// @ts-nocheck — Deno runtime
//
// Thin wrapper around the Resend transactional email API.
// Returns a normalised result so callers can distinguish a hard failure
// (retry with backoff) from a rate-limit / quota response (retry later).

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  status: number;
  error?: string;
  /** True when Resend rejected because of rate limiting / daily quota (429). */
  rateLimited: boolean;
}

export interface ResendSendOptions {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | null;
}

export interface ResendTemplateSendOptions {
  apiKey: string;
  from: string;
  to: string;
  /** Published Resend template uuid. */
  templateId: string;
  /** Variables matching the template's {{variable}} placeholders. */
  variables: Record<string, string>;
}

/**
 * Send through a published Resend template: the template carries its own
 * subject + HTML, we only supply id + variables. Signature confirmed against
 * Resend's current docs (emails.send with a `template` object).
 */
export async function sendViaResendTemplate(
  opts: ResendTemplateSendOptions,
): Promise<ResendSendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from,
        to: opts.to,
        template: { id: opts.templateId, variables: opts.variables },
      }),
    });

    const status = res.status;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, id: data?.id, status, rateLimited: false };
    }
    const errText = await res.text().catch(() => `HTTP ${status}`);
    return {
      ok: false,
      status,
      error: `Resend ${status}: ${errText}`,
      rateLimited: status === 429,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
      rateLimited: false,
    };
  }
}

export async function sendViaResend(opts: ResendSendOptions): Promise<ResendSendResult> {
  try {
    const payload: Record<string, unknown> = {
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
    };
    if (opts.html) payload.html = opts.html;
    if (opts.text) payload.text = opts.text;
    if (opts.replyTo) payload.reply_to = opts.replyTo;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const status = res.status;

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, id: data?.id, status, rateLimited: false };
    }

    const errText = await res.text().catch(() => `HTTP ${status}`);
    return {
      ok: false,
      status,
      error: `Resend ${status}: ${errText}`,
      rateLimited: status === 429,
    };
  } catch (e) {
    // Network / DNS / timeout — transient, worth retrying.
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
      rateLimited: false,
    };
  }
}
