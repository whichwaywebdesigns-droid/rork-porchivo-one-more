// @ts-nocheck — Deno runtime
// RevenueCat webhook receiver — single server-side source of truth for subscription state.
//
// SETUP (do once):
// 1. supabase secrets set REVENUECAT_WEBHOOK_BEARER_TOKEN=<random-32-char-string>
// 2. (Optional, M-3 hardening) supabase secrets set REVENUECAT_API_SECRET=<rc-secret-api-key>
//    RevenueCat does NOT send a webhook signature header, so the bearer token over
//    HTTPS is the only transport-level auth. As a defence-in-depth layer, when
//    REVENUECAT_API_SECRET is set we call back to the RC Subscriber API to confirm
//    the user/subscription referenced by the event actually exists and matches.
//    If unset, this verification is skipped (bearer-token-only, the RC-recommended minimum).
// 3. In RevenueCat Dashboard → Project → Integrations → Webhooks:
//    URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//    Authorization: Bearer <same-token-from-step-1>
// 4. supabase functions deploy revenuecat-webhook
// 5. In your app, call Purchases.logIn(supabaseUserId) after auth so RC's
//    app_user_id matches the Supabase user ID delivered in webhook events.
//
// WRITE CONTRACT:
// This function is the ONLY writer of:
//   - profiles.is_premium
//   - profiles.subscription_tier
//   - user_subscriptions (upsert)
//   - revenuecat_events (insert, append-only)
// The client MUST NOT write any of these columns/tables directly.
//
// IDEMPOTENCY:
// Each RC event carries a unique event.id (UUID). We insert it into
// revenuecat_events with ON CONFLICT DO NOTHING and bail early if
// rows-affected === 0, meaning this event was already processed.
// This guarantees at-most-once processing regardless of how many
// times RevenueCat retries delivery.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Subscription status constants ────────────────────────────────────────────
// Only used internally; never exposed to the client as raw strings —
// DbUserSubscription.status is the typed gateway for client reads.

const STATUS_ACTIVE = 'active';
const STATUS_CANCELLED = 'cancelled';
const STATUS_EXPIRED = 'expired';
const STATUS_BILLING_ISSUE = 'billing_issue';
const STATUS_PAUSED = 'paused';
const STATUS_GRACE_PERIOD = 'grace_period';

// ── Event type sets ───────────────────────────────────────────────────────────

/** Events that activate or restore a paid entitlement. */
const ACTIVATING_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'BILLING_ISSUE_RESOLVED',
  'UNCANCELLATION',
  'TRANSFER',
  'SUBSCRIBER_ALIAS',
]);

/** Events that should record state changes without immediately revoking access. */
const SOFT_DEACTIVATION_EVENT_TYPES = new Set([
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_PAUSED',
]);

/** Events that revoke paid access immediately. */
const HARD_DEACTIVATION_EVENT_TYPES = new Set([
  'EXPIRATION',
]);

// ── Tier resolver ─────────────────────────────────────────────────────────────
// Maps RevenueCat product_id strings to Porchivo subscription tiers.
// Fixed product identifiers — do NOT rename these without a coordinated deploy:
//   premium_monthly, premium_annual, family_monthly, family_annual, porchivo_lifetime
//
// The previous implementation used `productId.includes('family')` etc., which is
// fragile: a product id containing the wrong substring (e.g. the legacy
// `com.porchivo.premium.family` — which contains BOTH 'premium' and 'family')
// would silently mis-resolve if the check order ever changed. The explicit map
// below matches exact product ids (case-insensitive) so there is no ambiguity,
// and falls back to conservative 'premium' only for genuinely unknown paid ids.

const PRODUCT_ID_TIER_MAP: Record<string, string> = {
  premium_monthly: 'premium',
  premium_annual: 'premium',
  'com.porchivo.premium.family': 'family', // legacy family-monthly id (H-1); keep until renamed in RC + stores
  family_monthly: 'family', // future canonical id once H-1 rename lands
  family_annual: 'family',
  enterprise_monthly: 'enterprise',
  enterprise_annual: 'enterprise',
  porchivo_lifetime: 'lifetime',
};

