import React, { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAnalytics } from '@/store/AnalyticsContext';

import TrackingWelcomeScreen from './tracking-welcome';
import TrackingAddDeliveryScreen from './tracking-add-delivery';
import TrackingTheftShieldScreen from './tracking-theft-shield';
import TrackingNotificationsScreen from './tracking-notifications';
import TrackingPartnersScreen from './tracking-partners';
import TrackingCompleteScreen from './tracking-complete';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Step manager for the 6-step tracking onboarding flow.
 * Renders one step at a time, tracks which steps the user completed (vs skipped),
 * and routes to the home tab on finish.
 *
 * Step mapping:
 *   1 → tracking-welcome    (value prop, no auth/permissions)
 *   2 → tracking-add-delivery (first delivery + inline auth)
 *   3 → tracking-theft-shield  (ZIP risk score)
 *   4 → tracking-notifications (priming → system prompt)
 *   5 → tracking-partners      (coarse location, nearby partners)
 *   6 → tracking-complete      (summary → home)
 */
export default function TrackingOnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const { track } = useAnalytics();

  const [step, setStep] = useState<Step>(1);
  const completedSteps = useRef<Set<number>>(new Set());

  const markComplete = useCallback((stepNum: number) => {
    completedSteps.current.add(stepNum);
  }, []);

  const goNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((prev) => {
      const next = (prev + 1) as Step;
      if (next > 6) {
        // Should not happen — complete screen calls goHome
        return prev;
      }
      return next;
    });
  }, []);

  const goSkip = useCallback(
    (skipFrom: number) => {
      track('onboarding_step_skipped', { step: skipFrom });
      // Skipping does NOT mark the step as completed
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((prev) => {
        const next = (prev + 1) as Step;
        if (next > 6) return prev;
        return next;
      });
    },
    [track],
  );

  const goHome = useCallback(() => {
    track('onboarding_complete', {
      steps_completed: Array.from(completedSteps.current).join(','),
      step_count: completedSteps.current.size,
    });
    router.replace('/(tabs)/(home)' as never);
  }, [router, track]);

  // ── Render current step ─────────────────────────────────────────────
  switch (step) {
    case 1:
      return <TrackingWelcomeScreen onContinue={() => { markComplete(1); goNext(); }} />;

    case 2:
      return (
        <TrackingAddDeliveryScreen
          onContinue={() => { markComplete(2); goNext(); }}
          onSkip={() => goSkip(2)}
        />
      );

    case 3:
      return (
        <TrackingTheftShieldScreen
          onContinue={() => { markComplete(3); goNext(); }}
          onSkip={() => goSkip(3)}
        />
      );

    case 4:
      return (
        <TrackingNotificationsScreen
          onContinue={() => { markComplete(4); goNext(); }}
          onSkip={() => goSkip(4)}
        />
      );

    case 5:
      return (
        <TrackingPartnersScreen
          onContinue={() => { markComplete(5); goNext(); }}
          onSkip={() => goSkip(5)}
        />
      );

    case 6:
      return (
        <TrackingCompleteScreen
          onContinue={goHome}
          completedSteps={completedSteps.current}
        />
      );

    default:
      // Fallback — should never reach
      return <TrackingWelcomeScreen onContinue={() => { markComplete(1); goNext(); }} />;
  }
}
