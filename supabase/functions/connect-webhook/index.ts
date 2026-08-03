// @ts-nocheck — Deno runtime
// Stripe Connect webhook handler
// Register in Stripe Dashboard → Developers → Webhooks
// Endpoint: POST /functions/v1/connect-webhook
// Events to listen for:
//   account.updated              — fires when Express onboarding progresses/completes
//   account.application.deauthorized — partner disconnects their account
//   capability.updated           — individual capability (transfers/card_payments) changes
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Verify Stripe webhook signature using HMAC-SHA256 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    const signed = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
    const expected = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === signature;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[connect-webhook] Missing STRIPE_CONNECT_WEBHOOK_SECRET');
      return json({ error: 'Webhook not configured' }, 503);
    }

    const rawBody = await req.text();
    const sigHeader = req.headers.get('stripe-signature') ?? '';

    const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    if (!valid) {
      console.warn('[connect-webhook] Invalid Stripe signature');
      return json({ error: 'Invalid signature' }, 400);
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.type;
    const acct = event.data?.object;

    console.log(`[connect-webhook] Event: ${eventType}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── account.updated ───────────────────────────────────────────────────────
    // Stripe fires this as the partner progresses through Express onboarding.
    // When charges_enabled AND payouts_enabled both flip true the account is live.
    if (eventType === 'account.updated') {
      const stripeAccountId: string = acct?.id;
      if (!stripeAccountId) return json({ received: true });

      const chargesEnabled: boolean  = acct.charges_enabled  ?? false;
      const payoutsEnabled: boolean  = acct.payouts_enabled  ?? false;
      const detailsSubmitted: boolean = acct.details_submitted ?? false;

      // Map Stripe state → our payout_status enum
      let payoutStatus: string;
      if (chargesEnabled && payoutsEnabled) {
        payoutStatus = 'active';
      } else if (detailsSubmitted) {
        payoutStatus = 'pending_review';
      } else {
        payoutStatus = 'pending';
      }

      // Collect any current requirements/disabled reason for debugging
      const disabledReason: string | null =
        acct.requirements?.disabled_reason ?? null;
      const requirementsDue: string[] =
        acct.requirements?.currently_due ?? [];

      const { error: updateError } = await adminClient
        .from('partner_verifications')
        .update({
          payout_status: payoutStatus,
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          details_submitted: detailsSubmitted,
          connect_disabled_reason: disabledReason,
          connect_requirements_due: requirementsDue.length > 0
            ? requirementsDue
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', stripeAccountId);

      if (updateError) {
        console.error('[connect-webhook] DB update error:', updateError.message);
        // Still return 200 so Stripe doesn't retry indefinitely for a data error
      } else {
        console.log(
          `[connect-webhook] account.updated → stripe_account_id=${stripeAccountId}` +
          ` charges=${chargesEnabled} payouts=${payoutsEnabled} status=${payoutStatus}`,
        );
      }

      // ── Tier auto-promotion when account goes active ──────────────────────
      // If identity is also verified, bump tier to 'elite' (top onboarded partner)
      if (payoutStatus === 'active') {
        const { data: verif } = await adminClient
          .from('partner_verifications')
          .select('user_id, idv_status, tier')
          .eq('stripe_account_id', stripeAccountId)
          .maybeSingle();

        if (verif && verif.idv_status === 'verified' && verif.tier !== 'elite') {
          await adminClient
            .from('partner_verifications')
            .update({ tier: 'elite', updated_at: new Date().toISOString() })
            .eq('stripe_account_id', stripeAccountId);

          // Touch the profile so the app re-fetches via Realtime
          await adminClient
            .from('profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', verif.user_id);

          console.log(
            `[connect-webhook] Partner ${verif.user_id} promoted to tier=elite`,
          );
        }
      }

      return json({ received: true });
    }

    // ── account.application.deauthorized ─────────────────────────────────────
    // Partner explicitly disconnects their Express account from the platform.
    if (eventType === 'account.application.deauthorized') {
      const stripeAccountId: string = acct?.id ?? event.account;
      if (!stripeAccountId) return json({ received: true });

      await adminClient
        .from('partner_verifications')
        .update({
          payout_status: 'deauthorized',
          charges_enabled: false,
          payouts_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', stripeAccountId);

      console.log(
        `[connect-webhook] account.application.deauthorized → stripe_account_id=${stripeAccountId}`,
      );
      return json({ received: true });
    }

    // ── capability.updated ────────────────────────────────────────────────────
    // Fired when a specific capability (transfers, card_payments) changes status.
    // Re-fetch the full account object to get the current charges/payouts state.
    if (eventType === 'capability.updated') {
      const stripeAccountId: string = acct?.account;
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

      if (stripeAccountId && stripeSecretKey) {
        const acctRes = await fetch(
          `https://api.stripe.com/v1/accounts/${stripeAccountId}`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
        );

        if (acctRes.ok) {
          const fullAcct = await acctRes.json();
          const chargesEnabled: boolean  = fullAcct.charges_enabled  ?? false;
          const payoutsEnabled: boolean  = fullAcct.payouts_enabled  ?? false;
          const detailsSubmitted: boolean = fullAcct.details_submitted ?? false;

          let payoutStatus: string;
          if (chargesEnabled && payoutsEnabled) {
            payoutStatus = 'active';
          } else if (detailsSubmitted) {
            payoutStatus = 'pending_review';
          } else {
            payoutStatus = 'pending';
          }

          await adminClient
            .from('partner_verifications')
            .update({
              payout_status: payoutStatus,
              charges_enabled: chargesEnabled,
              payouts_enabled: payoutsEnabled,
              details_submitted: detailsSubmitted,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_account_id', stripeAccountId);

          console.log(
            `[connect-webhook] capability.updated re-sync → stripe_account_id=${stripeAccountId}` +
            ` status=${payoutStatus}`,
          );
        }
      }

      return json({ received: true });
    }

    // All other events — acknowledge and ignore
    console.log(`[connect-webhook] Unhandled event type: ${eventType} — acknowledged`);
    return json({ received: true });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[connect-webhook] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
