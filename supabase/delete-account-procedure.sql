-- Atomic account deletion stored procedure
-- Run in Supabase SQL Editor AFTER migration.sql.
--
-- Replaces the fragile client-side cascade in AppContext.deleteAccount.
-- The client calls  supabase.rpc('delete_account_cascade')  and gets a single
-- success/failure result. All deletes happen inside one transaction — either
-- everything is removed or nothing is, preventing partial-delete corruption.
--
-- The function runs as SECURITY DEFINER (elevated privileges) so it can:
--   • Delete from tables with strict RLS
--   • Delete the auth.users row (requires elevated access)
--
-- auth.uid() inside the function body resolves to the JWT caller's user ID,
-- so a user can only delete their own account — no impersonation is possible.

CREATE OR REPLACE FUNCTION public.delete_account_cascade()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Resolve caller identity from the JWT
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Delete dependent rows in order (children before parents)
  -- Use IF EXISTS / exception-safe DELETEs so missing tables don't abort

  -- Analytics events
  BEGIN
    DELETE FROM public.analytics_events WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Rate limit entries for this user
  BEGIN
    DELETE FROM public.rate_limit_log WHERE key LIKE '%:' || v_user_id::TEXT;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Chat messages sent by the user
  BEGIN
    DELETE FROM public.chat_messages WHERE sender_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Notifications received by the user
  DELETE FROM public.notifications WHERE recipient_id = v_user_id;

  -- Invoice periods
  BEGIN
    DELETE FROM public.invoice_periods WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner payouts
  BEGIN
    DELETE FROM public.partner_payouts WHERE partner_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner assignments (user as homeowner or partner)
  BEGIN
    DELETE FROM public.partner_assignments
    WHERE homeowner_id = v_user_id OR partner_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner connections (user as homeowner or partner)
  BEGIN
    DELETE FROM public.partner_connections
    WHERE homeowner_id = v_user_id OR partner_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Support tickets owned by the user
  BEGIN
    DELETE FROM public.support_tickets WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Partner verification record
  BEGIN
    DELETE FROM public.partner_verifications WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Shipments (user as homeowner or partner)
  DELETE FROM public.shipments
  WHERE homeowner_id = v_user_id OR partner_id = v_user_id;

  -- Profile row — must come after all child rows that FK to profiles
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Finally, delete the auth user. SECURITY DEFINER gives us access to auth schema.
  -- This invalidates all active sessions for this user immediately.
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  -- Rollback is automatic; return the error so the client can surface it
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Only the authenticated user (via RLS JWT check inside the function) can call this.
-- No GRANT needed — SECURITY DEFINER functions are callable by authenticated users
-- who the function body explicitly validates via auth.uid().
REVOKE ALL ON FUNCTION public.delete_account_cascade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_account_cascade() TO authenticated;
