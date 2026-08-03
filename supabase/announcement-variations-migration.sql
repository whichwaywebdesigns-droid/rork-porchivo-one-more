-- ─────────────────────────────────────────────────────────────────────────────
-- Porchivo: Announcement Phrase Variations
-- Additive migration — adds body_variations (JSONB) and variation_mode columns
-- to org_announcements so admins can compose rotating phrasing that auto-updates
-- on a daily, weekly, sequential, or random schedule.
--
-- Safe to run on existing tables: uses ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add phrase variation columns
ALTER TABLE public.org_announcements
  ADD COLUMN IF NOT EXISTS body_variations JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variation_mode  TEXT  DEFAULT NULL
    CONSTRAINT announcement_variation_mode_check
      CHECK (variation_mode IN ('sequential', 'random', 'daily', 'weekly'));

-- 2. Index body_variations for any future JSONB queries
CREATE INDEX IF NOT EXISTS idx_org_announcements_has_variations
  ON public.org_announcements ((body_variations IS NOT NULL))
  WHERE body_variations IS NOT NULL;

-- 3. Helper comment for future engineers
COMMENT ON COLUMN public.org_announcements.body_variations IS
  'JSONB array of alternative body strings. When NULL or empty, body is used as-is.
   When populated, the client selects which variation to display based on variation_mode:
     sequential — cycles through variations by view_count
     random     — seeded daily-random per announcement id
     daily      — changes every calendar day
     weekly     — changes every calendar week';

COMMENT ON COLUMN public.org_announcements.variation_mode IS
  'How body_variations rotate: sequential | random | daily | weekly. NULL = static (no rotation).';

-- 4. No RLS changes needed — body_variations is a column of the same row
--    and inherits all existing org_announcements RLS policies.
