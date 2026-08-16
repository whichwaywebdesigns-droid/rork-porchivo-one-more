-- ============================================================
-- PORCHIVO: Purge Storage objects on account deletion
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================
--
-- Adds Storage object cleanup to BOTH account-deletion functions:
--   1. delete_account_cascade()  — immediate, user-initiated
--   2. purge_deleted_accounts()  — batch, after 30-day grace period
--
-- Buckets cleaned:
--   • avatars          — path pattern: <uid>/<filename>
--   • delivery-photos  — path pattern: <uid>/<shipmentId>/<filename>
--
-- Both use (storage.foldername(name))[1] = <uid> to match the user's
-- objects, consistent with the Storage RLS policies in
-- avatar-storage-migration.sql and delivery-proof-photos-migration.sql.
-- ============================================================


-- ── 1. delete_account_cascade() — add Storage cleanup ──────────────────
-- Replaces the existing function with the same signature + body, plus
-- a DELETE FROM storage.objects before the auth.users row is removed.

CREATE OR REPLACE FUNCTION public.delete_account_cascade()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

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

  -- ── NEW: Purge Storage objects for this user ────────────────────────
  -- Delete all avatar and delivery-photo objects owned by this user.
  -- Runs as SECURITY DEFINER (bypasses Storage RLS).
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id IN ('avatars', 'delivery-photos')
      AND (storage.foldername(name))[1] = v_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    -- Don't abort the entire deletion if storage cleanup fails
    -- (orphaned objects can be cleaned up separately if needed)
    NULL;
  END;

  -- Finally, delete the auth user
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_cascade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_account_cascade() TO authenticated;


-- ── 2. purge_deleted_accounts() — add Storage cleanup to per-user loop ──

CREATE OR REPLACE FUNCTION public.purge_deleted_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count INT := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_user IN
    SELECT id, email
    FROM public.profiles
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < NOW() - INTERVAL '30 days'
  LOOP
    BEGIN
      BEGIN
        DELETE FROM public.analytics_events WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.rate_limit_log WHERE key LIKE '%:' || v_user.id::TEXT;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.chat_messages WHERE sender_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      DELETE FROM public.notifications WHERE recipient_id = v_user.id;

      BEGIN
        DELETE FROM public.invoice_periods WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_payouts WHERE partner_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_assignments
        WHERE homeowner_id = v_user.id OR partner_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_connections
        WHERE homeowner_id = v_user.id OR partner_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.support_tickets WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      BEGIN
        DELETE FROM public.partner_verifications WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      DELETE FROM public.shipments
      WHERE homeowner_id = v_user.id OR partner_id = v_user.id;

      DELETE FROM public.profiles WHERE id = v_user.id;

      -- ── NEW: Purge Storage objects for this user ────────────────────
      BEGIN
        DELETE FROM storage.objects
        WHERE bucket_id IN ('avatars', 'delivery-photos')
          AND (storage.foldername(name))[1] = v_user.id::text;
      EXCEPTION WHEN OTHERS THEN
        -- Log but don't abort — orphaned storage objects are non-critical
        v_errors := array_append(v_errors, format('User %s storage cleanup: %s', v_user.id, SQLERRM));
      END;

      DELETE FROM auth.users WHERE id = v_user.id;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, format('User %s: %s', v_user.id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'purged_count', v_count,
    'errors', to_jsonb(v_errors)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- No GRANT — only service_role can call the purge job
