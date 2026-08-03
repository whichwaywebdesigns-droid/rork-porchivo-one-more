import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { log, warn } from '@/lib/logger';

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
// M-1: migrated from EXPO_PUBLIC_SUPABASE_ANON_KEY to the new publishable-key
// var name. Supabase is phasing out legacy JWT-format API keys in favor of
// sb_publishable_... keys. We read the new var first and fall back to the
// legacy var name so a stale .env / EAS secret doesn't break the app during
// the transition. Once all environments set EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// the fallback can be removed.
const supabasePublishableKey = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  ''
).trim().replace(/^['"]|['"]$/g, '');
const supabaseUrl = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;

if (!supabaseUrl || !supabasePublishableKey) {
  warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
    '(legacy fallback EXPO_PUBLIC_SUPABASE_ANON_KEY also unset). Auth will not work.',
  );
} else {
  try {
    new URL(supabaseUrl);
    log('[Supabase] Client configured.');
  } catch (e) {
    warn('[Supabase] Invalid EXPO_PUBLIC_SUPABASE_URL format.');
  }
  // Detect legacy JWT-format keys early so a "Legacy API keys are disabled"
  // failure is actionable instead of a mystery at first data fetch.
  if (supabasePublishableKey.startsWith('eyJ')) {
    warn(
      '[Supabase] Supabase key is a legacy JWT-format key. If requests fail with ' +
      '"Legacy API keys are disabled", replace EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
      'with the new publishable key (sb_publishable_...) from Supabase Dashboard ' +
      '\u2192 Settings \u2192 API Keys.',
    );
  }
}

export const isSupabaseConfigured = !!supabaseUrl && !!supabasePublishableKey;

/**
 * Fetch with a hard timeout to avoid hanging requests that surface as
 * "Network request failed" on RN after long stalls.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeoutMs = 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init?.signal ?? controller.signal;
  return fetch(input as RequestInfo, { ...(init ?? {}), signal }).finally(() => clearTimeout(timer));
};

/** Lightweight connectivity probe to the Supabase REST endpoint. */
export async function pingSupabase(): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: supabasePublishableKey },
    });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'unknown' };
  }
}

// ── Secure session storage ─────────────────────────────────────────────────
//
// Supabase session tokens (JWT + refresh token + metadata) frequently exceed
// 2048 bytes — the per-key limit of expo-secure-store on iOS Keychain / Android
// Keystore. We chunk large values across multiple SecureStore entries.
//
// On web there is no SecureStore; we fall back to localStorage (acceptable
// since the web build is not a primary target and localStorage is session-scoped
// in most browser contexts).
//
// NEVER use AsyncStorage for auth/session tokens — it is unencrypted on Android
// and readable on jailbroken iOS devices.

const CHUNK_SIZE = 1900; // bytes, safely under the 2048-byte SecureStore limit

function chunkString(str: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) {
    chunks.push(str.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [''];
}

const secureNativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const countStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (countStr === null) return null;
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count <= 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
        if (chunk === null) return null; // incomplete write — treat as missing
        parts.push(chunk);
      }
      return parts.join('');
    } catch {
      warn('[Supabase] SecureStore getItem error');
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const chunks = chunkString(value);
      // Write count first so readers know how many chunks to expect
      await SecureStore.setItemAsync(`${key}__chunks`, String(chunks.length));
      await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__${i}`, chunk)));
    } catch {
      warn('[Supabase] SecureStore setItem error');
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const countStr = await SecureStore.getItemAsync(`${key}__chunks`);
      const count = countStr ? parseInt(countStr, 10) : 0;
      const deletions: Promise<void>[] = [SecureStore.deleteItemAsync(`${key}__chunks`)];
      if (!isNaN(count)) {
        for (let i = 0; i < count; i++) {
          deletions.push(SecureStore.deleteItemAsync(`${key}__${i}`));
        }
      }
      await Promise.all(deletions);
    } catch {
      warn('[Supabase] SecureStore removeItem error');
    }
  },
};

/** localStorage fallback for web — acceptable since web is not a primary target */
const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try { localStorage.setItem(key, value); } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try { localStorage.removeItem(key); } catch {}
  },
};

const supabaseStorage = Platform.OS === 'web' ? webStorage : secureNativeStorage;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-key',
  {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
      lock: Platform.OS === 'web'
        ? (async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
            return await fn();
          })
        : undefined,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  },
);
