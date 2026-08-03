/**
 * Porchivo Partner Rate Engine
 *
 * Canonical source of truth for all Porch Partner pay calculations.
 * All pricing displayed in the app and on the web site derives from
 * these constants — never hard-code a dollar amount elsewhere.
 *
 * Rate structure (what the homeowner pays per hold):
 *   Base rate × geo-tier multiplier + quantity bonus
 *
 * Partners keep 85 % of every assignment payment.
 * Porchivo platform fee: 15 %.
 */

import { PackageSize, GeoTier } from '@/types';

export type { PackageSize, GeoTier };

// ─── Package size ─────────────────────────────────────────────────────────────

export const PACKAGE_SIZE_LABELS: Record<PackageSize, string> = {
  small:  'Small',
  medium: 'Medium',
  large:  'Large',
};

export const PACKAGE_SIZE_DESCRIPTIONS: Record<PackageSize, string> = {
  small:  'Envelope or box under 2 lbs',
  medium: 'Box 2–15 lbs',
  large:  '15+ lbs or oversized',
};

/** Base rate in cents (homeowner pays, before geo or quantity adjustments) */
export const BASE_RATE_CENTS: Record<PackageSize, number> = {
  small:  300,   // $3.00
  medium: 800,   // $8.00
  large:  1800,  // $18.00
};

// ─── Geographic tier ─────────────────────────────────────────────────────────

export const GEO_TIER_LABELS: Record<GeoTier, string> = {
  tier1: 'Major metro',
  tier2: 'Large city',
  tier3: 'Standard',
};

/** Example markets shown in UI */
export const GEO_TIER_EXAMPLES: Record<GeoTier, string> = {
  tier1: 'NYC, SF, LA, Boston, Seattle, DC',
  tier2: 'Chicago, Miami, Austin, Denver, Portland, Atlanta',
  tier3: 'All other US markets',
};

/**
 * Geo multipliers stored as integers (multiply cents by this, divide by 100).
 * tier1 = ×1.40, tier2 = ×1.20, tier3 = ×1.00
 */
export const GEO_MULTIPLIER_PCT: Record<GeoTier, number> = {
  tier1: 140,
  tier2: 120,
  tier3: 100,
};

// ─── Quantity bonus ──────────────────────────────────────────────────────────

export interface QuantityTier {
  minPackages: number;
  maxPackages: number | null;
  label: string;
  bonusCentsPerPackage: number;
}

/**
 * Bonus added *per package* within a payout cycle.
 * Applied after the geo multiplier.
 */
export const QUANTITY_TIERS: QuantityTier[] = [
  { minPackages: 1,  maxPackages: 4,    label: '1–4 pkgs / cycle',  bonusCentsPerPackage: 0   },
  { minPackages: 5,  maxPackages: 9,    label: '5–9 pkgs / cycle',  bonusCentsPerPackage: 75  }, // +$0.75
  { minPackages: 10, maxPackages: 19,   label: '10–19 pkgs / cycle', bonusCentsPerPackage: 150 }, // +$1.50
  { minPackages: 20, maxPackages: null, label: '20+ pkgs / cycle',  bonusCentsPerPackage: 250 }, // +$2.50
];

export function getQuantityTier(packageCount: number): QuantityTier {
  return (
    QUANTITY_TIERS.find(
      (t) => packageCount >= t.minPackages && (t.maxPackages === null || packageCount <= t.maxPackages),
    ) ?? QUANTITY_TIERS[0]
  );
}

// ─── Platform split ───────────────────────────────────────────────────────────

/** Porchivo platform fee percentage (integer, e.g. 15 = 15 %) */
export const PLATFORM_FEE_PCT = 15;

/** Partner revenue share percentage */
export const PARTNER_SHARE_PCT = 100 - PLATFORM_FEE_PCT; // 85

// ─── Rate calculation ────────────────────────────────────────────────────────

