// @ts-nocheck — Deno runtime
//
// dev-confirm-user — DEV ONLY edge function.
//
// Ensures a QA test account exists, is email-confirmed, and has the correct
// password — all via the Admin API — so the client only needs a single
// signInWithPassword call (avoiding Supabase Auth rate limits from multiple
// rapid auth calls).
//
// Security:
//   - Only operates on emails matching the QA test pattern (@porchivo.dev).
//   - Requires a valid Supabase anon-key auth header.
//   - Uses the service role key server-side for all admin operations.
//   - Returns { ready: true } on success.
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

    // ── 1. Require a valid anon-key header (light gate) ─────────────────────
    const apiKey = req.headers.get('apikey') ?? '';
    if (!apiKey || apiKey !== supabaseAnonKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Parse + validate body ────────────────────────────────────────────
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'A valid email is required' }, 400);
    }

    const password = body.password;
    if (!password || password.length < 8) {
      return json({ error: 'A valid password (min 8 chars) is required' }, 400);
    }

    // ── 3. Restrict to QA test emails only ───────────────────────────────────
    const ALLOWED_DOMAIN = 'porchivo.dev';
    const domain = email.split('@')[1];
    if (domain !== ALLOWED_DOMAIN) {
      return json(
        { error: `This endpoint only operates on @${ALLOWED_DOMAIN} test accounts` },
        403,
      );
    }

    // ── 4. Admin client (not subject to Auth rate limits) ─────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 5. Find existing user by email ───────────────────────────────────────
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

    // ── 6a. User not found → create with confirmed email + password ──────────
    if (!targetUser) {
      const { error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: 'QA Tester', full_name: 'QA Tester' },
      });

      if (createError) {
        console.error('[dev-confirm-user] createUser error:', createError.message);
        return json({ error: 'Could not create QA user' }, 500);
      }

      console.log(`[dev-confirm-user] Created + confirmed QA account: ${email}`);
      return json({ ready: true, created: true });
    }

    // ── 6b. User exists → ensure confirmed + password matches ─────────────────
    const updates: { email_confirm?: boolean; password?: string } = {};

    if (!targetUser.email_confirmed_at) {
      updates.email_confirm = true;
    }
    // Always set the password to ensure it matches what the client expects.
    updates.password = password;

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      updates,
    );

    if (updateError) {
      console.error('[dev-confirm-user] updateUserById error:', updateError.message);
      return json({ error: 'Could not update QA user' }, 500);
    }

    console.log(`[dev-confirm-user] Ensured QA account ready: ${email}`);
    return json({ ready: true, already: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[dev-confirm-user] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
