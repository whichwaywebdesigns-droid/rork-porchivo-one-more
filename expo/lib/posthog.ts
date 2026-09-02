/**
 * Lightweight PostHog client for Porchivo (Expo Go compatible).
 *
 * posthog-react-native is blocked by the Expo-Go install guard, so this
 * module talks to PostHog's ingestion API directly over `fetch`:
 *   - `POST {host}/batch/`      → event ingestion (batched, background-flushed)
 *   - `POST {host}/decide/?v=3` → feature-flag evaluation + payloads
 *
 * Design goals:
 *   - Never throws into app code — every network call fails soft and is logged.
 *   - Events queue in memory and flush on a short debounce plus on app
 *     backgrounding, so tracking never blocks renders or navigation.
 *   - The anonymous distinct_id is generated once per install and persisted;
 *     login stitches it to the auth user id via `$identify` so pre-auth
 *     onboarding events join to the authenticated person.
 *   - Flags are cached to AsyncStorage so the UI has a variant on the first
 *     cold render, then re-validated in the background.
 *
 * Everything is a no-op unless EXPO_PUBLIC_POSTHOG_API_KEY is configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { log, warn } from './logger';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(
  /\/+$/,
  '',
);

const DISTINCT_ID_KEY = 'porchivo_posthog_distinct_id';
const FLAGS_CACHE_KEY = 'porchivo_posthog_flags';

/** Debounce window before queued events are flushed to the /batch endpoint. */
const FLUSH_DELAY_MS = 2000;
/** Flush immediately once the queue reaches this many events. */
const FLUSH_THRESHOLD = 20;

export type PostHogFlagValue = string | boolean | undefined;
type PostHogFlags = Record<string, PostHogFlagValue>;
type PostHogPayloads = Record<string, unknown>;

interface QueuedEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export const isPostHogEnabled = (): boolean => POSTHOG_KEY.length > 0;

let distinctId: string | null = null;
let flags: PostHogFlags = {};
let flagPayloads: PostHogPayloads = {};
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let stateListenerAttached = false;

/** Random v4 UUID (Expo Go's JS runtime has no crypto.randomUUID). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function ensureDistinctId(): Promise<string> {
  if (distinctId) return distinctId;
  try {
    const stored = await AsyncStorage.getItem(DISTINCT_ID_KEY);
    distinctId = stored ?? uuidv4();
    if (!stored) await AsyncStorage.setItem(DISTINCT_ID_KEY, distinctId);
  } catch {
    distinctId = distinctId ?? uuidv4();
  }
  return distinctId;
}

/**
 * Initialize the client: restore the persisted distinct_id + cached flags,
 * re-validate flags in the background, fire the session's app_open event and
 * attach a background-flush listener. Safe to call multiple times.
 */
export async function initPostHog(): Promise<void> {
  if (initialized || !isPostHogEnabled()) return;
  initialized = true;

  await ensureDistinctId();

  // Flags: serve the cached variant immediately (setFlagsFromCache), then
  // re-validate against /decide in the background.
  try {
    const cached = await AsyncStorage.getItem(FLAGS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { flags: PostHogFlags; payloads: PostHogPayloads };
      flags = parsed.flags ?? {};
      flagPayloads = parsed.payloads ?? {};
    }
  } catch {
    // Corrupt cache — fall through to a fresh fetch.
  }

  void fetchFlags();

  // Anonymous launch event — this is the volume anchor for all funnels.
  capture('app_open', { platform: Platform.OS, dev: __DEV__ });

  if (!stateListenerAttached) {
    stateListenerAttached = true;
    AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') void flush();
    });
  }
}

/**
 * Stitch the anonymous device identity to the authenticated user. Fires
 * PostHog's `$identify` (with the pre-auth anon id) and re-fetches flags so
 * user-scoped experiments resolve immediately after login.
 */
export async function identifyPostHog(
  userId: string,
  traits?: Record<string, unknown>,
): Promise<void> {
  if (!isPostHogEnabled()) return;
  const anonId = await ensureDistinctId();
  if (anonId === userId) return;

  try {
    await post({
      path: '/batch/',
      body: {
        api_key: POSTHOG_KEY,
        batch: [
          {
            event: '$identify',
            distinct_id: userId,
            timestamp: new Date().toISOString(),
            properties: {
              $anon_distinct_id: anonId,
              $set: traits ?? {},
              $lib: 'porchivo-expo',
            },
          },
        ],
      },
    });
  } catch {
    // Identity stitching is best-effort; flags still resolve below.
  }

  distinctId = userId;
  await AsyncStorage.setItem(DISTINCT_ID_KEY, userId).catch(() => {});
  void fetchFlags();
}

/** Track an event. Queues and flushes on a debounce; never throws. */
export function capture(event: string, props?: Record<string, unknown>): void {
  if (!isPostHogEnabled()) return;

  const properties: Record<string, unknown> = {
    $lib: 'porchivo-expo',
    ...props,
  };

  void ensureDistinctId().then((id) => {
    queue.push({ event, properties: { distinct_id: id, ...properties }, timestamp: new Date().toISOString() });
    if (queue.length >= FLUSH_THRESHOLD) {
      void flush();
      return;
    }
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_DELAY_MS);
  });
}

/** POST the queued events to /batch/. On failure the queue is preserved. */
async function flush(): Promise<void> {
  if (!isPostHogEnabled() || queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await post({
      path: '/batch/',
      body: {
        api_key: POSTHOG_KEY,
        batch: batch.map((e) => ({
          event: e.event,
          properties: e.properties,
          timestamp: e.timestamp,
        })),
      },
    });
  } catch {
    // Re-queue on the front so ordering is preserved; the next flush retries.
    queue = [...batch, ...queue];
  }
}

/** Evaluate feature flags for the current distinct_id and cache the result. */
export async function fetchFlags(): Promise<PostHogFlags> {
  if (!isPostHogEnabled()) return {};
  const id = await ensureDistinctId();
  try {
    const response = await post<{ featureFlags?: PostHogFlags; featureFlagPayloads?: PostHogPayloads }>({
      path: '/decide/?v=3',
      body: {
        api_key: POSTHOG_KEY,
        distinct_id: id,
        person_properties: { $lib: 'porchivo-expo' },
      },
    });
    flags = response.featureFlags ?? {};
    flagPayloads = response.featureFlagPayloads ?? {};
    await AsyncStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify({ flags, payloads: flagPayloads })).catch(
      () => {},
    );
    return flags;
  } catch (err) {
    warn('[PostHog] flag fetch failed:', err instanceof Error ? err.message : err);
    return flags;
  }
}

/** Current value of a feature flag (undefined = not yet resolved). */
export function getFlag(key: string): PostHogFlagValue {
  return flags[key];
}

/** JSON payload attached to a feature flag, if any. */
export function getFlagPayload(key: string): unknown {
  return flagPayloads[key];
}

async function post<T>({ path, body }: { path: string; body: Record<string, unknown> }): Promise<T> {
  const response = await fetch(`${POSTHOG_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`PostHog ${path} → ${response.status}`);
  }
  return (await response.json()) as T;
}

if (__DEV__ && isPostHogEnabled()) {
  log('[PostHog] client configured →', POSTHOG_HOST);
}
