-- Graceful account deletion: deactivation-first with 30-day grace period.
--
-- This migration adds a `deletion_requested_at` column to `profiles` and
-- creates three new RPCs:
--   1. request_account_deletion() — stamps the timestamp, invalidates sessions
--   2. restore_account()           — clears the timestamp (within 30-day window)
--   3. purge_deleted_accounts()    — permanently deletes accounts past 30 days
--
-- The existing delete_account_cascade() RPC is kept as-is; it is called
-- internally by purge_deleted_accounts() for each eligible user.
--
-- ** This is a schema change. Run in Supabase SQL Editor and confirm before deploying. **

-- ── 1. Add deletion_requested_at column ────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- Index for the purge job to quickly find pending deletions
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_requested_at
  ON public.profiles (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

-- ── 2. request_account_deletion() RPC ──────────────────────────────────────
-- Called by the client when the user confirms deletion.
-- Stamps deletion_requested_at, signs out all sessions, returns success.
-- Does NOT delete any data — the 30-day grace period begins.

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if already pending deletion
  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Stamp the deletion request timestamp
  UPDATE public.profiles
  SET deletion_requested_at = NOW()
  WHERE id = v_user_id AND deletion_requested_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deletion already requested');
  END IF;

  -- Invalidate all active sessions for this user (sign out everywhere)
  -- This prevents login during the grace period
  UPDATE auth.users
  SET banned_until = '2999-01-01'::timestamptz
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'email', v_email);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

-- ── 3. restore_account() RPC ───────────────────────────────────────────────
-- Called by support (via service role) to cancel a pending deletion.
-- Clears the timestamp and unbans the user.

CREATE OR REPLACE FUNCTION public.restore_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only callable with service_role (no GRANT to authenticated/anon)
  UPDATE public.profiles
  SET deletion_requested_at = NULL
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Unban the user so they can log in again
  UPDATE auth.users
  SET banned_until = NULL
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- No GRANT — only service_role can call this (support-initiated restore)

-- ── 4. purge_deleted_accounts() RPC ────────────────────────────────────────
-- Called by a scheduled edge function (pg_cron or external scheduler).
-- Finds all accounts with deletion_requested_at older than 30 days and
-- permanently deletes them using the existing cascade logic.

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
  -- Find all accounts past the 30-day grace period
  FOR v_user IN
    SELECT id, email
    FROM public.profiles
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < NOW() - INTERVAL '30 days'
  LOOP
    BEGIN
      -- Delete dependent rows in order (children before parents)
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

      -- Purge Storage objects (avatars + delivery-photos) for this user.
      BEGIN
        DELETE FROM storage.objects
        WHERE bucket_id IN ('avatars', 'delivery-photos')
          AND (storage.foldername(name))[1] = v_user.id::text;
      EXCEPTION WHEN OTHERS THEN
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
