// @ts-nocheck — Deno runtime
//
// Scheduled purge: permanently deletes accounts past the 30-day grace period.
//
// Deployed with --no-verify-jwt because it is invoked by an external scheduler
// (pg_cron or GitHub Actions scheduled workflow), not by end-user clients.
// Every request must carry the shared `x-purge-secret` header matching the
// PURGE_FN_SECRET env var.
//
// Expected env vars (set via `supabase secrets set`):
//   PURGE_FN_SECRET  — shared secret for auth
//   SUPABASE_URL     — project URL (injected automatically)
//   SUPABASE_SERVICE_ROLE_KEY — service role key (injected automatically)
//
// Invoke: POST with header `x-purge-secret: <secret>` and body `{}`.
// Returns: `{ success, purged_count, errors }` from the purge_deleted_accounts RPC.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-purge-secret',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify shared secret
    const secret = Deno.env.get('PURGE_FN_SECRET');
    if (!secret) {
      return new Response(
        JSON.stringify({ error: 'Purge secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const providedSecret = req.headers.get('x-purge-secret');
    if (providedSecret !== secret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create service-role client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Call the purge RPC
    const { data, error } = await supabase.rpc('purge_deleted_accounts');

    if (error) {
      console.error('[purge-deleted-accounts] RPC error:', error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = data as { success: boolean; purged_count: number; errors?: string[] };

    console.log(
      `[purge-deleted-accounts] Purged ${result.purged_count ?? 0} accounts.` +
      (result.errors?.length ? ` Errors: ${result.errors.join('; ')}` : ''),
    );

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[purge-deleted-accounts] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
