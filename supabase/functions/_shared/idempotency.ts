// Deno runtime — idempotency key handling for mutation routes.
//
// Contract (spec §6):
//   - Every record-creating POST must send an `Idempotency-Key` header (UUID).
//   - Keys live in public.idempotency_keys with a 24h TTL.
//   - Re-submission within TTL returns the cached response verbatim —
//     the handler is NOT re-executed (prevents duplicate packages,
//     double billing, duplicate incident reports).
//
// Storage is service-role only (RLS enabled with no client policies).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(key: string | null): key is string {
  return typeof key === 'string' && UUID_RE.test(key);
}

export interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Look up a previously stored response for (key, user). Returns null when the
 * key is fresh. Scoped to user_id so one user cannot replay another's key.
 */
export async function findCachedResponse(
  adminClient: SupabaseClient,
  key: string,
  userId: string,
): Promise<CachedResponse | null> {
  const { data, error } = await adminClient
    .from('idempotency_keys')
    .select('response_status, response_body, user_id, expires_at')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.warn('[idempotency] lookup failed:', error.message);
    return null; // fail open on infra errors — handler still runs
  }
  if (!data) return null;

  // Key exists but belongs to a different user — treat as fresh for THIS user
  // by rejecting reuse (handled by caller via conflict on store). Safest here
  // is to signal a conflict-style cached response.
  if (data.user_id !== userId) {
    return { status: 409, body: { error: 'Idempotency key conflict', code: 'CONFLICT' } };
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) return null; // expired

  return { status: data.response_status, body: data.response_body };
}

/**
 * Persist the response for an idempotency key. Best effort — a failure to
 * store must not fail the original (already successful) request.
 */
export async function storeResponse(
  adminClient: SupabaseClient,
  key: string,
  userId: string,
  route: string,
  status: number,
  body: unknown,
): Promise<void> {
  const { error } = await adminClient.from('idempotency_keys').insert({
    key,
    user_id: userId,
    route,
    response_status: status,
    response_body: body ?? {},
  });
  if (error && !error.message.includes('duplicate')) {
    console.warn('[idempotency] store failed:', error.message);
  }

  // Opportunistic TTL sweep (fire and forget)
  try {
    void adminClient.rpc('cleanup_idempotency_keys').then(
      () => undefined,
      () => undefined,
    );
  } catch {
    // never block
  }
}
