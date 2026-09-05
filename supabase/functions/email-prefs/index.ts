// @ts-nocheck — Deno runtime
//
// Token-based email preference endpoint backing porchivo.com/unsubscribe.
// Deployed with --no-verify-jwt: the unsubscribe token IS the credential
// (random uuid per user, stored in email_preferences.unsubscribe_token).
//
// GET  ?token=<token>  → { email_masked, categories: { partners, packages, community, marketing } }
// POST { token, category, optOut } → { success: true }
//
// security (account deletion, theft reports) and billing (subscription)
// categories are intentionally NOT settable — those always send.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const CATEGORIES = ['partners', 'packages', 'community', 'marketing'] as const;
const COLUMN: Record<string, string> = {
  partners: 'opt_out_partners',
  packages: 'opt_out_packages',
  community: 'opt_out_community',
  marketing: 'opt_out_marketing',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return 'your inbox';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token') ?? '';
    if (!token) return json({ error: 'Missing token' }, 400);
    const { data, error } = await adminClient
      .from('email_preferences')
      .select('opt_out_partners, opt_out_packages, opt_out_community, opt_out_marketing, profiles(email)')
      .eq('unsubscribe_token', token)
      .maybeSingle();
    if (error || !data) return json({ error: 'Invalid or expired link' }, 404);
    const row = data as unknown as {
      opt_out_partners: boolean;
      opt_out_packages: boolean;
      opt_out_community: boolean;
      opt_out_marketing: boolean;
      profiles: { email: string } | Array<{ email: string }> | null;
    };
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return json({
      email_masked: maskEmail(profile?.email ?? ''),
      categories: {
        partners: row.opt_out_partners,
        packages: row.opt_out_packages,
        community: row.opt_out_community,
        marketing: row.opt_out_marketing,
      },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null);
    if (!body?.token || !CATEGORIES.includes(body.category)) {
      return json({ error: 'Invalid request' }, 400);
    }
    const { error } = await adminClient
      .from('email_preferences')
      .update({
        [COLUMN[body.category as string]]: !!body.optOut,
        updated_at: new Date().toISOString(),
      })
      .eq('unsubscribe_token', body.token);
    if (error) return json({ error: 'Update failed' }, 500);
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
});
