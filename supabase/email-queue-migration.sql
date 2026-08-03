-- ============================================================
-- PORCHIVO: Resend Email Queue + Retry Infrastructure
-- Run this in Supabase SQL Editor AFTER migration.sql.
-- ============================================================
-- Durable, retrying transactional-email queue backed by Resend.
--
-- Why a queue (not a direct API call):
--   • Resend's free tier caps at 100 emails/day. The `send-email` Edge
--     Function honours DAILY_EMAIL_CAP and simply leaves the rest queued —
--     they drain automatically the next day instead of being dropped.
--   • Transient failures (network blips, 5xx, 429) are retried with
--     exponential backoff instead of being lost.
--
-- Pieces:
--   1. email_queue            — durable job table (pending/processing/sent/failed)
--   2. enqueue_email          — insert a job (called by triggers / Edge Functions)
--   3. claim_email_batch       — atomically lease a batch of due jobs (SKIP LOCKED)
--   4. mark_email_sent         — finalise a delivered job
--   5. mark_email_failed       — increment attempts + schedule retry / give up
--   6. email_sent_today        — count of jobs sent since local midnight (cap guard)
--   7. reap_stale_email_jobs   — recover jobs stuck in 'processing' after a crash
--
-- All functions are SECURITY DEFINER and locked to the service role — they
-- are only ever invoked from the `send-email` Edge Function (service key).
-- ============================================================

-- ── Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient           TEXT NOT NULL,
  subject             TEXT NOT NULL,
  html_body           TEXT,
  text_body           TEXT,
  template            TEXT,                       -- optional logical template name
  reply_to            TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  max_attempts        INTEGER NOT NULL DEFAULT 5,
  next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error          TEXT,
  provider_message_id TEXT,                       -- Resend message id once sent
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at             TIMESTAMPTZ
);

-- Service-role only: written exclusively by SECURITY DEFINER funcs / Edge Function.
-- SECURITY: RLS must be ENABLED with zero policies (service_role bypasses RLS).
-- With RLS disabled, Supabase's default PostgREST grants would expose recipient
-- emails and full email bodies to any anon-key holder. Belt-and-suspenders:
-- also revoke the default table grants from client roles.
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_queue FROM anon, authenticated;

-- Claim queries filter on (status, next_attempt_at); this index keeps them fast.
CREATE INDEX IF NOT EXISTS idx_email_queue_due
  ON public.email_queue (status, next_attempt_at);

-- Daily-cap count filters on (status, sent_at).
CREATE INDEX IF NOT EXISTS idx_email_queue_sent_at
  ON public.email_queue (sent_at)
  WHERE status = 'sent';

