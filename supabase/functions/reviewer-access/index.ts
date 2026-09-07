// @ts-nocheck — Deno runtime
//
// reviewer-access — App Review demo access (release-safe).
//
// Lets an App Store reviewer sign in to the demo account without email inbox
// access: the client sends the reviewer email (+ the static demo code when
// signing in), and this function mints a real Supabase session server-side.
//
// Security model:
//   - Hard-gated to EXACTLY the reviewer email — no other account can be
//     created, modified, or signed into through this endpoint.
//   - The demo code is validated server-side (env REVIEWER_ACCESS_CODE,
//     fallback "123456"). The password for the demo account is randomized on
//     every sign-in and NEVER returned to any client.
//   - The session is minted via a real /auth/v1/token grant, so the client
//     receives standard access/refresh tokens indistinguishable from a
//     normal login.
//   - Idempotent "ensure" phase (no code required) prepares demo content:
//     reviewer account + confirmed email, active hoa_admin membership in the
//     demo community, a pending resident request (to exercise approvals), and
//     demo shipments if the reviewer has none.
//   - Light per-IP rate limit (30 requests / 10 min, best-effort in-memory).
//
// Deploy: supabase functions deploy reviewer-access --no-verify-jwt
//
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REVIEWER_EMAIL = 'reviewer@porchivo.com';
const PENDING_DEMO_EMAIL = 'pending@porchivo.dev';
const ACCESS_CODE = Deno.env.get('REVIEWER_ACCESS_CODE') ?? '123456';
// Demo community the reviewer joins as an admin (Willow Creek HOA).
const DEMO_ORG_ID = Deno.env.get('DEMO_ORG_ID') ?? '032c31bf-6fb0-4a69-b2a6-872f089766af';

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

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'pv' + btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '') + '9x';
}

