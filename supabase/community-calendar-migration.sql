-- ─── Community Calendar ────────────────────────────────────────────────────────
-- Phase 12: HOA meetings, maintenance windows, amenity scheduling
-- Additive — no changes to existing tables.
-- Run this in your Supabase SQL editor.

-- ─── Event category enum ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_event_category AS ENUM (
    'meeting',
    'maintenance',
    'amenity',
    'social',
    'deadline',
    'inspection',
    'emergency',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Event status enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_event_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── RSVP status enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_rsvp_status AS ENUM (
    'going',
    'maybe',
    'not_going'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Community calendar events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_calendar_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  category            calendar_event_category NOT NULL DEFAULT 'other',
  status              calendar_event_status NOT NULL DEFAULT 'scheduled',
  location            TEXT,
  -- Timing
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ,
  all_day             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Recurrence (simple weekly/monthly)
  is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule     TEXT,                     -- 'weekly', 'monthly', 'yearly'
  recurrence_end_date DATE,
  -- Visibility & notify
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,   -- false = staff/board only
  notify_residents    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Capacity for amenity bookings
  max_attendees       INT,
  -- Linked announcement (optional)
  linked_announcement_id UUID REFERENCES org_announcements(id) ON DELETE SET NULL,
  -- Soft delete
  is_cancelled        BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_reason    TEXT,
  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cce_org_starts ON community_calendar_events(org_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cce_org_category ON community_calendar_events(org_id, category);
CREATE INDEX IF NOT EXISTS idx_cce_org_status ON community_calendar_events(org_id, status);

-- ─── RSVPs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_rsvps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES community_calendar_events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status      calendar_rsvp_status NOT NULL DEFAULT 'going',
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cersvp_event ON calendar_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_cersvp_user ON calendar_event_rsvps(user_id, org_id);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_calendar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cce_updated_at ON community_calendar_events;
CREATE TRIGGER trg_cce_updated_at
  BEFORE UPDATE ON community_calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_calendar_updated_at();

DROP TRIGGER IF EXISTS trg_cersvp_updated_at ON calendar_event_rsvps;
CREATE TRIGGER trg_cersvp_updated_at
  BEFORE UPDATE ON calendar_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION set_calendar_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE community_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_rsvps ENABLE ROW LEVEL SECURITY;

-- Active org members can view public events for their org
CREATE POLICY "Members can view public calendar events"
  ON community_calendar_events FOR SELECT
  USING (
    is_public = TRUE AND
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Staff/board can view all events (including staff-only)
CREATE POLICY "Staff can view all calendar events"
  ON community_calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('hoa_admin', 'property_manager', 'property_staff', 'board_member', 'super_admin')
    )
  );

-- Only staff/admin can create events
CREATE POLICY "Staff can create calendar events"
  ON community_calendar_events FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('hoa_admin', 'property_manager', 'property_staff', 'board_member', 'super_admin')
    )
  );

-- Creator or admin can update
CREATE POLICY "Creator or admin can update calendar events"
  ON community_calendar_events FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = community_calendar_events.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('hoa_admin', 'super_admin')
    )
  );

-- RSVP policies
CREATE POLICY "Members can view event RSVPs"
  ON calendar_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = calendar_event_rsvps.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Members can upsert their own RSVP"
  ON calendar_event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can update their own RSVP"
  ON calendar_event_rsvps FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Members can delete their own RSVP"
  ON calendar_event_rsvps FOR DELETE
  USING (user_id = auth.uid());

-- ─── RPCs ──────────────────────────────────────────────────────────────────────

