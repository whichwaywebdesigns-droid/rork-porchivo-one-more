-- Add native iOS APNS token support to the existing push infrastructure.
-- Expo apps continue to use the existing `profiles.expo_push_token` column and
-- the `send_push_notification` trigger (which calls the Expo Push API).
-- This migration adds an `apns_token` column so the native iOS app can persist
-- its Apple Push Notification service device token for future native iOS pushes.
--
-- PREREQUISITE: native iOS APNS *delivery* still requires an APNS certificate
-- or key configured in your backend. This migration only adds the storage column.

-- 1. Add the APNS token column to profiles.
alter table public.profiles
    add column if not exists apns_token text;

-- 2. Ensure the column is writable by the authenticated user themselves.
--    (profiles already has RLS policies; this grants update on the new column.)
grant update (apns_token) on public.profiles to authenticated;

-- 3. Keep the existing Expo push trigger unchanged. When you later wire native
--    APNS delivery, you can extend `send_push_notification()` to fall back to
--    `apns_token` when `expo_push_token` is null.
--
--    Example future trigger logic (not enabled here because APNS credentials are
--    project-specific and not yet configured):
--      if new.recipient's expo_push_token is not null then send via Expo Push API
--      elsif new.recipient's apns_token is not null then send via APNS
--      end if;
