// Deno runtime — shared security primitives for the Porchivo API gateway.
//
// Provides:
//   SECURITY_HEADERS   — strict HTTP security headers set on EVERY response
//   corsHeaders        — CORS allowances for the mobile/web clients
//   jsonResponse       — response helper that always attaches security headers
//   errorResponse      — structured error envelope (never leaks internals)
//   logSecurityEvent   — fire-and-forget write to public.security_events

/** Strict security headers attached to every gateway response. */
export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-XSS-Protection': '0',
};

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/** Machine-readable error codes surfaced to clients. */
export type GatewayErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_ALLOWED'
  | 'VALIDATION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface GatewayErrorBody {
  error: string;
  code: GatewayErrorCode;
  details?: unknown;
}

/** JSON response with security + CORS headers on every reply. */
export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

/**
 * Structured error response. Message must be user-safe — never pass raw DB
 * errors, stack traces, or internal table names here.
 */
export function errorResponse(
  status: number,
  code: GatewayErrorCode,
  message: string,
  details?: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  const body: GatewayErrorBody = { error: message, code };
  if (details !== undefined) body.details = details;
  return jsonResponse(body, status, extraHeaders);
}

export type SecurityEventType =
  | 'rate_limit_breach'
  | 'auth_failure'
  | 'role_claim_mismatch'
  | 'cross_context_denied'
  | 'invalid_transition'
  | 'validation_rejected'
  | 'payload_too_large'
  | 'webhook_signature_invalid'
  | 'webhook_replay_rejected';

interface MinimalSupabaseClient {
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
}

/**
 * Fire-and-forget security event log. Never throws, never blocks the response.
 * metadata must NOT contain PII, tokens, or raw payloads.
 */
export function logSecurityEvent(
  adminClient: MinimalSupabaseClient,
  event: {
    type: SecurityEventType;
    userId?: string | null;
    orgId?: string | null;
    route?: string;
    metadata?: Record<string, unknown>;
  },
): void {
  try {
    void Promise.resolve(
      adminClient.from('security_events').insert({
        event_type: event.type,
        user_id: event.userId ?? null,
        org_id: event.orgId ?? null,
        route: event.route ?? null,
        metadata: event.metadata ?? {},
      }),
    ).then(
      (res) => {
        if (res?.error) console.warn('[security] event log failed:', res.error.message);
      },
      () => undefined,
    );
  } catch {
    // Logging must never break request handling
  }
}

/** Extract the client IP from proxy headers (best effort, first hop). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? 'unknown';
}