-- List events in a date range (with RSVP counts)
CREATE OR REPLACE FUNCTION get_org_calendar_events(
  p_org_id     UUID,
  p_from       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 month',
  p_to         TIMESTAMPTZ DEFAULT NOW() + INTERVAL '3 months',
  p_category   TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  org_id                UUID,
  created_by            UUID,
  creator_name          TEXT,
  title                 TEXT,
  description           TEXT,
  category              TEXT,
  status                TEXT,
  location              TEXT,
  starts_at             TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  all_day               BOOLEAN,
  is_recurring          BOOLEAN,
  recurrence_rule       TEXT,
  recurrence_end_date   DATE,
  is_public             BOOLEAN,
  notify_residents      BOOLEAN,
  max_attendees         INT,
  is_cancelled          BOOLEAN,
  cancelled_reason      TEXT,
  rsvp_going            BIGINT,
  rsvp_maybe            BIGINT,
  my_rsvp               TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE sql AS $$
  SELECT
    e.id,
    e.org_id,
    e.created_by,
    COALESCE(p.name, 'Staff') AS creator_name,
    e.title,
    e.description,
    e.category::TEXT,
    e.status::TEXT,
    e.location,
    e.starts_at,
    e.ends_at,
    e.all_day,
    e.is_recurring,
    e.recurrence_rule,
    e.recurrence_end_date,
    e.is_public,
    e.notify_residents,
    e.max_attendees,
    e.is_cancelled,
    e.cancelled_reason,
    COUNT(r.id) FILTER (WHERE r.status = 'going')  AS rsvp_going,
    COUNT(r.id) FILTER (WHERE r.status = 'maybe') AS rsvp_maybe,
    (SELECT status::TEXT FROM calendar_event_rsvps WHERE event_id = e.id AND user_id = auth.uid() LIMIT 1) AS my_rsvp,
    e.created_at,
    e.updated_at
  FROM community_calendar_events e
  LEFT JOIN profiles p ON p.id = e.created_by
  LEFT JOIN calendar_event_rsvps r ON r.event_id = e.id
  WHERE
    e.org_id = p_org_id
    AND e.is_cancelled = FALSE
    AND e.starts_at >= p_from
    AND e.starts_at <= p_to
    AND (p_category IS NULL OR e.category::TEXT = p_category)
    AND (
      e.is_public = TRUE
      OR EXISTS (
        SELECT 1 FROM org_memberships om
        WHERE om.org_id = e.org_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
          AND om.role IN ('hoa_admin','property_manager','property_staff','board_member','super_admin')
      )
    )
  GROUP BY e.id, p.name
  ORDER BY e.starts_at ASC;
$$;

-- Create a calendar event
CREATE OR REPLACE FUNCTION create_org_calendar_event(
  p_org_id              UUID,
  p_title               TEXT,
  p_description         TEXT DEFAULT NULL,
  p_category            TEXT DEFAULT 'other',
  p_location            TEXT DEFAULT NULL,
  p_starts_at           TIMESTAMPTZ DEFAULT NOW(),
  p_ends_at             TIMESTAMPTZ DEFAULT NULL,
  p_all_day             BOOLEAN DEFAULT FALSE,
  p_is_recurring        BOOLEAN DEFAULT FALSE,
  p_recurrence_rule     TEXT DEFAULT NULL,
  p_recurrence_end_date DATE DEFAULT NULL,
  p_is_public           BOOLEAN DEFAULT TRUE,
  p_notify_residents    BOOLEAN DEFAULT FALSE,
  p_max_attendees       INT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
  v_role     TEXT;
BEGIN
  SELECT role INTO v_role FROM org_memberships
  WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active';

  IF v_role NOT IN ('hoa_admin','property_manager','property_staff','board_member','super_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to create calendar events';
  END IF;

  INSERT INTO community_calendar_events (
    org_id, created_by, title, description, category, location,
    starts_at, ends_at, all_day, is_recurring, recurrence_rule,
    recurrence_end_date, is_public, notify_residents, max_attendees
  ) VALUES (
    p_org_id, auth.uid(), p_title, p_description, p_category::calendar_event_category,
    p_location, p_starts_at, p_ends_at, p_all_day, p_is_recurring,
    p_recurrence_rule, p_recurrence_end_date, p_is_public, p_notify_residents, p_max_attendees
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Cancel an event
CREATE OR REPLACE FUNCTION cancel_org_calendar_event(
  p_event_id UUID,
  p_org_id   UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT om.role INTO v_role FROM org_memberships om
  WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active';

  IF v_role NOT IN ('hoa_admin','property_manager','property_staff','board_member','super_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE community_calendar_events
  SET is_cancelled = TRUE, cancelled_reason = p_reason, status = 'cancelled'
  WHERE id = p_event_id AND org_id = p_org_id;
END;
$$;

-- Upsert RSVP
CREATE OR REPLACE FUNCTION upsert_event_rsvp(
  p_event_id  UUID,
  p_org_id    UUID,
  p_status    TEXT DEFAULT 'going'
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO calendar_event_rsvps (event_id, user_id, org_id, status)
  VALUES (p_event_id, auth.uid(), p_org_id, p_status::calendar_rsvp_status)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = p_status::calendar_rsvp_status, updated_at = NOW();
END;
$$;

-- Upcoming events summary (for admin dashboard widget)
CREATE OR REPLACE FUNCTION get_org_upcoming_events(
  p_org_id UUID,
  p_limit  INT DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  category   TEXT,
  starts_at  TIMESTAMPTZ,
  location   TEXT,
  is_public  BOOLEAN
)
SECURITY DEFINER
LANGUAGE sql AS $$
  SELECT id, title, category::TEXT, starts_at, location, is_public
  FROM community_calendar_events
  WHERE org_id = p_org_id
    AND is_cancelled = FALSE
    AND starts_at >= NOW()
  ORDER BY starts_at ASC
  LIMIT p_limit;
$$;
