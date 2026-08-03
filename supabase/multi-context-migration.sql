-- =============================================================
-- multi-context-migration.sql
-- Phase 1: HOA / Condo / Multifamily / Property-Manager support
--
-- Adds:
--   organizations      — the community/HOA/building entity
--   properties         — buildings within an organization
--   units              — individual addressable apartments/lots
--   org_memberships    — user <-> organization with typed role
--   org_announcements  — board/staff broadcasts to members
--   package_log_items  — org-scoped package event log
--
-- All tables have RLS enabled. No homeowner tables are modified.
-- Run this in Supabase SQL Editor after all prior migrations.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ORGANIZATIONS
-- Central entity: an HOA, condo association, multifamily
-- property, or property-management company.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'hoa'
                    CHECK (type IN ('hoa', 'condo', 'multifamily', 'property_management')),
  address         TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  state           TEXT NOT NULL DEFAULT '',
  zip             TEXT NOT NULL DEFAULT '',
  total_units     INT,
  logo_url        TEXT,
  invite_code     TEXT UNIQUE,
  -- The user who claimed / created this org (super_admin or hoa_admin)
  admin_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  website         TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_type     ON public.organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_zip      ON public.organizations(zip);
CREATE INDEX IF NOT EXISTS idx_organizations_invite   ON public.organizations(invite_code);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can search/view active orgs (for join flow)
CREATE POLICY "authenticated_read_active_orgs"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only the org admin can update their org
CREATE POLICY "org_admin_update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Any authenticated user can create an org (claim flow)
CREATE POLICY "authenticated_create_org"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. PROPERTIES (buildings within an org)
-- A property_management org may have multiple buildings.
-- HOA/condo orgs typically have one property = the community.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.properties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  address          TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL DEFAULT '',
  state            TEXT NOT NULL DEFAULT '',
  zip              TEXT NOT NULL DEFAULT '',
  total_units      INT,
  manager_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_org_id ON public.properties(org_id);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Org members can view properties in their org
CREATE POLICY "org_members_read_properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Org admin/manager can insert/update properties
CREATE POLICY "org_admin_write_properties"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

CREATE POLICY "org_admin_update_properties"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. UNITS (apartments / lots / suites)
-- Addressable units within a property. One user may occupy
-- one unit at a time (enforced by unique membership constraint).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_number  TEXT NOT NULL,
  floor        INT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_org_id      ON public.units(org_id);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Org members can view units in their org
CREATE POLICY "org_members_read_units"
  ON public.units FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins/managers can manage units
CREATE POLICY "org_admin_write_units"
  ON public.units FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. ORG MEMBERSHIPS (user <-> org with role)
-- Single join table. user_id + org_id is unique (one role per org).
-- Role escalation must go through admin approval.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id      UUID REFERENCES public.units(id) ON DELETE SET NULL,
  role         TEXT NOT NULL DEFAULT 'resident'
                 CHECK (role IN (
                   'resident',
                   'board_member',
                   'hoa_admin',
                   'property_staff',
                   'property_manager',
                   'super_admin'
                 )),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  joined_at    TIMESTAMPTZ,
  invited_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id  ON public.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_status  ON public.org_memberships(status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role    ON public.org_memberships(role);

ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
CREATE POLICY "user_read_own_memberships"
  ON public.org_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all memberships in their org
CREATE POLICY "org_admin_read_all_memberships"
  ON public.org_memberships FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.status = 'active'
        AND m2.role IN ('hoa_admin', 'property_manager', 'property_staff', 'board_member', 'super_admin')
    )
  );

-- Any authenticated user can request membership (status = 'pending')
CREATE POLICY "user_request_membership"
  ON public.org_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND role = 'resident'
  );

-- Users can update their own pending membership (cancel request)
CREATE POLICY "user_cancel_own_request"
  ON public.org_memberships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

-- Org admins can approve/update memberships in their org
CREATE POLICY "org_admin_update_memberships"
  ON public.org_memberships FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.status = 'active'
        AND m2.role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. ORG ANNOUNCEMENTS
