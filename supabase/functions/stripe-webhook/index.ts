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
//
// ORG (property) subscriptions — create-org-checkout stamps metadata.org_id on
// the Stripe customer/subscription. When an event carries org_id, the ORG branch
// runs INSTEAD of the user_subscriptions branch (org billing is property-scoped,
// never a personal entitlement):
//   invoice.payment_failed + org_id → organizations.subscription_status='past_due',
//     payment_failed_at = COALESCE(existing, now()) — a FRESH lapse after resume
//     resets the 3-stage clock; Stripe retries within one dunning cycle must NOT.
//     Manager-only dunning email+push at day 0/7/14/21 markers (deduped via
//     dunning_last_marker_sent). Residents/staff are NEVER notified here.
//   invoice.paid + org_id → status='active', payment_failed_at=NULL (instant
//     resume from any grace stage — the webhook is the source of truth).
//   checkout.session.completed + org_id → org billing columns activated.
//   customer.subscription.deleted + org_id → status='canceled', clock cleared.

import Stripe from 'npm:stripe@16.12.0';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { SECURITY_HEADERS, jsonResponse, logSecurityEvent } from '../_shared/security.ts';
import { sendViaResend } from '../_shared/resend.ts';
import { sendSubscriptionStarted, type SqlRpcClient } from '../_shared/emailService.ts';

