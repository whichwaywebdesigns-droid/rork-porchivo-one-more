/**
 * Porchivo — In-App Rating & Review System
 *
 * Tracks user engagement milestones via AsyncStorage:
 *   - Session open counts (3rd, 10th, 25th app open)
 *   - 7-day active use milestone
 *   - Cooldown between prompts (90 days)
 *   - "Remind me later" dismissal (re-prompt after 14 days)
 *
 * Uses expo-store-review (SKStoreReviewController on iOS, Google Play
 * In-App Review API on Android) for native 1–5 star dialogs.
 * Falls back to direct store deep-links if the native API is unavailable.
 *
 * Prompts are NEVER triggered during onboarding or critical actions —
 * the hook caller is responsible for gating on isOnboarded.
 */

import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from './logger';

// ── Storage keys ────────────────────────────────────────────────────────────

const REVIEW_STORAGE_KEY = 'porchivo_review_state_v2';

// ── Configuration ───────────────────────────────────────────────────────────

/** Session milestones that trigger a review prompt. */
const SESSION_MILESTONES: readonly number[] = [3, 10, 25];

/** Days of active use before prompting (in addition to session counts). */
const ACTIVE_USE_DAYS_THRESHOLD = 7;

/** Minimum days between prompts after a successful review. */
const COOLDOWN_DAYS_AFTER_REVIEW = 90;

/** Days to wait before re-prompting after "Remind me later". */
const REMIND_LATER_COOLDOWN_DAYS = 14;

/** iOS App Store deep-link. */
const IOS_STORE_URL = 'itms-apps://itunes.apple.com/app/id6760732057?action=write-review';

/** Android Play Store deep-link. */
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.whichwayweblabs.porchivo&showAllReviews=true';

/** Web fallback (used when Platform.OS === 'web' or both deep-links fail). */
const WEB_STORE_URL = 'https://apps.apple.com/app/id6760732057';

// ── Types ───────────────────────────────────────────────────────────────────

export type ReviewTriggerReason = 'session_milestone' | 'active_use_milestone' | 'manual';

export interface ReviewState {
  /** Total number of times the app has been opened. */
  sessionCount: number;
  /** ISO date string of the first app open. */
  firstOpenDate: string;
  /** ISO date string of the last prompt (native or fallback). */
  lastPromptDate: string | null;
  /** ISO date string when user chose "Remind me later". */
  lastRemindLaterDate: string | null;
  /** Whether the native review dialog was ever shown. */
  hasPrompted: boolean;
  /** Whether the user has completed a review (dismissed the native dialog after seeing it). */
  hasReviewed: boolean;
  /** Set of session milestones already triggered (prevents re-triggering same milestone). */
  triggeredMilestones: number[];
  /** Whether the 7-day active use milestone was triggered. */
  activeUseTriggered: boolean;
}

// ── State persistence ───────────────────────────────────────────────────────

function getDefaultState(): ReviewState {
  return {
    sessionCount: 0,
    firstOpenDate: new Date().toISOString(),
    lastPromptDate: null,
    lastRemindLaterDate: null,
    hasPrompted: false,
    hasReviewed: false,
    triggeredMilestones: [],
    activeUseTriggered: false,
  };
}

export async function getReviewState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReviewState>;
      // Merge with defaults to handle schema migrations gracefully
      return { ...getDefaultState(), ...parsed };
    }
  } catch (e) {
    log('[StoreReview] Error reading review state:', e);
  }
  return getDefaultState();
}

async function saveReviewState(state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    log('[StoreReview] Error saving review state:', e);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateString: string | null): number {
  if (!dateString) return Infinity;
  return (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Returns the platform-appropriate store listing URL.
 */
export function getStoreUrl(): string {
  if (Platform.OS === 'android') return ANDROID_STORE_URL;
  if (Platform.OS === 'ios') return IOS_STORE_URL;
  return WEB_STORE_URL;
}

/**
 * Opens the store listing directly (fallback when native review API
 * is unavailable, or when user explicitly chooses to rate from settings).
 */
export async function openStoreListing(): Promise<void> {
  const url = getStoreUrl();
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      log('[StoreReview] Opened store listing:', url);
    } else {
      // Fallback to web URL if native deep-link fails
      await Linking.openURL(WEB_STORE_URL);
      log('[StoreReview] Native deep-link failed, opened web fallback');
    }
  } catch (e) {
    log('[StoreReview] Error opening store listing:', e);
    // Last-resort: try the web URL
    try {
      await Linking.openURL(WEB_STORE_URL);
    } catch {
      // Give up silently
    }
  }
}

// ── Core logic ──────────────────────────────────────────────────────────────

/**
 * Increments the session counter and determines whether a review prompt
 * should be shown. Returns the trigger reason if a prompt should fire,
 * or null if no prompt is needed.
 *
 * This should be called once per app open, AFTER onboarding is complete.
 */
