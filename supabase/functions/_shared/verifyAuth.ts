// Deno runtime — JWT verification + DB-authoritative auth context.
//
// Security model (defense in depth):
//   1. Verify the JWT SIGNATURE cryptographically:
//        - RS256/ES256 tokens → verified locally against Supabase's JWKS endpoint
//        - HS256 (legacy symmetric) tokens → verified by the Supabase Auth server
//          via auth.getUser(token) (the server holds the shared secret)
//   2. Reject expired tokens (401) and malformed tokens (400) explicitly.
//   3. NEVER trust role / property claims embedded in the token. Re-fetch the
//      user's role and enrolled org/property ids DIRECTLY from the database
//      (get_gateway_auth_context RPC, SECURITY DEFINER, keyed on auth.uid()).
//   4. If the token carries a role claim that does not match the DB role,
//      reject with 403 (possible tampering / stale privilege escalation).

import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, decodeJwt } from 'npm:jose@5.9.6';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Canonical Porchivo roles exposed to route guards. */
export type CanonicalRole =
  | 'resident'
  | 'manager'
  | 'hoa_admin'
  | 'porch_partner'
  | 'super_admin';

/** One enrolled context (org membership) for the user. */
export interface EnrolledContext {
  orgId: string;
  propertyId: string | null;
  unitId: string | null;
  dbRole: string;
  role: CanonicalRole;
  isPrimary: boolean;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  /** Highest-privilege canonical role across enrolled contexts (DB-derived). */
  role: CanonicalRole;
  contexts: EnrolledContext[];
  primaryContext: EnrolledContext | null;
}

export type AuthFailure =
  | { kind: 'malformed' }   // → 400
  | { kind: 'expired' }     // → 401
  | { kind: 'invalid' }     // → 401 (bad signature / unknown user)
  | { kind: 'role_mismatch' }; // → 403

export type AuthResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; failure: AuthFailure };

/** DB membership role → canonical gateway role. */
export function toCanonicalRole(dbRole: string): CanonicalRole {
  switch (dbRole) {
    case 'super_admin':
      return 'super_admin';
    case 'hoa_admin':
      return 'hoa_admin';
    case 'property_manager':
    case 'property_staff':
    case 'board_member':
      return 'manager';
    case 'porch_partner':
      return 'porch_partner';
    default:
      return 'resident';
  }
}

const ROLE_RANK: Record<CanonicalRole, number> = {
  resident: 0,
  porch_partner: 1,
  manager: 2,
  hoa_admin: 3,
  super_admin: 4,
};

export function roleAtLeast(role: CanonicalRole, required: CanonicalRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

interface ContextRow {
  org_id: string;
  property_id: string | null;
  unit_id: string | null;
  role: string;
  is_primary: boolean;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Verify the bearer token and build a DB-authoritative auth context.
 *
 * @param token      Raw JWT (without the "Bearer " prefix)
 * @param supabaseUrl SUPABASE_URL env value (JWKS + issuer)
 * @param userClient  Supabase client scoped to THIS user's Authorization header
 *                    (RLS-enforced; used for signature fallback + context fetch)
 */
export async function verifyAuth(
  token: string,
  supabaseUrl: string,
  userClient: SupabaseClient,
): Promise<AuthResult> {
  // ── Structural validation ──────────────────────────────────────────────────
  if (!token || token.split('.').length !== 3) {
    return { ok: false, failure: { kind: 'malformed' } };
  }

  let alg: string;
  let payload: Record<string, unknown>;
  try {
    alg = decodeProtectedHeader(token).alg ?? '';
    payload = decodeJwt(token) as Record<string, unknown>;
  } catch {
    return { ok: false, failure: { kind: 'malformed' } };
  }

  // Explicit expiry check → 401 (jose would also catch this, but we want a
  // distinct failure kind regardless of verification path)
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (exp > 0 && exp * 1000 <= Date.now()) {
    return { ok: false, failure: { kind: 'expired' } };
  }

  // ── Signature verification ─────────────────────────────────────────────────
  let userId: string | null = null;
  let email: string | null = null;

  if (alg === 'RS256' || alg === 'ES256') {
    try {
      const { payload: verified } = await jwtVerify(token, getJwks(supabaseUrl), {
        issuer: `${supabaseUrl}/auth/v1`,
      });
      userId = typeof verified.sub === 'string' ? verified.sub : null;
      email = typeof verified.email === 'string' ? verified.email : null;
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'ERR_JWT_EXPIRED') return { ok: false, failure: { kind: 'expired' } };
      return { ok: false, failure: { kind: 'invalid' } };
    }
  } else if (alg === 'HS256') {
    // Legacy symmetric signing — the Auth server verifies the signature.
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data.user) {
      const msg = (error?.message ?? '').toLowerCase();
      if (msg.includes('expired')) return { ok: false, failure: { kind: 'expired' } };
      return { ok: false, failure: { kind: 'invalid' } };
    }
    userId = data.user.id;
    email = data.user.email ?? null;
  } else {
    // alg "none" or anything unexpected — treat as malformed
    return { ok: false, failure: { kind: 'malformed' } };
  }

  if (!userId) return { ok: false, failure: { kind: 'invalid' } };

  // ── DB-authoritative role + contexts (NEVER trust claims) ─────────────────
  const { data: rows, error: ctxError } = await userClient.rpc('get_gateway_auth_context');
  if (ctxError) {
    console.error('[auth] context fetch failed:', ctxError.message);
    return { ok: false, failure: { kind: 'invalid' } };
  }

  const contexts: EnrolledContext[] = ((rows ?? []) as ContextRow[]).map((r) => ({
    orgId: r.org_id,
    propertyId: r.property_id,
    unitId: r.unit_id,
    dbRole: r.role,
    role: toCanonicalRole(r.role),
    isPrimary: r.is_primary === true,
  }));

  const dbRole: CanonicalRole = contexts.reduce<CanonicalRole>(
    (best, c) => (ROLE_RANK[c.role] > ROLE_RANK[best] ? c.role : best),
    'resident',
  );

  // ── Claim vs DB comparison ─────────────────────────────────────────────────
  const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;
  const claimedRole =
    (typeof payload.user_role === 'string' ? payload.user_role : null) ??
    (typeof appMeta.role === 'string' ? (appMeta.role as string) : null) ??
    (typeof appMeta.user_role === 'string' ? (appMeta.user_role as string) : null);

  // Supabase's standard "role" claim is "authenticated" — only compare
  // app-level role claims, and only when one is actually present.
  if (claimedRole && claimedRole !== 'authenticated') {
    const canonicalClaim = toCanonicalRole(claimedRole);
    if (canonicalClaim !== dbRole) {
      return { ok: false, failure: { kind: 'role_mismatch' } };
    }
  }

  const primaryContext = contexts.find((c) => c.isPrimary) ?? contexts[0] ?? null;

  return {
    ok: true,
    ctx: { userId, email, role: dbRole, contexts, primaryContext },
  };
}
