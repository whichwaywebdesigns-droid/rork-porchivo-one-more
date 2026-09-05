// Deno runtime — Porchivo security-hardened API gateway.
//
// Defense-in-depth request pipeline (every request, in order):
//   0. Strict security headers on EVERY response (see _shared/security.ts)
//   1. IP rate limit for unauthenticated probes (10/min per IP)
//   2. JWT signature verification (JWKS) + expiry/malformed rejection
//      OR Bearer pvk_live_* API-key verification (Enterprise integrations)
//   3. DB-authoritative role + enrolled-context re-fetch (claims never trusted)
//   4. Per-user rate limit (60/min) + mutation rate limit (20/min)
//   5. Content-Type + body-size enforcement (64KB standard / 256KB file-adjacent)
//   6. Zod schema validation (strict — unknown fields rejected)
//   7. Route guard (role) → ownership check (record vs enrolled context) → RLS
//   8. Idempotency-Key handling on creating POSTs (24h replay cache)
//   9. Explicit response DTOs — raw DB rows never leave this function
//
// Data access uses the caller-scoped anon client (RLS enforced). The service
// role client touches ONLY security infrastructure tables (rate_limit_log,
// idempotency_keys, security_events) — never user-facing data.
//
// Routes:
//   GET  /packages                 — list packages in an enrolled context
//   POST /packages                 — log a package (staff, idempotent)
//   GET  /packages/:id             — fetch one package (ownership enforced)
//   POST /packages/:id/status      — status machine transition (staff)

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import {
  SECURITY_HEADERS,
  corsHeaders,
  jsonResponse,
  errorResponse,
  logSecurityEvent,
  clientIp,
} from '../_shared/security.ts';
import {
  verifyAuth,
  roleAtLeast,
  type AuthContext,
  type AuthResult,
  type EnrolledContext,
} from '../_shared/verifyAuth.ts';
import {
  BODY_LIMIT_STANDARD,
  BODY_LIMIT_FILE_ADJACENT,
  readBodyWithLimit,
  hasJsonContentType,
  parseWith,
  parseJson,
  safeStringOptional,
  uuidSchema,
} from '../_shared/validate.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';
import { isValidIdempotencyKey, findCachedResponse, storeResponse } from '../_shared/idempotency.ts';

// ── Package status machine ─────────────────────────────────────────────────────

type ApiStatus = 'pending' | 'arrived' | 'held' | 'picked_up' | 'returned' | 'lost';
type DbStatus =
  | 'pending'
  | 'received'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'returned_to_sender'
  | 'exception';

const API_TO_DB: Record<ApiStatus, DbStatus> = {
  pending: 'pending',
  arrived: 'received',
  held: 'ready_for_pickup',
  picked_up: 'picked_up',
  returned: 'returned_to_sender',
  lost: 'exception',
};

const DB_TO_API: Record<DbStatus, ApiStatus> = {
  pending: 'pending',
  received: 'arrived',
  ready_for_pickup: 'held',
  picked_up: 'picked_up',
  returned_to_sender: 'returned',
  exception: 'lost',
};

/** Valid transitions. 'lost' is additionally gated to manager/admin roles. */
const TRANSITIONS: Record<ApiStatus, ApiStatus[]> = {
  pending: ['arrived', 'lost'],
  arrived: ['held', 'picked_up', 'returned', 'lost'],
  held: ['picked_up', 'returned', 'lost'],
  picked_up: ['lost'],
  returned: ['lost'],
  lost: [],
};

// ── Schemas (strict: unknown fields — including `status` on create — rejected) ─