-- Board/staff can post community-wide announcements.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_announcements_org_id     ON public.org_announcements(org_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_created_at ON public.org_announcements(created_at DESC);

ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;

-- All active org members can read announcements
CREATE POLICY "org_members_read_announcements"
  ON public.org_announcements FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Board/admin/staff can create announcements
CREATE POLICY "org_staff_create_announcements"
  ON public.org_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('board_member', 'hoa_admin', 'property_staff', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. PACKAGE LOG ITEMS (org-scoped package event log)
-- Staff can log package arrivals / pickups / exceptions
-- without requiring a Porchivo shipment record.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.package_log_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id         UUID REFERENCES public.units(id) ON DELETE SET NULL,
  resident_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id     UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  carrier         TEXT,
  tracking_number TEXT,
  status          TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN (
                      'received',
                      'ready_for_pickup',
                      'picked_up',
                      'returned_to_sender',
                      'exception'
                    )),
  notes           TEXT,
  photo_url       TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_log_org_id      ON public.package_log_items(org_id);
CREATE INDEX IF NOT EXISTS idx_package_log_unit_id     ON public.package_log_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_package_log_resident_id ON public.package_log_items(resident_id);
CREATE INDEX IF NOT EXISTS idx_package_log_status      ON public.package_log_items(status);

ALTER TABLE public.package_log_items ENABLE ROW LEVEL SECURITY;

-- Residents can see log items for their unit
CREATE POLICY "resident_read_own_unit_log"
  ON public.package_log_items FOR SELECT
  TO authenticated
  USING (
    resident_id = auth.uid()
    OR unit_id IN (
      SELECT unit_id FROM public.org_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Staff/admin can read all logs in their org
CREATE POLICY "org_staff_read_all_logs"
  ON public.package_log_items FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_staff', 'property_manager', 'board_member', 'super_admin')
    )
  );

-- Staff can log packages
CREATE POLICY "org_staff_insert_log"
  ON public.package_log_items FOR INSERT
  TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_staff', 'property_manager', 'super_admin')
    )
  );

-- Staff can update log items
CREATE POLICY "org_staff_update_log"
  ON public.package_log_items FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('hoa_admin', 'property_staff', 'property_manager', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. updated_at TRIGGERS
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at   ON public.organizations;
DROP TRIGGER IF EXISTS trg_properties_updated_at      ON public.properties;
DROP TRIGGER IF EXISTS trg_units_updated_at           ON public.units;
DROP TRIGGER IF EXISTS trg_org_memberships_updated_at ON public.org_memberships;
DROP TRIGGER IF EXISTS trg_org_announcements_updated_at ON public.org_announcements;
DROP TRIGGER IF EXISTS trg_package_log_updated_at     ON public.package_log_items;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE TRIGGER trg_org_memberships_updated_at
  BEFORE UPDATE ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE TRIGGER trg_org_announcements_updated_at
  BEFORE UPDATE ON public.org_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE TRIGGER trg_package_log_updated_at
  BEFORE UPDATE ON public.package_log_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ─────────────────────────────────────────────────────────────
-- 8. HELPER RPC: get_my_org_context
-- Returns the calling user's active membership + org in one call.
-- Avoids N+1 pattern on the community dashboard.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_org_context()
RETURNS TABLE (
  membership_id   UUID,
  org_id          UUID,
  org_name        TEXT,
  org_type        TEXT,
  org_logo_url    TEXT,
  org_is_verified BOOLEAN,
  unit_id         UUID,
  unit_number     TEXT,
  role            TEXT,
  status          TEXT,
  joined_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.id,
      o.id,
      o.name,
      o.type,
      o.logo_url,
      o.is_verified,
      m.unit_id,
      u.unit_number,
      m.role,
      m.status,
      m.joined_at
    FROM public.org_memberships m
    JOIN public.organizations o ON o.id = m.org_id
    LEFT JOIN public.units u ON u.id = m.unit_id
    WHERE m.user_id = auth.uid()
      AND m.status IN ('active', 'pending')
    ORDER BY m.joined_at DESC NULLS LAST
    LIMIT 5;
END;
$$;
