// Deno runtime — request validation layer for the Porchivo API gateway.
//
// Every route MUST pass through:
//   enforceContentType  → 415 on non-JSON POST/PATCH
//   readBodyWithLimit   → 413 on oversized payloads (64KB / 256KB)
//   parseWith           → Zod schema validation, 400 with structured errors
//   sanitizeString      → strips null bytes / non-printable chars, caps length
//
// Nothing reaches business logic or the database unvalidated.

import { z, ZodType, ZodError } from 'npm:zod@3.23.8';

/** 64KB for standard routes. */
export const BODY_LIMIT_STANDARD = 64 * 1024;
/** 256KB for file-adjacent routes (photo metadata, etc.). */
export const BODY_LIMIT_FILE_ADJACENT = 256 * 1024;

export type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too_large' | 'unreadable' };

/**
 * Read the request body enforcing a hard byte limit. Checks Content-Length
 * first (fast reject) and counts actual streamed bytes (spoof-proof).
 */
export async function readBodyWithLimit(req: Request, limitBytes: number): Promise<BodyReadResult> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > limitBytes) {
    return { ok: false, reason: 'too_large' };
  }

  try {
    const reader = req.body?.getReader();
    if (!reader) return { ok: true, text: '' };

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limitBytes) {
        await reader.cancel();
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, text: new TextDecoder().decode(merged) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/** Strict content-type gate for mutation methods. */
export function hasJsonContentType(req: Request): boolean {
  const ct = req.headers.get('content-type') ?? '';
  return ct.toLowerCase().split(';')[0]?.trim() === 'application/json';
}

/**
 * Sanitize a string input:
 *   - strip null bytes
 *   - strip non-printable control characters (keeps \n and \t)
 *   - hard cap length
 */
export function sanitizeString(input: string, maxLength = 2000): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0) continue; // null byte
    if (code < 32 && code !== 9 && code !== 10) continue; // control chars except \t \n
    if (code === 127) continue; // DEL
    out += ch;
    if (out.length >= maxLength) break;
  }
  return out.trim();
}

/** Zod string that is sanitized and length-capped before validation. */
export function safeString(maxLength: number): ZodType<string> {
  return z
    .string()
    .max(maxLength * 4) // pre-cap to bound sanitation work
    .transform((s: string) => sanitizeString(s, maxLength))
    .pipe(z.string().min(1).max(maxLength));
}

/** Optional variant of safeString — empty strings become undefined. */
export function safeStringOptional(maxLength: number): ZodType<string | undefined> {
  return z
    .string()
    .max(maxLength * 4)
    .transform((s: string) => sanitizeString(s, maxLength))
    .transform((s: string) => (s.length === 0 ? undefined : s))
    .pipe(z.string().max(maxLength).optional())
    .optional();
}

export const uuidSchema = z.string().uuid();

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: { path: string; message: string }[] };

/** Validate unknown input against a Zod schema, returning structured issues. */
export function parseWith<T>(schema: ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const err: ZodError = result.error;
  return {
    ok: false,
    issues: err.issues.slice(0, 10).map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  };
}

/** Parse a JSON string safely. */
export function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (text.length === 0) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
