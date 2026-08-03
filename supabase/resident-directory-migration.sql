-- =============================================================
-- resident-directory-migration.sql
-- Phase 2: Resident Directory
--
-- Adds:
--   get_org_directory(p_org_id)  — role-aware member list RPC
--   get_org_member_count(p_org_id) — lightweight count RPC
--
-- Security model:
--   • Caller must be an active member of the org
--   • email/phone only returned when caller has a staff/admin role
--   • SECURITY DEFINER ensures profiles are readable across RLS boundary
--     but only for same-org members; zero cross-tenant leakage.
--
-- Run after multi-context-migration.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Supporting index (if not already present)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_status
  ON public.org_memberships(org_id, status);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org
  ON public.org_memberships(user_id, org_id);

-- ─────────────────────────────────────────────────────────────
-- 1. get_org_directory
--    Returns active members of an org.
--    email + phone are redacted unless the calling user is staff.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_directory(p_org_id UUID)
RETURNS TABLE (
  membership_id   UUID,
  user_id         UUID,
  display_name    TEXT,
  avatar_url      TEXT,
  unit_number     TEXT,
  role            TEXT,
  joined_at       TIMESTAMPTZ,
  -- Staff-only fields; NULL for residents/board members
  email           TEXT,
  phone           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_caller_status TEXT;
  v_is_staff      BOOLEAN;
BEGIN
  -- Verify caller is an active member of this org
  SELECT m.role, m.status
  INTO   v_caller_role, v_caller_status
  FROM   org_memberships m
  WHERE  m.org_id  = p_org_id
    AND  m.user_id = auth.uid()
  LIMIT  1;

  -- Silently return nothing if caller is not an active member
  IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
    RETURN;
  END IF;

  -- Staff / admin roles can see contact details
  v_is_staff := v_caller_role IN (
    'hoa_admin', 'property_manager', 'property_staff', 'super_admin'
  );

  RETURN QUERY
  SELECT
    m.id                                                      AS membership_id,
    m.user_id,
    COALESCE(NULLIF(p.name, ''), 'Community Member')         AS display_name,
    p.avatar_url,
    u.unit_number,
    m.role,
    m.joined_at,
    CASE WHEN v_is_staff THEN NULLIF(p.email, '')  ELSE NULL END AS email,
    CASE WHEN v_is_staff THEN NULLIF(p.phone, '')  ELSE NULL END AS phone
  FROM   org_memberships m
  JOIN   profiles p ON p.id = m.user_id
  LEFT   JOIN units u ON u.id = m.unit_id
  WHERE  m.org_id  = p_org_id
    AND  m.status  = 'active'
  ORDER  BY
    -- Sort by unit first (natural property sort), then by name
    u.unit_number NULLS LAST,
    p.name        NULLS LAST;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. get_org_member_count
--    Cheap scalar used for stat pills. Same access gate as above.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_member_count(p_org_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_status TEXT;
  v_count         BIGINT;
BEGIN
  SELECT m.status
  INTO   v_caller_status
  FROM   org_memberships m
  WHERE  m.org_id  = p_org_id
    AND  m.user_id = auth.uid()
  LIMIT  1;

  IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM   org_memberships
  WHERE  org_id = p_org_id AND status = 'active';

  RETURN v_count;
END;
$$;