export async function checkShouldPromptReview(): Promise<ReviewTriggerReason | null> {
  if (Platform.OS === 'web') return null;

  try {
    const state = await getReviewState();
    state.sessionCount += 1;
    log('[StoreReview] Session count:', state.sessionCount);

    // ── Cooldown checks ──────────────────────────────────────────────────

    // If user already reviewed, wait for full cooldown
    if (state.hasReviewed) {
      const daysSinceReview = daysSince(state.lastPromptDate);
      if (daysSinceReview < COOLDOWN_DAYS_AFTER_REVIEW) {
        log('[StoreReview] In cooldown after review, skipping');
        await saveReviewState(state);
        return null;
      }
    }

    // If user chose "Remind me later", respect that cooldown
    if (state.lastRemindLaterDate) {
      const daysSinceRemind = daysSince(state.lastRemindLaterDate);
      if (daysSinceRemind < REMIND_LATER_COOLDOWN_DAYS) {
        log('[StoreReview] In remind-later cooldown, skipping');
        await saveReviewState(state);
        return null;
      }
    }

    // ── Milestone: session count ─────────────────────────────────────────

    for (const milestone of SESSION_MILESTONES) {
      if (state.sessionCount >= milestone && !state.triggeredMilestones.includes(milestone)) {
        state.triggeredMilestones = [...state.triggeredMilestones, milestone];
        await saveReviewState(state);
        log('[StoreReview] Triggering session milestone:', milestone);
        return 'session_milestone';
      }
    }

    // ── Milestone: 7-day active use ──────────────────────────────────────

    if (!state.activeUseTriggered) {
      const daysSinceFirstOpen = daysSince(state.firstOpenDate);
      if (daysSinceFirstOpen >= ACTIVE_USE_DAYS_THRESHOLD && state.sessionCount >= 3) {
        state.activeUseTriggered = true;
        await saveReviewState(state);
        log('[StoreReview] Triggering 7-day active use milestone');
        return 'active_use_milestone';
      }
    }

    await saveReviewState(state);
    return null;
  } catch (e) {
    log('[StoreReview] Error checking review prompt:', e);
    return null;
  }
}

/**
 * Shows the native review dialog (SKStoreReviewController / Play In-App Review).
 * If the native API is unavailable, falls back to opening the store listing.
 *
 * This is the primary entry point for automatic milestone-based prompts.
 */
export async function showNativeReviewDialog(): Promise<boolean> {
  if (Platform.OS === 'web') {
    await openStoreListing();
    return false;
  }

  try {
    const StoreReview = await import('expo-store-review');
    const isAvailable = await StoreReview.isAvailableAsync();

    if (isAvailable) {
      log('[StoreReview] Requesting native review dialog...');
      await StoreReview.requestReview();

      const state = await getReviewState();
      state.lastPromptDate = new Date().toISOString();
      state.hasPrompted = true;
      state.hasReviewed = true;
      await saveReviewState(state);
      return true;
    }

    // Native API unavailable — fall back to store deep-link
    log('[StoreReview] Native API unavailable, falling back to store listing');
    await openStoreListing();

    const state = await getReviewState();
    state.lastPromptDate = new Date().toISOString();
    state.hasPrompted = true;
    await saveReviewState(state);
    return false;
  } catch (e) {
    log('[StoreReview] Error showing native review dialog:', e);
    // Last-resort fallback
    await openStoreListing();
    return false;
  }
}

/**
 * Records that the user chose "Remind me later".
 * Sets a cooldown before the next prompt can fire.
 */
export async function remindMeLater(): Promise<void> {
  try {
    const state = await getReviewState();
    state.lastRemindLaterDate = new Date().toISOString();
    await saveReviewState(state);
    log('[StoreReview] User chose remind me later');
  } catch (e) {
    log('[StoreReview] Error recording remind-later:', e);
  }
}

/**
 * Records that the user dismissed the prompt without action.
 * Treated the same as "remind me later" for cooldown purposes.
 */
export async function dismissPrompt(): Promise<void> {
  try {
    const state = await getReviewState();
    state.lastRemindLaterDate = new Date().toISOString();
    await saveReviewState(state);
    log('[StoreReview] User dismissed review prompt');
  } catch (e) {
    log('[StoreReview] Error recording dismissal:', e);
  }
}

/**
 * Manually triggers the review flow — always fires regardless of cooldowns.
 * Used when user explicitly taps "Rate Porchivo" from Settings/Profile.
 * Prefers the native dialog; falls back to store listing.
 */
export async function manualRequestReview(): Promise<void> {
  if (Platform.OS === 'web') {
    await openStoreListing();
    return;
  }

  try {
    const StoreReview = await import('expo-store-review');
    const isAvailable = await StoreReview.isAvailableAsync();

    if (isAvailable) {
      log('[StoreReview] Manual: requesting native review dialog...');
      await StoreReview.requestReview();
    } else {
      await openStoreListing();
    }

    const state = await getReviewState();
    state.lastPromptDate = new Date().toISOString();
    state.hasPrompted = true;
    await saveReviewState(state);
  } catch (e) {
    log('[StoreReview] Error in manual review request:', e);
    await openStoreListing();
  }
}

// ── Legacy compatibility ───────────────────────────────────────────────────
/**
 * @deprecated Use `checkShouldPromptReview` + `showNativeReviewDialog` instead.
 * Kept for backward compatibility with ShipmentsContext.
 */
export async function maybeRequestReview(): Promise<void> {
  const reason = await checkShouldPromptReview();
  if (reason) {
    await showNativeReviewDialog();
  }
}
