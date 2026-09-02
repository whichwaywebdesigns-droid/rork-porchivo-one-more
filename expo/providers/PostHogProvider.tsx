/**
 * PostHogProvider — Expo-Go-safe analytics + experiments context.
 *
 * Wraps the lightweight fetch client in `lib/posthog.ts` so screens can:
 *   - capture events (`capture`)
 *   - read feature flags reactively (`getFlag` — components re-render when
 *     flags resolve from the /decide endpoint, falling back to the cached
 *     variant from the previous session)
 *
 * Identity: initializes the client on mount and stitches the anonymous
 * device id to the auth user id as soon as a session appears, so pre-auth
 * onboarding events join to the authenticated person in PostHog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import {
  capture,
  fetchFlags,
  getFlag as getModuleFlag,
  getFlagPayload,
  identifyPostHog,
  initPostHog,
  isPostHogEnabled,
  type PostHogFlagValue,
} from '@/lib/posthog';
import { useApp } from '@/store/AppContext';

type PostHogFlags = Record<string, PostHogFlagValue>;

export const [PostHogProvider, usePostHog] = createContextHook(() => {
  const { session } = useApp();
  const userId = session?.user?.id ?? null;
  const [flags, setFlags] = useState<PostHogFlags>({});
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    void initPostHog();
  }, []);

  const refreshFlags = useCallback(async () => {
    const next = await fetchFlags();
    setFlags({ ...next });
  }, []);

  // Resolve flags shortly after boot so experiments land on the first
  // meaningful paint instead of the second.
  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshFlags();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshFlags]);

  // Login → stitch the anon device id and re-resolve user-scoped flags.
  useEffect(() => {
    if (!userId || identifiedRef.current === userId) return;
    identifiedRef.current = userId;
    void identifyPostHog(userId, {}).then(() => refreshFlags());
  }, [userId, refreshFlags]);

  // Reads from the live state first (triggers re-renders), then the module
  // cache (covers callers rendered before the provider effect ran).
  const getFlag = useCallback(
    (key: string): PostHogFlagValue => flags[key] ?? getModuleFlag(key),
    [flags],
  );

  return useMemo(
    () => ({
      isEnabled: isPostHogEnabled(),
      flags,
      getFlag,
      getFlagPayload,
      capture,
      refreshFlags,
    }),
    [flags, getFlag, refreshFlags],
  );
});
