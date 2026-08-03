-- ─── Role Management Migration ────────────────────────────────────────────────
-- Additive: RPCs for admin-side role assignment, invitation, suspension,
-- reinstatement, and removal. Builds on top of org_memberships from
-- multi-context-migration.sql. All functions are SECURITY DEFINER to enforce
-- role-based access before any mutation.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── 1. Get all org members (admin view) ─────────────────────────────────────
-- Returns every non-removed member with joined profile data.
-- Caller must be admin/staff in the org (enforced inside).

CREATE OR REPLACE FUNCTION get_org_members_admin(p_org_id UUID)
RETURNS TABLE(
  membership_id   UUID,
  user_id         UUID,
  display_name    TEXT,
  avatar_url      TEXT,
  email           TEXT,
  unit_number     TEXT,
  role            TEXT,
  status          TEXT,
  joined_at       TIMESTAMPTZ,
  invited_by      UUID,
  invited_by_name TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verify caller is admin or staff in this org
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id  = auth.uid()
    AND om.org_id   = p_org_id
    AND om.status   = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','property_manager','property_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient role';
  END IF;

  RETURN QUERY
  SELECT
    om.id                           AS membership_id,
    om.user_id,
    COALESCE(p.name, p.email, 'Unknown') AS display_name,
    p.avatar_url,
    p.email,
    u.unit_number,
    om.role::TEXT,
    om.status::TEXT,
    om.joined_at,
    om.invited_by,
    COALESCE(inv.name, inv.email)   AS invited_by_name,
    om.notes,
    om.created_at
  FROM org_memberships om
  LEFT JOIN profiles p ON p.id = om.user_id
  LEFT JOIN units u ON u.id = om.unit_id
  LEFT JOIN profiles inv ON inv.id = om.invited_by
  WHERE om.org_id = p_org_id
    AND om.status != 'removed'
  ORDER BY
    CASE om.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    COALESCE(p.name, p.email, '') ASC;
END;
$$;

-- ─── 2. Assign / change role ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_org_member_role(
  p_membership_id UUID,
  p_org_id        UUID,
  p_new_role      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  -- Guard: caller must be admin
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: must be hoa_admin or super_admin';
  END IF;

  -- Guard: cannot downgrade a super_admin unless you are super_admin
  SELECT om.role INTO v_target_role
  FROM org_memberships om
  WHERE om.id     = p_membership_id
    AND om.org_id = p_org_id;

  IF v_target_role = 'super_admin' AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: cannot modify super_admin role';
  END IF;

  UPDATE org_memberships
  SET role       = p_new_role,
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id;
END;
$$;

-- ─── 3. Suspend member ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION suspend_org_member(
  p_membership_id UUID,
  p_org_id        UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: must be hoa_admin or super_admin';
  END IF;

  UPDATE org_memberships
  SET status     = 'suspended',
      notes      = COALESCE(p_reason, notes),
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'active';
END;
$$;

-- ─── 4. Reinstate suspended member ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION reinstate_org_member(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE org_memberships
  SET status     = 'active',
      joined_at  = COALESCE(joined_at, NOW()),
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'suspended';
END;
$$;

-- ─── 5. Remove member ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_org_member(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE org_memberships
  SET status     = 'removed',
      updated_at = NOW()
  WHERE id     = p_membership_id
    AND org_id = p_org_id;
END;
$$;

-- ─── 6. Invite member by email ────────────────────────────────────────────────
-- Creates a pending membership for an existing Porchivo user by email.
-- If no matching profile exists, returns NULL (front-end shows instructions).

CREATE OR REPLACE FUNCTION invite_org_member_by_email(
  p_org_id   UUID,
  p_email    TEXT,
  p_role     TEXT DEFAULT 'resident'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_target_user   UUID;
  v_membership_id UUID;
BEGIN
  -- Guard: caller must be admin
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Look up user by email in profiles
  SELECT id INTO v_target_user
  FROM profiles
  WHERE email = LOWER(TRIM(p_email))
  LIMIT 1;

  -- If not found, try auth.users (email may be there but profile not yet written)
  IF v_target_user IS NULL THEN
    SELECT id INTO v_target_user
    FROM auth.users
    WHERE email = LOWER(TRIM(p_email))
    LIMIT 1;
  END IF;

  IF v_target_user IS NULL THEN
    -- Return NULL to signal "user not found in Porchivo"
    RETURN NULL;
  END IF;

  -- Upsert: if already a member re-activate with new role
  INSERT INTO org_memberships (user_id, org_id, role, status, invited_by, created_at, updated_at)
  VALUES (v_target_user, p_org_id, p_role, 'active', auth.uid(), NOW(), NOW())
  ON CONFLICT (user_id, org_id)
  DO UPDATE SET
    role       = EXCLUDED.role,
    status     = 'active',
    invited_by = EXCLUDED.invited_by,
    joined_at  = COALESCE(org_memberships.joined_at, NOW()),
    updated_at = NOW()
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END;
$$;

-- ─── 7. Generate a fresh invite code for the org ─────────────────────────────

CREATE OR REPLACE FUNCTION regenerate_org_invite_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_new_code    TEXT;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.org_id  = p_org_id
    AND om.status  = 'active'
  LIMIT 1;

  IF v_caller_role NOT IN ('hoa_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

  UPDATE organizations
  SET invite_code = v_new_code,
      updated_at  = NOW()
  WHERE id = p_org_id;

  RETURN v_new_code;
END;
$$;

-- ─── Grant execution to authenticated users ───────────────────────────────────
GRANT EXECUTE ON FUNCTION get_org_members_admin(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION assign_org_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION suspend_org_member(UUID, UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION reinstate_org_member(UUID, UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION remove_org_member(UUID, UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION invite_org_member_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_org_invite_code(UUID)       TO authenticated;