// Best-effort in-memory rate limiter (per isolate).
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= 30) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function isoAt(base: Date, dayOffset: number, hour: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ── 1. Require a public Supabase key header (light gate, mirrors
    //       dev-confirm-user). The platform may expose either the legacy JWT
    //       anon key or the new sb_publishable_ key — accept either; if neither
    //       env is injected, fall back to shape-checking the header.
    const apiKey = req.headers.get('apikey') ?? '';
    const knownKeys = [
      Deno.env.get('SUPABASE_ANON_KEY'),
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    ].filter((k): k is string => !!k);
    const looksPublic = apiKey.startsWith('sb_publishable_') || apiKey.startsWith('eyJ');
    const keyOk = knownKeys.length > 0 ? knownKeys.includes(apiKey) : looksPublic;
    if (!apiKey || !keyOk) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Rate limit per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (rateLimited(ip)) {
      return json({ error: 'Too many requests. Try again later.' }, 429);
    }

    // ── 3. Parse body
    let body: { email?: string; code?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // ── 4. HARD GATE: only the reviewer email may pass, exactly.
    const email = body.email?.trim().toLowerCase() ?? '';
    if (email !== REVIEWER_EMAIL) {
      return json({ error: 'Demo access is not available for this account.' }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 5. Ensure the reviewer auth user exists (profile trigger creates the
    //       profile row). Existing account → no changes needed.
    let userId: string | null = null;
    const { data: profileRow } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    userId = profileRow?.id ?? null;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { name: 'App Review', full_name: 'App Review' },
      });
      if (createError || !created.user) {
        console.error('[reviewer-access] createUser failed:', createError?.message);
        return json({ error: 'Could not prepare demo account' }, 500);
      }
      userId = created.user.id;
      console.log('[reviewer-access] created reviewer user');
    }

    // ── 6. Ensure profile row (safety net if the trigger has not fired yet)
    await admin
      .from('profiles')
      .upsert(
        { id: userId, name: 'App Review', email },
        { onConflict: 'id', ignoreDuplicates: true },
      );

    // ── 7. Ensure active hoa_admin membership in the demo community
    const { data: membership } = await admin
      .from('org_memberships')
      .select('id, status, role')
      .eq('user_id', userId)
      .eq('org_id', DEMO_ORG_ID)
      .maybeSingle();

    if (!membership) {
      const { error: insError } = await admin.from('org_memberships').insert({
        user_id: userId,
        org_id: DEMO_ORG_ID,
        role: 'hoa_admin',
        status: 'active',
        notes: 'App Review demo membership',
      });
      if (insError) console.error('[reviewer-access] membership insert:', insError.message);
    } else if (membership.status !== 'active' || membership.role !== 'hoa_admin') {
      await admin
        .from('org_memberships')
        .update({ status: 'active', role: 'hoa_admin' })
        .eq('id', membership.id);
    }

    // ── 8. Ensure a pending resident request exists so the reviewer can
    //       exercise the member-approvals admin tool.
    const { count: pendingCount } = await admin
      .from('org_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', DEMO_ORG_ID)
      .eq('status', 'pending');

    if ((pendingCount ?? 0) === 0) {
      const { data: pendingProfile } = await admin
        .from('profiles')
        .select('id')
        .ilike('email', PENDING_DEMO_EMAIL)
        .maybeSingle();
      let pendingId = pendingProfile?.id ?? null;
      if (!pendingId) {
        const { data: createdPending, error: pendingCreateError } = await admin.auth.admin.createUser({
          email: PENDING_DEMO_EMAIL,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: { name: 'Pending Resident', full_name: 'Pending Resident' },
        });
        if (pendingCreateError) {
          console.error('[reviewer-access] pending user create failed:', pendingCreateError.message);
        }
        pendingId = createdPending?.user?.id ?? null;
      }
      if (pendingId) {
        await admin.from('org_memberships').insert({
          user_id: pendingId,
          org_id: DEMO_ORG_ID,
          role: 'resident',
          status: 'pending',
          notes: 'Requesting to join the community',
        });
      }
    }

    // ── 9. Seed demo shipments only if the reviewer has none (idempotent).
    const { count: shipmentCount } = await admin
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('homeowner_id', userId);

    if ((shipmentCount ?? 0) === 0) {
      const now = new Date();
      const { error: seedError } = await admin.from('shipments').insert([
        {
          homeowner_id: userId,
          homeowner_name: 'App Review',
          status: 'open',
          carrier: 'UPS',
          packages_expected: '1',
          delivery_window_start: isoAt(now, 0, 16),
          delivery_window_end: isoAt(now, 0, 19),
          address_text: '123 Willow Creek Ln',
          tracking_number: '1Z999AA10123456784',
          delivery_status: 'out_for_delivery',
          notes: 'Demo delivery — arriving today',
        },
        {
          homeowner_id: userId,
          homeowner_name: 'App Review',
          status: 'open',
          carrier: 'FedEx',
          packages_expected: '2',
          delivery_window_start: isoAt(now, 1, 15),
          delivery_window_end: isoAt(now, 1, 18),
          address_text: '123 Willow Creek Ln',
          tracking_number: '461234567890',
          delivery_status: 'in_transit',
          notes: 'Demo delivery — scheduled tomorrow',
        },
        {
          homeowner_id: userId,
          homeowner_name: 'App Review',
          status: 'completed',
          carrier: 'USPS',
          packages_expected: '1',
          delivery_window_start: isoAt(now, -1, 10),
          delivery_window_end: isoAt(now, -1, 13),
          address_text: '123 Willow Creek Ln',
          tracking_number: '9400111899223197428497',
          delivery_status: 'delivered',
          notes: 'Demo delivery — completed yesterday',
        },
      ]);
      if (seedError) console.error('[reviewer-access] shipment seed:', seedError.message);
    }

    // ── 10. No code → ensure-only phase (client's "Send magic link" tap).
    const code = body.code?.trim() ?? '';
    if (!code) {
      return json({ ready: true });
    }

    // ── 11. Validate the static demo code server-side.
    if (code !== ACCESS_CODE) {
      return json({ error: 'Invalid demo code.' }, 401);
    }

    // ── 12. Mint a real session: rotate the demo password server-side, then
    //        grant via /auth/v1/token. The password is never returned.
    const newPassword = randomPassword();
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (pwError) {
      console.error('[reviewer-access] password rotate failed:', pwError.message);
      return json({ error: 'Could not prepare demo session' }, 500);
    }

    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    if (!tokenRes.ok) {
      console.error('[reviewer-access] token grant failed:', tokenRes.status);
      return json({ error: 'Could not sign in to the demo account' }, 500);
    }
    const tokenData = await tokenRes.json();

    return json({ ready: true, session: tokenData });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[reviewer-access] unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
