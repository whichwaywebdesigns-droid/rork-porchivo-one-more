/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ONBOARDING EXPERIMENTS — A/B-testable copy & flags for the refined flow
 *
 * Everything the growth team might want to test lives here so screens stay
 * structural and dumb. Swap a value, or wire `activeVariant` to a remote flag /
 * Supabase config later, and the whole onboarding + paywall re-skins itself.
 *
 * Nothing here is fear-based or salesy by design — copy is calm, direct, and
 * trust-forward. Keep it that way.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PRICING } from '@/config/app';
import type { PorchivoRole, PainPoint } from '@/store/OnboardingFlowContext';

export type OnboardingVariant = 'control' | 'visibility_led';

/** Welcome headline / subheadline pair — testable. */
export interface WelcomeCopy {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryAction: string;
}

/** A single trust-row item shown beneath the welcome hero. */
export interface TrustItem {
  id: string;
  label: string;
}

/** Paywall CTA + emphasis configuration — testable. */
export interface PaywallConfig {
  headline: string;
  /** 'trial' shows "Start free trial"; 'direct' shows "Continue with Pro". */
  ctaModel: 'trial' | 'direct';
  /** Which plan card reads as primary. Annual by default. */
  emphasizedPlan: 'annual' | 'monthly';
  /** Card stacking order, top to bottom. */
  planOrder: ('annual' | 'monthly')[];
  /** Offer the low-emphasis "continue free" escape hatch. */
  allowFreeContinue: boolean;
  /** When during the journey the paywall may appear. Never 'first_launch'. */
  timing: 'after_value' | 'after_setup';
}

interface OnboardingExperiment {
  welcome: WelcomeCopy;
  trustItems: TrustItem[];
  paywall: PaywallConfig;
}

// ── Variants ─────────────────────────────────────────────────────────────────

const CONTROL: OnboardingExperiment = {
  welcome: {
    headline: 'From blocks to buildings — superior package and property tracking for homeowners and homeowner associations.',
    subheadline: '',
    primaryCta: 'Get started',
    secondaryAction: 'Sign in',
  },
  trustItems: [
    { id: 'visibility', label: 'Real-time delivery visibility' },
    { id: 'handoff', label: 'Cleaner handoff tracking' },
    { id: 'coordination', label: 'Better building coordination' },
  ],
  paywall: {
    headline: 'Unlock Pro for full building visibility.',
    ctaModel: PRICING.annual.trialDays > 0 ? 'trial' : 'direct',
    emphasizedPlan: 'annual',
    planOrder: ['annual', 'monthly'],
    allowFreeContinue: true,
    timing: 'after_setup',
  },
};

const VISIBILITY_LED: OnboardingExperiment = {
  ...CONTROL,
  welcome: {
    ...CONTROL.welcome,
    headline: 'From front porches to fifth floors — see every delivery, clearly.',
  },
};

const EXPERIMENTS: Record<OnboardingVariant, OnboardingExperiment> = {
  control: CONTROL,
  visibility_led: VISIBILITY_LED,
};

/**
 * The currently active variant. Point this at a remote flag or Supabase value
 * later for live A/B tests — screens never need to change.
 */
export const activeVariant: OnboardingVariant = 'visibility_led';

export function getOnboardingExperiment(
  variant: OnboardingVariant = activeVariant,
): OnboardingExperiment {
  return EXPERIMENTS[variant];
}

// ── Personalized copy ──────────────────────────────────────────────────────
// Supporting lines derived from the user's role + pain point. Used on the value
// preview and paywall so the experience feels written for them, not at them.

const ROLE_NOUN: Record<PorchivoRole, string> = {
  resident: 'your deliveries',
  property_manager: 'your building',
  staff: 'the front desk',
  other: 'your packages',
};

const PAIN_PHRASE: Record<PainPoint, string> = {
  missed_alerts: 'so nothing slips past you',
  delivery_confusion: 'so every package has a clear status',
  resident_comms: 'so everyone stays in the loop',
  front_desk: 'so the front desk stays light',
  all: 'across the whole operation',
};

/** One calm sentence personalizing the value-preview screen. */
export function valuePreviewSupportingCopy(
  role: PorchivoRole | null,
  pain: PainPoint | null,
): string {
  const noun = role ? ROLE_NOUN[role] : 'your deliveries';
  const phrase = pain ? PAIN_PHRASE[pain] : 'so nothing slips past you';
  return `Built around ${noun} ${phrase}.`;
}

/** Sub-line shown under the paywall headline, personalized when possible. */
export function paywallSubcopy(
  role: PorchivoRole | null,
  pain: PainPoint | null,
): string {
  if (role === 'property_manager' || role === 'staff') {
    return 'Coordinate deliveries, handoffs, and your team in one calm view.';
  }
  const phrase = pain ? PAIN_PHRASE[pain] : 'so nothing slips past you';
  return `Stay ahead of every delivery — ${phrase}.`;
}
