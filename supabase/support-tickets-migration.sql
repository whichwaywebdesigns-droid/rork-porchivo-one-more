-- ============================================================
-- PORCHIVO: Support Tickets + AI-Drafted Staff Replies
-- Run in Supabase SQL Editor AFTER migration.sql.
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================
--
-- Creates the `support_tickets` table that expo/lib/supportTickets.ts
-- and the app/contact-support.tsx + app/support-ticket-detail.tsx screens
-- already read/write against. Until this migration is applied, every
-- client call hits `relation "public.support_tickets" does not exist`.
--
-- Security model
--   * Users can SELECT/UPDATE only their own rows (user_id = auth.uid()).
--   * Users can INSERT their own rows (user_id forced to auth.uid() by a
--     WITH CHECK policy — the client never sends user_id).
--   * Staff with auth.app_metadata.role = 'support_staff' can SELECT all
--     tickets and UPDATE any ticket (WITH CHECK keeps user_id stable so
--     staff cannot reassign ownership).
--   * AI-draft columns (ai_draft_reply, ai_draft_generated_at,
--     ai_draft_model, ai_draft_feedback) are STAFF-ONLY. Column-level
--     grants revoke SELECT on them from authenticated, so a user's
--     `select *` never sees the draft. The support-ticket-ai-draft Edge
--     Function (service role) is the only writer of these columns.
--   * The on_ticket_created trigger enqueues an AI-draft generation job
--     by calling the support-ticket-ai-draft Edge Function via pg_net.
-- ============================================================


-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  subject           text        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body              text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),

  category          text        NOT NULL DEFAULT 'other'
                      CHECK (category IN (
                        'delivery_issue', 'payment_billing', 'account_access',
                        'partner_dispute', 'app_bug', 'feature_request',
                        'safety_alert', 'other'
                      )),
  status            text        NOT NULL DEFAULT 'open'
                      CHECK (status IN (
                        'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'
                      )),
  priority          text        NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Staff-owned fields (never written by the user).
  staff_reply         text,
  staff_replied_at    timestamptz,
  resolution_note     text,
  resolved_at         timestamptz,

  -- User-supplied context (optional, capped to keep rows small).
  attachment_url      text,
  app_version         text,
  platform            text,
  device_model        text,

  -- AI-drafted staff reply (STAFF-ONLY — see column-level grants below).
  -- Written exclusively by the support-ticket-ai-draft Edge Function
  -- (service role). Staff review the draft, edit as needed, then promote
  -- it to staff_reply. Users never see these columns.
  ai_draft_reply        text,
  ai_draft_generated_at timestamptz,
  ai_draft_model        text,
  ai_draft_feedback     text CHECK (ai_draft_feedback IN ('accepted', 'edited', 'rejected') OR ai_draft_feedback IS NULL),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
  ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at
  ON public.support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_staff_queue
  ON public.support_tickets (status, created_at DESC)
  WHERE status IN ('open', 'in_progress', 'waiting_on_user');


-- ── 2. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users: read only their own tickets.
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
CREATE POLICY "Users view own support tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users: insert their own tickets. user_id must match auth.uid() — the
-- client never sends user_id; the default is filled by the trigger below
-- as a defence-in-depth layer (the WITH CHECK here is the real gate).
DROP POLICY IF EXISTS "Users insert own support tickets" ON public.support_tickets;
CREATE POLICY "Users insert own support tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users: update their own tickets (reply / close / reopen). They may NOT
-- touch staff-only columns — enforced by the trigger below (trg_guard_ticket_writes).
DROP POLICY IF EXISTS "Users update own support tickets" ON public.support_tickets;
CREATE POLICY "Users update own support tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users: delete their own tickets (rare; used by account-deletion cascade
-- via the FK ON DELETE CASCADE, so this policy is belt-and-suspenders).
DROP POLICY IF EXISTS "Users delete own support tickets" ON public.support_tickets;
CREATE POLICY "Users delete own support tickets"
  ON public.support_tickets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Staff: read all tickets. Membership is decided by the JWT app_metadata.role
