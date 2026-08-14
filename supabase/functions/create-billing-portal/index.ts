// @ts-nocheck — Deno runtime
// Creates a Stripe Billing Portal session for an org admin to manage their
// subscription (update payment method, download invoices, cancel, etc.).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

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
      `create-billing-portal:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Parse request ──────────────────────────────────────────────────────
    let body: { orgId?: string; returnUrl?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const { orgId, returnUrl } = body;
    if (!orgId) return json({ error: 'Missing org_id' }, 400);

    // ── 4. Verify the org exists and the caller is the admin ─────────────────
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name, admin_user_id, stripe_customer_id, subscription_status')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !org) return json({ error: 'Organization not found' }, 404);
    if (org.admin_user_id !== user.id) return json({ error: 'Not authorized for this organization' }, 403);

    if (!org.stripe_customer_id) {
      return json({ error: 'No billing account found. Your subscription may have been set up differently.' }, 400);
    }

    // ── 5. Create Stripe Billing Portal session ──────────────────────────────
    const portalParams = new URLSearchParams();
    portalParams.set('customer', org.stripe_customer_id);

    const finalReturnUrl = returnUrl && returnUrl.startsWith('porchivo://')
      ? returnUrl
      : 'porchivo://manage-subscription';
    portalParams.set('return_url', finalReturnUrl);

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: portalParams.toString(),
    });

    const portalData = await portalRes.json();
    if (!portalRes.ok) {
      console.error('[create-billing-portal] Stripe portal error:', portalData?.error?.message);
      return json({ error: 'Could not create billing portal session: ' + (portalData?.error?.message ?? 'Stripe error') }, 500);
    }

    return json({
      url: portalData.url,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[create-billing-portal] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
