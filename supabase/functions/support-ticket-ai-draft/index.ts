// @ts-nocheck — Deno runtime
// support-ticket-ai-draft — generate a suggested staff reply for a support ticket.
//
// Called by the trg_enqueue_ticket_ai_draft DB trigger (pg_net POST) right
// after a new ticket is created. The function:
//   1. Verifies an internal bearer token (SUPPORT_TICKET_AI_DRAFT_TOKEN).
//   2. Loads the ticket via the service role (bypasses RLS + column grants
//      so we can read ai_draft_* and write back to them).
//   3. Bails early if a draft already exists (idempotent).
//   4. Calls the Rork AI Gateway (Vercel AI Gateway proxy) with a tight
//      system prompt and the ticket body, using a cheap, fast model
//      (openai/gpt-5-nano) tuned for instruction-following.
//   5. Persists the draft into ai_draft_reply / ai_draft_generated_at /
//      ai_draft_model. Staff review + edit it in their tooling, then
//      promote it to staff_reply. Users never see ai_draft_* columns.
//   6. Fans out a push notification to every support_staff / super_admin
//      user (tokens via the get_staff_push_tokens() service-role RPC) so
//      staff get pinged the moment a draft is ready for review.
//
// SETUP (do once):
//   supabase secrets set SUPPORT_TICKET_AI_DRAFT_TOKEN=<random-32-char-string>
//   supabase secrets set RORK_TOOLKIT_URL=https://toolkit.rork.com
//   supabase secrets set RORK_TOOLKIT_SECRET_KEY=<same key as EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY>
//   ALTER DATABASE <your-db> SET app.support_ticket_ai_draft_url =
//     'https://<project-ref>.supabase.co/functions/v1/support-ticket-ai-draft';
//   ALTER DATABASE <your-db> SET app.support_ticket_ai_draft_token = <same token>;
//   supabase functions deploy support-ticket-ai-draft
//
// FAILURE MODE: any error (AI outage, malformed input, DB hiccup) is logged
// and acknowledged with 200 so the pg_net trigger does not retry in a loop.
// The ticket still exists; staff simply draft a reply manually.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STAFF_PUSH_TITLE = 'AI draft ready for review';
const STAFF_PUSH_BATCH_SIZE = 100; // Expo accepts up to 100 push tickets per request

// Model picked via the verification protocol (list → details → usage):
//   openai/gpt-5-nano — cheapest GPT-5 tier, $0.05/M input + $0.40/M output,
//   400K context, strong instruction following, low latency (p50 ~4.4s).
//   A draft reply is a short, structured generation, so nano is the right
//   cost/latency tradeoff. Fallbacks are listed below so a transient
//   provider outage does not leave staff without a draft.
const PRIMARY_MODEL = 'openai/gpt-5-nano';
const FALLBACK_MODELS = ['openai/gpt-5-mini', 'google/gemini-2.5-flash-lite'];

const MAX_DRAFT_TOKENS = 350;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface TicketRow {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  ai_draft_reply: string | null;
}

/**
 * Build the chat-completions prompt for a ticket. Keeps the system prompt
 * tight and explicit so the draft is short, professional, and never
 * invents policy specifics (refund amounts, SLA guarantees, etc.).
 */