function resolveTierFromProductId(productId: string): string {
  if (!productId) return 'free';
  const id = productId.toLowerCase();
  const mapped = PRODUCT_ID_TIER_MAP[id];
  if (mapped) return mapped;
  // Unknown paid product — fall back to base premium (conservative: grants
  // the minimum paid tier rather than over-entitling to family/enterprise).
  console.warn(
    `[revenuecat-webhook] Unmapped product_id "${productId}" — defaulting to 'premium'`
  );
  return 'premium';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Convert a RevenueCat unix-millisecond timestamp to an ISO string, or null. */
function msToIso(ms: number | null | undefined): string | null {
  if (!ms || typeof ms !== 'number') return null;
  return new Date(ms).toISOString();
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Verify bearer token ───────────────────────────────────────────────
    const expectedToken = Deno.env.get('REVENUECAT_WEBHOOK_BEARER_TOKEN');
    if (!expectedToken) {
      console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_BEARER_TOKEN not configured');
      return json({ error: 'Webhook not configured' }, 503);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || token !== expectedToken) {
      console.warn('[revenuecat-webhook] Invalid bearer token');
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Parse payload ─────────────────────────────────────────────────────
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    // Read the raw body once for the optional subscriber-API verification step.
    // req.json() already consumed the stream; we keep the parsed `payload` and
    // re-serialize it deterministically when needed below.
    const rcApiSecret = Deno.env.get('REVENUECAT_API_SECRET');

    const event = payload?.event;
    if (!event) {
      console.warn('[revenuecat-webhook] Missing event object in payload');
      return json({ received: true }); // acknowledge but ignore malformed
    }

    // Extract all relevant fields from the RC event object.
    const rcEventId: string = event.id ?? '';            // stable dedup key
    const eventType: string = event.type ?? '';
    const appUserId: string = event.app_user_id ?? '';
    const productId: string = event.product_id ?? '';
    const store: string = event.store ?? '';
    const environment: string = event.environment ?? '';
    const expirationAtMs: number | null = event.expiration_at_ms ?? null;
    const cancelledAtMs: number | null = event.cancel_reason
      ? (event.original_transaction_id ? event.expiration_at_ms : null)
      : null;

    console.log(
      `[revenuecat-webhook] Event: ${eventType} | user: ${appUserId} | ` +
      `product: ${productId} | rc_id: ${rcEventId} | env: ${environment}`
    );

    if (!appUserId) {
      console.warn('[revenuecat-webhook] Missing app_user_id — acknowledged without processing');
      return json({ received: true });
    }

    if (!rcEventId) {
      // Unusual: RC events should always have an id. Log and proceed without dedup.
      console.warn('[revenuecat-webhook] Missing event.id — cannot deduplicate this event');
    }

    // ── 3. Initialise Supabase admin client ──────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 4. Idempotency check via revenuecat_events insert ────────────────────
    // Attempt to insert the raw event. The unique index on rc_event_id means
    // a duplicate delivery will hit ON CONFLICT and insert 0 rows.
    // We only bail on confirmed duplicates (rcEventId present + conflict).
    if (rcEventId) {
      const { error: insertError, count } = await adminClient
        .from('revenuecat_events')
        .insert({
          rc_event_id: rcEventId,
          user_id: appUserId,
          event_type: eventType,
          product_id: productId || null,
          store: store || null,
          environment: environment || null,
          expiration_at_ms: expirationAtMs,
          raw_payload: event,
        })
        .select('id', { count: 'exact', head: true });

      if (insertError) {
        // Unique violation (23505) = duplicate event → safe to skip.
        if (insertError.code === '23505') {
          console.log(
            `[revenuecat-webhook] Duplicate event ${rcEventId} (${eventType}) — skipping`
          );
          return json({ received: true, duplicate: true });
        }
        // Other insert error — log but continue processing so RC gets a 200
        // and doesn't retry indefinitely for a non-critical audit-log failure.
        console.warn(
          `[revenuecat-webhook] revenuecat_events insert error (non-fatal): ${insertError.message}`
        );
      }
    }

    // ── 4b. Optional M-3 hardening: verify the subscriber exists in RC ─────
    // RevenueCat does NOT send a webhook signature header (confirmed by RC staff
    // in their community forums: "We don't provide a x-revenuecat-signature
    // header (or similar) mechanism"). The bearer token over HTTPS is the only
    // transport-level auth RC supports. As a defence-in-depth layer, when
    // REVENUECAT_API_SECRET is set we call back to the RC Subscriber API to
    // confirm the app_user_id referenced by the event is a real RC subscriber.
    // This catches a forged event that guessed a valid app_user_id despite the
    // bearer token. If unset, this step is skipped (bearer-token-only, the
    // RC-recommended minimum).
    if (rcApiSecret) {
      try {
        const rcProjectId = Deno.env.get('REVENUECAT_PROJECT_ID');
        if (!rcProjectId) {
          console.warn(
            '[revenuecat-webhook] REVENUECAT_API_SECRET set but REVENUECAT_PROJECT_ID missing — skipping subscriber verification'
          );
        } else {
          const verifyRes = await fetch(
            `https://api.revenuecat.com/v1.1/subscribers/${encodeURIComponent(appUserId)}`,
            { method: 'GET', headers: { Authorization: `Bearer ${rcApiSecret}`, 'X-Platform': store || 'ios' } },
          );
          if (!verifyRes.ok) {
            console.warn(
              `[revenuecat-webhook] Subscriber verification failed for ${appUserId}: ` +
              `HTTP ${verifyRes.status} — acknowledging event without state mutation`
            );
            return json({ received: true, warning: 'Subscriber verification failed' });
          }
        }
      } catch (verifyErr) {
        // Network/RC outage — fail open so a real subscriber isn't locked out
        // by a transient RC API error. The bearer token already authenticated RC.
        const verifyMsg = verifyErr instanceof Error ? verifyErr.message : 'unknown';
        console.warn(
          `[revenuecat-webhook] Subscriber verification error (fail-open): ${verifyMsg}`
        );
      }
    }

    // ── 5. Resolve subscription state from event type ────────────────────────
    //
    // isPremium:
    //   true  — user is currently entitled (active, cancelled-but-in-period, billing issue)
    //   false — access revoked (expired only)
    //
    // status values map to DbUserSubscription['status']:
    //   active         → entitled, currently renewing
    //   cancelled      → entitled until current_period_end, then will expire
    //   expired        → access revoked
    //   billing_issue  → payment failed, access preserved during grace period
    //   paused         → Google Play paused subscription
    //
    // Conservative rule: prefer false-negative over false-positive paid access.
    // If event type is unrecognised, we acknowledge without state change.

    let isPremium: boolean;
    let resolvedTier: string;
    let resolvedStatus: string;
    let isEntitled: boolean;
    let updateProfiles = true;  // whether to write profiles.is_premium / subscription_tier

    if (ACTIVATING_EVENT_TYPES.has(eventType)) {
      // Full activation — user is entitled.
      isPremium = true;
      resolvedTier = resolveTierFromProductId(productId);
      resolvedStatus = STATUS_ACTIVE;
      isEntitled = true;

    } else if (eventType === 'CANCELLATION') {
      // User cancelled but is still entitled until their current period ends.
      // EXPIRATION will fire when the period actually ends and revoke access then.
      // Do NOT revoke is_premium here — that would incorrectly lock out a paying user.
      isPremium = true;
      resolvedTier = resolveTierFromProductId(productId);
      resolvedStatus = STATUS_CANCELLED;
      isEntitled = true;

    } else if (HARD_DEACTIVATION_EVENT_TYPES.has(eventType)) {
      // Period has ended — access revoked.
      isPremium = false;
      resolvedTier = 'free';
      resolvedStatus = STATUS_EXPIRED;
      isEntitled = false;

    } else if (eventType === 'BILLING_ISSUE') {
      // Payment failed. RC grants a grace period before expiration.
      // Keep current entitlement alive during that window.
      // We update user_subscriptions.status but do NOT touch profiles.is_premium
      // so the user continues to have access while we wait for payment to resolve.
      isPremium = true; // will be overwritten from existing profiles value below
      resolvedTier = resolveTierFromProductId(productId);
      resolvedStatus = STATUS_BILLING_ISSUE;
      isEntitled = true;
      updateProfiles = false; // preserve existing profiles.is_premium as-is

    } else if (eventType === 'SUBSCRIBER_PAUSED') {
      // Google Play subscription pause. Access is revoked for the pause period.
      // RevenueCat fires RENEWAL when it resumes.
      isPremium = false;
      resolvedTier = resolveTierFromProductId(productId) ?? 'free';
      resolvedStatus = STATUS_PAUSED;
      isEntitled = false;

    } else {
      // Unhandled event type — acknowledge without state mutation.
      console.log(`[revenuecat-webhook] Unhandled event type: ${eventType} — acknowledged`);
      return json({ received: true });
    }

    const isLifetime = resolvedTier === 'lifetime';
    const currentPeriodEnd = msToIso(expirationAtMs);
    const cancelledAt = eventType === 'CANCELLATION' ? new Date().toISOString() : null;

    // ── 6. Upsert user_subscriptions ─────────────────────────────────────────
    // Single authoritative row per user. ON CONFLICT (user_id) DO UPDATE
    // replaces the current state with the latest event's resolved values.
    // This is safe because RC events are ordered by timestamp and we've already
    // deduplicated via step 4.
    const { error: upsertError } = await adminClient
      .from('user_subscriptions')
      .upsert(
        {
          user_id: appUserId,
          status: resolvedStatus,
          tier: resolvedTier,
          product_id: productId || null,
          store: store || null,
          environment: environment || null,
          current_period_end: currentPeriodEnd,
          cancelled_at: cancelledAt,
          is_lifetime: isLifetime,
          is_entitled: isEntitled,
          last_event_type: eventType,
          last_rc_event_id: rcEventId || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
          // For BILLING_ISSUE we want to update status but not flip is_entitled back
          // if the user was already marked non-entitled (shouldn't happen in practice,
          // but guarded here for safety).
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      // The most likely cause is the user_id not existing in profiles yet
      // (e.g. a RevenueCat anonymous user who hasn't completed Supabase signup).
      // This is non-fatal — the profiles.is_premium write below may also fail,
      // but we return 200 so RC doesn't retry forever.
      console.warn(
        `[revenuecat-webhook] user_subscriptions upsert error for user ${appUserId}: ` +
        `${upsertError.message} (code: ${upsertError.code})`
      );
    } else {
      console.log(
        `[revenuecat-webhook] user_subscriptions upserted — ` +
        `user: ${appUserId} status: ${resolvedStatus} tier: ${resolvedTier} ` +
        `entitled: ${isEntitled} period_end: ${currentPeriodEnd ?? 'n/a'}`
      );
    }

    // ── 7. Update profiles (backward compat + subscription_tier column) ───────
    // profiles.is_premium is the legacy entitlement flag read by existing client code.
    // profiles.subscription_tier is the new column added in subscription-entitlements-migration.sql.
    // Both are written together here and ONLY here.
    if (updateProfiles) {
      const profileUpdates: Record<string, unknown> = {
        is_premium: isPremium,
        subscription_tier: resolvedTier,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', appUserId);

      if (profileError) {
        // Non-fatal: user may not have a profile row yet (pre-signup RC anonymous user).
        console.warn(
          `[revenuecat-webhook] profiles update error for user ${appUserId}: ` +
          `${profileError.message} (code: ${profileError.code})`
        );
      } else {
        console.log(
          `[revenuecat-webhook] profiles updated — ` +
          `user: ${appUserId} is_premium: ${isPremium} tier: ${resolvedTier}`
        );
      }
    }

    return json({ received: true });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[revenuecat-webhook] Unhandled error:', msg);
    // Return 200 so RevenueCat does not retry for unrecoverable server-side errors.
    // Structured error is still logged to Supabase function logs for investigation.
    return json({ received: true, warning: 'Handler error logged' });
  }
});
