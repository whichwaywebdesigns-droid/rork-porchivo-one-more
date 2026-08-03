import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { log, warn } from "./logger";

/**
 * Funnel events tracked across onboarding → paywall → conversion.
 * Naming: snake_case, past-tense for completions, present for views/starts.
 */
export type FunnelEvent =
  | 'intro_view'
  | 'intro_slide_view'
  | 'intro_skip'
  | 'intro_complete'
  | 'role_selected'
  | 'onboarding_started'
  | 'onboarding_auth_started'
  | 'onboarding_auth_completed'
  | 'onboarding_intent_selected'
  | 'onboarding_home_area_saved'
  | 'onboarding_push_prompt_shown'
  | 'onboarding_push_allowed'
  | 'onboarding_push_denied'
  | 'onboarding_step_view'
  | 'onboarding_step_skipped'
  | 'onboarding_step_complete'
  | 'onboarding_carousel_slide'
  | 'onboarding_carousel_dismiss'
  | 'onboarding_completed'
  | 'onboarding_complete'
  | 'checklist_item_tapped'
  | 'checklist_item_completed'
  | 'safe_dropoff_preference_saved'
  | 'trusted_contact_started'
  | 'paywall_view'
  | 'paywall_plan_select'
  | 'paywall_tab_change'
  | 'paywall_dismiss'
  | 'trial_start'
  | 'purchase_success'
  | 'purchase_fail'
  | 'restore_attempt'
  | 'restore_success'
  | 'restore_fail'
  | 'intro_role_selected'
  | 'billing_screen_view'
  | 'billing_manage_tap'
  | 'billing_sync_tap'
  | 'billing_restore_tap'
  | 'billing_upgrade_tap'
  | 'billing_resubscribe_tap'
  | 'partner_payout_setup_view'
  | 'partner_identity_verify_start'
  | 'partner_identity_verify_redirected'
  | 'partner_bank_connect_start'
  | 'partner_bank_connect_redirected'
  | 'partner_payout_setup_complete'
  | 'referral_screen_view'
  | 'referral_link_copied'
  | 'referral_share_completed'
  | 'intro_opened_from_welcome'
  | 'session_start'
  | 'identity_stitched'
  | 'winback_screen_view'
  | 'winback_claim_tapped'
  | 'winback_dismissed'
  | 'partner_nudge_tapped'
  | 'experiment_exposure'
  | 'trust_engine_view'
  | 'trust_engine_manual_cycle'
  | 'trust_engine_upgrade_tap'
  | 'trust_engine_loop_start'
  | 'trust_engine_loop_stop'
  | 'trust_engine_remediation_ack'
  | 'trust_engine_report_export'
  | 'support_screen_view'
  | 'support_ticket_created'
  | 'support_ticket_replied'
  | 'support_ticket_closed'
  | 'support_ticket_reopened'
  | 'guest_mode_started'
  | 'guest_convert';

export interface AnalyticsEvent {
  event: FunnelEvent;
  props?: Record<string, string | number | boolean | null | undefined>;
  ts: number;
  sessionId: string;
  userId?: string | null;
}

const STORAGE_KEY = 'porchivo_analytics_events_v1';
const SESSION_KEY = 'porchivo_analytics_session_v1';
const MAX_LOCAL_EVENTS = 500;

let cachedSessionId: string | null = null;
let memoryBuffer: AnalyticsEvent[] = [];
let hydrated = false;

/**
 * Props merged into every tracked event (e.g. the resolved A/B variant). Set
 * once at startup by ExperimentsContext so the whole funnel is cohort-tagged.
 */
let globalProps: AnalyticsEvent['props'] = {};

/** Merge persistent props onto every subsequent event. Shallow-merges. */
export function setGlobalAnalyticsProps(props: AnalyticsEvent['props']): void {
  globalProps = { ...globalProps, ...props };
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getSessionId(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const existing = await AsyncStorage.getItem(SESSION_KEY);
  if (existing) {
    cachedSessionId = existing;
    return existing;
  }
  const fresh = makeId();
  cachedSessionId = fresh;
  await AsyncStorage.setItem(SESSION_KEY, fresh);
  return fresh;
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AnalyticsEvent[];
      if (Array.isArray(parsed)) memoryBuffer = parsed;
    }
  } catch (e) {
    log('[analytics] hydrate error:', e);
  }
  hydrated = true;
}

