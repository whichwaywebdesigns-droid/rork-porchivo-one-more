// @ts-nocheck — Deno runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

// Rate limit: 3 verification initiations per 10 minutes per user.
// Prevents abuse of the paid Stripe Identity API.
const RATE_LIMIT = 3;
const RATE_WINDOW_SECONDS = 600; // 10 minutes

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── 2. Rate limiting ─────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await checkRateLimit(
      adminClient,
      `initiate-verification:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      console.warn('[initiate-verification] Rate limit exceeded for user:', user.id);
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Stripe key check ──────────────────────────────────────────────────
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('[initiate-verification] STRIPE_SECRET_KEY not set');
      return json({ error: 'Payment service not configured' }, 503);
    }

    // ── 3. Parse and validate request ─────────────────────────────────────────
    let body: { returnUrl?: string } = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const returnUrl = body.returnUrl ?? 'porchivo://partner-verify/callback';

    // Only allow porchivo:// deep-link scheme — prevents open-redirect attacks
    if (!returnUrl.startsWith('porchivo://')) {
      return json({ error: 'Invalid returnUrl: only porchivo:// scheme is allowed' }, 400);
    }

    // ── 4. Upsert verification record in "pending" state ────────────────────

    const { data: existing } = await adminClient
      .from('partner_verifications')
      .select('id, idv_status, idv_session_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Don't start a new session if already verified
    if (existing?.idv_status === 'verified') {
      return json({ alreadyVerified: true });
    }

    // ── 5. Create Stripe Identity verification session ───────────────────────
    const stripeParams = new URLSearchParams({
      type: 'document',
      'options[document][require_id_number]': 'false',
      'options[document][require_live_capture]': 'true',
      'options[document][require_matching_selfie]': 'true',
      'metadata[user_id]': user.id,
      return_url: returnUrl,
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/identity/verification_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams.toString(),
    });

    const stripeData = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('[initiate-verification] Stripe error:', stripeData?.error?.message);
      return json({ error: stripeData?.error?.message ?? 'Stripe error' }, 500);
    }

    const sessionId = stripeData.id as string;
    const verificationUrl = stripeData.url as string;   // hosted verification page
    const clientSecret = stripeData.client_secret as string;

    // ── 6. Save session to DB ────────────────────────────────────────────────
    if (existing) {
      await adminClient
        .from('partner_verifications')
        .update({
          idv_session_id: sessionId,
          idv_status: 'pending',
          idv_failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    } else {
      await adminClient
        .from('partner_verifications')
        .insert({
          user_id: user.id,
          idv_session_id: sessionId,
          idv_status: 'pending',
        });
    }

    return json({
      sessionId,
      verificationUrl,
      clientSecret,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[initiate-verification] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
