/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPERIMENTS — live, measurable A/B testing for the onboarding flow.
 *
 * What makes this a *real* test (not just a global toggle):
 *  1. Sticky assignment — each device is deterministically bucketed once and the
 *     result is persisted, so a user always sees the same variant across launches.
 *     Without this you can't measure retention by cohort.
 *  2. Remote control — a row in Supabase (`experiment_config`) acts as the source
 *     of truth: kill switch, traffic rollout %, or a forced variant. Flip it and
 *     new assignments react live, with a safe local fallback if it's unreachable.
 *  3. Exposure tagging — the resolved variant is stamped on every analytics event
 *     (see analytics.setGlobalAnalyticsProps), so the funnel + retention can be
 *     sliced per variant downstream.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  activeVariant as LOCAL_DEFAULT_VARIANT,
  type OnboardingVariant,
} from '@/config/onboardingExperiments';

/** The experiment key — matches the `key` column in `experiment_config`. */
export const ONBOARDING_EXPERIMENT_KEY = 'onboarding_welcome_v1';

const DEVICE_ID_KEY = 'porchivo_device_id_v1';
const ASSIGNMENT_KEY = `porchivo_exp_assignment_${ONBOARDING_EXPERIMENT_KEY}`;
const EXPOSURE_KEY = `porchivo_exp_exposed_${ONBOARDING_EXPERIMENT_KEY}`;
const STITCH_KEY = `porchivo_exp_stitched_${ONBOARDING_EXPERIMENT_KEY}`;

/** Shape of a row in the Supabase `experiment_config` table. */
export interface ExperimentRemoteConfig {
  /** Master kill switch. When false, everyone gets `control`. */
  enabled: boolean;
  /** Force a single variant for everyone (overrides rollout). null = bucket normally. */
  forcedVariant: OnboardingVariant | null;
  /** 0–100: share of traffic allocated to the treatment (`visibility_led`). */
  rolloutPercent: number;
}

const DEFAULT_REMOTE_CONFIG: ExperimentRemoteConfig = {
  enabled: true,
  forcedVariant: null,
  rolloutPercent: 50,
};

const CONTROL: OnboardingVariant = 'control';
const TREATMENT: OnboardingVariant = 'visibility_led';

interface StoredAssignment {
  variant: OnboardingVariant;
  /** Snapshot of the config used, so we can detect meaningful changes. */
  rolloutPercent: number;
  forcedVariant: OnboardingVariant | null;
  assignedAt: number;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable per-install id used as the bucketing seed. Created once, then reused. */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = makeId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  return fresh;
}

/**
 * Deterministic 0–99 bucket from a string seed (FNV-1a). Same seed → same bucket,
 * so assignment is stable and uniformly distributed without a server round-trip.
 */
function bucketFromSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

/** Best-effort fetch of the remote config. Silent fallback keeps onboarding resilient. */
export async function fetchRemoteConfig(): Promise<ExperimentRemoteConfig> {
  try {
    const { data, error } = await supabase
      .from('experiment_config')
      .select('enabled, forced_variant, rollout_percent')
      .eq('key', ONBOARDING_EXPERIMENT_KEY)
      .maybeSingle();

    if (error || !data) return DEFAULT_REMOTE_CONFIG;

    const forced = data.forced_variant as string | null;
    return {
      enabled: data.enabled ?? DEFAULT_REMOTE_CONFIG.enabled,
      forcedVariant:
        forced === CONTROL || forced === TREATMENT ? (forced as OnboardingVariant) : null,
      rolloutPercent:
        typeof data.rollout_percent === 'number'
          ? Math.max(0, Math.min(100, data.rollout_percent))
          : DEFAULT_REMOTE_CONFIG.rolloutPercent,
    };
  } catch {
    return DEFAULT_REMOTE_CONFIG;
  }
}

