-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Dashboard Migration
-- Phase 5 — Porchivo multi-context expansion
--
-- Adds:
--   get_admin_dashboard_stats(p_org_id)  — aggregated stats for admin home
--   approve_org_membership(p_membership_id, p_org_id)
--   deny_org_membership(p_membership_id, p_org_id)
--   admin_audit_log table — lightweight action trail for admin operations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Admin audit log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,                   -- e.g. 'approve_member', 'deny_member', 'log_package'
  target_type   TEXT,                            -- e.g. 'membership', 'package_log_item'
  target_id     UUID,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only org admins/staff can read their own org's audit log
CREATE POLICY "admin_audit_log_read"
  ON public.admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = admin_audit_log.org_id
        AND m.user_id = auth.uid()
        AND m.status  = 'active'
        AND m.role    IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
    )
  );

-- Only the backend (service role) or security-definer RPCs insert log entries
CREATE POLICY "admin_audit_log_insert_sd"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- ── Dashboard stats RPC ───────────────────────────────────────────────────────
-- Returns a single JSON row with all counts an admin dashboard needs.
-- SECURITY DEFINER — caller is verified as an active admin/staff member first.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_result JSON;
BEGIN
  -- 1. Verify caller is an active admin or staff member of this org
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- 2. Aggregate stats
  SELECT json_build_object(
    -- Membership
    'total_members',        (SELECT COUNT(*) FROM org_memberships WHERE org_id = p_org_id AND status = 'active'),
    'pending_members',      (SELECT COUNT(*) FROM org_memberships WHERE org_id = p_org_id AND status = 'pending'),
    'suspended_members',    (SELECT COUNT(*) FROM org_memberships WHERE org_id = p_org_id AND status = 'suspended'),

    -- Packages
    'packages_received',    (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'received'),
    'packages_ready',       (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'ready_for_pickup'),
    'packages_picked_up',   (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'picked_up'),
    'packages_exception',   (SELECT COUNT(*) FROM package_log_items WHERE org_id = p_org_id AND status = 'exception'),
    'packages_today',       (
      SELECT COUNT(*) FROM package_log_items
      WHERE org_id = p_org_id
        AND received_at >= CURRENT_DATE
    ),

    -- Announcements
    'total_announcements',  (SELECT COUNT(*) FROM org_announcements WHERE org_id = p_org_id),
    'active_announcements', (
      SELECT COUNT(*) FROM org_announcements
      WHERE org_id = p_org_id
        AND (expires_at IS NULL OR expires_at > now())
        AND (scheduled_at IS NULL OR scheduled_at <= now())
    ),
    'pinned_announcements', (SELECT COUNT(*) FROM org_announcements WHERE org_id = p_org_id AND is_pinned = true),

    -- Audit
    'admin_actions_today',  (
      SELECT COUNT(*) FROM admin_audit_log
      WHERE org_id = p_org_id AND created_at >= CURRENT_DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(UUID) TO authenticated;

-- ── Pending members list RPC ──────────────────────────────────────────────────
-- Returns pending membership requests with display name.
CREATE OR REPLACE FUNCTION public.get_pending_members(p_org_id UUID)
RETURNS TABLE (
  membership_id UUID,
  user_id       UUID,
  display_name  TEXT,
  avatar_url    TEXT,
  unit_number   TEXT,
  created_at    TIMESTAMPTZ,
  notes         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify admin/staff
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'property_staff', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
    SELECT
      m.id                AS membership_id,
      m.user_id,
      COALESCE(p.name, p.email, 'Unknown')::TEXT AS display_name,
      p.avatar_url::TEXT,
      u.unit_number::TEXT,
      m.created_at,
      m.notes::TEXT
    FROM org_memberships m
    LEFT JOIN profiles       p ON p.id          = m.user_id
    LEFT JOIN units          u ON u.id           = m.unit_id
    WHERE m.org_id = p_org_id
      AND m.status = 'pending'
    ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_members(UUID) TO authenticated;

-- ── Approve membership ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_org_membership(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify caller is admin/staff of this org
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Approve
  UPDATE public.org_memberships
  SET status    = 'active',
      joined_at = now(),
      updated_at = now()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'pending';

  -- Audit
  INSERT INTO public.admin_audit_log (org_id, actor_id, action, target_type, target_id)
  VALUES (p_org_id, auth.uid(), 'approve_member', 'membership', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_org_membership(UUID, UUID) TO authenticated;

-- ── Deny membership ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deny_org_membership(
  p_membership_id UUID,
  p_org_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.org_memberships
  WHERE org_id  = p_org_id
    AND user_id = auth.uid()
    AND status  = 'active'
    AND role    IN ('hoa_admin', 'property_manager', 'super_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE public.org_memberships
  SET status     = 'removed',
      updated_at = now()
  WHERE id     = p_membership_id
    AND org_id = p_org_id
    AND status = 'pending';

  INSERT INTO public.admin_audit_log (org_id, actor_id, action, target_type, target_id)
  VALUES (p_org_id, auth.uid(), 'deny_member', 'membership', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deny_org_membership(UUID, UUID) TO authenticated;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_org_created
  ON public.admin_audit_log (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_memberships_pending
  ON public.org_memberships (org_id, status)
  WHERE status = 'pending';
