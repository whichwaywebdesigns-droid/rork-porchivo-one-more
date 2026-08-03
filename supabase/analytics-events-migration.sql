-- ============================================================
-- PORCHIVO · ANALYTICS EVENTS
-- ============================================================
-- Client funnel telemetry written by expo/lib/analytics.ts.
-- Previously this table was assumed to exist (hardened-rls.sql only adds
-- policies IF EXISTS, delete-account-procedure.sql deletes from it), but no
-- migration ever created it — on a fresh deploy client analytics silently
-- failed. This migration is the canonical definition.
--
-- Security model:
--   * INSERT-only for app clients. The funnel starts BEFORE signup
--     (intro/onboarding events), so anon inserts are allowed with
--     user_id forced to NULL-or-self.
--   * No SELECT/UPDATE/DELETE for clients — dashboards read via
--     service_role / SQL editor only.
--   * CHECK constraints cap field sizes so the anon insert path cannot
--     be used to store arbitrary blobs.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT NOT NULL CHECK (char_length(event) BETWEEN 1 AND 64),
  props       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 4096),
  session_id  TEXT NOT NULL CHECK (char_length(session_id) BETWEEN 1 AND 64),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform    TEXT CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Clients may insert; a user may only attribute events to themselves (or no one).
CREATE POLICY "analytics_events_client_insert"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Explicit grants: INSERT only. Reads are service_role/dashboard territory.
REVOKE ALL ON public.analytics_events FROM anon, authenticated;
GRANT INSERT ON public.analytics_events TO anon, authenticated;

-- Funnel queries group by event over time; retention queries join on session/user.
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_time
  ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON public.analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON public.analytics_events (user_id)
  WHERE user_id IS NOT NULL;
