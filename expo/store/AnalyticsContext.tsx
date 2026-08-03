import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import {
  AnalyticsEvent,
  FunnelEvent,
  getFunnelSummary,
  track as trackEvent,
} from '@/lib/analytics';
import { useApp } from '@/store/AppContext';

interface FunnelSummary {
  introViewed: boolean;
  introCompleted: boolean;
  onboardingCompleted: boolean;
  paywallViews: number;
  trialStarts: number;
  purchases: number;
  conversionRate: number;
  events: AnalyticsEvent[];
}

const EMPTY_SUMMARY: FunnelSummary = {
  introViewed: false,
  introCompleted: false,
  onboardingCompleted: false,
  paywallViews: 0,
  trialStarts: 0,
  purchases: 0,
  conversionRate: 0,
  events: [],
};

export const [AnalyticsProvider, useAnalytics] = createContextHook(() => {
  const { session } = useApp();
  const userId = session?.user?.id ?? null;
  const [summary, setSummary] = useState<FunnelSummary>(EMPTY_SUMMARY);

  const refresh = useCallback(async () => {
    const next = await getFunnelSummary();
    setSummary(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const track = useCallback(
    (event: FunnelEvent, props?: AnalyticsEvent['props']) => {
      void trackEvent(event, props, userId).then(() => {
        void refresh();
      });
    },
    [userId, refresh],
  );

  return useMemo(
    () => ({
      summary,
      track,
      refresh,
    }),
    [summary, track, refresh],
  );
});
