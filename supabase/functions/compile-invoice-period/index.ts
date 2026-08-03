import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { role, periodType, periodStart, periodEnd } = body as {
      role: 'homeowner' | 'partner';
      periodType: 'monthly' | 'quarterly' | 'annual';
      periodStart: string;
      periodEnd: string;
    };

    if (!role || !periodType || !periodStart || !periodEnd) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    // Call the DB function to compile the period
    const { data: periodId, error: compileErr } = await db.rpc('compile_invoice_period', {
      p_user_id: user.id,
      p_role: role,
      p_type: periodType,
      p_start: periodStart,
      p_end: periodEnd,
    });

    if (compileErr) {
      console.error('compile_invoice_period error:', compileErr);
      return new Response(JSON.stringify({ error: compileErr.message }), { status: 500, headers: corsHeaders });
    }

    // Fetch the compiled period record
    const { data: period, error: fetchErr } = await db
      .from('invoice_periods')
      .select('*')
      .eq('id', periodId)
      .single();

    if (fetchErr || !period) {
      return new Response(JSON.stringify({ error: 'Period not found after compile' }), { status: 500, headers: corsHeaders });
    }

    // Mark notification as sent
    await db
      .from('invoice_periods')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', periodId);

    // --- Push notification ---
    // Get user's push token
    const { data: profile } = await db
      .from('profiles')
      .select('expo_push_token, full_name')
      .eq('id', user.id)
      .single();

    if (profile?.expo_push_token && period.transaction_count > 0) {
      const totalFormatted = `$${(period.total_cents / 100).toFixed(2)}`;
      const typeLabel = periodType === 'monthly' ? 'Monthly' : periodType === 'quarterly' ? 'Quarterly' : 'Annual';
      const notifTitle = `${typeLabel} ${role === 'homeowner' ? 'Expense' : 'Earnings'} Summary Ready`;
      const notifBody = role === 'homeowner'
        ? `You spent ${totalFormatted} on Porch Partner services in ${period.period_label.trim()}. Your tax summary is ready to download.`
        : `You earned ${totalFormatted} as a Porch Partner in ${period.period_label.trim()}. Your income summary is ready to download.`;

      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: profile.expo_push_token,
            title: notifTitle,
            body: notifBody,
            data: { screen: 'invoices', role, periodType, periodKey: period.period_key },
          }),
        });
      } catch (pushErr) {
        // Non-fatal
        console.warn('Push notification failed:', pushErr);
      }
    }

    return new Response(JSON.stringify({ success: true, period }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('compile-invoice-period error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders });
  }
});
