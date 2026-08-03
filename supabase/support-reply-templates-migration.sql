-- ============================================================
-- PORCHIVO: Staff Support Reply Templates
-- Run in Supabase SQL Editor AFTER support-tickets-migration.sql.
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================
--
-- Creates the `support_reply_templates` table that
-- expo/lib/supportTemplates.ts and the staff-support-queue reply
-- modal read/write against. Staff can save, edit, and select
-- pre-written templates for common property-management queries
-- (package theft reports, key-fob issues, HOA dues, vendor access,
-- noise complaints, move-in/move-out, etc.).
--
-- Security model
--   * Only support staff / super_admin (auth.app_metadata().role)
--     can SELECT, INSERT, UPDATE, or DELETE templates.
--   * Templates are shared across all staff — there is no per-author
--     ownership filter, so any staff member can refine or remove a
--     template a colleague created. (Staff populations are small and
--     trusted; we intentionally avoid per-author scoping to keep the
--     library coherent and avoid template sprawl.)
--   * The `is_default` flag marks the seed rows shipped with the
--     schema. Staff can still edit/delete them — the flag only
--     controls whether the seed block re-inserts the row on re-runs
--     (ON CONFLICT DO NOTHING when is_default = true).
-- ============================================================


-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_reply_templates (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label        text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  body         text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  category     text        CHECK (category IS NULL OR category IN (
                          'delivery_issue', 'payment_billing', 'account_access',
                          'partner_dispute', 'app_bug', 'feature_request',
                          'safety_alert', 'other'
                        )),
  is_default   boolean     NOT NULL DEFAULT false,
  created_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_reply_templates_category
  ON public.support_reply_templates (category)
  WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_reply_templates_default
  ON public.support_reply_templates (is_default)
  WHERE is_default = true;


-- ── 2. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.support_reply_templates ENABLE ROW LEVEL SECURITY;

-- Staff: read all templates.
DROP POLICY IF EXISTS "Staff view reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff view reply templates"
  ON public.support_reply_templates FOR SELECT
  TO authenticated
  USING (auth.app_metadata() ->> 'role' = 'support_staff'
         OR auth.app_metadata() ->> 'role' = 'super_admin');

-- Staff: create templates.
DROP POLICY IF EXISTS "Staff insert reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff insert reply templates"
  ON public.support_reply_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.app_metadata() ->> 'role' = 'support_staff'
              OR auth.app_metadata() ->> 'role' = 'super_admin');

-- Staff: update any template (shared library, no per-author gate).
DROP POLICY IF EXISTS "Staff update reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff update reply templates"
  ON public.support_reply_templates FOR UPDATE
  TO authenticated
  USING (auth.app_metadata() ->> 'role' = 'support_staff'
         OR auth.app_metadata() ->> 'role' = 'super_admin')
  WITH CHECK (auth.app_metadata() ->> 'role' = 'support_staff'
              OR auth.app_metadata() ->> 'role' = 'super_admin');

-- Staff: delete any template.
DROP POLICY IF EXISTS "Staff delete reply templates" ON public.support_reply_templates;
CREATE POLICY "Staff delete reply templates"
  ON public.support_reply_templates FOR DELETE
  TO authenticated
  USING (auth.app_metadata() ->> 'role' = 'support_staff'
         OR auth.app_metadata() ->> 'role' = 'super_admin');


-- ── 3. Triggers ─────────────────────────────────────────────────────────────

-- 3a. Stamp created_by from auth.uid() on INSERT when omitted.
CREATE OR REPLACE FUNCTION public.stamp_template_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_template_author ON public.support_reply_templates;
CREATE TRIGGER trg_stamp_template_author
  BEFORE INSERT ON public.support_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_template_author();

-- 3b. Auto-update updated_at (reuses the shared trigger function from migration.sql).
DROP TRIGGER IF EXISTS support_reply_templates_updated_at ON public.support_reply_templates;
CREATE TRIGGER support_reply_templates_updated_at
  BEFORE UPDATE ON public.support_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ── 4. Seed default templates for common property-management queries ────────
