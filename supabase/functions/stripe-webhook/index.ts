// Deno runtime — hardened Stripe subscription webhook (spec §7).
//
// Register in Stripe Dashboard → Developers → Webhooks:
//   Endpoint: POST /functions/v1/stripe-webhook
//   Secret:   STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
//
// Security posture:
//   - Signature verified with stripe.webhooks.constructEventAsync() BEFORE any
//     processing (tolerance 300s — replayed/stale events are rejected)
//   - Explicit event-age check: events older than 300s are rejected
//   - Processed event ids stored in stripe_processed_events (insert-first);
//     duplicate ids are acknowledged with 200 and NOT re-processed
//   - Only 4 event types are processed; everything else returns 200 immediately
//   - Raw payloads are NEVER logged — only event_id, event_type, and outcome
//   - service_role client is used ONLY here, after signature verification
//
// Handled events:
//   invoice.paid                  → mark subscription active
//   invoice.payment_failed        → mark billing_issue (grace period)
//   customer.subscription.deleted → mark expired, revoke entitlement
//   checkout.session.completed    → activate subscription for metadata.user_id

import Stripe from 'npm:stripe@16.12.0';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { SECURITY_HEADERS, jsonResponse, logSecurityEvent } from '../_shared/security.ts';

const ALLOWED_EVENTS = new Set([
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'checkout.session.completed',
]);

const MAX_EVENT_AGE_SECONDS = 300;
const MAX_BODY_BYTES = 256 * 1024;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const adminClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

/** Look up the Porchivo user for a Stripe object (metadata.user_id preferred). */
async function resolveUserId(
  metadata: Record<string, string> | null | undefined,
  customerEmail: string | null | undefined,
): Promise<string | null> {
  const metaUserId = metadata?.user_id;
  if (metaUserId && /^[0-9a-f-]{36}$/i.test(metaUserId)) {
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', metaUserId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  if (customerEmail) {
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', customerEmail)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

/** Map a Stripe price lookup_key to a Porchivo tier (see STRIPE_SETUP.md). */
function tierFromLookupKey(lookupKey: string | null | undefined): string {
  if (!lookupKey) return 'premium';
  if (lookupKey.includes('family')) return 'family';
  if (lookupKey.includes('enterprise')) return 'enterprise';
  if (lookupKey.includes('lifetime')) return 'lifetime';
  return 'premium';
}

async function upsertSubscription(
  userId: string,
  fields: {
    status: string;
    tier?: string;
    productId?: string | null;
    currentPeriodEnd?: string | null;
    isEntitled: boolean;
    isLifetime?: boolean;
    eventType: string;
    eventId: string;
  },
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    status: fields.status,
    store: 'STRIPE',
    is_entitled: fields.isEntitled,
    last_event_type: fields.eventType,
    last_rc_event_id: fields.eventId,
    updated_at: new Date().toISOString(),
  };
  if (fields.tier) payload.tier = fields.tier;
  if (fields.productId !== undefined) payload.product_id = fields.productId;
  if (fields.currentPeriodEnd !== undefined) payload.current_period_end = fields.currentPeriodEnd;
  if (fields.isLifetime !== undefined) payload.is_lifetime = fields.isLifetime;

  const { error } = await adminClient
    .from('user_subscriptions')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error('[stripe-webhook] subscription upsert failed:', error.message);
    return false;
  }
  return true;
}

