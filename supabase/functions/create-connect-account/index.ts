// @ts-nocheck — Deno runtime
// Creates a Stripe Connect Express account for a verified partner and returns
// a hosted onboarding URL. On success, stores stripe_account_id in the DB.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

// Rate limit: 5 account-link generations per 10 minutes per user.
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 600;

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

    // ── 2. Rate limiting ──────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await checkRateLimit(
      adminClient,
      `create-connect-account:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      console.warn('[create-connect-account] Rate limit exceeded for user:', user.id);
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Parse and validate request ─────────────────────────────────────────
    let body: { returnUrl?: string; refreshUrl?: string } = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const returnUrl  = body.returnUrl  ?? 'porchivo://partner-verify/connect-return';
    const refreshUrl = body.refreshUrl ?? 'porchivo://partner-verify/connect-refresh';

    // Only allow porchivo:// deep-link scheme — prevents open-redirect attacks
    if (!returnUrl.startsWith('porchivo://') || !refreshUrl.startsWith('porchivo://')) {
      return json({ error: 'Invalid URL: only porchivo:// scheme is allowed' }, 400);
    }

    // ── 3. Load existing verification record ─────────────────────────────────
    const { data: verif } = await adminClient
      .from('partner_verifications')
      .select('id, idv_status, stripe_account_id, payout_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!verif) return json({ error: 'Verification record not found. Complete identity verification first.' }, 404);
    if (verif.idv_status !== 'verified') return json({ error: 'Identity must be verified before connecting a payout account.' }, 400);
    if (verif.payout_status === 'active') return json({ alreadyConnected: true }, 200);

    // ── 4. Create or reuse Stripe Connect Express account ────────────────────
    let stripeAccountId: string = verif.stripe_account_id ?? '';

    if (!stripeAccountId) {
      // Pull email from profiles for pre-fill
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .maybeSingle();

      const acctParams = new URLSearchParams({
        type: 'express',
        country: 'US',
        'capabilities[transfers][requested]': 'true',
        'capabilities[card_payments][requested]': 'true',
        'metadata[user_id]': user.id,
      });
      if (profile?.email) acctParams.set('email', profile.email);
      if (profile?.full_name) {
        const parts = (profile.full_name as string).split(' ');
        if (parts[0]) acctParams.set('individual[first_name]', parts[0]);
        if (parts[1]) acctParams.set('individual[last_name]', parts.slice(1).join(' '));
      }

      const acctRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: acctParams.toString(),
      });

      const acctData = await acctRes.json();
      if (!acctRes.ok) {
        console.error('[create-connect-account] Stripe account create error:', acctData?.error?.message);
        return json({ error: acctData?.error?.message ?? 'Stripe error' }, 500);
      }
      stripeAccountId = acctData.id as string;

      // Persist account ID immediately
      await adminClient
        .from('partner_verifications')
        .update({
          stripe_account_id: stripeAccountId,
          payout_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    // ── 5. Create Account Link (hosted Stripe Express onboarding URL) ─────────
    const linkParams = new URLSearchParams({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: linkParams.toString(),
    });

    const linkData = await linkRes.json();
    if (!linkRes.ok) {
      console.error('[create-connect-account] Account link error:', linkData?.error?.message);
      return json({ error: linkData?.error?.message ?? 'Stripe link error' }, 500);
    }

    const onboardingUrl: string = linkData.url;

    // Also persist the onboarding URL in DB for recovery
    await adminClient
      .from('partner_verifications')
      .update({
        stripe_onboarding_url: onboardingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return json({ stripeAccountId, onboardingUrl });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[create-connect-account] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
