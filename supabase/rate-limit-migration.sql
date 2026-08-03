-- Rate Limiting Infrastructure
-- Run this in Supabase SQL Editor AFTER the main migration.sql
--
-- Creates:
--   1. rate_limit_log  — sliding-window counters keyed by (function:user_id, window_ts)
--   2. increment_rate_limit — atomic upsert RPC used by Edge Function shared utility
--
-- Configuration lives in supabase/functions/_shared/rateLimit.ts.
-- Default limits (configurable per-caller):
--   initiate-verification   → 3 calls / 10 min  per user
--   create-connect-account  → 5 calls / 10 min  per user
--   partner-payout          → 10 calls / 60 min per user

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  key        TEXT    NOT NULL,
  window_ts  BIGINT  NOT NULL,   -- unix epoch / window_size_seconds
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_ts)
);

-- This table is only written by SECURITY DEFINER functions via the service
-- role key inside Edge Functions. SECURITY: RLS must be ENABLED with zero
-- policies — with RLS disabled, default PostgREST grants let any anon-key
-- holder read or delete rate-limit counters, neutering the limiter.
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_log FROM anon, authenticated;

-- Index for cleanup queries (delete stale windows)
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_window_ts
  ON public.rate_limit_log (window_ts);

-- ── Atomic increment RPC ───────────────────────────────────────────────────
-- Returns the NEW count after increment.
-- Uses INSERT ... ON CONFLICT DO UPDATE so the increment is atomic.
-- SECURITY DEFINER so Edge Functions calling via service role can execute it.
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key       TEXT,
  p_window_ts BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limit_log (key, window_ts, count)
  VALUES (p_key, p_window_ts, 1)
  ON CONFLICT (key, window_ts)
  DO UPDATE SET count = rate_limit_log.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;