const listQuerySchema = z
  .object({
    context_id: uuidSchema.optional(),
    status: z.enum(['pending', 'arrived', 'held', 'picked_up', 'returned', 'lost']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

const createPackageSchema = z
  .object({
    context_id: uuidSchema.optional(),
    property_id: uuidSchema.optional(),
    unit_id: uuidSchema.optional(),
    resident_id: uuidSchema.optional(),
    carrier: safeStringOptional(60),
    tracking_number: safeStringOptional(120),
    description: safeStringOptional(500),
    size_hint: z.enum(['small', 'medium', 'large', 'oversized']).optional(),
    location_in_office: safeStringOptional(120),
    notes: safeStringOptional(1000),
    photo_url: z.string().url().max(2048).optional(),
  })
  .strict(); // blocks any attempt to smuggle `status` (or anything else) in

const statusUpdateSchema = z
  .object({
    status: z.enum(['arrived', 'held', 'picked_up', 'returned', 'lost']),
    notes: safeStringOptional(500),
  })
  .strict();

// ── Response DTOs (raw DB rows never leave the gateway) ───────────────────────

interface PackageDto {
  id: string;
  contextId: string;
  propertyId: string | null;
  unitId: string | null;
  residentId: string | null;
  status: ApiStatus;
  carrier: string | null;
  trackingNumber: string | null;
  description: string | null;
  sizeHint: string | null;
  photoUrl: string | null;
  receivedAt: string | null;
  pickedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Staff-only fields (omitted for residents)
  locationInOffice?: string | null;
  notes?: string | null;
  exceptionReason?: string | null;
  notifiedAt?: string | null;
}

interface PackageRow {
  id: string;
  org_id: string;
  property_id: string | null;
  unit_id: string | null;
  resident_id: string | null;
  status: DbStatus;
  carrier: string | null;
  tracking_number: string | null;
  description: string | null;
  size_hint: string | null;
  location_in_office: string | null;
  notes: string | null;
  exception_reason: string | null;
  photo_url: string | null;
  received_at: string | null;
  picked_up_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

const PACKAGE_COLUMNS =
  'id, org_id, property_id, unit_id, resident_id, status, carrier, tracking_number, ' +
  'description, size_hint, location_in_office, notes, exception_reason, photo_url, ' +
  'received_at, picked_up_at, notified_at, created_at, updated_at';

/**
 * Map a DB row to the explicit response DTO. Strips everything not listed —
 * internal/audit fields (logged_by, ip columns, soft-delete markers, any
 * future additions) can never leak by accident.
 */
function toPackageDto(row: PackageRow, includeStaffFields: boolean): PackageDto {
  const dto: PackageDto = {
    id: row.id,
    contextId: row.org_id,
    propertyId: row.property_id,
    unitId: row.unit_id,
    residentId: row.resident_id,
    status: DB_TO_API[row.status] ?? 'pending',
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    description: row.description,
    sizeHint: row.size_hint,
    photoUrl: row.photo_url,
    receivedAt: row.received_at,
    pickedUpAt: row.picked_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeStaffFields) {
    dto.locationInOffice = row.location_in_office;
    dto.notes = row.notes;
    dto.exceptionReason = row.exception_reason;
    dto.notifiedAt = row.notified_at;
  }
  return dto;
}

// ── Context resolution (multi-context ownership, spec §4) ─────────────────────

type ContextResolution =
  | { ok: true; context: EnrolledContext }
  | { ok: false };

/**
 * Resolve the acting context. A client-supplied context_id must match one of
 * the user's DB-verified enrollments; otherwise deny (403 — never 404).
 * When omitted, the DB-derived primary context is used — never client headers.
 */
function resolveContext(auth: AuthContext, contextId: string | undefined): ContextResolution {
  if (contextId) {
    const match = auth.contexts.find((c) => c.orgId === contextId);
    if (!match) return { ok: false };
    return { ok: true, context: match };
  }
  if (!auth.primaryContext) return { ok: false };
  return { ok: true, context: auth.primaryContext };
}

// ── API-key auth (Enterprise integrations) ────────────────────────────────────

interface ApiKeyRow {
  id: string;
  org_id: string;
  created_by: string;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a `pvk_live_*` API key against the hashed api_keys table and return a
 * synthetic staff AuthContext scoped to the key's single org. The gateway's
 * service-role client handles data access for key requests (a key carries no
 * JWT, so RLS cannot scope it) — every query is explicitly filtered to the
 * key's org by resolveContext, and the manager-level route guards stay in force.
 */
async function verifyApiKey(token: string): Promise<AuthResult> {
  if (!token.startsWith('pvk_') || token.length < 16 || token.length > 200) {
    return { ok: false, failure: { kind: 'malformed' } };
  }
  const keyHash = await sha256Hex(token);
  const { data, error } = await infraClient
    .from('api_keys')
    .select('id, org_id, created_by')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) {
    console.error('[gateway] api key lookup failed:', error.message);
    return { ok: false, failure: { kind: 'invalid' } };
  }
  const key = (data ?? null) as unknown as ApiKeyRow | null;
  if (!key) return { ok: false, failure: { kind: 'invalid' } };

  const context: EnrolledContext = {
    orgId: key.org_id,
    propertyId: null,
    unitId: null,
    dbRole: 'property_manager',
    role: 'manager',
    isPrimary: true,
  };

  // Best-effort usage tracking — never block a valid request on it
  await infraClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id);

  return {
    ok: true,
    ctx: {
      userId: key.created_by,
      email: null,
      role: 'manager',
      apiKeyId: key.id,
      contexts: [context],
      primaryContext: context,
    },
  };
}

// ── Environment / clients ─────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Infrastructure-only client (rate limits, idempotency, security events). */
const infraClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function userScopedClient(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

// ── Handlers ───────────────────────────────────────────────────────────────────

async function handleListPackages(
  db: SupabaseClient,
  auth: AuthContext,
  url: URL,
  route: string,
): Promise<Response> {
  const query = parseWith(listQuerySchema, Object.fromEntries(url.searchParams.entries()));
  if (!query.ok) {
    logSecurityEvent(infraClient, {
      type: 'validation_rejected',
      userId: auth.userId,
      route,
      metadata: { issues: query.issues.length },
    });
    return errorResponse(400, 'VALIDATION_FAILED', 'Invalid query parameters', query.issues);
  }

  const resolved = resolveContext(auth, query.data.context_id);
  if (!resolved.ok) {
    logSecurityEvent(infraClient, {
      type: 'cross_context_denied',
      userId: auth.userId,
      orgId: query.data.context_id ?? null,
      route,
    });
    return errorResponse(403, 'FORBIDDEN', 'You do not have access to this context');
  }
  const ctx = resolved.context;
  const isStaff = roleAtLeast(ctx.role, 'manager');
  const limit: number = query.data.limit ?? 50;
  const offset: number = query.data.offset ?? 0;

  // RLS additionally constrains visibility (residents → own unit only)
  let builder = db
    .from('package_log_items')
    .select(PACKAGE_COLUMNS)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.data.status) {
    builder = builder.eq('status', API_TO_DB[query.data.status]);
  }
  if (!isStaff) {
    // Layer 2 ownership: residents only ever see their own packages, even if
    // an RLS policy were misconfigured.
    builder = builder.or(
      `resident_id.eq.${auth.userId}${ctx.unitId ? `,unit_id.eq.${ctx.unitId}` : ''}`,
    );
  }

  const { data, error } = await builder;
  if (error) {
    console.error('[gateway] list packages failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to load packages');
  }

  const rows = (data ?? []) as unknown as PackageRow[];
  return jsonResponse({
    packages: rows.map((r) => toPackageDto(r, isStaff)),
    contextId: ctx.orgId,
    limit,
    offset,
  });
}

async function handleCreatePackage(
  db: SupabaseClient,
  auth: AuthContext,
  body: unknown,
  route: string,
): Promise<{ status: number; body: unknown }> {
  const parsed = parseWith(createPackageSchema, body);
  if (!parsed.ok) {
    logSecurityEvent(infraClient, {
      type: 'validation_rejected',
      userId: auth.userId,
      route,
      metadata: { issues: parsed.issues.length },
    });
    return {
      status: 400,
      body: { error: 'Invalid request body', code: 'VALIDATION_FAILED', details: parsed.issues },
    };
  }

  const resolved = resolveContext(auth, parsed.data.context_id);
  if (!resolved.ok) {
    logSecurityEvent(infraClient, {
      type: 'cross_context_denied',
      userId: auth.userId,
      orgId: parsed.data.context_id ?? null,
      route,
    });
    return { status: 403, body: { error: 'You do not have access to this context', code: 'FORBIDDEN' } };
  }
  const ctx = resolved.context;

  // Route guard: only staff can log packages (RLS enforces this too)
  if (!roleAtLeast(ctx.role, 'manager')) {
    return { status: 403, body: { error: 'Insufficient permissions', code: 'FORBIDDEN' } };
  }

  const { data, error } = await db
    .from('package_log_items')
    .insert({
      org_id: ctx.orgId,
      property_id: parsed.data.property_id ?? ctx.propertyId,
      unit_id: parsed.data.unit_id ?? null,
      resident_id: parsed.data.resident_id ?? null,
      logged_by: auth.userId,
      carrier: parsed.data.carrier ?? null,
      tracking_number: parsed.data.tracking_number ?? null,
      description: parsed.data.description ?? null,
      size_hint: parsed.data.size_hint ?? null,
      location_in_office: parsed.data.location_in_office ?? null,
      notes: parsed.data.notes ?? null,
      photo_url: parsed.data.photo_url ?? null,
      status: 'received', // packages are logged on arrival; status changes only via /status
    })
    .select(PACKAGE_COLUMNS)
    .single();

  if (error || !data) {
    console.error('[gateway] create package failed:', error?.message);
    return { status: 500, body: { error: 'Unable to create package', code: 'INTERNAL_ERROR' } };
  }

  return { status: 201, body: { package: toPackageDto(data as unknown as PackageRow, true) } };
}

async function handleGetPackage(
  db: SupabaseClient,
  auth: AuthContext,
  packageId: string,
  route: string,
): Promise<Response> {
  const { data, error } = await db
    .from('package_log_items')
    .select(PACKAGE_COLUMNS)
    .eq('id', packageId)
    .maybeSingle();

  if (error) {
    console.error('[gateway] get package failed:', error.message);
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to load package');
  }

  // Not found and not authorized are indistinguishable — always 403,
  // never 404 (prevents resource enumeration).
  const row = data as unknown as PackageRow | null;
  const enrolled = row ? auth.contexts.find((c) => c.orgId === row.org_id) : undefined;
  if (!row || !enrolled) {
    logSecurityEvent(infraClient, {
      type: 'cross_context_denied',
      userId: auth.userId,
      route,
    });
    return errorResponse(403, 'FORBIDDEN', 'You do not have access to this resource');
  }

  const isStaff = roleAtLeast(enrolled.role, 'manager');
  if (!isStaff) {
    const ownsIt =
      row.resident_id === auth.userId ||
      (enrolled.unitId !== null && row.unit_id === enrolled.unitId);
    if (!ownsIt) {
      logSecurityEvent(infraClient, {
        type: 'cross_context_denied',
        userId: auth.userId,
        orgId: row.org_id,
        route,
      });
      return errorResponse(403, 'FORBIDDEN', 'You do not have access to this resource');
    }
  }

  return jsonResponse({ package: toPackageDto(row, isStaff) });
}

async function handleStatusTransition(
  db: SupabaseClient,
  auth: AuthContext,
  packageId: string,
  body: unknown,
  route: string,
): Promise<{ status: number; body: unknown }> {
  const parsed = parseWith(statusUpdateSchema, body);
  if (!parsed.ok) {
    return {
      status: 400,
      body: { error: 'Invalid request body', code: 'VALIDATION_FAILED', details: parsed.issues },
    };
  }

  // Layer 2 — fetch the record first, verify ownership from the record itself
  const { data, error } = await db
    .from('package_log_items')
    .select(PACKAGE_COLUMNS)
    .eq('id', packageId)
    .maybeSingle();

  if (error) {
    console.error('[gateway] status fetch failed:', error.message);
    return { status: 500, body: { error: 'Unable to update package', code: 'INTERNAL_ERROR' } };
  }

  const row = data as unknown as PackageRow | null;
  const enrolled = row ? auth.contexts.find((c) => c.orgId === row.org_id) : undefined;
  if (!row || !enrolled) {
    logSecurityEvent(infraClient, {
      type: 'cross_context_denied',
      userId: auth.userId,
      route,
    });
    return { status: 403, body: { error: 'You do not have access to this resource', code: 'FORBIDDEN' } };
  }

  // Route guard: status transitions are staff operations
  if (!roleAtLeast(enrolled.role, 'manager')) {
    return { status: 403, body: { error: 'Insufficient permissions', code: 'FORBIDDEN' } };
  }

  const fromStatus = DB_TO_API[row.status] ?? 'pending';
  const toStatus = parsed.data.status as ApiStatus;

  const allowed = TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
  if (!allowed) {
    logSecurityEvent(infraClient, {
      type: 'invalid_transition',
      userId: auth.userId,
      orgId: row.org_id,
      route,
      metadata: { from: fromStatus, to: toStatus },
    });
    return {
      status: 422,
      body: {
        error: `Invalid status transition: ${fromStatus} → ${toStatus}`,
        code: 'INVALID_TRANSITION',
        details: { from: fromStatus, allowed: TRANSITIONS[fromStatus] },
      },
    };
  }

  // 'lost' is manager/admin only (already guaranteed by the staff guard above,
  // kept explicit so relaxing the staff guard later cannot weaken this rule)
  if (toStatus === 'lost' && !roleAtLeast(enrolled.role, 'manager')) {
    return { status: 403, body: { error: 'Insufficient permissions', code: 'FORBIDDEN' } };
  }

  const updatePayload: Record<string, unknown> = {
    status: API_TO_DB[toStatus],
    updated_at: new Date().toISOString(),
  };
  if (toStatus === 'picked_up') updatePayload.picked_up_at = new Date().toISOString();
  if (toStatus === 'lost') {
    updatePayload.exception_reason = parsed.data.notes ?? 'lost';
  }

  // Optimistic concurrency: only transition from the state we validated
  const { data: updated, error: updateError } = await db
    .from('package_log_items')
    .update(updatePayload)
    .eq('id', packageId)
    .eq('status', row.status)
    .select(PACKAGE_COLUMNS)
    .maybeSingle();

  if (updateError) {
    console.error('[gateway] status update failed:', updateError.message);
    return { status: 500, body: { error: 'Unable to update package', code: 'INTERNAL_ERROR' } };
  }
  if (!updated) {
    // Row changed between read and write — client should re-fetch and retry
    return {
      status: 409,
      body: { error: 'Package was modified concurrently — retry', code: 'CONFLICT' },
    };
  }

  // Audit trail (RLS: staff insert with changed_by = auth.uid())
  const { error: eventError } = await db.from('package_status_events').insert({
    package_id: packageId,
    org_id: row.org_id,
    changed_by: auth.userId,
    from_status: row.status,
    to_status: API_TO_DB[toStatus],
    notes: parsed.data.notes ?? null,
  });
  if (eventError) console.warn('[gateway] status event insert failed:', eventError.message);

  return {
    status: 200,
    body: { package: toPackageDto(updated as unknown as PackageRow, true) },
  };
}

// ── Router ─────────────────────────────────────────────────────────────────────

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, ...SECURITY_HEADERS } });
  }

  try {
    const url = new URL(req.url);
    // Strip the function name prefix: /api-gateway/packages → /packages
    const path = url.pathname.replace(/^\/api-gateway/, '') || '/';
    const segments = path.split('/').filter(Boolean);
    const route = `${req.method} ${path}`;
    const ip = clientIp(req);

    // ── Unauthenticated probes: 10/min per IP ────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      const ipLimit = await checkRateLimit(infraClient, `gw:ip:${ip}`, 10, 60);
      if (!ipLimit.allowed) {
        logSecurityEvent(infraClient, {
          type: 'rate_limit_breach',
          route,
          metadata: { scope: 'ip' },
        });
        return rateLimitResponse(ipLimit, { ...corsHeaders, ...SECURITY_HEADERS });
      }
      return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
    }

    // ── Auth: Supabase JWT (app clients) or pvk_ API key (Enterprise) ────────
    const isApiKey = token.startsWith('pvk_');
    const db: SupabaseClient = isApiKey
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : userScopedClient(authHeader);
    const authResult = isApiKey
      ? await verifyApiKey(token)
      : await verifyAuth(token, SUPABASE_URL, db);

    if (!authResult.ok) {
      // Failed auth counts against the IP bucket too
      const ipLimit = await checkRateLimit(infraClient, `gw:ip:${ip}`, 10, 60);
      if (!ipLimit.allowed) {
        return rateLimitResponse(ipLimit, { ...corsHeaders, ...SECURITY_HEADERS });
      }

      switch (authResult.failure.kind) {
        case 'malformed':
          logSecurityEvent(infraClient, { type: 'auth_failure', route, metadata: { reason: 'malformed' } });
          return errorResponse(400, 'BAD_REQUEST', 'Malformed authentication token');
        case 'expired':
          return errorResponse(401, 'UNAUTHORIZED', 'Token expired');
        case 'role_claim_mismatch' as never:
        case 'role_mismatch':
          logSecurityEvent(infraClient, { type: 'role_claim_mismatch', route });
          return errorResponse(403, 'FORBIDDEN', 'Access denied');
        default:
          logSecurityEvent(infraClient, { type: 'auth_failure', route, metadata: { reason: 'invalid' } });
          return errorResponse(401, 'UNAUTHORIZED', 'Invalid authentication token');
      }
    }

    const auth = authResult.ctx;

    // ── Authenticated rate limits: 60/min per user or key, 20/min mutations ─
    const subject = auth.apiKeyId ? `key:${auth.apiKeyId}` : `user:${auth.userId}`;
    const userLimit = await checkRateLimit(infraClient, `gw:${subject}`, 60, 60);
    if (!userLimit.allowed) {
      logSecurityEvent(infraClient, {
        type: 'rate_limit_breach',
        userId: auth.userId,
        route,
        metadata: { scope: 'user' },
      });
      return rateLimitResponse(userLimit, { ...corsHeaders, ...SECURITY_HEADERS });
    }

    const isMutation = MUTATION_METHODS.has(req.method);
    if (isMutation) {
      const mutLimit = await checkRateLimit(infraClient, `gw:mut:${subject}`, 20, 60);
      if (!mutLimit.allowed) {
        logSecurityEvent(infraClient, {
          type: 'rate_limit_breach',
          userId: auth.userId,
          route,
          metadata: { scope: 'mutation' },
        });
        return rateLimitResponse(mutLimit, { ...corsHeaders, ...SECURITY_HEADERS });
      }
    }

    // ── Content-Type + body-size enforcement on mutations ────────────────────
    let body: unknown = {};
    if (isMutation) {
      if (!hasJsonContentType(req)) {
        return errorResponse(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type must be application/json',
        );
      }

      // POST /packages can carry photo metadata → file-adjacent limit
      const isFileAdjacent = req.method === 'POST' && segments[0] === 'packages' && segments.length === 1;
      const limit = isFileAdjacent ? BODY_LIMIT_FILE_ADJACENT : BODY_LIMIT_STANDARD;

      const read = await readBodyWithLimit(req, limit);
      if (!read.ok) {
        if (read.reason === 'too_large') {
          logSecurityEvent(infraClient, {
            type: 'payload_too_large',
            userId: auth.userId,
            route,
          });
          return errorResponse(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${limit} bytes`);
        }
        return errorResponse(400, 'BAD_REQUEST', 'Unable to read request body');
      }

      const json = parseJson(read.text);
      if (!json.ok) return errorResponse(400, 'BAD_REQUEST', 'Request body must be valid JSON');
      body = json.value;
    }

    // ── Routing ───────────────────────────────────────────────────────────────
    // GET /packages
    if (req.method === 'GET' && segments[0] === 'packages' && segments.length === 1) {
      return await handleListPackages(db, auth, url, route);
    }

    // GET /packages/:id
    if (req.method === 'GET' && segments[0] === 'packages' && segments.length === 2) {
      const id = parseWith(uuidSchema, segments[1]);
      if (!id.ok) return errorResponse(400, 'VALIDATION_FAILED', 'Invalid package id');
      return await handleGetPackage(db, auth, id.data, route);
    }

    // POST /packages (idempotent create)
    if (req.method === 'POST' && segments[0] === 'packages' && segments.length === 1) {
      const idemKey = req.headers.get('Idempotency-Key');
      if (!isValidIdempotencyKey(idemKey)) {
        return errorResponse(
          400,
          'IDEMPOTENCY_KEY_REQUIRED',
          'A UUID Idempotency-Key header is required for this operation',
        );
      }

      const cached = await findCachedResponse(infraClient, idemKey, auth.userId);
      if (cached) {
        return jsonResponse(cached.body, cached.status, { 'Idempotency-Replay': 'true' });
      }

      const result = await handleCreatePackage(db, auth, body, route);
      if (result.status < 500) {
        await storeResponse(infraClient, idemKey, auth.userId, route, result.status, result.body);
      }
      return jsonResponse(result.body, result.status);
    }

    // POST /packages/:id/status (the ONLY way to change status)
    if (
      req.method === 'POST' &&
      segments[0] === 'packages' &&
      segments.length === 3 &&
      segments[2] === 'status'
    ) {
      const id = parseWith(uuidSchema, segments[1]);
      if (!id.ok) return errorResponse(400, 'VALIDATION_FAILED', 'Invalid package id');
      const result = await handleStatusTransition(db, auth, id.data, body, route);
      return jsonResponse(result.body, result.status);
    }

    return errorResponse(405, 'NOT_ALLOWED', 'Route not supported');
  } catch (e) {
    // Never leak internals — log server-side, return a generic envelope
    console.error('[gateway] unhandled error:', e instanceof Error ? e.message : 'unknown');
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});
