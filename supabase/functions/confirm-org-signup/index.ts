// @ts-nocheck — Deno runtime
// Called after Stripe Checkout redirect. Verifies the payment session,
// activates the organization, and creates the admin membership.
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
      `confirm-org-signup:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Parse request ──────────────────────────────────────────────────────
    let body: { sessionId?: string; orgId?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const { sessionId, orgId } = body;
    if (!sessionId) return json({ error: 'Missing session_id' }, 400);
    if (!orgId) return json({ error: 'Missing org_id' }, 400);

    // ── 4. Verify the org exists and belongs to this user ────────────────────
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name, invite_code, admin_user_id, subscription_status, plan_tier, billing_cycle, is_active')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !org) return json({ error: 'Organization not found' }, 404);
    if (org.admin_user_id !== user.id) return json({ error: 'Not authorized for this organization' }, 403);

    // Already activated (idempotent — return success)
    if (org.subscription_status === 'active' && org.is_active) {
      return json({
        success: true,
        alreadyActive: true,
        org: {
          id: org.id,
          name: org.name,
          inviteCode: org.invite_code,
          planTier: org.plan_tier,
        },
      });
    }

    // ── 5. Retrieve the Stripe Checkout Session ──────────────────────────────
    const sessionRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      },
    );

    const sessionData = await sessionRes.json();
    if (!sessionRes.ok) {
      console.error('[confirm-org-signup] Stripe session retrieval error:', sessionData?.error?.message);
      return json({ error: 'Could not verify payment session' }, 500);
    }

    // ── 6. Check payment status ───────────────────────────────────────────────
    const paymentStatus = sessionData.payment_status;
    const mode = sessionData.mode;

    if (paymentStatus !== 'paid') {
      return json({
        error: 'Payment not completed',
        paymentStatus,
        detail: 'Your payment has not been processed yet. Please try again or contact support.',
      }, 402);
    }

    // Extract subscription and customer IDs
    const stripeSubscriptionId = sessionData.subscription as string | null;
    const stripeCustomerId = sessionData.customer as string | null;

    // ── 7. Retrieve subscription for period end ───────────────────────────────
    let currentPeriodEnd: string | null = null;
    if (stripeSubscriptionId) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`,
        {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
        },
      );
      const subData = await subRes.json();
      if (subRes.ok && subData.current_period_end) {
        currentPeriodEnd = new Date(subData.current_period_end * 1000).toISOString();
      }
    }

    // ── 8. Activate the organization ──────────────────────────────────────────
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        is_active: true,
        subscription_status: 'active',
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId ?? org.stripe_customer_id,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    if (updateError) {
      console.error('[confirm-org-signup] Org activation error:', updateError.message);
      return json({ error: 'Could not activate organization: ' + updateError.message }, 500);
    }

    // ── 9. Create admin membership (hoa_admin, active) ───────────────────────
    // Check if membership already exists (idempotent)
    const { data: existingMembership } = await adminClient
      .from('org_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!existingMembership) {
      const { error: memberError } = await adminClient
        .from('org_memberships')
        .insert({
          user_id: user.id,
          org_id: orgId,
          role: 'hoa_admin',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error('[confirm-org-signup] Membership creation error:', memberError.message);
        // Non-fatal — org is active, user can re-join manually
      }
    } else {
      // Ensure existing membership is active with hoa_admin role
      await adminClient
        .from('org_memberships')
        .update({
          role: 'hoa_admin',
          status: 'active',
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMembership.id);
    }

    return json({
      success: true,
      org: {
        id: org.id,
        name: org.name,
        inviteCode: org.invite_code,
        planTier: org.plan_tier,
        billingCycle: org.billing_cycle,
      },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[confirm-org-signup] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
