// @ts-nocheck — Deno runtime; no Node types needed
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

// Rate limit: 60 tracking lookups per 10 minutes per user.
// Prevents Ship24 quota exhaustion from a single abusive account.
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 600;

const SHIP24_BASE = 'https://api.ship24.com/public/v1';

const CARRIER_TO_COURIER_CODE: Record<string, string[] | undefined> = {
  Amazon: ['amazon'],
  UPS: ['ups'],
  USPS: ['us-post'],
  FedEx: ['fedex'],
};

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Verify caller is an authenticated Supabase user ──────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Rate limiting ─────────────────────────────────────────────────────
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, supabaseServiceKey);
    const rl = await checkRateLimit(
      adminClient,
      `track-shipment:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      console.warn('[track-shipment] Rate limit exceeded for user:', user.id);
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Read the secret — never exposed to the client ────────────────────
    const apiKey = Deno.env.get('SHIP24_API_KEY');
    if (!apiKey) {
      console.error('[track-shipment] SHIP24_API_KEY secret is not set');
      return json({ error: 'Tracking service not configured' }, 503);
    }

    // ── 4. Parse and validate request body ──────────────────────────────────
    let body: { trackingNumber?: string; carrier?: string; clientTrackerId?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const trackingNumber = body.trackingNumber?.trim();
    if (!trackingNumber) {
      return json({ error: 'trackingNumber is required' }, 400);
    }

    // ── 5. Build Ship24 request ──────────────────────────────────────────────
    const ship24Body: Record<string, unknown> = { trackingNumber };

    const courierCodes = body.carrier ? CARRIER_TO_COURIER_CODE[body.carrier] : undefined;
    if (courierCodes) ship24Body.courierCode = courierCodes;
    if (body.clientTrackerId) ship24Body.clientTrackerId = body.clientTrackerId;

    // ── 6. Call Ship24 — API key stays server-side ───────────────────────────
    const ship24Res = await fetch(`${SHIP24_BASE}/trackers/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(ship24Body),
    });

    const ship24Json = await ship24Res.json();

    if (!ship24Res.ok) {
      const msg = ship24Json?.errors?.[0]?.message ?? `Ship24 HTTP ${ship24Res.status}`;
      console.error('[track-shipment] Ship24 error:', msg);
      return json({ error: msg }, ship24Res.status);
    }

    const tracking = ship24Json?.data?.trackings?.[0] ?? null;
    return json({ data: tracking });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[track-shipment] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