const ALLOWED_EVENTS = new Set([
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
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

/** Look up the Porchivo ORG for a Stripe object (metadata.org_id). Org events
 *  route to the organizations table, never to user_subscriptions. */
const UUID_RE = /^[0-9a-f-]{36}$/i;

async function resolveOrgId(
  metadata: Record<string, string> | null | undefined,
): Promise<string | null> {
  const orgId = metadata?.org_id;
  if (!orgId || !UUID_RE.test(orgId)) return null;
  const { data } = await adminClient
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/** Manager-only dunning content for a day marker (0/7/14/21). */
function dunningMessage(
  marker: number,
): { subject: string; body: string; pushTitle: string; pushBody: string } {
  if (marker >= 21) {
    return {
      subject: 'Final reminder — Porchivo access pauses in 9 days',
      body: 'Your community subscription payment is still failing. In 9 days, on day 30, package intake and app access will pause for everyone at your property. Please update your payment method.',
      pushTitle: 'Final billing reminder',
      pushBody: 'Porchivo access pauses on day 30 — update your payment method.',
    };
  }
  if (marker >= 14) {
    return {
      subject: 'Payment failed — resident settings are now read-only',
      body: 'Your community subscription payment failed 14 days ago. Residents can still see their packages and pickup codes, but account settings are temporarily read-only. Staff intake keeps working. Update your payment method to restore everything instantly.',
      pushTitle: 'Billing issue — day 14',
      pushBody: 'Resident settings are read-only until billing is updated.',
    };
  }
  if (marker >= 7) {
    return {
      subject: 'Reminder — Porchivo payment failed 7 days ago',
      body: 'Your community subscription payment failed 7 days ago. Residents and staff still have full access while we retry, but please update your payment method to avoid disruption.',
      pushTitle: 'Billing reminder — day 7',
      pushBody: 'Your Porchivo payment failed 7 days ago. Update billing when you can.',
    };
  }
  return {
    subject: 'Action needed — your Porchivo payment failed',
    body: 'Your community subscription payment failed. Residents and staff keep full access while we retry — nothing changes for them. Please update your payment method in the billing portal to keep Porchivo active.',
    pushTitle: 'Payment failed',
    pushBody: 'Your community payment failed. Residents are unaffected — update billing when you can.',
  };
}

/** Best-effort "Subscription Started / Upgraded" email through the Resend
 *  template service (billing category — ignores email opt-outs). */
async function notifySubscriptionEmail(
  userId: string,
  opts: {
    eventName: string;
    planName: string;
    upgradeOrStart: string;
    billingCycle: string;
    amount: string;
    nextBillingDate: string;
  },
): Promise<void> {
  try {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.email) return;
    const name = (profile.name ?? '').trim();
    await sendSubscriptionStarted(
      adminClient as unknown as SqlRpcClient,
      {
        recipient: profile.email,
        userId,
        eventName: opts.eventName,
        firstName: name.split(/\s+/)[0] || 'there',
        planName: opts.planName,
        upgradeOrStart: opts.upgradeOrStart,
        billingCycle: opts.billingCycle,
        amount: opts.amount,
        nextBillingDate: opts.nextBillingDate,
      },
    );
  } catch (e) {
    console.warn(
      '[stripe-webhook] subscription email failed:',
      e instanceof Error ? e.message : 'unknown',
    );
  }
}

function fmtAmount(cents: number | null | undefined): string {
  return typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}` : '—';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Send the manager-only dunning email + push. Never throws — notification
 *  failures must not fail the billing state write. */
async function notifyOrgManager(
  orgId: string,
  adminUserId: string | null,
  orgName: string | null,
  marker: number,
): Promise<void> {
  if (!adminUserId) return;
  try {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, expo_push_token')
      .eq('id', adminUserId)
      .maybeSingle();
    if (!profile) return;

    const msg = dunningMessage(marker);
    const orgLabel = orgName ? ` for ${orgName}` : '';

    // Email (best-effort)
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('EMAIL_FROM');
    if (apiKey && from && profile.email) {
      const result = await sendViaResend({
        apiKey,
        from,
        to: profile.email,
        subject: msg.subject,
        text: `${msg.body}\n\nManage billing: Porchivo app → More → Manage Subscription.`,
      });
      if (!result.ok) {
        console.warn(`[stripe-webhook] dunning email failed (marker=${marker}): ${result.error ?? result.status}`);
      }
    }

    // Push (best-effort, direct to Expo — the notifications table is
    // shipment-scoped and cannot carry billing types)
    const token = profile.expo_push_token as string | null;
    if (token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: msg.pushTitle,
          body: msg.pushBody,
          sound: 'default',
          data: { kind: 'billing_dunning', org_id: orgId, marker, scope: orgLabel.trim() ? 'manager' : 'manager' },
        }),
      }).catch((e) => {
        console.warn('[stripe-webhook] dunning push failed:', e instanceof Error ? e.message : 'unknown');
      });
    }
  } catch (e) {
    console.warn('[stripe-webhook] notifyOrgManager error:', e instanceof Error ? e.message : 'unknown');
  }
}

/** Org invoice.payment_failed — start/continue the 3-stage grace clock. */
async function handleOrgPaymentFailed(orgId: string): Promise<string> {
  const { data: org } = await adminClient
    .from('organizations')
    .select('name, admin_user_id, subscription_status, payment_failed_at, dunning_last_marker_sent')
    .eq('id', orgId)
    .maybeSingle();
  if (!org) return 'org_not_found';

  const nowIso = new Date().toISOString();
  const isFirstFailure = !org.payment_failed_at;
  // Fresh lapse (after a resume cleared the timestamp) resets the clock from
  // zero; retries within the SAME dunning cycle keep the original timestamp.
  const failedAt: string = (org.payment_failed_at as string) ?? nowIso;
  const days = Math.max(0, Math.floor((Date.now() - new Date(failedAt).getTime()) / 86_400_000));
  const marker = days >= 21 ? 21 : days >= 14 ? 14 : days >= 7 ? 7 : 0;

  const update: Record<string, unknown> = {
    subscription_status: 'past_due',
    updated_at: nowIso,
  };
  if (isFirstFailure) {
    update.payment_failed_at = failedAt;
    update.dunning_last_marker_sent = null; // fresh cadence for a new lapse
  }

  const { error } = await adminClient.from('organizations').update(update).eq('id', orgId);
  if (error) {
    console.error('[stripe-webhook] org past_due update failed:', error.message);
    return 'db_error';
  }

  // Manager-only dunning at day 0/7/14/21 (deduped by marker)
  const lastMarker = (org.dunning_last_marker_sent as number | null) ?? -1;
  if (marker > lastMarker) {
    await notifyOrgManager(orgId, org.admin_user_id as string | null, org.name as string | null, marker);
    await adminClient
      .from('organizations')
      .update({ dunning_last_marker_sent: marker })
      .eq('id', orgId);
  }

  return 'org_past_due';
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
        // Org (property) checkout — update the org, not a personal subscription
        const orgId = await resolveOrgId(session.metadata);
        if (orgId) {
          const { error } = await adminClient
            .from('organizations')
            .update({
              subscription_status: 'active',
              payment_failed_at: null,
              dunning_last_marker_sent: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orgId);
          outcome = error ? 'db_error' : 'org_activated';
          break;
        }
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
        if (ok) {
          const tier = tierFromLookupKey(session.metadata?.lookup_key);
          await notifySubscriptionEmail(userId, {
            eventName: event.id,
            planName: tier && tier !== 'free' ? tier : 'Premium',
            upgradeOrStart: 'starting',
            billingCycle: isLifetime
              ? 'one-time'
              : session.metadata?.billing_cycle ?? 'monthly',
            amount: fmtAmount(session.amount_total),
            nextBillingDate: isLifetime ? '—' : 'per your billing cycle',
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // Org (property) invoice — instant resume from ANY grace stage: the
        // webhook is the source of truth, no manual un-pause, no waiting for
        // a new billing cycle.
        const paidOrgId = await resolveOrgId(
          invoice.subscription_details?.metadata ?? invoice.metadata,
        );
        if (paidOrgId) {
          const line = invoice.lines?.data?.[0];
          const periodEnd = line?.period?.end
            ? new Date(line.period.end * 1000).toISOString()
            : null;
          const { error } = await adminClient
            .from('organizations')
            .update({
              subscription_status: 'active',
              payment_failed_at: null,
              dunning_last_marker_sent: null,
              ...(periodEnd ? { current_period_end: periodEnd } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', paidOrgId);
          outcome = error ? 'db_error' : 'org_resumed';
          break;
        }
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
        // Org (property) payment failure — enter the 3-stage grace timeline
        // (silent grace day 0-14 → read-only day 14-30 → restricted day 30+).
        // Residents/staff see NO change at this point; only the manager is
        // notified (dunning cadence inside handleOrgPaymentFailed).
        const failedOrgId = await resolveOrgId(
          invoice.subscription_details?.metadata ?? invoice.metadata,
        );
        if (failedOrgId) {
          outcome = await handleOrgPaymentFailed(failedOrgId);
          break;
        }
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
        // Org (property) subscription canceled — clear the grace clock
        const deletedOrgId = await resolveOrgId(subscription.metadata);
        if (deletedOrgId) {
          const { error } = await adminClient
            .from('organizations')
            .update({
              subscription_status: 'canceled',
              payment_failed_at: null,
              dunning_last_marker_sent: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', deletedOrgId);
          outcome = error ? 'db_error' : 'org_canceled';
          break;
        }
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

      case 'customer.subscription.updated': {
        const updated = event.data.object as Stripe.Subscription;
        // Org events: no personal email (managers already get dunning).
        const updOrgId = await resolveOrgId(updated.metadata);
        if (updOrgId) {
          outcome = 'org_update_ignored';
          break;
        }
        // Upgrade detection: plan items changed while the sub is active.
        const prevAttrs = (
          event.data as unknown as { previous_attributes?: Record<string, unknown> }
        ).previous_attributes;
        if (!prevAttrs || !('items' in prevAttrs) || updated.status !== 'active') {
          outcome = 'ignored_update';
          break;
        }
        const updUserId = await resolveUserId(updated.metadata, null);
        if (!updUserId) {
          outcome = 'user_not_found';
          break;
        }
        const price = updated.items?.data?.[0]?.price;
        const tier = tierFromLookupKey(price?.lookup_key ?? null);
        await notifySubscriptionEmail(updUserId, {
          eventName: event.id,
          planName: tier && tier !== 'free' ? tier : 'Premium',
          upgradeOrStart: 'upgrading to',
          billingCycle: price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
          amount: fmtAmount(price?.unit_amount ?? null),
          nextBillingDate: fmtDate(
            updated.current_period_end
              ? new Date(updated.current_period_end * 1000).toISOString()
              : null,
          ),
        });
        outcome = 'upgrade_email_sent';
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