function buildMessages(ticket: TicketRow): Array<{ role: string; content: string }> {
  const system = [
    'You are Porchivo\'s support assistant. Draft a short, empathetic first-pass',
    'reply that a human support agent will review before sending to the customer.',
    'Rules:',
    '- 2-4 sentences. Plain text. No markdown, no headings, no bullet lists.',
    '- Acknowledge the specific issue, then state the next concrete step.',
    '- Never invent specifics: do not promise refunds, credits, exact timeframes,',
    '  or policy guarantees. Use "we\'ll look into this" rather than fabricated facts.',
    '- Do not sign off with a name; the agent adds the signature.',
    '- Refuse-safe: if the message reads as a safety or legal threat, respond only',
    '  with "Thank you for reaching out. A support lead will review this and follow up shortly."',
  ].join(' ');

  const user = [
    `Ticket category: ${ticket.category}`,
    `Subject: ${ticket.subject}`,
    `Customer message:`,
    ticket.body.slice(0, 4000),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Call the Rork AI Gateway (Vercel AI Gateway proxy) for a single
 * non-streaming chat completion. Returns the assistant text or throws.
 */
async function generateDraft(
  toolkitUrl: string,
  toolkitKey: string,
  model: string,
  ticket: TicketRow,
): Promise<string> {
  const url = `${toolkitUrl.replace(/\/$/, '')}/v2/vercel/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${toolkitKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(ticket),
      max_tokens: MAX_DRAFT_TOKENS,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI gateway ${model} HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error(`AI gateway ${model} returned empty content`);
  }
  return content.trim().slice(0, 4000);
}

/**
 * Fan out a push notification to every support_staff / super_admin user the
 * moment a draft lands. Tokens come from the get_staff_push_tokens() RPC
 * (service-role only). Best-effort — a failure here is logged, never thrown.
 *
 * We send to Expo's batch endpoint in chunks of STAFF_PUSH_BATCH_SIZE so a
 * large staff roster does not blow past Expo's per-request ticket limit.
 */
async function notifyStaffOfDraft(
  admin: ReturnType<typeof createClient>,
  ticketId: string,
  subject: string,
  category: string,
): Promise<void> {
  const { data: staffRows, error: rpcErr } = await admin.rpc('get_staff_push_tokens');
  if (rpcErr) {
    throw new Error(`get_staff_push_tokens RPC failed: ${rpcErr.message}`);
  }
  const tokens: Array<{ user_id: string; expo_push_token: string }> = staffRows ?? [];
  if (tokens.length === 0) {
    console.log('[support-ticket-ai-draft] no staff push tokens on file — skipping fan-out');
    return;
  }

  const body = `New AI draft ready · ${category.replace(/_/g, ' ')} · "${subject.slice(0, 60)}"`;
  const tickets = tokens.map((row) => ({
    to: row.expo_push_token,
    title: STAFF_PUSH_TITLE,
    body,
    data: { ticketId, type: 'staff_ticket_ai_draft' },
    sound: 'default',
    priority: 'high' as const,
  }));

  for (let i = 0; i < tickets.length; i += STAFF_PUSH_BATCH_SIZE) {
    const batch = tickets.slice(i, i + STAFF_PUSH_BATCH_SIZE);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[support-ticket-ai-draft] Expo push batch ${i} HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
    } catch (batchErr) {
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      console.warn(`[support-ticket-ai-draft] Expo push batch ${i} error: ${msg}`);
    }
  }
  console.log(`[support-ticket-ai-draft] staff push dispatched to ${tokens.length} staff device(s)`);
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Bearer token ───────────────────────────────────────────────────
    const expectedToken = Deno.env.get('SUPPORT_TICKET_AI_DRAFT_TOKEN');
    if (!expectedToken) {
      console.error('[support-ticket-ai-draft] SUPPORT_TICKET_AI_DRAFT_TOKEN not configured');
      return json({ error: 'Not configured' }, 503);
    }
    const authHeader = req.headers.get('Authorization') ?? '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || token !== expectedToken) {
      console.warn('[support-ticket-ai-draft] Invalid bearer token');
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Parse + validate body ──────────────────────────────────────────
    let body: { ticketId?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const ticketId = body?.ticketId;
    if (!ticketId || typeof ticketId !== 'string') {
      return json({ error: 'Missing ticketId' }, 400);
    }

    // ── 3. Load the ticket (service role bypasses RLS + column grants) ───
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ticket, error: loadErr } = await admin
      .from('support_tickets')
      .select('id, user_id, subject, body, category, status, ai_draft_reply')
      .eq('id', ticketId)
      .maybeSingle<TicketRow>();

    if (loadErr) {
      console.warn('[support-ticket-ai-draft] ticket load error:', loadErr.message);
      return json({ received: true, warning: 'ticket load failed' });
    }
    if (!ticket) {
      console.warn(`[support-ticket-ai-draft] ticket ${ticketId} not found`);
      return json({ received: true, warning: 'ticket not found' });
    }

    // Idempotent: skip if a draft already exists or the ticket is no longer open.
    if (ticket.ai_draft_reply) {
      console.log(`[support-ticket-ai-draft] ticket ${ticketId} already has a draft — skipping`);
      return json({ received: true, skipped: true });
    }
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      console.log(`[support-ticket-ai-draft] ticket ${ticketId} is ${ticket.status} — skipping`);
      return json({ received: true, skipped: true });
    }

    // ── 4. Generate the draft (primary + fallback) ───────────────────────
    const toolkitUrl = Deno.env.get('RORK_TOOLKIT_URL') ?? Deno.env.get('EXPO_PUBLIC_TOOLKIT_URL');
    const toolkitKey = Deno.env.get('RORK_TOOLKIT_SECRET_KEY') ?? Deno.env.get('EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY');
    if (!toolkitUrl || !toolkitKey) {
      console.error('[support-ticket-ai-draft] RORK_TOOLKIT_URL / RORK_TOOLKIT_SECRET_KEY not configured');
      return json({ received: true, warning: 'AI gateway not configured' });
    }

    let draftText: string | null = null;
    let usedModel: string | null = null;
    const attempts = [PRIMARY_MODEL, ...FALLBACK_MODELS];
    for (const model of attempts) {
      try {
        draftText = await generateDraft(toolkitUrl, toolkitKey, model, ticket);
        usedModel = model;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[support-ticket-ai-draft] ${model} failed: ${msg}`);
      }
    }

    if (!draftText || !usedModel) {
      console.error(`[support-ticket-ai-draft] all ${attempts.length} models failed for ticket ${ticketId}`);
      return json({ received: true, warning: 'all models failed' });
    }

    // ── 5. Persist the draft ─────────────────────────────────────────────
    // Only write if ai_draft_reply is still NULL — guards against a race
    // where two trigger deliveries both reached this point.
    const { error: writeErr, count } = await admin
      .from('support_tickets')
      .update({
        ai_draft_reply: draftText,
        ai_draft_generated_at: new Date().toISOString(),
        ai_draft_model: usedModel,
      })
      .eq('id', ticketId)
      .is('ai_draft_reply', null)
      .select('id', { count: 'exact', head: true });

    if (writeErr) {
      console.warn(`[support-ticket-ai-draft] write error for ${ticketId}:`, writeErr.message);
      return json({ received: true, warning: 'write failed' });
    }
    if (count === 0) {
      console.log(`[support-ticket-ai-draft] ticket ${ticketId} already had a draft — write skipped`);
      return json({ received: true, skipped: true });
    }

    console.log(
      `[support-ticket-ai-draft] draft saved — ticket ${ticketId} model ${usedModel} ` +
      `len ${draftText.length}`,
    );

    // ── 6. Notify staff: fire a push to every support_staff / super_admin ─────
    // Best-effort — a push failure never rolls back the draft. We look up
    // staff push tokens via the get_staff_push_tokens() SECURITY DEFINER RPC
    // (service-role only) and fan out to Expo's batch push endpoint.
    try {
      await notifyStaffOfDraft(admin, ticketId, ticket.subject, ticket.category);
    } catch (pushErr) {
      const pushMsg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      console.warn(`[support-ticket-ai-draft] staff push fan-out failed: ${pushMsg}`);
    }

    return json({ received: true, drafted: true, model: usedModel });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[support-ticket-ai-draft] Unhandled error:', msg);
    // 200 so the pg_net trigger does not retry in a loop.
    return json({ received: true, warning: 'handler error logged' });
  }
});
