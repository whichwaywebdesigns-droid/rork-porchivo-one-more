// @ts-nocheck — Deno runtime
//
// Resend email queue: enqueue + drain with retry/backoff and a daily-cap guard.
//
// This function is deployed with --no-verify-jwt because it is invoked by
// server-side callers (other Edge Functions, DB triggers, pg_cron) rather than
// end-user clients. Every request must carry the shared `x-email-secret`
// header matching the EMAIL_FN_SECRET env var.
//
// Actions:
//   { action: 'enqueue', recipient, subject, html?, text?, template?, replyTo?, metadata? }
//       → queues an email, returns { id }
//       When template === 'branded', pass { heading, bodyHtml, bodyText, cta? }
//       instead of html/text and the email is composed through the shared
//       branded shell (which includes the porchivo.com/guide Field Guide link).
//   { action: 'preview', heading, bodyHtml, bodyText, cta? }
//       → renders the branded template and returns { html, text } without
//       enqueuing or sending anything. Use for email preview/debug UIs.
//   { action: 'process', batchSize? }
//       → drains due jobs through Resend (used by the pg_cron schedule)
//
// Required secrets (supabase secrets set): RESEND_API_KEY, EMAIL_FROM, EMAIL_FN_SECRET
// Optional: DAILY_EMAIL_CAP (default 100, matches Resend free tier)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendViaResend, sendViaResendTemplate } from '../_shared/resend.ts';
import { renderEmail } from '../_shared/emailTemplate.ts';

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

function secondsUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((next.getTime() - now.getTime()) / 1000));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Shared-secret auth (server-to-server only) ────────────────────────────
  const fnSecret = Deno.env.get('EMAIL_FN_SECRET');
  if (!fnSecret) {
    console.error('[send-email] EMAIL_FN_SECRET not configured');
    return json({ error: 'Email function not configured' }, 500);
  }
  if (req.headers.get('x-email-secret') !== fnSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  let body: {
    action?: string;
    recipient?: string;
    subject?: string;
    html?: string;
    text?: string;
    template?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
    batchSize?: number;
    // Branded-template fields (used when template === 'branded' or action === 'preview').
    heading?: string;
    bodyHtml?: string;
    bodyText?: string;
    cta?: { label: string; url: string } | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // ── ENQUEUE ────────────────────────────────────────────────────────────────
  if (body.action === 'enqueue') {
    const { recipient, subject, replyTo, metadata, template } = body;
    let { html, text } = body;

    // Compose through the shared branded shell (adds the Field Guide link).
    if (template === 'branded') {
      if (!body.heading || (!body.bodyHtml && !body.bodyText)) {
        return json(
          { error: "Branded template requires: heading and bodyHtml or bodyText" },
          400,
        );
      }
      const rendered = renderEmail({
        heading: body.heading,
        bodyHtml: body.bodyHtml ?? body.bodyText ?? '',
        bodyText: body.bodyText ?? body.bodyHtml ?? '',
        cta: body.cta ?? null,
      });
      html = rendered.html;
      text = rendered.text;
    }

    if (!recipient || !subject || (!html && !text)) {
      return json({ error: 'Missing required fields: recipient, subject, and html or text' }, 400);
    }
    const { data: id, error } = await adminClient.rpc('enqueue_email', {
      p_recipient: recipient,
      p_subject: subject,
      p_html: html ?? null,
      p_text: text ?? null,
      p_template: template ?? null,
      p_reply_to: replyTo ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) {
      console.error('[send-email] enqueue error:', error.message);
      return json({ error: 'Failed to enqueue email' }, 500);
    }
    return json({ id });
  }

  // ── PREVIEW (render without enqueuing) ────────────────────────────────────
  if (body.action === 'preview') {
    if (!body.heading || (!body.bodyHtml && !body.bodyText)) {
      return json(
        { error: 'Preview requires: heading and bodyHtml or bodyText' },
        400,
      );
    }
    const rendered = renderEmail({
      heading: body.heading,
      bodyHtml: body.bodyHtml ?? body.bodyText ?? '',
      bodyText: body.bodyText ?? body.bodyHtml ?? '',
      cta: body.cta ?? null,
    }, { preview: true });
    return json({ html: rendered.html, text: rendered.text });
  }

  // ── PROCESS (drain the queue) ────────────────────────────────────────────
  if (body.action === 'process') {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('EMAIL_FROM');
    if (!resendApiKey || !from) {
      console.error('[send-email] RESEND_API_KEY or EMAIL_FROM not configured');
      return json({ error: 'Email provider not configured' }, 500);
    }

    const dailyCap = Number(Deno.env.get('DAILY_EMAIL_CAP') ?? '100');

    // Recover any jobs orphaned in 'processing' by a previous crash/timeout.
    await adminClient.rpc('reap_stale_email_jobs');

    // Daily-cap guard — never exceed the Resend free-tier quota.
    const { data: sentToday } = await adminClient.rpc('email_sent_today');
    let remaining = dailyCap - Number(sentToday ?? 0);
    if (remaining <= 0) {
      console.log('[send-email] Daily cap reached; leaving queue for tomorrow');
      return json({ processed: 0, sent: 0, failed: 0, requeued: 0, capReached: true });
    }

    const requested = Math.max(1, Math.min(body.batchSize ?? 25, remaining));
    const { data: batch, error: claimErr } = await adminClient.rpc('claim_email_batch', {
      p_limit: requested,
    });
    if (claimErr) {
      console.error('[send-email] claim error:', claimErr.message);
      return json({ error: 'Failed to claim email batch' }, 500);
    }

    const jobs = (batch ?? []) as Array<{
      id: string;
      recipient: string;
      subject: string;
      html_body: string | null;
      text_body: string | null;
      reply_to: string | null;
      metadata: Record<string, unknown> | null;
    }>;

    let sent = 0;
    let failed = 0;
    let requeued = 0;

    for (const job of jobs) {
      if (remaining <= 0) {
        // Hit the cap mid-batch — requeue without consuming an attempt.
        await adminClient.rpc('mark_email_failed', {
          p_id: job.id,
          p_error: 'Daily cap reached; requeued for next window',
          p_retry_in_seconds: secondsUntilNextMidnight(),
        });
        requeued++;
        continue;
      }

      // ── Resend-template job ──
      // The template carries its own subject + HTML; we send id + variables
      // only (email-templates-migration.sql). email_sends is kept in sync for
      // the audit trail / support traceability.
      const meta = (job.metadata ?? {}) as Record<string, unknown>;
      const templateId = typeof meta.template_id === 'string' ? meta.template_id : null;
      if (templateId) {
        const variables = (meta.variables ?? {}) as Record<string, string>;
        const result = await sendViaResendTemplate({
          apiKey: resendApiKey,
          from,
          to: job.recipient,
          templateId,
          variables,
        });
        if (result.ok) {
          await adminClient.rpc('mark_email_sent', {
            p_id: job.id,
            p_provider_message_id: result.id ?? null,
          });
          await adminClient.rpc('mark_email_send_settled', {
            p_queue_id: job.id,
            p_ok: true,
            p_message_id: result.id ?? null,
          });
          sent++;
          remaining--;
        } else if (result.rateLimited) {
          // Provider throttled us — back off ~1h, don't burn an attempt.
          await adminClient.rpc('mark_email_failed', {
            p_id: job.id,
            p_error: result.error ?? 'rate limited',
            p_retry_in_seconds: 3600,
          });
          await adminClient.rpc('mark_email_send_settled', {
            p_queue_id: job.id,
            p_ok: false,
            p_error: result.error ?? 'rate limited',
          });
          requeued++;
        } else {
          // Hard failure — increment attempts; RPC applies exponential backoff.
          console.warn('[send-email] template send failed for job', job.id, result.error);
          await adminClient.rpc('mark_email_failed', {
            p_id: job.id,
            p_error: result.error ?? 'unknown error',
          });
          await adminClient.rpc('mark_email_send_settled', {
            p_queue_id: job.id,
            p_ok: false,
            p_error: result.error ?? 'unknown error',
          });
          failed++;
        }
        continue;
      }

      const result = await sendViaResend({
        apiKey: resendApiKey,
        from,
        to: job.recipient,
        subject: job.subject,
        html: job.html_body,
        text: job.text_body,
        replyTo: job.reply_to,
      });

      if (result.ok) {
        await adminClient.rpc('mark_email_sent', {
          p_id: job.id,
          p_provider_message_id: result.id ?? null,
        });
        sent++;
        remaining--;
      } else if (result.rateLimited) {
        // Provider throttled us — back off ~1h, don't burn an attempt.
        await adminClient.rpc('mark_email_failed', {
          p_id: job.id,
          p_error: result.error ?? 'rate limited',
          p_retry_in_seconds: 3600,
        });
        requeued++;
      } else {
        // Hard failure — increment attempts; RPC applies exponential backoff.
        console.warn('[send-email] send failed for job', job.id, result.error);
        await adminClient.rpc('mark_email_failed', {
          p_id: job.id,
          p_error: result.error ?? 'unknown error',
        });
        failed++;
      }
    }

    return json({ processed: jobs.length, sent, failed, requeued, capReached: false });
  }

  return json({ error: "Unknown action. Use 'enqueue', 'preview', or 'process'." }, 400);
});
