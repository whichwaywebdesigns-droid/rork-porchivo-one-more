/**
 * ExperimentsContext — resolves the live onboarding A/B variant once at startup
 * and exposes it to the flow.
 *
 * Resolution combines a sticky per-device assignment with the Supabase-backed
 * remote config (kill switch / rollout % / forced variant). The resolved variant
 * is also pushed into the analytics layer so every event is tagged with it,
 * which is what lets retention be measured per cohort.
 *
 * While resolving, screens fall back to the local default variant so the UI
 * never blocks on the network.
 */

import { useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import {
  activeVariant as LOCAL_DEFAULT_VARIANT,
  getOnboardingExperiment,
  type OnboardingVariant,
} from '@/config/onboardingExperiments';
import {
  ONBOARDING_EXPERIMENT_KEY,
  resolveOnboardingVariant,
  stitchIdentity,
} from '@/lib/experiments';
import { setGlobalAnalyticsProps, trackSessionStart } from '@/lib/analytics';
import { useApp } from '@/store/AppContext';

export const [ExperimentsProvider, useExperiments] = createContextHook(() => {
  const { session } = useApp();
  const userId = session?.user?.id ?? null;
  const [variant, setVariant] = useState<OnboardingVariant>(LOCAL_DEFAULT_VARIANT);
  const [isResolved, setIsResolved] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { variant: resolved, deviceId: id, bucket } = await resolveOnboardingVariant();
        if (cancelled) return;
        setVariant(resolved);
        setDeviceId(id);
        // Tag every subsequent analytics event with the cohort + device.
        setGlobalAnalyticsProps({
          experiment: ONBOARDING_EXPERIMENT_KEY,
          variant: resolved,
          exp_bucket: bucket,
          device_id: id,
        });
        // Recurring retention signal, now cohort-tagged. Fires once per launch.
        void trackSessionStart(undefined, userId);
      } catch {
        // Keep local default; analytics still works without the tag.
      } finally {
        if (!cancelled) setIsResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the user authenticates, stitch the pre-auth device_id to their user_id
  // so anonymous onboarding events join to the authenticated user for retention.
  useEffect(() => {
    if (!deviceId || !userId) return;
    void stitchIdentity(deviceId, userId);
  }, [deviceId, userId]);

  const experiment = useMemo(() => getOnboardingExperiment(variant), [variant]);

  return useMemo(
    () => ({ variant, experiment, isResolved }),
    [variant, experiment, isResolved],
  );
});