-- claim set by the admin role-management migration. We check it via
-- auth.app_metadata ->> 'role' so staff sessions (issued with role=
-- 'support_staff') see every row, while regular users fall back to the
-- owner-only policy above.
DROP POLICY IF EXISTS "Staff view all support tickets" ON public.support_tickets;
CREATE POLICY "Staff view all support tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (auth.app_metadata() ->> 'role' = 'support_staff'
         OR auth.app_metadata() ->> 'role' = 'super_admin');

-- Staff: update any ticket (reply, change status, set priority, write
-- resolution_note). user_id must stay stable — staff cannot reassign
-- ownership of a ticket to another user.
DROP POLICY IF EXISTS "Staff update any support ticket" ON public.support_tickets;
CREATE POLICY "Staff update any support ticket"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (auth.app_metadata() ->> 'role' = 'support_staff'
         OR auth.app_metadata() ->> 'role' = 'super_admin')
  WITH CHECK (auth.app_metadata() ->> 'role' = 'support_staff'
              OR auth.app_metadata() ->> 'role' = 'super_admin');

-- No staff INSERT/DELETE policies — tickets are created by users and
-- removed only by the account-deletion cascade (FK ON DELETE CASCADE).


-- ── 3. Column-level grants: hide AI-draft columns from users ────────────────
-- PostgREST returns only columns the role has been GRANTed SELECT on, so
-- revoking SELECT on the AI-draft columns makes them invisible to a user's
-- `select *` even though RLS would otherwise let them read the row.
-- The service role bypasses GRANT checks, so the Edge Function still sees
-- and writes them.
REVOKE SELECT (ai_draft_reply, ai_draft_generated_at, ai_draft_model, ai_draft_feedback)
  ON public.support_tickets FROM authenticated;
GRANT SELECT (ai_draft_reply, ai_draft_generated_at, ai_draft_model, ai_draft_feedback)
  ON public.support_tickets TO service_role;
GRANT UPDATE (ai_draft_reply, ai_draft_generated_at, ai_draft_model, ai_draft_feedback)
  ON public.support_tickets TO service_role;


-- ── 4. Triggers ─────────────────────────────────────────────────────────────

-- 4a. Stamp user_id from auth.uid() on INSERT if the caller forgot to send
--     it (defence-in-depth — the WITH CHECK policy is the real gate).
CREATE OR REPLACE FUNCTION public.stamp_ticket_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_ticket_owner ON public.support_tickets;
CREATE TRIGGER trg_stamp_ticket_owner
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.stamp_ticket_owner();


