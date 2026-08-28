-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 14: Portfolio (multi-community), Vendor Directory, Custom Branding
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) organizations: portfolio caps + onboarding fee + branding color
-- 2) org_vendors: lightweight vendor directory per organization
-- All statements are idempotent — safe to re-run alongside master-deploy.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. organizations columns ──────────────────────────────────────────────
-- max_communities       — NULL = unlimited (enterprise), 1/3 for the rest
-- onboarding_fee_cents  — one-time fee charged with the first checkout
-- brand_color           — hex accent chosen by the admin (custom branding)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS max_communities INT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding_fee_cents INT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS brand_color TEXT;

-- Backfill existing orgs from their plan tier (enterprise stays NULL = unlimited).
UPDATE public.organizations
SET max_communities = CASE plan_tier
                        WHEN 'professional' THEN 3
                        WHEN 'enterprise'   THEN NULL
                        ELSE 1
                      END,
    onboarding_fee_cents = CASE plan_tier
                             WHEN 'professional' THEN 50000
                             WHEN 'enterprise'   THEN 150000
                             ELSE 0
                           END
WHERE max_communities IS NULL
  AND onboarding_fee_cents IS NULL
  AND plan_tier IS DISTINCT FROM 'enterprise';

-- ── 2. org_vendors ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_vendors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general'
               CHECK (category IN ('general','plumbing','electrical','hvac','landscaping',
                                   'cleaning','security','pool','pest','roofing','other')),
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_vendors_org    ON public.org_vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_org_vendors_active ON public.org_vendors(org_id, is_active);

ALTER TABLE public.org_vendors ENABLE ROW LEVEL SECURITY;

-- All active members can view the directory.
DROP POLICY IF EXISTS org_vendors_select ON public.org_vendors;
CREATE POLICY org_vendors_select ON public.org_vendors
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id));

-- Staff/admin can add and edit vendors.
DROP POLICY IF EXISTS org_vendors_insert ON public.org_vendors;
CREATE POLICY org_vendors_insert ON public.org_vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(org_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS org_vendors_update ON public.org_vendors;
CREATE POLICY org_vendors_update ON public.org_vendors
  FOR UPDATE TO authenticated
  USING (public.is_org_staff(org_id))
  WITH CHECK (public.is_org_staff(org_id));

-- The creator or a full admin (not board/staff) can remove a vendor.
DROP POLICY IF EXISTS org_vendors_delete ON public.org_vendors;
CREATE POLICY org_vendors_delete ON public.org_vendors
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = org_vendors.org_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('hoa_admin', 'property_manager', 'super_admin')
    )
  );

DROP TRIGGER IF EXISTS trg_org_vendors_updated_at ON public.org_vendors;
CREATE TRIGGER trg_org_vendors_updated_at
  BEFORE UPDATE ON public.org_vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