async function persist(): Promise<void> {
  try {
    const trimmed = memoryBuffer.slice(-MAX_LOCAL_EVENTS);
    memoryBuffer = trimmed;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    log('[analytics] persist error:', e);
  }
}

/**
 * Circuit breaker for remote uploads. Config-level failures (missing table,
 * disabled/rotated API key) will fail on EVERY event — without a breaker each
 * tracked event fires a doomed network request and spams logs. After a hard
 * config error (or 3 consecutive transient failures) remote upload is disabled
 * for the rest of the session; events keep buffering locally.
 */
let remoteDisabled = false;
let remoteFailureStreak = 0;
const MAX_REMOTE_FAILURES = 3;

async function uploadRemote(evt: AnalyticsEvent): Promise<void> {
  if (remoteDisabled || !isSupabaseConfigured) return;
  // Best-effort. Failures are non-blocking so we never degrade UX.
  try {
    const { error } = await supabase.from('analytics_events').insert({
      event: evt.event,
      props: evt.props ?? {},
      session_id: evt.sessionId,
      user_id: evt.userId ?? null,
      platform: Platform.OS,
      created_at: new Date(evt.ts).toISOString(),
    });
    if (error) {
      const isConfigError =
        error.code === '42P01' || /legacy api key|invalid api key|jwt/i.test(error.message);
      remoteFailureStreak += 1;
      if (isConfigError || remoteFailureStreak >= MAX_REMOTE_FAILURES) {
        remoteDisabled = true;
        warn(
          '[analytics] Remote analytics disabled for this session:',
          error.message,
          isConfigError ? '(config error — check Supabase API key / analytics_events table)' : '',
        );
      }
    } else {
      remoteFailureStreak = 0;
    }
  } catch {
    // Network-level failure — count toward the breaker.
    remoteFailureStreak += 1;
    if (remoteFailureStreak >= MAX_REMOTE_FAILURES) remoteDisabled = true;
  }
}

/** Track a funnel event. Always non-blocking; safe to fire-and-forget. */
export async function track(
  event: FunnelEvent,
  props?: AnalyticsEvent['props'],
  userId?: string | null,
): Promise<void> {
  await hydrate();
  const evt: AnalyticsEvent = {
    event,
    props: { ...globalProps, ...(props ?? {}) },
    ts: Date.now(),
    sessionId: await getSessionId(),
    userId: userId ?? null,
  };
  memoryBuffer.push(evt);
  log('[funnel]', event, props ?? {});
  await persist();
  void uploadRemote(evt);
}

/** Returns a derived funnel summary for the current device. */
export async function getFunnelSummary(): Promise<{
  introViewed: boolean;
  introCompleted: boolean;
  onboardingCompleted: boolean;
  paywallViews: number;
  trialStarts: number;
  purchases: number;
  conversionRate: number;
  events: AnalyticsEvent[];
}> {
  await hydrate();
  const has = (e: FunnelEvent) => memoryBuffer.some((x) => x.event === e);
  const count = (e: FunnelEvent) => memoryBuffer.filter((x) => x.event === e).length;
  const paywallViews = count('paywall_view');
  const purchases = count('purchase_success');
  return {
    introViewed: has('intro_view'),
    introCompleted: has('intro_complete'),
    onboardingCompleted: has('onboarding_complete'),
    paywallViews,
    trialStarts: count('trial_start'),
    purchases,
    conversionRate: paywallViews > 0 ? purchases / paywallViews : 0,
    events: [...memoryBuffer],
  };
}

/**
 * Fire a lightweight "active day" ping. Used as the recurring retention signal
 * so D1/D7/D30 can be computed per cohort from `analytics_events`. Idempotent
 * per app process: only the first call after launch emits, which keeps it a
 * clean session-level signal rather than a per-screen counter.
 */
let sessionStartFired = false;
export async function trackSessionStart(
  props?: AnalyticsEvent['props'],
  userId?: string | null,
): Promise<void> {
  if (sessionStartFired) return;
  sessionStartFired = true;
  await track('session_start', props, userId);
}

/** Clears local funnel buffer. Useful for QA / sign-out. */
export async function clearAnalytics(): Promise<void> {
  memoryBuffer = [];
  hydrated = true;
  await AsyncStorage.removeItem(STORAGE_KEY);
}
