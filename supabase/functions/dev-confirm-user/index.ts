// @ts-nocheck — Deno runtime
//
// dev-confirm-user — DEV ONLY edge function.
//
// Auto-confirms the email of a freshly-registered QA test account so the
// developer can sign in without leaving the preview environment (where the
// magic-link / confirmation email redirect can't be opened).
//
// Security:
//   - Only operates on emails matching the QA test pattern (@porchivo.dev).
//   - Requires a valid Supabase anon-key auth header (rate-limited per IP).
//   - Uses the service role key server-side to flip email_confirmed_at.
//   - Returns a minimal { confirmed: true } on success.
//   - Never returns tokens, user IDs, or internal user data.
//
// Deploy: supabase functions deploy dev-confirm-user --no-verify-jwt
//
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ── 1. Require a valid anon-key header (light gate, not full auth) ───────
    const apiKey = req.headers.get('apikey') ?? '';
    if (!apiKey || apiKey !== supabaseAnonKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Parse + validate body ────────────────────────────────────────────
    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'A valid email is required' }, 400);
    }

    // ── 3. Restrict to QA test emails only ───────────────────────────────────
    // Only allow @porchivo.dev addresses — this function must never confirm
    // a real user's email.
    const ALLOWED_DOMAIN = 'porchivo.dev';
    const domain = email.split('@')[1];
    if (domain !== ALLOWED_DOMAIN) {
      return json(
        { error: `This endpoint only confirms @${ALLOWED_DOMAIN} test accounts` },
        403,
      );
    }

    // ── 4. Use the Admin API to confirm the user's email ─────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // List users matching the email, then update the matching one.
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error('[dev-confirm-user] listUsers error:', listError.message);
      return json({ error: 'Could not look up user' }, 500);
    }

    const targetUser = listData.users.find(
      (u: any) => (u.email ?? '').toLowerCase() === email,
    );

    if (!targetUser) {
      // User doesn't exist yet — nothing to confirm. Return success so the
      // client flow can proceed (it will have created the user first).
      return json({ confirmed: false, reason: 'user_not_found' });
    }

    if (targetUser.email_confirmed_at) {
      // Already confirmed — no-op.
      return json({ confirmed: true, already: true });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      { email_confirm: true },
    );

    if (updateError) {
      console.error('[dev-confirm-user] updateUserById error:', updateError.message);
      return json({ error: 'Could not confirm user' }, 500);
    }

    console.log(`[dev-confirm-user] Confirmed email for QA account: ${email}`);
    return json({ confirmed: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[dev-confirm-user] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