async function markOutcome(eventId: string, outcome: string): Promise<void> {
  const { error } = await adminClient
    .from('stripe_processed_events')
    .update({ outcome })
    .eq('event_id', eventId);
  if (error) console.warn('[stripe-webhook] outcome update failed:', error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!webhookSecret || !stripeSecretKey) {
    console.error('[stripe-webhook] Missing webhook configuration');
    return jsonResponse({ error: 'Webhook not configured' }, 503);
  }

  // Bound the payload before reading it
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    logSecurityEvent(adminClient, { type: 'webhook_signature_invalid', route: 'stripe-webhook' });
    return jsonResponse({ error: 'Missing signature' }, 400);
  }

  // ── 1. Signature verification (tolerance 300s) ─────────────────────────────
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      MAX_EVENT_AGE_SECONDS,
      cryptoProvider,
    );
  } catch {
    logSecurityEvent(adminClient, { type: 'webhook_signature_invalid', route: 'stripe-webhook' });
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }

  // ── 2. Event-age replay check ──────────────────────────────────────────────
  const ageSeconds = Math.floor(Date.now() / 1000) - event.created;
  if (ageSeconds > MAX_EVENT_AGE_SECONDS) {
    logSecurityEvent(adminClient, {
      type: 'webhook_replay_rejected',
      route: 'stripe-webhook',
      metadata: { event_id: event.id, age_seconds: ageSeconds },
    });
    return jsonResponse({ error: 'Event too old' }, 400);
  }

  // ── 3. Unhandled event types: acknowledge immediately ─────────────────────
  if (!ALLOWED_EVENTS.has(event.type)) {
    return jsonResponse({ received: true });
  }

  // ── 4. Idempotency: insert-first, duplicate id → 200 without re-processing ─
  const { error: insertError } = await adminClient
    .from('stripe_processed_events')
    .insert({ event_id: event.id, event_type: event.type, outcome: 'processing' });

  if (insertError) {
    if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
      console.log(`[stripe-webhook] event_id=${event.id} type=${event.type} outcome=duplicate`);
      return jsonResponse({ received: true, duplicate: true });
    }
    console.error('[stripe-webhook] idempotency insert failed:', insertError.message);
    // Fail closed for processing, but 200 would drop the event — let Stripe retry
    return jsonResponse({ error: 'Temporary storage failure' }, 500);
  }

  // ── 5. Process (log only event_id, event_type, outcome — never payloads) ──
  let outcome = 'ignored';
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = await resolveUserId(
          session.metadata,
          session.customer_details?.email ?? session.customer_email,
        );
        if (!userId) {
          outcome = 'user_not_found';
          break;
        }
        const isLifetime = session.mode === 'payment';
        const ok = await upsertSubscription(userId, {
          status: 'active',
          tier: tierFromLookupKey(session.metadata?.lookup_key),
          isEntitled: true,
          isLifetime,
          currentPeriodEnd: null,
          eventType: event.type,
          eventId: event.id,
        });
        outcome = ok ? 'activated' : 'db_error';
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await resolveUserId(
          invoice.subscription_details?.metadata ?? invoice.metadata,
          invoice.customer_email,
        );
        if (!userId) {
          outcome = 'user_not_found';
          break;
        }
        const line = invoice.lines?.data?.[0];
        const periodEnd = line?.period?.end
          ? new Date(line.period.end * 1000).toISOString()
          : null;
        const ok = await upsertSubscription(userId, {
          status: 'active',
          tier: tierFromLookupKey(line?.price?.lookup_key),
          productId: line?.price?.lookup_key ?? null,
          currentPeriodEnd: periodEnd,
          isEntitled: true,
          eventType: event.type,
          eventId: event.id,
        });
        outcome = ok ? 'renewed' : 'db_error';
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await resolveUserId(
          invoice.subscription_details?.metadata ?? invoice.metadata,
          invoice.customer_email,
        );
        if (!userId) {
          outcome = 'user_not_found';
          break;
        }
        // Grace period: entitlement continues while billing is retried
        const ok = await upsertSubscription(userId, {
          status: 'billing_issue',
          isEntitled: true,
          eventType: event.type,
          eventId: event.id,
        });
        outcome = ok ? 'billing_issue' : 'db_error';
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(subscription.metadata, null);
        if (!userId) {
          outcome = 'user_not_found';
          break;
        }

        // Never let a Stripe event downgrade a user entitled via RevenueCat
        const { data: existing } = await adminClient
          .from('user_subscriptions')
          .select('store, is_lifetime')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing && existing.store !== 'STRIPE') {
          outcome = 'skipped_non_stripe_entitlement';
          break;
        }
        if (existing?.is_lifetime) {
          outcome = 'skipped_lifetime';
          break;
        }

        const ok = await upsertSubscription(userId, {
          status: 'expired',
          tier: 'free',
          isEntitled: false,
          currentPeriodEnd: null,
          eventType: event.type,
          eventId: event.id,
        });
        outcome = ok ? 'expired' : 'db_error';
        break;
      }
    }
  } catch (e) {
    console.error('[stripe-webhook] handler error:', e instanceof Error ? e.message : 'unknown');
    outcome = 'handler_error';
  }

  await markOutcome(event.id, outcome);
  console.log(`[stripe-webhook] event_id=${event.id} type=${event.type} outcome=${outcome}`);

  // Always 200 after signature+idempotency: data-level issues must not cause
  // infinite Stripe retries (outcome is recorded for investigation)
  return new Response(JSON.stringify({ received: true, outcome }), {
    status: 200,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json' },
  });
});
