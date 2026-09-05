// @ts-nocheck — Deno runtime
//
// Manual / staff-triggered email sends: app-update announcements, HOA pilot
// welcomes, and ad-hoc template sends. Deployed with --no-verify-jwt — it is
// invoked server-side / by ops with the shared `x-email-secret` header (same
// model as send-email).
//
// POST body:
//   { action: 'send', slug, variables?, recipient?, userId?, segment? }
//     - recipient  → single email (userId attaches preferences + token)
//     - segment    → 'all' | 'premium' (capped at 500 recipients)
//     - slug       → any slug from resend_template_id(); 'app-update' and
//                    'hoa-pilot-welcome' use their typed payloads.
// Returns { sent, skipped, recipients } — 'skipped' = dedupe/opt-out skips.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  enqueueTemplateEmail,
  sendAppUpdateAnnouncement,
  sendHoaPilotWelcome,
  type SqlRpcClient,
} from '../_shared/emailService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-email-secret',
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

  const fnSecret = Deno.env.get('EMAIL_FN_SECRET');
  if (!fnSecret) return json({ error: 'Email function not configured' }, 500);
  if (req.headers.get('x-email-secret') !== fnSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  ) as unknown as SqlRpcClient;

  let body: {
    action?: string;
    slug?: string;
    variables?: Record<string, string>;
    recipient?: string;
    userId?: string;
    segment?: string;
    category?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.action !== 'send' || typeof body.slug !== 'string') {
    return json({ error: "Use { action: 'send', slug, ... }" }, 400);
  }

  const vars = body.variables ?? {};
  const broadcastKey =
    typeof vars.broadcast_key === 'string' && vars.broadcast_key.length > 0
      ? vars.broadcast_key
      : new Date().toISOString().slice(0, 10);

  // Resolve recipients
  let recipients: Array<{ email: string; id: string | null; name: string | null }> = [];
  if (typeof body.recipient === 'string') {
    let name: string | null = null;
    if (body.userId) {
      const { data } = await (adminClient as any)
        .from('profiles')
        .select('name')
        .eq('id', body.userId)
        .maybeSingle();
      name = data?.name ?? null;
    }
    recipients = [{ email: body.recipient, id: body.userId ?? null, name }];
  } else if (typeof body.segment === 'string') {
    let query = (adminClient as any)
      .from('profiles')
      .select('id, email, name, is_premium')
      .like('email', '%@%')
      .limit(500);
    if (body.segment === 'premium') query = query.eq('is_premium', true);
    const { data, error } = await query;
    if (error) return json({ error: 'Segment lookup failed' }, 500);
    recipients = (data ?? []).map((r: any) => ({
      email: r.email as string,
      id: r.id as string,
      name: (r.name as string) ?? null,
    }));
  } else {
    return json({ error: 'Provide recipient or segment' }, 400);
  }

  const firstNameOf = (name: string | null): string =>
    name && name.trim().length > 0 ? name.trim().split(/\s+/)[0] : 'there';

  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    let id: string | null = null;
    if (body.slug === 'app-update') {
      id = await sendAppUpdateAnnouncement(adminClient, {
        recipient: r.email,
        userId: r.id,
        broadcastKey,
        firstName: vars.first_name ?? firstNameOf(r.name),
        featureName: vars.feature_name ?? 'What\u2019s new in Porchivo',
        featureDescription: vars.feature_description ?? '',
        platforms: vars.platforms ?? 'iOS & Android',
        appVersion: vars.app_version ?? 'latest',
        releaseDate: vars.release_date ?? new Date().toISOString().slice(0, 10),
      });
    } else if (body.slug === 'hoa-pilot-welcome') {
      id = await sendHoaPilotWelcome(adminClient, {
        recipient: r.email,
        userId: r.id,
        firstName: vars.first_name ?? firstNameOf(r.name),
        communityName: vars.community_name ?? 'your community',
        pilotStartDate: vars.pilot_start_date ?? new Date().toISOString().slice(0, 10),
        unitCount: vars.unit_count ?? '',
        accountManagerName: vars.account_manager_name ?? 'The Porchivo team',
      });
    } else {
      id = await enqueueTemplateEmail(adminClient, {
        slug: body.slug,
        recipient: r.email,
        userId: r.id,
        category: (body.category as any) ?? 'community',
        dedupeKey: `${body.slug}:${broadcastKey}:${r.email}`,
        variables: vars,
        sourceTable: 'broadcasts',
        sourceId: null,
      });
    }
    if (id) sent++;
    else skipped++;
  }

  return json({ sent, skipped, recipients: recipients.length, slug: body.slug, broadcastKey });
});
