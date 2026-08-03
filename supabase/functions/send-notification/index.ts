// @ts-nocheck — Deno runtime
// send-notification v11 — PUSH-ONLY.
// DB notification rows are created by the client via the create_notification
// RPC (which fires the on_notification_created pg_net trigger for push).
// This function is retained as a push-only fallback for edge cases where
// the pg_net trigger is unavailable or a direct push dispatch is needed
// without a DB row. It does NOT insert into the notifications table.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── 2. Rate limiting ─────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await checkRateLimit(
      adminClient,
      `send-notification:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (!rl.allowed) {
      console.warn('[send-notification] Rate limit exceeded for user:', user.id);
      return rateLimitResponse(rl, corsHeaders);
    }

    // ── 3. Parse and validate request body ──────────────────────────────────
    let body: {
      shipmentId?: string;
      type?: string;
      title?: string;
      message?: string;
      recipientId?: string;
      recipientRole?: string;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { shipmentId, type, title, message, recipientId, recipientRole } = body;

    if (!shipmentId || !type || !title || !message || !recipientId || !recipientRole) {
      return json({ error: 'Missing required fields: shipmentId, type, title, message, recipientId, recipientRole' }, 400);
    }

    const VALID_TYPES = [
      'package_delivered', 'partner_pickup_alert', 'partner_accepted',
      'tracking_added', 'package_out_for_delivery', 'shipment_cancelled',
      'payment_received', 'idv_approved', 'idv_requires_input', 'tier_promoted',
    ];
    if (!VALID_TYPES.includes(type)) {
      return json({ error: `Invalid notification type: ${type}` }, 400);
    }

    if (!['homeowner', 'partner'].includes(recipientRole)) {
      return json({ error: 'recipientRole must be homeowner or partner' }, 400);
    }

    // ── 4. Verify the caller is a participant in the shipment ────────────────
    const { data: shipment } = await adminClient
      .from('shipments')
      .select('homeowner_id, partner_id')
      .eq('id', shipmentId)
      .maybeSingle();

    if (!shipment) {
      return json({ error: 'Shipment not found' }, 404);
    }

    const isParticipant =
      shipment.homeowner_id === user.id || shipment.partner_id === user.id;

    if (!isParticipant) {
      console.warn('[send-notification] Non-participant attempted to send notification:', user.id);
      return json({ error: 'Forbidden: you are not a participant in this shipment' }, 403);
    }

    // ── 5. Dispatch push notification via Expo Push API ──────────────────────
    // Push-only: no DB notification row is created here. The client calls
    // create_notification RPC which inserts the row and fires the
    // on_notification_created pg_net trigger for push dispatch.
    // This function is a fallback for direct push without a DB row.
    const { data: recipientProfile } = await adminClient
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientId)
      .maybeSingle();

    if (recipientProfile?.expo_push_token) {
      try {
        const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify({
            to: recipientProfile.expo_push_token,
            title,
            body: message,
            data: { shipmentId, type },
            sound: 'default',
            priority: 'high',
          }),
        });

        if (!pushRes.ok) {
          const pushErr = await pushRes.text();
          console.warn('[send-notification] Expo push API error:', pushErr);
        } else {
          console.log('[send-notification] Push dispatched (push-only fallback):', type);
        }
      } catch (pushError) {
        console.warn('[send-notification] Push dispatch error:', pushError);
      }
    } else {
      console.log('[send-notification] Recipient has no push token; no-op (push-only)');
    }

    return json({ dispatched: true });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    console.error('[send-notification] Unhandled error:', msg);
    return json({ error: msg }, 500);
  }
});
