// @ts-nocheck — Deno runtime
//
// Postgres-backed sliding-window rate limiter for Supabase Edge Functions.
//
// Requires: supabase/rate-limit-migration.sql applied to the database.
//
// Rate limit configuration lives here per-function (see LIMIT constants below).
// To tune a limit, change the `limit` and `windowSeconds` args in each caller.
//
// Design: uses a Postgres table + atomic UPSERT so limits hold across all
// concurrent Edge Function worker instances. Fails open (allows requests) if
// the DB call fails — never block users due to rate limiter infrastructure issues.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;     // unix seconds when current window resets
  retryAfter: number;  // seconds until the window resets
}

/**
 * Check and atomically increment the rate limit counter for a key.
 *
 * @param adminClient Supabase client initialised with the service role key
 * @param key         Bucket key — typically `"<function-name>:<user-id>"`
 * @param limit       Max requests allowed in the window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(
  adminClient: any,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowTs = Math.floor(now / windowSeconds);
  const resetAt = (windowTs + 1) * windowSeconds;
  const retryAfter = Math.max(1, resetAt - now);

  try {
    const { data: count, error } = await adminClient.rpc('increment_rate_limit', {
      p_key: key,
      p_window_ts: windowTs,
    });

    if (error) {
      // Fail open — never block legitimate users because of a DB hiccup
      console.warn('[rateLimit] RPC error, failing open:', error.message);
      return { allowed: true, remaining: limit, resetAt, retryAfter };
    }

    const currentCount = count as number;
    const remaining = Math.max(0, limit - currentCount);

    // Fire-and-forget cleanup of stale rows older than 2 windows
    void adminClient
      .from('rate_limit_log')
      .delete()
      .lt('window_ts', windowTs - 2)
      .then(() => {})
      .catch(() => {});

    return {
      allowed: currentCount <= limit,
      remaining,
      resetAt,
      retryAfter,
    };
  } catch (e) {
    console.warn('[rateLimit] Unexpected error, failing open:', e);
    return { allowed: true, remaining: limit, resetAt, retryAfter };
  }
}

/**
 * Build a structured 429 response with Retry-After and X-RateLimit-* headers.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: result.retryAfter,
      resetAt: result.resetAt,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    },
  );
}
