/**
 * useReviewPrompt — orchestrates the in-app rating system.
 *
 * On app open (after onboarding is complete), calls checkShouldPromptReview()
 * to see if a milestone has been hit. If so, shows the custom ReviewPromptSheet.
 *
 * The sheet filters for willing reviewers before calling the quota-limited
 * native review API (SKStoreReviewController / Play In-App Review).
 *
 * Also exports `triggerManualReview` for the Settings/Profile "Rate Porchivo"
 * button — bypasses milestones/cooldowns.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  checkShouldPromptReview,
  showNativeReviewDialog,
  type ReviewTriggerReason,
} from '@/lib/storeReview';
import { isEnabled } from '@/config/features';
import { log } from '@/lib/logger';

export interface ReviewPromptState {
  /** Whether the ReviewPromptSheet should be visible. */
  visible: boolean;
  /** The reason the prompt was triggered. */
  reason: ReviewTriggerReason;
}

export interface UseReviewPromptReturn extends ReviewPromptState {
  /** Dismiss the sheet (called by ReviewPromptSheet). */
  dismiss: () => void;
  /** Manually trigger the review flow (from Settings/Profile). */
  triggerManualReview: () => void;
}

/**
 * Hook that checks for review milestones on mount and exposes the prompt state.
 *
 * @param isOnboarded — only check when the user has completed onboarding.
 * @param isOnboardingScreen — true if currently on an onboarding/welcome screen.
 */
export function useReviewPrompt(
  isOnboarded: boolean | null,
  isOnboardingScreen = false,
): UseReviewPromptReturn {
  const [visible, setVisible] = useState<boolean>(false);
  const [reason, setReason] = useState<ReviewTriggerReason>('session_milestone');
  const hasCheckedRef = useRef<boolean>(false);

  useEffect(() => {
    // Guard: only check once per app session, only when onboarded,
    // not during onboarding, and only if the feature flag is on.
    if (hasCheckedRef.current) return;
    if (isOnboarded !== true) return;
    if (isOnboardingScreen) return;
    if (Platform.OS === 'web') return;
    if (!isEnabled('storeReviewPrompt')) return;

    hasCheckedRef.current = true;

    // Delay the check slightly so the prompt doesn't appear immediately on
    // app launch — wait until the UI has settled (2.5s after mount).
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const triggerReason = await checkShouldPromptReview();
          if (triggerReason) {
            log('[useReviewPrompt] Showing review prompt sheet:', triggerReason);
            setReason(triggerReason);
            setVisible(true);
          }
        } catch (e) {
          log('[useReviewPrompt] Error checking review prompt:', e);
        }
      })();
    }, 2500);

    return () => clearTimeout(timer);
  }, [isOnboarded, isOnboardingScreen]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const triggerManualReview = useCallback(() => {
    // For manual triggers, show the native dialog directly (no custom sheet)
    void showNativeReviewDialog();
  }, []);

  return { visible, reason, dismiss, triggerManualReview };
}