function resolveVariant(
  config: ExperimentRemoteConfig,
  bucket: number,
): OnboardingVariant {
  if (!config.enabled) return CONTROL;
  if (config.forcedVariant) return config.forcedVariant;
  // Buckets [0, rolloutPercent) go to treatment; the rest to control.
  return bucket < config.rolloutPercent ? TREATMENT : CONTROL;
}

/**
 * Resolve the variant for this device. Assignment is sticky: once a device is
 * bucketed it keeps that variant unless the experiment is force-flipped or the
 * kill switch changes the outcome — so retention can be attributed to a cohort.
 */
export async function resolveOnboardingVariant(): Promise<{
  variant: OnboardingVariant;
  deviceId: string;
  bucket: number;
  config: ExperimentRemoteConfig;
}> {
  const deviceId = await getDeviceId();
  const bucket = bucketFromSeed(`${ONBOARDING_EXPERIMENT_KEY}:${deviceId}`);
  const config = await fetchRemoteConfig();

  let stored: StoredAssignment | null = null;
  try {
    const raw = await AsyncStorage.getItem(ASSIGNMENT_KEY);
    if (raw) stored = JSON.parse(raw) as StoredAssignment;
  } catch {
    stored = null;
  }

  const target = resolveVariant(config, bucket);

  // Honor an explicit force/kill change from remote even for already-assigned
  // devices; otherwise keep the existing sticky assignment.
  const configChanged =
    !stored ||
    stored.forcedVariant !== config.forcedVariant ||
    (config.forcedVariant === null && stored.variant !== target && stored.rolloutPercent !== config.rolloutPercent);

  const variant = stored && !configChanged ? stored.variant : target;

  if (!stored || stored.variant !== variant) {
    const next: StoredAssignment = {
      variant,
      rolloutPercent: config.rolloutPercent,
      forcedVariant: config.forcedVariant,
      assignedAt: Date.now(),
    };
    await AsyncStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(next)).catch(() => {});
  }

  return { variant: variant ?? LOCAL_DEFAULT_VARIANT, deviceId, bucket, config };
}

/** QA helper — clears the sticky assignment so the next resolve re-buckets. */
export async function clearExperimentAssignment(): Promise<void> {
  await AsyncStorage.removeItem(ASSIGNMENT_KEY);
  await AsyncStorage.removeItem(EXPOSURE_KEY).catch(() => {});
  await AsyncStorage.removeItem(STITCH_KEY).catch(() => {});
}

/**
 * Returns true exactly once per install — the first time a device is actually
 * exposed to the experiment (i.e. sees the welcome screen). This is the clean
 * denominator for cohort analysis: every device that fires `experiment_exposure`
 * is a counted participant, regardless of whether they continue.
 */
export async function markExposedOnce(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(EXPOSURE_KEY);
    if (seen) return false;
    await AsyncStorage.setItem(EXPOSURE_KEY, Date.now().toString());
    return true;
  } catch {
    return false;
  }
}

/**
 * Stitch the pre-auth `device_id` to the authenticated `user_id` so that
 * anonymous onboarding events recorded before sign-up can be attributed to the
 * same user for retention. Idempotent per (device, user) pair; writes a row to
 * the Supabase `experiment_identity` mapping table. Silent on failure.
 */
export async function stitchIdentity(
  deviceId: string,
  userId: string,
): Promise<boolean> {
  if (!deviceId || !userId) return false;
  try {
    const marker = `${deviceId}:${userId}`;
    const prev = await AsyncStorage.getItem(STITCH_KEY);
    if (prev === marker) return false;

    const { error } = await supabase.from('experiment_identity').upsert(
      {
        device_id: deviceId,
        user_id: userId,
        experiment: ONBOARDING_EXPERIMENT_KEY,
      },
      { onConflict: 'device_id,experiment' },
    );
    // 42P01 = table missing; treat as benign so onboarding never blocks.
    if (error && error.code !== '42P01') {
      return false;
    }
    await AsyncStorage.setItem(STITCH_KEY, marker).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
