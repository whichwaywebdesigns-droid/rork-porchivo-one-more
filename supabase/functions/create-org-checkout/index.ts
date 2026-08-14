// @ts-nocheck — Deno runtime
// Creates an organization with pending subscription status, then returns
// a Stripe Checkout URL for the HOA board member / property manager to
// complete payment. After payment, the confirm-org-signup function activates
// the org and creates the admin membership.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

const RATE_LIMIT = 3;
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

// ─── Plan definitions (must match the app screen) ────────────────────────────

interface PlanConfig {
  name: string;
  description: string;
  monthlyPrice: number;  // cents
  annualPrice: number;   // cents
  maxUnits: number | null;
}

const PLANS: Record<string, PlanConfig> = {
  starter: {
    name: 'Porchivo Starter',
    description: 'Up to 50 units — announcements, maintenance, package tracking',
    monthlyPrice: 4900,
    annualPrice: 49900,
    maxUnits: 50,
  },
  community: {
    name: 'Porchivo Community',
    description: 'Up to 200 units — dues collection, payments, amenity reservations',
    monthlyPrice: 9900,
    annualPrice: 99900,
    maxUnits: 200,
  },
  professional: {
    name: 'Porchivo Professional',
    description: 'Up to 500 units across 3 communities — vendor management, branding',
    monthlyPrice: 17900,
    annualPrice: 179900,
    maxUnits: 500,
  },
  enterprise: {
    name: 'Porchivo Property Manager',
    description: 'Unlimited units & communities — white-label, API access, SLA',
    monthlyPrice: 29900,
    annualPrice: 299000,
    maxUnits: null,
  },
};

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
      `create-org-checkout:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      console.warn('[create-org-checkout] Rate limit exceeded for user:', user.id);
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Parse and validate request ─────────────────────────────────────────
    let body: {
      name: string;
      type: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      totalUnits?: number;
      planTier: string;
      billingCycle: 'monthly' | 'annual';
      returnUrl?: string;
    };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const {
      name, type, address, city, state, zip, totalUnits,
      planTier, billingCycle,
    } = body;

    // Validate required fields
    if (!name?.trim()) return json({ error: 'Organization name is required' }, 400);
    if (!type) return json({ error: 'Organization type is required' }, 400);
    if (!['hoa', 'condo', 'multifamily', 'property_management'].includes(type)) {
      return json({ error: 'Invalid organization type' }, 400);
    }
    if (!planTier || !PLANS[planTier]) return json({ error: 'Invalid plan tier' }, 400);
    if (!billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
      return json({ error: 'Invalid billing cycle' }, 400);
    }

    const returnUrl = body.returnUrl ?? 'porchivo://org-signup/success';
    if (!returnUrl.startsWith('porchivo://')) {
      return json({ error: 'Invalid return URL: only porchivo:// scheme is allowed' }, 400);
    }

    // ── 4. Check user doesn't already have an active org ────────────────────
    const { data: existingMembership } = await adminClient
      .from('org_memberships')
      .select('org_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
      .limit(1);

    if (existingMembership && existingMembership.length > 0) {
      return json({ error: 'You are already a member of a community. Leave your current community before creating a new one.' }, 409);
    }

    // ── 5. Generate invite code ───────────────────────────────────────────────
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const plan = PLANS[planTier];
    const unitAmount = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
    const interval: 'month' | 'year' = billingCycle === 'monthly' ? 'month' : 'year';

    // ── 6. Create org with pending subscription ───────────────────────────────
    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: name.trim(),
        type,
        address: address?.trim() ?? '',
        city: city?.trim() ?? '',
        state: state?.trim() ?? '',
        zip: zip?.trim() ?? '',
        total_units: totalUnits ?? null,
        admin_user_id: user.id,
        invite_code: inviteCode,
        is_active: false, // activated after payment
        plan_tier: planTier,
        billing_cycle: billingCycle,
        subscription_status: 'pending',
        max_units: plan.maxUnits,
      })
      .select()
      .single();

    if (orgError) {
      console.error('[create-org-checkout] Org create error:', orgError.code, orgError.message);
      return json({ error: 'Could not create organization: ' + orgError.message }, 500);
    }

    const orgId = orgData.id;

    // ── 7. Get user email for Stripe customer ────────────────────────────────
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('id', user.id)
      .maybeSingle();

    const userEmail = profile?.email ?? user.email ?? '';
    const userName = profile?.name ?? '';

    // ── 8. Create Stripe Customer ────────────────────────────────────────────
    const customerParams = new URLSearchParams();
    customerParams.set('email', userEmail);
    customerParams.set('name', userName || name.trim());
    customerParams.set('metadata[org_id]', orgId);
    customerParams.set('metadata[user_id]', user.id);
    customerParams.set('metadata[plan_tier]', planTier);
    customerParams.set('metadata[billing_cycle]', billingCycle);

    const customerRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: customerParams.toString(),
    });

    const customerData = await customerRes.json();
    if (!customerRes.ok) {
      console.error('[create-org-checkout] Stripe customer error:', customerData?.error?.message);
      // Clean up the pending org
      await adminClient.from('organizations').delete().eq('id', orgId);
      return json({ error: 'Could not set up payment customer: ' + (customerData?.error?.message ?? 'Stripe error') }, 500);
    }

    const stripeCustomerId = customerData.id as string;

    // Persist customer ID
    await adminClient
      .from('organizations')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', orgId);

    // ── 9. Create Stripe Checkout Session (subscription mode) ────────────────
    const checkoutParams = new URLSearchParams();
    checkoutParams.set('mode', 'subscription');
    checkoutParams.set('customer', stripeCustomerId);
    checkoutParams.set('success_url', `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&org_id=${orgId}`);
    checkoutParams.set('cancel_url', `porchivo://org-signup/cancelled?org_id=${orgId}`);
    checkoutParams.set('metadata[org_id]', orgId);
    checkoutParams.set('metadata[user_id]', user.id);
    checkoutParams.set('metadata[plan_tier]', planTier);
    checkoutParams.set('metadata[billing_cycle]', billingCycle);
    checkoutParams.set('subscription_data[metadata][org_id]', orgId);
    checkoutParams.set('subscription_data[metadata][user_id]', user.id);
    checkoutParams.set('subscription_data[metadata][plan_tier]', planTier);
    checkoutParams.set('subscription_data[metadata][billing_cycle]', billingCycle);

    // Line item with inline price_data (no pre-created Stripe products needed)
    checkoutParams.set('line_items[0][quantity]', '1');
    checkoutParams.set('line_items[0][price_data][currency]', 'usd');
    checkoutParams.set('line_items[0][price_data][unit_amount]', String(unitAmount));
    checkoutParams.set('line_items[0][price_data][product_data][name]', plan.name);
    checkoutParams.set('line_items[0][price_data][product_data][description]', plan.description);
    checkoutParams.set('line_items[0][price_data][recurring][interval]', interval);

    const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: checkoutParams.toString(),
    });

    const checkoutData = await checkoutRes.json();
    if (!checkoutRes.ok) {
      console.error('[create-org-checkout] Checkout session error:', checkoutData?.error?.message);
      // Clean up the pending org and customer
      await adminClient.from('organizations').delete().eq('id', orgId);
      return json({ error: 'Could not create checkout session: ' + (checkoutData?.error?.message ?? 'Stripe error') }, 500);
    }

    const checkoutUrl: string = checkoutData.url;
    const sessionId: string = checkoutData.id;

    return json({
      checkoutUrl,
      sessionId,
      orgId,
      plan: { name: plan.name, price: unitAmount, interval },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[create-org-checkout] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