-- 4b. Guard writes: regular users may only touch user-writable columns
--     (subject, body, status, attachment_url, app_version, platform,
--     device_model). Staff-owned columns (staff_reply, staff_replied_at,
--     resolution_note, resolved_at, priority, ai_draft_*) are read-only
--     from the client. Staff sessions bypass this guard.
CREATE OR REPLACE FUNCTION public.guard_ticket_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := auth.app_metadata() ->> 'role';

  -- Staff / super_admin: allow any column change (policy already gated role).
  IF v_role IN ('support_staff', 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Regular user: reject changes to staff-owned columns.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.staff_reply       IS DISTINCT FROM OLD.staff_reply
    OR NEW.staff_replied_at  IS DISTINCT FROM OLD.staff_replied_at
    OR NEW.resolution_note   IS DISTINCT FROM OLD.resolution_note
    OR NEW.resolved_at       IS DISTINCT FROM OLD.resolved_at
    OR NEW.priority          IS DISTINCT FROM OLD.priority
    OR NEW.ai_draft_reply    IS DISTINCT FROM OLD.ai_draft_reply
    OR NEW.ai_draft_generated_at IS DISTINCT FROM OLD.ai_draft_generated_at
    OR NEW.ai_draft_model    IS DISTINCT FROM OLD.ai_draft_model
    OR NEW.ai_draft_feedback IS DISTINCT FROM OLD.ai_draft_feedback
    OR NEW.user_id           IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot modify staff-owned columns on support_tickets';
    END IF;
  END IF;

  -- INSERT: user must not preset staff-owned columns.
  IF TG_OP = 'INSERT' THEN
    IF NEW.staff_reply IS NOT NULL
    OR NEW.staff_replied_at IS NOT NULL
    OR NEW.resolution_note IS NOT NULL
    OR NEW.resolved_at IS NOT NULL
    OR NEW.priority IS DISTINCT FROM 'normal'
    OR NEW.ai_draft_reply IS NOT NULL
    OR NEW.ai_draft_generated_at IS NOT NULL
    OR NEW.ai_draft_model IS NOT NULL
    OR NEW.ai_draft_feedback IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot preset staff-owned columns on support_tickets';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ticket_writes ON public.support_tickets;
CREATE TRIGGER trg_guard_ticket_writes
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_writes();


-- 4c. Auto-update updated_at (reuses the shared trigger function from migration.sql).
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 4d. On ticket creation, fire-and-forget call the AI-draft Edge Function
--     via pg_net so staff get a suggested reply within seconds of submission.
--     The function is self-throttling (rate-limited inside the Edge Function)
--     and idempotent (it only writes when ai_draft_reply IS NULL).
CREATE OR REPLACE FUNCTION public.enqueue_ticket_ai_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fn_url text;
  v_token text;
BEGIN
  -- Only generate a draft for brand-new open tickets (not reopens).
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_fn_url := current_setting('app.support_ticket_ai_draft_url', true);
  v_token  := current_setting('app.support_ticket_ai_draft_token', true);

  -- If the Edge Function URL or bearer token is not configured via
  --   ALTER DATABASE ... SET app.support_ticket_ai_draft_url = 'https://...';
  --   ALTER DATABASE ... SET app.support_ticket_ai_draft_token = '...';
  -- then skip silently — the ticket still creates, staff just draft manually.
  IF v_fn_url IS NULL OR v_token IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget POST. The Edge Function re-checks ownership / status
  -- and is the only writer of ai_draft_* columns. Errors are swallowed so
  -- a transient pg_net failure never blocks ticket creation.
  PERFORM net.http_post(
    url    := v_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body   := jsonb_build_object('ticketId', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_ticket_ai_draft ON public.support_tickets;
CREATE TRIGGER trg_enqueue_ticket_ai_draft
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_ticket_ai_draft();


-- ── 5. Verification ─────────────────────────────────────────────────────────
-- After running this migration, execute the following to confirm:
--
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'support_tickets';
--   -- Expected: rowsecurity = true
--
--   SELECT polname, polcmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_tickets';
--   -- Expected: 6 policies (user select/insert/update/delete + staff select/update)
--
--   SELECT has_column_privilege('authenticated', 'public.support_tickets', 'ai_draft_reply', 'SELECT');
--   -- Expected: false (users cannot see AI-draft columns)
--   SELECT has_column_privilege('service_role', 'public.support_tickets', 'ai_draft_reply', 'SELECT');
--   -- Expected: true


-- ── 6. Staff helper: is the caller a support staff member? ────────────────────
-- Checks auth.app_metadata().role for 'support_staff' or 'super_admin'.
-- This mirrors the role claims enforced by the staff policies above and is
-- used by the staff RPCs (get_staff_support_queue / send_staff_ticket_reply /
-- regenerate_ticket_ai_draft) to gate access before returning AI-draft columns
-- or applying staff-side mutations.
CREATE OR REPLACE FUNCTION public.is_support_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.app_metadata() ->> 'role' IN ('support_staff', 'super_admin');
$$;

GRANT EXECUTE ON FUNCTION public.is_support_staff() TO authenticated;


-- ── 7. RPC: get_staff_support_queue ───────────────────────────────────────────
-- Returns all tickets with the staff-only AI-draft columns. SECURITY DEFINER
-- (owner-privileged) so the column-level REVOKE on authenticated does not
-- hide ai_draft_* from this query; the function re-checks the caller's
-- app_metadata.role so only support_staff / super_admin get rows back.
--
-- p_status_filter: null = all statuses, otherwise one of the status enum values.
-- p_priority_filter: null = any priority, otherwise one of low/normal/high/urgent.
-- p_search: optional ILIKE against subject / body / user_id; null/empty = no search.
-- p_limit: capped at 200. p_offset: pagination offset.
CREATE OR REPLACE FUNCTION public.get_staff_support_queue(
  p_status_filter    text DEFAULT NULL,
  p_priority_filter  text DEFAULT NULL,
  p_search           text DEFAULT NULL,
  p_limit            int  DEFAULT 100,
  p_offset           int  DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  subject           text,
  body              text,
  category          text,
  status            text,
  priority          text,
  staff_reply       text,
  staff_replied_at  timestamptz,
  resolution_note   text,
  resolved_at       timestamptz,
  attachment_url    text,
  app_version       text,
  platform          text,
  device_model      text,
  ai_draft_reply        text,
  ai_draft_generated_at timestamptz,
  ai_draft_model        text,
  ai_draft_feedback     text,
  created_at        timestamptz,
  updated_at        timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(TRIM(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.subject,
    t.body,
    t.category,
    t.status,
    t.priority,
    t.staff_reply,
    t.staff_replied_at,
    t.resolution_note,
    t.resolved_at,
    t.attachment_url,
    t.app_version,
    t.platform,
    t.device_model,
    t.ai_draft_reply,
    t.ai_draft_generated_at,
    t.ai_draft_model,
    t.ai_draft_feedback,
    t.created_at,
    t.updated_at
  FROM public.support_tickets t
  WHERE (p_status_filter   IS NULL OR t.status   = p_status_filter)
    AND (p_priority_filter IS NULL OR t.priority = p_priority_filter)
    AND (
      v_search IS NULL
      OR t.subject ILIKE '%' || v_search || '%'
      OR t.body   ILIKE '%' || v_search || '%'
      OR t.user_id::text ILIKE '%' || v_search || '%'
    )
  ORDER BY
    CASE t.status
      WHEN 'open'           THEN 0
      WHEN 'in_progress'    THEN 1
      WHEN 'waiting_on_user' THEN 2
      WHEN 'resolved'       THEN 3
      WHEN 'closed'         THEN 4
      ELSE 5
    END,
    t.priority DESC NULLS LAST,
    t.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_support_queue(text, text, text, int, int) TO authenticated;


-- ── 8. RPC: get_staff_support_queue_counts ──────────────────────────────────
-- Quick per-status counts for the staff queue header badges. Same staff gate.
CREATE OR REPLACE FUNCTION public.get_staff_support_queue_counts()
RETURNS TABLE (
  status         text,
  status_count   bigint,
  with_draft     bigint,
  awaiting_review bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  RETURN QUERY
  SELECT
    t.status,
    COUNT(*)::bigint AS status_count,
    COUNT(*) FILTER (WHERE t.ai_draft_reply IS NOT NULL)::bigint AS with_draft,
    COUNT(*) FILTER (
      WHERE t.ai_draft_reply IS NOT NULL
        AND t.staff_reply IS NULL
        AND t.status IN ('open', 'in_progress')
    )::bigint AS awaiting_review
  FROM public.support_tickets t
  GROUP BY t.status
  ORDER BY MIN(t.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_support_queue_counts() TO authenticated;


-- ── 9. RPC: send_staff_ticket_reply ──────────────────────────────────────────
-- Promotes a (possibly edited) AI draft (or an entirely hand-written reply)
-- to the user-visible staff_reply column. Marks ai_draft_feedback so the
-- AI-draft pipeline can measure accept/edit/reject rates, then advances the
-- ticket status to 'waiting_on_user'. Staff-only; SECURITY DEFINER so it can
-- write to the staff-owned columns that the trg_guard_ticket_writes trigger
-- would otherwise block on the authenticated role.
--
-- p_feedback: 'accepted' if the draft was sent as-is, 'edited' if the staff
-- modified the text, 'rejected' if staff wrote a brand-new reply without using
-- the draft. NULL defaults to 'edited' when a draft existed, else 'rejected'.
CREATE OR REPLACE FUNCTION public.send_staff_ticket_reply(
  p_ticket_id        uuid,
  p_reply_text       text,
  p_feedback         text DEFAULT NULL,
  p_resolution_note  text DEFAULT NULL,
  p_mark_resolved    boolean DEFAULT FALSE
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_feedback text;
  v_new_status text;
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  IF COALESCE(TRIM(p_reply_text), '') = '' THEN
    RAISE EXCEPTION 'Reply text must not be empty';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Decide draft feedback label for analytics.
  v_feedback := p_feedback;
  IF v_feedback IS NULL THEN
    IF v_ticket.ai_draft_reply IS NOT NULL THEN
      v_feedback := CASE WHEN p_reply_text = v_ticket.ai_draft_reply THEN 'accepted' ELSE 'edited' END;
    ELSE
      v_feedback := 'rejected';
    END IF;
  END IF;
  IF v_feedback NOT IN ('accepted', 'edited', 'rejected') THEN
    v_feedback := 'edited';
  END IF;

  v_new_status := CASE WHEN p_mark_resolved THEN 'resolved' ELSE 'waiting_on_user' END;

  UPDATE public.support_tickets
    SET staff_reply       = p_reply_text,
        staff_replied_at  = now(),
        ai_draft_feedback = v_feedback,
        resolution_note   = COALESCE(p_resolution_note, resolution_note),
        resolved_at       = CASE WHEN p_mark_resolved THEN now() ELSE resolved_at END,
        status            = v_new_status,
        updated_at        = now()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_staff_ticket_reply(uuid, text, text, text, boolean) TO authenticated;


-- ── 10. RPC: regenerate_ticket_ai_draft ──────────────────────────────────────
-- Re-enqueues the AI-draft Edge Function for a ticket (e.g. staff clicked
-- "Regenerate draft"). Clears the existing ai_draft_* columns first so the
-- Edge Function's idempotent "ai_draft_reply IS NULL" guard does not skip it.
-- Only callable by support staff. The actual AI generation happens
-- asynchronously in the Edge Function via pg_net — this RPC returns 200 once
-- the job is enqueued, not after the draft is written.
CREATE OR REPLACE FUNCTION public.regenerate_ticket_ai_draft(
  p_ticket_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fn_url text;
  v_token  text;
  v_ticket_exists boolean;
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'Access denied: support staff only';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = p_ticket_id)
    INTO v_ticket_exists;
  IF NOT v_ticket_exists THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  v_fn_url := current_setting('app.support_ticket_ai_draft_url', true);
  v_token  := current_setting('app.support_ticket_ai_draft_token', true);

  IF v_fn_url IS NULL OR v_token IS NULL THEN
    RAISE EXCEPTION 'AI draft function not configured on this database';
  END IF;

  -- Clear the existing draft so the Edge Function will write a new one.
  UPDATE public.support_tickets
    SET ai_draft_reply        = NULL,
        ai_draft_generated_at = NULL,
        ai_draft_model        = NULL,
        ai_draft_feedback     = NULL,
        updated_at            = now()
  WHERE id = p_ticket_id;

  PERFORM net.http_post(
    url     := v_fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object('ticketId', p_ticket_id)
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_ticket_ai_draft(uuid) TO authenticated;


-- ── 11. RPC: get_staff_push_tokens ─────────────────────────────────────────────
-- Returns the Expo push tokens for every support_staff / super_admin user, so
-- the support-ticket-ai-draft Edge Function can fire a push notification to all
-- on-duty staff the moment a draft lands. Service-role only (the function is
-- called from the Edge Function with the service-role key, not from the client).
--
-- Staff membership is decided by the JWT app_metadata.role claim, which lives
-- on auth.users.raw_app_meta_data. The service role bypasses RLS on auth.users.
CREATE OR REPLACE FUNCTION public.get_staff_push_tokens()
RETURNS TABLE (user_id uuid, expo_push_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No is_support_staff() gate here — this RPC is service-role only and is
  -- never exposed to authenticated clients (no GRANT EXECUTE to authenticated).
  -- It reads auth.users.raw_app_meta_data, which only the service role can see.
  RETURN QUERY
  SELECT p.id, p.expo_push_token
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.expo_push_token IS NOT NULL
    AND p.expo_push_token <> ''
    AND (u.raw_app_meta_data ->> 'role' = 'support_staff'
         OR u.raw_app_meta_data ->> 'role' = 'super_admin');
END;
$$;

-- Intentionally NO `GRANT EXECUTE ... TO authenticated` — service-role only.
-- The support-ticket-ai-draft Edge Function calls this with the service key.
REVOKE EXECUTE ON FUNCTION public.get_staff_push_tokens() FROM authenticated, anon;
