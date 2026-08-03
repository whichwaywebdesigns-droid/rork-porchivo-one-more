-- ─────────────────────────────────────────────────────────────────────────────
-- Property / Building Management Migration
-- Additive layer on top of multi-context-migration.sql
-- Adds: property CRUD RPCs, unit CRUD RPCs, property stats view, manager assign
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: assert the caller is an admin/manager in the org ──────────────────

CREATE OR REPLACE FUNCTION assert_org_admin(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
END;
$$;

-- ── Get all properties for an org (with unit counts) ─────────────────────────

CREATE OR REPLACE FUNCTION get_org_properties(p_org_id uuid)
RETURNS TABLE (
  id            uuid,
  org_id        uuid,
  name          text,
  address       text,
  city          text,
  state         text,
  zip           text,
  total_units   int,
  manager_user_id uuid,
  manager_name  text,
  is_active     boolean,
  notes         text,
  unit_count    bigint,
  occupied_count bigint,
  created_at    timestamptz,
  updated_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be an active member of the org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.org_id,
    p.name,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.total_units,
    p.manager_user_id,
    prof.display_name AS manager_name,
    p.is_active,
    p.notes,
    COUNT(u.id)::bigint AS unit_count,
    COUNT(CASE WHEN om2.status = 'active' THEN 1 END)::bigint AS occupied_count,
    p.created_at,
    p.updated_at
  FROM properties p
  LEFT JOIN profiles prof ON prof.id = p.manager_user_id
  LEFT JOIN units u ON u.property_id = p.id AND u.org_id = p_org_id
  LEFT JOIN org_memberships om2 ON om2.unit_id = u.id AND om2.status = 'active'
  WHERE p.org_id = p_org_id
  GROUP BY p.id, prof.display_name
  ORDER BY p.name ASC;
END;
$$;

-- ── Get units for a property ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_property_units(p_property_id uuid, p_org_id uuid)
RETURNS TABLE (
  id              uuid,
  property_id     uuid,
  org_id          uuid,
  unit_number     text,
  floor           int,
  notes           text,
  resident_name   text,
  resident_id     uuid,
  membership_id   uuid,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  RETURN QUERY
  SELECT
    u.id,
    u.property_id,
    u.org_id,
    u.unit_number,
    u.floor,
    u.notes,
    prof.display_name AS resident_name,
    prof.id AS resident_id,
    om.id AS membership_id,
    u.created_at
  FROM units u
  LEFT JOIN org_memberships om
    ON om.unit_id = u.id
    AND om.org_id = p_org_id
    AND om.status = 'active'
  LEFT JOIN profiles prof ON prof.id = om.user_id
  WHERE u.property_id = p_property_id
    AND u.org_id = p_org_id
  ORDER BY u.unit_number ASC;
END;
$$;

-- ── Create a property ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_org_property(
  p_org_id      uuid,
  p_name        text,
  p_address     text,
  p_city        text,
  p_state       text,
  p_zip         text,
  p_total_units int DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
BEGIN
  PERFORM assert_org_admin(p_org_id);

  INSERT INTO properties (org_id, name, address, city, state, zip, total_units, notes)
  VALUES (p_org_id, p_name, p_address, p_city, p_state, p_zip, p_total_units, p_notes)
  RETURNING id INTO v_property_id;

  RETURN v_property_id;
END;
$$;

-- ── Update a property ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_org_property(
  p_property_id uuid,
  p_org_id      uuid,
  p_name        text DEFAULT NULL,
  p_address     text DEFAULT NULL,
  p_city        text DEFAULT NULL,
  p_state       text DEFAULT NULL,
  p_zip         text DEFAULT NULL,
  p_total_units int  DEFAULT NULL,
  p_notes       text DEFAULT NULL,
  p_is_active   boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  UPDATE properties
  SET
    name        = COALESCE(p_name, name),
    address     = COALESCE(p_address, address),
    city        = COALESCE(p_city, city),
    state       = COALESCE(p_state, state),
    zip         = COALESCE(p_zip, zip),
    total_units = COALESCE(p_total_units, total_units),
    notes       = COALESCE(p_notes, notes),
    is_active   = COALESCE(p_is_active, is_active),
    updated_at  = now()
  WHERE id = p_property_id AND org_id = p_org_id;
END;
$$;

-- ── Assign manager to a property ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_property_manager(
  p_property_id   uuid,
  p_org_id        uuid,
  p_manager_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Ensure target is an active staff/admin member
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = p_manager_user_id
      AND org_id = p_org_id
      AND status = 'active'
      AND role IN ('property_manager', 'property_staff', 'hoa_admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Target user is not an active staff member of this organization';
  END IF;

  UPDATE properties
  SET manager_user_id = p_manager_user_id, updated_at = now()
  WHERE id = p_property_id AND org_id = p_org_id;
END;
$$;

-- ── Create a unit ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_org_unit(
  p_property_id uuid,
  p_org_id      uuid,
  p_unit_number text,
  p_floor       int  DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Verify property belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM properties WHERE id = p_property_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Property not found in this organization';
  END IF;

  INSERT INTO units (property_id, org_id, unit_number, floor, notes)
  VALUES (p_property_id, p_org_id, p_unit_number, p_floor, p_notes)
  RETURNING id INTO v_unit_id;

  RETURN v_unit_id;
END;
$$;

-- ── Bulk create units for a property ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION bulk_create_units(
  p_property_id uuid,
  p_org_id      uuid,
  p_unit_numbers text[]   -- e.g. ARRAY['101','102','103']
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_number text;
  v_count int := 0;
BEGIN
  PERFORM assert_org_admin(p_org_id);

  IF NOT EXISTS (
    SELECT 1 FROM properties WHERE id = p_property_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Property not found in this organization';
  END IF;

  FOREACH v_unit_number IN ARRAY p_unit_numbers LOOP
    INSERT INTO units (property_id, org_id, unit_number)
    VALUES (p_property_id, p_org_id, trim(v_unit_number))
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── Delete/deactivate a unit ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_org_unit(
  p_unit_id  uuid,
  p_org_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Unlink any memberships referencing this unit first
  UPDATE org_memberships
  SET unit_id = NULL
  WHERE unit_id = p_unit_id AND org_id = p_org_id;

  DELETE FROM units WHERE id = p_unit_id AND org_id = p_org_id;
END;
$$;

-- ── Property summary stats (for admin dashboard widget) ───────────────────────

CREATE OR REPLACE FUNCTION get_property_summary(p_org_id uuid)
RETURNS TABLE (
  total_properties  bigint,
  active_properties bigint,
  total_units       bigint,
  occupied_units    bigint,
  vacant_units      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
      AND role IN ('hoa_admin', 'property_manager', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT p.id)::bigint AS total_properties,
    COUNT(DISTINCT CASE WHEN p.is_active THEN p.id END)::bigint AS active_properties,
    COUNT(DISTINCT u.id)::bigint AS total_units,
    COUNT(DISTINCT CASE WHEN om.status = 'active' THEN u.id END)::bigint AS occupied_units,
    COUNT(DISTINCT CASE WHEN om.id IS NULL OR om.status != 'active' THEN u.id END)::bigint AS vacant_units
  FROM properties p
  LEFT JOIN units u ON u.property_id = p.id AND u.org_id = p_org_id
  LEFT JOIN org_memberships om ON om.unit_id = u.id AND om.status = 'active'
  WHERE p.org_id = p_org_id;
END;
$$;

-- ── Assign a unit to a member ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_unit_to_member(
  p_membership_id uuid,
  p_unit_id       uuid,
  p_org_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_admin(p_org_id);

  -- Verify unit belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM units WHERE id = p_unit_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Unit not found in this organization';
  END IF;

  UPDATE org_memberships
  SET unit_id = p_unit_id, updated_at = now()
  WHERE id = p_membership_id AND org_id = p_org_id;
END;
$$;

-- ── RLS: properties ───────────────────────────────────────────────────────────

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_properties" ON properties;
CREATE POLICY "org_members_read_properties" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = properties.org_id
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "org_admins_write_properties" ON properties;
CREATE POLICY "org_admins_write_properties" ON properties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = properties.org_id
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ── RLS: units ────────────────────────────────────────────────────────────────

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_units" ON units;
CREATE POLICY "org_members_read_units" ON units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = units.org_id
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "org_admins_write_units" ON units;
CREATE POLICY "org_admins_write_units" ON units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE user_id = auth.uid()
        AND org_id = units.org_id
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ── Grant RPC execution ───────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_org_properties(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_property_units(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_org_property(uuid, text, text, text, text, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_org_property(uuid, uuid, text, text, text, text, text, int, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_property_manager(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_org_unit(uuid, uuid, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_create_units(uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_org_unit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_property_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_unit_to_member(uuid, uuid, uuid) TO authenticated;
