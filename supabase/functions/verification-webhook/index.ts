// @ts-nocheck — Deno runtime
// Stripe Identity webhook handler
// Register in Stripe Dashboard → Developers → Webhooks
// Events to listen for:
//   identity.verification_session.verified
//   identity.verification_session.requires_input
//   identity.verification_session.cancelled
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

// v22: verification-webhook no longer inserts notification rows or touches
// profiles directly. The DB trigger chain handles everything:
//   partner_verifications UPDATE
//     → trg_sync_idv_to_profile  (bumps profiles.updated_at for Realtime)
//     → trg_notify_idv_change    (inserts notification row)
//       → on_notification_created (sends Expo push via pg_net)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_IDENTITY_WEBHOOK_SECRET');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!webhookSecret || !stripeSecretKey) {
      console.error('[verification-webhook] Missing STRIPE_IDENTITY_WEBHOOK_SECRET or STRIPE_SECRET_KEY');
      return json({ error: 'Webhook not configured' }, 503);
    }

    const rawBody = await req.text();
    const sigHeader = req.headers.get('stripe-signature') ?? '';

    const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    if (!valid) {
      console.warn('[verification-webhook] Invalid signature');
      return json({ error: 'Invalid signature' }, 400);
    }

    const event = JSON.parse(rawBody);
    const session = event.data?.object;

    if (!session || session.object !== 'identity.verification_session') {
      return json({ received: true });
    }

    const userId: string | undefined = session.metadata?.user_id;
    if (!userId) {
      console.warn('[verification-webhook] No user_id in session metadata');
      return json({ received: true });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const eventType: string = event.type;
    console.log(`[verification-webhook] Event: ${eventType} for user: ${userId}`);

    // ── identity.verification_session.verified ────────────────────────────────
    if (eventType === 'identity.verification_session.verified') {
      // Pull verified fields from the VerificationReport
      const reportId: string = session.last_verification_report;
      let legal_first_name: string | null = null;
      let legal_last_name: string | null = null;
      let dob: string | null = null;
      let id_country: string | null = null;
      let id_type: string | null = null;

      if (reportId) {
        const reportRes = await fetch(
          `https://api.stripe.com/v1/identity/verification_reports/${reportId}`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
        );
        if (reportRes.ok) {
          const report = await reportRes.json();
          const doc = report.document;
          if (doc) {
            legal_first_name = doc.first_name ?? null;
            legal_last_name  = doc.last_name ?? null;
            id_country = doc.issuing_country ?? null;
            id_type = doc.type ?? null;
            if (doc.dob) {
              const { year, month, day } = doc.dob;
              if (year && month && day) {
                dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              }
            }
          }
        }
      }

      await adminClient
        .from('partner_verifications')
        .update({
          idv_status: 'verified',
          idv_report_id: reportId ?? null,
          idv_verified_at: new Date().toISOString(),
          legal_first_name,
          legal_last_name,
          dob,
          id_country,
          id_type,
          tier: 'verified',
          idv_failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // DB triggers handle profile sync + notification + push:
      //   trg_sync_idv_to_profile → trg_notify_idv_change → on_notification_created

    // ── identity.verification_session.requires_input ──────────────────────────
    } else if (eventType === 'identity.verification_session.requires_input') {
      const lastError = session.last_error;
      const reason = lastError?.reason ?? lastError?.code ?? 'requires_input';

      await adminClient
        .from('partner_verifications')
        .update({
          idv_status: 'requires_input',
          idv_failure_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // DB triggers handle notification + push automatically

    // ── identity.verification_session.cancelled ───────────────────────────────
    } else if (eventType === 'identity.verification_session.cancelled') {
      await adminClient
        .from('partner_verifications')
        .update({
          idv_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // DB triggers handle notification + push automatically
    }

    return json({ received: true });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[verification-webhook] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});

// mapFailureReason removed — notification messages are now generated by
// the trg_notify_idv_change DB trigger, not by this edge function.
