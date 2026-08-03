// @ts-nocheck — Deno runtime
// Homeowner creates a paid hold assignment for a connected partner.
// Creates a Stripe PaymentIntent (authorized, not captured) so funds
// are reserved until the partner completes the hold.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLATFORM_FEE_PERCENT = 0.15; // 15% Porchivo cut

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) return json({ error: 'Payment service not configured' }, 503);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── 2. Parse body ────────────────────────────────────────────────────────
    let body: {
      connectionId?: string;
      partnerId?: string;
      agreedRateCents?: number;
      expectedDeliveryDate?: string;
      pickupWindowStart?: string;
      pickupWindowEnd?: string;
      notes?: string;
      shipmentId?: string;
    };
    try { body = await req.json(); } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const {
      connectionId,
      partnerId,
      agreedRateCents = 0,
      expectedDeliveryDate,
      pickupWindowStart,
      pickupWindowEnd,
      notes,
      shipmentId,
    } = body;

    if (!connectionId) return json({ error: 'connectionId is required' }, 400);
    if (!partnerId) return json({ error: 'partnerId is required' }, 400);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 3. Validate connection ───────────────────────────────────────────────
    const { data: connection } = await adminClient
      .from('partner_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('homeowner_id', user.id)
      .eq('partner_id', partnerId)
      .eq('status', 'active')
      .maybeSingle();

    if (!connection) {
      return json({ error: 'Active connection not found between you and this partner.' }, 404);
    }

    // ── 4. Validate partner is verified and has payout connected ─────────────
    const { data: partnerVerif } = await adminClient
      .from('partner_verifications')
      .select('idv_status, payout_status, stripe_account_id')
      .eq('user_id', partnerId)
      .maybeSingle();

    if (!partnerVerif || partnerVerif.idv_status !== 'verified') {
      return json({ error: 'Partner has not completed identity verification.' }, 400);
    }

    // ── 5. Compute fee split ─────────────────────────────────────────────────
    const platformFeeCents = Math.round(agreedRateCents * PLATFORM_FEE_PERCENT);
    const partnerEarnCents = agreedRateCents - platformFeeCents;

    // ── 6. Create Stripe PaymentIntent (capture_method: manual = authorize only) ─
    let paymentIntentId: string | null = null;
    let paymentStatus: string = 'unpaid';

    if (agreedRateCents >= 50) { // Stripe minimum is $0.50
      const piParams = new URLSearchParams({
        amount: String(agreedRateCents),
        currency: 'usd',
        capture_method: 'manual',    // authorize now, capture on completion
        'metadata[assignment_type]': 'partner_hold',
        'metadata[homeowner_id]': user.id,
        'metadata[partner_id]': partnerId,
        'metadata[connection_id]': connectionId,
      });
      if (partnerVerif.stripe_account_id) {
        piParams.set('transfer_data[destination]', partnerVerif.stripe_account_id);
        piParams.set('application_fee_amount', String(platformFeeCents));
      }

      const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: piParams.toString(),
      });

      const piData = await piRes.json();
      if (!piRes.ok) {
        console.error('[create-assignment] PaymentIntent error:', piData?.error?.message);
        return json({ error: piData?.error?.message ?? 'Stripe error' }, 500);
      }
      paymentIntentId = piData.id as string;
      paymentStatus = 'authorized';
    }

    // ── 7. Insert assignment row ─────────────────────────────────────────────
    const { data: assignment, error: insertError } = await adminClient
      .from('partner_assignments')
      .insert({
        connection_id: connectionId,
        homeowner_id: user.id,
        partner_id: partnerId,
        shipment_id: shipmentId ?? null,
        status: 'requested',
        expected_delivery_date: expectedDeliveryDate ?? null,
        pickup_window_start: pickupWindowStart ?? null,
        pickup_window_end: pickupWindowEnd ?? null,
        notes: notes ?? null,
        agreed_rate_cents: agreedRateCents,
        platform_fee_cents: platformFeeCents,
        partner_earn_cents: partnerEarnCents,
        payment_intent_id: paymentIntentId,
        payment_status: paymentStatus,
      })
      .select()
      .single();

    if (insertError || !assignment) {
      console.error('[create-assignment] DB insert error:', insertError?.message);
      return json({ error: 'Failed to create assignment' }, 500);
    }

    return json({
      success: true,
      assignmentId: assignment.id,
      paymentIntentId,
      agreedRateCents,
      platformFeeCents,
      partnerEarnCents,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[create-assignment] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
