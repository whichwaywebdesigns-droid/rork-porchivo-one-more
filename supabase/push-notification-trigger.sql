-- ============================================
-- PORCHIVO: Push Notification Trigger
-- Run this in Supabase SQL Editor
-- ============================================
-- This trigger sends a push notification via Expo's push API
-- whenever a new row is inserted into the notifications table.
-- It looks up the recipient's expo_push_token from profiles
-- and calls the Expo push endpoint using pg_net (HTTP extension).
--
-- PREREQUISITE: Enable the pg_net extension in Supabase Dashboard:
--   Database > Extensions > search "pg_net" > Enable
-- ============================================

-- 1. Enable pg_net extension (if not already enabled)
create extension if not exists pg_net with schema extensions;

-- 2. Create the trigger function
create or replace function public.send_push_notification()
returns trigger as $$
declare
  recipient_token text;
  payload jsonb;
begin
  -- Look up the recipient's push token
  select expo_push_token into recipient_token
  from public.profiles
  where id = new.recipient_id;

  -- Only send if recipient has a push token
  if recipient_token is not null and recipient_token != '' then
    payload := jsonb_build_object(
      'to', recipient_token,
      'sound', 'default',
      'title', new.title,
      'body', new.message,
      'data', jsonb_build_object(
        'shipmentId', new.shipment_id,
        'type', new.type,
        'notificationId', new.id
      )
    );

    -- Send via Expo Push API using pg_net
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json',
        'Accept-encoding', 'gzip, deflate'
      ),
      body := payload
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 3. Create the trigger on notifications table
drop trigger if exists on_notification_created on public.notifications;
create trigger on_notification_created
  after insert on public.notifications
  for each row execute function public.send_push_notification();
