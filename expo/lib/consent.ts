import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';
import { LEGAL_VERSION, LEGAL_DOCUMENTS } from '@/constants/legal';

/**
 * Record a timestamped, versioned acceptance of the Terms of Service and
 * Privacy Policy for the given user. Append-only — each call inserts a new
 * immutable audit row in public.user_consents.
 *
 * Returns true on success. Failures are non-fatal (logged, never thrown) so a
 * transient backend hiccup never blocks signup.
 */
export async function recordConsent(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const appVersion: string =
      (Constants.expoConfig?.version as string | undefined) ?? 'unknown';
    const { error } = await supabase.from('user_consents').insert({
      user_id: userId,
      version: LEGAL_VERSION,
      documents: LEGAL_DOCUMENTS,
      platform: Platform.OS,
      app_version: appVersion,
    });
    if (error) {
      warn('[Consent] Failed to record consent:', error.code);
      return false;
    }
    log('[Consent] Recorded consent', LEGAL_VERSION, 'for user');
    return true;
  } catch {
    warn('[Consent] Unexpected error recording consent');
    return false;
  }
}

/**
 * Fetch the most recent legal version a user has accepted.
 * Returns null when the user has no consent record yet.
 */
export async function fetchLatestConsentVersion(
  userId: string
): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_consents')
      .select('version, accepted_at')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      warn('[Consent] Failed to read consent:', error.code);
      return null;
    }
    return (data?.version as string | undefined) ?? null;
  } catch {
    warn('[Consent] Unexpected error reading consent');
    return null;
  }
}