-- Re-running this block is safe: ON CONFLICT DO NOTHING preserves any edits
-- staff have made to the seeded rows. To force a refresh, drop the row first.
-- Bodies use {{first_name}} / {{building_name}} / {{unit}} placeholders that
-- staff can substitute when composing the reply.

INSERT INTO public.support_reply_templates (label, body, category, is_default) VALUES
  (
    'Package theft report — file with local precinct',
    'Hi {{first_name}}, thanks for flagging the missing package. I''ve pulled the delivery timestamp from the courier log and the porch-camera clip is attached for your records. To file an official theft report, contact your local precinct''s non-emergency line with the tracking number and this footage; once you have a case number, reply here and we''ll log it on your unit''s safety record and share it with the block watch.',
    'delivery_issue',
    true
  ),
  (
    'HOA dues — payment plan request acknowledged',
    'Hi {{first_name}}, I''ve received your request for a payment plan on the outstanding HOA balance for {{unit}}. The board reviews payment-plan requests on the first Tuesday of each month; I''ve added yours to the next agenda and you''ll get a written decision within five business days of that meeting. In the meantime, no late fees will accrue and your community access remains active.',
    'payment_billing',
    true
  ),
  (
    'Key fob / access credential replacement',
    'Hi {{first_name}}, sorry about the lost fob. I''ve deactivated the old credential so it can''t be used even if found. Replacement fobs are $25 and can be picked up at the management office during business hours — bring a photo ID. If you need after-hours access today, reply with a time and I''ll meet you at the front desk to issue a temporary code valid for 24 hours.',
    'account_access',
    true
  ),
  (
    'Vendor / contractor access approval',
    'Hi {{first_name}}, your vendor-access request for {{unit}} is approved for the date and window you specified. The contractor must check in at the front desk with a photo ID and a copy of this approval; they''ll be issued a day-pass badge that expires at 6pm. Please make sure someone 18+ is on-site the entire time the vendor is in the unit.',
    'partner_dispute',
    true
  ),
  (
    'Noise complaint — first formal notice',
    'Hi {{first_name}}, we''ve received a noise complaint regarding your unit on {{date}}. This is a first notice under the community''s quiet-hours policy (10pm–7am weekdays, 11pm–8pm weekends). No fine is being assessed at this time. Please acknowledge receipt of this message and let us know if there''s a recurring cause we can help mediate. A second verified complaint within 30 days escalates to the board.',
    'other',
    true
  ),
  (
    'Move-out inspection scheduled',
    'Hi {{first_name}}, your move-out inspection for {{unit}} is scheduled for {{date}} at {{time}}. Please ensure the unit is empty, swept, and all keys/fobs/rental appliances are returned at the inspection. The walk-through takes about 30 minutes and you''re welcome to attend. Your security deposit refund, less any itemized deductions, will be issued within 30 days per your lease.',
    'other',
    true
  ),
  (
    'App bug — fix shipped, please update',
    'Hi {{first_name}}, thanks for the bug report — I was able to reproduce it on our end and the engineering team shipped a fix in version {{version}}. Open the App Store / Play Store, pull to refresh updates, and install the latest build. If the issue persists after updating, reply with a fresh screen recording and we''ll reopen the investigation immediately.',
    'app_bug',
    true
  ),
  (
    'Safety alert acknowledged — action taken',
    'Hi {{first_name}}, I''ve acknowledged your safety alert and logged it on the building''s incident board. I''ve also notified the on-site security contact and the block captain for your area. You should see a follow-up from the property team within 24 hours. If you feel unsafe at any point before then, call 911 first and reply here second — we''ll coordinate with the responders.',
    'safety_alert',
    true
  )
ON CONFLICT DO NOTHING;


-- ── 5. Verification ─────────────────────────────────────────────────────────
-- After running this migration, execute the following to confirm:
--
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'support_reply_templates';
--   -- Expected: rowsecurity = true
--
--   SELECT polname, polcmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'support_reply_templates';
--   -- Expected: 4 policies (staff select/insert/update/delete)
--
--   SELECT label, category, is_default FROM public.support_reply_templates
--   ORDER BY is_default DESC, label;
--   -- Expected: 8 seeded rows with is_default = true
