// @ts-nocheck — Deno runtime
// Triggered after a partner assignment is marked completed.
// Creates a Stripe Connect transfer to the partner's connected account.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

// Rate limit: 10 payout initiations per hour per homeowner.
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 3600; // 1 hour

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      return json({ error: 'Payment service not configured' }, 503);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── 2. Rate limiting ─────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await checkRateLimit(
      adminClient,
      `partner-payout:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      console.warn('[partner-payout] Rate limit exceeded for user:', user.id);
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: { assignmentId?: string };
    try { body = await req.json(); } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const { assignmentId } = body;
    if (!assignmentId) return json({ error: 'assignmentId is required' }, 400);

    // ── 4. Load assignment ───────────────────────────────────────────────────
    const { data: assignment, error: assignmentError } = await adminClient
      .from('partner_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return json({ error: 'Assignment not found' }, 404);
    }

    // Only the homeowner may trigger payout
    if (assignment.homeowner_id !== user.id) {
      return json({ error: 'Forbidden' }, 403);
    }

    if (assignment.status !== 'completed') {
      return json({ error: 'Assignment is not completed' }, 400);
    }

    if (assignment.payment_status === 'captured') {
      return json({ error: 'Already paid out' }, 400);
    }

    // ── 4. Load partner Stripe account ───────────────────────────────────────
    const { data: partnerVerif } = await adminClient
      .from('partner_verifications')
      .select('stripe_account_id, payout_status, idv_status')
      .eq('user_id', assignment.partner_id)
      .single();

    if (!partnerVerif?.stripe_account_id) {
      return json({ error: 'Partner has not connected a payout account' }, 400);
    }

    if (partnerVerif.idv_status !== 'verified') {
      return json({ error: 'Partner identity not verified' }, 400);
    }

    // ── 5. Compute amounts ───────────────────────────────────────────────────
    const agreedCents = assignment.agreed_rate_cents ?? 0;
    const platformFeeCents = Math.round(agreedCents * PLATFORM_FEE_PERCENT);
    const partnerEarnCents = agreedCents - platformFeeCents;

    // ── 6. Create Stripe Transfer (platform → partner Connect account) ───────
    const transferParams = new URLSearchParams({
      amount: String(partnerEarnCents),
      currency: 'usd',
      destination: partnerVerif.stripe_account_id,
      'metadata[assignment_id]': assignmentId,
      'metadata[partner_id]': assignment.partner_id,
    });

    const transferRes = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: transferParams.toString(),
    });

    const transferData = await transferRes.json();
    if (!transferRes.ok) {
      console.error('[partner-payout] Stripe transfer error:', transferData?.error?.message);
      return json({ error: transferData?.error?.message ?? 'Stripe error' }, 500);
    }

    const transferId: string = transferData.id;

    // ── 7. Record payout + update assignment ─────────────────────────────────
    const { data: payout } = await adminClient
      .from('partner_payouts')
      .insert({
        partner_id: assignment.partner_id,
        assignment_id: assignmentId,
        amount_cents: partnerEarnCents,
        stripe_transfer_id: transferId,
        status: 'in_transit',
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single();

    await adminClient
      .from('partner_assignments')
      .update({
        platform_fee_cents: platformFeeCents,
        partner_earn_cents: partnerEarnCents,
        payment_status: 'captured',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    // Refresh denormalised partner stats
    const { error: rpcError } = await adminClient.rpc('refresh_partner_stats', {
      p_user_id: assignment.partner_id,
    });
    if (rpcError) {
      console.warn('[partner-payout] refresh_partner_stats error:', rpcError.message);
    }

    return json({
      success: true,
      payoutId: payout?.id,
      transferId,
      partnerEarnCents,
      platformFeeCents,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[partner-payout] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