-- ── 1. Enqueue ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_email(
  p_recipient    TEXT,
  p_subject      TEXT,
  p_html         TEXT DEFAULT NULL,
  p_text         TEXT DEFAULT NULL,
  p_template     TEXT DEFAULT NULL,
  p_reply_to     TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'::jsonb,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_recipient IS NULL OR position('@' IN p_recipient) = 0 THEN
    RAISE EXCEPTION 'enqueue_email: invalid recipient %', p_recipient;
  END IF;
  IF p_html IS NULL AND p_text IS NULL THEN
    RAISE EXCEPTION 'enqueue_email: at least one of html/text body is required';
  END IF;

  INSERT INTO public.email_queue (
    recipient, subject, html_body, text_body, template, reply_to, metadata, max_attempts
  )
  VALUES (
    lower(trim(p_recipient)), p_subject, p_html, p_text, p_template, p_reply_to,
    COALESCE(p_metadata, '{}'::jsonb), GREATEST(1, COALESCE(p_max_attempts, 5))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 2. Claim a batch (atomic lease) ─────────────────────────────────────────
-- Marks up to p_limit due 'pending' jobs as 'processing' and returns them.
-- FOR UPDATE SKIP LOCKED makes it safe under concurrent processors.
CREATE OR REPLACE FUNCTION public.claim_email_batch(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_queue q
  SET status = 'processing', updated_at = now()
  WHERE q.id IN (
    SELECT e.id
    FROM public.email_queue e
    WHERE e.status = 'pending'
      AND e.next_attempt_at <= now()
    ORDER BY e.next_attempt_at ASC
    LIMIT GREATEST(1, p_limit)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

-- ── 3. Mark sent ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_email_sent(
  p_id                  UUID,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_queue
  SET status = 'sent',
      provider_message_id = p_provider_message_id,
      last_error = NULL,
      sent_at = now(),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

-- ── 4. Mark failed (retry w/ exponential backoff, or give up) ───────────────
-- p_retry_in_seconds overrides the computed backoff (used for 429 / cap cases).
CREATE OR REPLACE FUNCTION public.mark_email_failed(
  p_id              UUID,
  p_error           TEXT,
  p_retry_in_seconds INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_max      INTEGER;
  v_delay    INTEGER;
  v_force_retry BOOLEAN := p_retry_in_seconds IS NOT NULL;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM public.email_queue
  WHERE id = p_id;

  IF v_attempts IS NULL THEN
    RETURN; -- row gone
  END IF;

  -- A forced retry (e.g. provider rate limit / daily cap) does NOT consume an
  -- attempt — it isn't the message's fault. Real failures increment attempts.
  IF NOT v_force_retry THEN
    v_attempts := v_attempts + 1;
  END IF;

  IF NOT v_force_retry AND v_attempts >= COALESCE(v_max, 5) THEN
    UPDATE public.email_queue
    SET status = 'failed',
        attempts = v_attempts,
        last_error = left(p_error, 2000),
        updated_at = now()
    WHERE id = p_id;
  ELSE
    -- Exponential backoff: 2^attempts minutes, capped at 6 hours.
    v_delay := COALESCE(
      p_retry_in_seconds,
      LEAST((power(2, GREATEST(1, v_attempts))::INTEGER) * 60, 21600)
    );
    UPDATE public.email_queue
    SET status = 'pending',
        attempts = v_attempts,
        last_error = left(p_error, 2000),
        next_attempt_at = now() + make_interval(secs => v_delay),
        updated_at = now()
    WHERE id = p_id;
  END IF;
END;
$$;

-- ── 5. Daily cap guard ───────────────────────────────────────────────────────
-- Count of emails actually sent since local midnight. The Edge Function uses
-- this to stay under the Resend free-tier cap.
CREATE OR REPLACE FUNCTION public.email_sent_today()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.email_queue
  WHERE status = 'sent'
    AND sent_at >= date_trunc('day', now());
$$;

-- ── 6. Reaper for crashed processors ────────────────────────────────────────
-- Jobs leased into 'processing' that never finished (function crash / timeout)
-- are returned to 'pending' after 10 minutes so they get retried.
CREATE OR REPLACE FUNCTION public.reap_stale_email_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.email_queue
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '10 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Permissions: server-role only, never clients ────────────────────────────
REVOKE ALL ON FUNCTION public.enqueue_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_email_batch(INTEGER)                                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_email_sent(UUID, TEXT)                                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_email_failed(UUID, TEXT, INTEGER)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_sent_today()                                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reap_stale_email_jobs()                                          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_batch(INTEGER)                                        TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_sent(UUID, TEXT)                                       TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_failed(UUID, TEXT, INTEGER)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.email_sent_today()                                                TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_stale_email_jobs()                                           TO service_role;

-- ── Optional: schedule the drainer with pg_cron ─────────────────────────────
-- The `send-email` Edge Function processes the queue. To drain it automatically
-- every minute, enable pg_cron (Database → Extensions → pg_cron) and uncomment:
--
--   select cron.schedule(
--     'drain-email-queue',
--     '* * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://<your-ref>.supabase.co/functions/v1/send-email',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'x-email-secret', '<EMAIL_FN_SECRET>'
--         ),
--         body    := jsonb_build_object('action', 'process')
--       );
--     $$
--   );