export interface RateBreakdown {
  /** Gross amount homeowner pays (cents) */
  grossCents: number;
  /** Porchivo platform fee (cents) */
  platformFeeCents: number;
  /** Partner's net earnings (cents) */
  partnerEarnCents: number;
}

/**
 * Calculate the full rate breakdown for a single hold.
 * @param size       Package size category
 * @param geo        Geographic tier of the homeowner's address
 * @param cycleCount Total packages the partner has accepted this billing cycle
 *                   (used to determine quantity bonus tier)
 */
export function calculateRate(
  size: PackageSize,
  geo: GeoTier = 'tier3',
  cycleCount: number = 1,
): RateBreakdown {
  const base = BASE_RATE_CENTS[size];
  const geoAdjusted = Math.round((base * GEO_MULTIPLIER_PCT[geo]) / 100);
  const qTier = getQuantityTier(cycleCount);
  const grossCents = geoAdjusted + qTier.bonusCentsPerPackage;
  const platformFeeCents = Math.round(grossCents * (PLATFORM_FEE_PCT / 100));
  const partnerEarnCents = grossCents - platformFeeCents;
  return { grossCents, platformFeeCents, partnerEarnCents };
}

/**
 * Suggested quick-pick rate options for the create-assignment screen.
 * Presented as chip buttons; homeowner can still type a custom amount.
 */
export const RATE_OPTIONS_BY_SIZE: Record<PackageSize, { label: string; cents: number }[]> = {
  small:  [
    { label: 'Free', cents: 0    },
    { label: '$3',   cents: 300  },
    { label: '$4',   cents: 400  },
    { label: '$5',   cents: 500  },
    { label: 'Custom', cents: -1 },
  ],
  medium: [
    { label: 'Free', cents: 0    },
    { label: '$6',   cents: 600  },
    { label: '$8',   cents: 800  },
    { label: '$10',  cents: 1000 },
    { label: '$12',  cents: 1200 },
    { label: 'Custom', cents: -1 },
  ],
  large:  [
    { label: 'Free', cents: 0    },
    { label: '$12',  cents: 1200 },
    { label: '$15',  cents: 1500 },
    { label: '$18',  cents: 1800 },
    { label: '$25',  cents: 2500 },
    { label: 'Custom', cents: -1 },
  ],
};

/** Default suggested rate (homeowner pre-fill) for a given size + geo tier */
export function suggestedRateCents(size: PackageSize, geo: GeoTier = 'tier3'): number {
  return calculateRate(size, geo).grossCents;
}

// ─── Marketing copy helpers ───────────────────────────────────────────────────

/** Formatted per-hold range for marketing ("$3–$25 per hold") */
export const MARKETING_RATE_RANGE = '$3–$25 per hold';

/** Formatted monthly range for active partners */
export const MARKETING_MONTHLY_RANGE = '$80–$250/month';

/** Monthly range for hero stats */
export const MARKETING_MONTHLY_HERO = '$80–$250/mo';

/**
 * Earnings examples for onboarding screens.
 * Based on a blended avg rate of ~$8 (medium T3) after 85 % share.
 */
export const EARNINGS_EXAMPLES: { label: string; perMonth: string; note: string }[] = [
  { label: '1 hold / week',  perMonth: '$27–$85/mo',   note: 'light activity'     },
  { label: '3 holds / week', perMonth: '$80–$250/mo',  note: 'most partners'      },
  { label: '5+ holds/week',  perMonth: '$200–$450+/mo', note: 'high-volume metros' },
];

/**
 * Tier-based monthly earning bands shown in payout setup.
 */
export const EARNING_TIERS_SETUP: { label: string; amount: string }[] = [
  { label: '1–3 holds/wk',  amount: '$27–$85/mo'   },
  { label: '4–8 holds/wk',  amount: '$80–$200/mo'  },
  { label: '9+ holds/wk',   amount: '$200–$450+/mo' },
];
