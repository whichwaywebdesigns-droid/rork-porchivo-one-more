-- ============================================
-- PORCHIVO: Delivery Status Push Notification Trigger
-- Run this in Supabase SQL Editor
-- ============================================
-- Fires a push notification when a shipment's delivery_status changes
-- to 'out_for_delivery' or 'delivered' — even when the app is closed.
--
-- This complements the client-side notification logic in ShipmentsContext,
-- which handles the case where the app is foregrounded. This trigger
-- ensures users get notified regardless of app state.
--
-- PREREQUISITES:
--   - pg_net extension enabled
--   - on_notification_created trigger already installed (push-notification-trigger.sql)
--   - notifications table exists
--   - create_notification() function exists (hardened-rls.sql / master-deploy.sql)
-- ============================================

-- 1. Create the trigger function
create or replace function public.notify_delivery_status_change()
returns trigger as $$
declare
  v_old_status text;
  v_new_status text;
  v_homeowner_id uuid;
  v_partner_id uuid;
  v_carrier text;
  v_homeowner_name text;
  v_partner_name text;
  v_notif_type text;
  v_title text;
  v_message text;
begin
  -- Only fire on actual delivery_status changes
  if TG_OP = 'UPDATE' and OLD.delivery_status = NEW.delivery_status then
    return new;
  end if;

  v_old_status := case when TG_OP = 'UPDATE' then OLD.delivery_status else null end;
  v_new_status := NEW.delivery_status;

  -- Only notify for these two transitions
  if v_new_status = 'out_for_delivery' and v_old_status != 'out_for_delivery' then
    v_notif_type := 'package_out_for_delivery';
    v_title := 'Out for delivery';
    v_message := 'Your ' || coalesce(NEW.carrier, 'package') || ' package is out for delivery.';
  elsif v_new_status = 'delivered' and v_old_status not in ('delivered', 'delivered_to_homeowner') then
    v_notif_type := 'package_delivered';
    v_title := 'Package delivered!';
    v_message := 'Your ' || coalesce(NEW.carrier, 'package') || ' package just arrived at your porch.';
  else
    return new;
  end if;

  v_homeowner_id := NEW.homeowner_id;
  v_partner_id := NEW.partner_id;
  v_carrier := NEW.carrier;
  v_homeowner_name := NEW.homeowner_name;
  v_partner_name := NEW.partner_name;

  -- ── Notify the homeowner ──────────────────────────────────────────────
  -- Insert directly into notifications table; the on_notification_created
  -- trigger will dispatch the Expo push via pg_net.
  -- We use a security definer insert to bypass RLS on the notifications table.
  begin
    insert into public.notifications (shipment_id, recipient_id, recipient_role, type, title, message, read)
    values (NEW.id, v_homeowner_id, 'homeowner', v_notif_type, v_title, v_message, false)
    on conflict do nothing;
  exception when others then
    -- Non-fatal: don't block the status update
    raise notice 'notify_delivery_status: homeowner insert failed: %', SQLERRM;
  end;

  -- ── Notify the partner (if assigned) ──────────────────────────────────
  if v_partner_id is not null then
    declare
      v_partner_title text;
      v_partner_message text;
    begin
      if v_notif_type = 'package_delivered' then
        v_partner_title := 'Time to pick up!';
        v_partner_message := coalesce(v_homeowner_name, 'A homeowner') || '''s ' || coalesce(v_carrier, 'package') || ' package has been delivered. Head over to pick it up.';
        begin
          insert into public.notifications (shipment_id, recipient_id, recipient_role, type, title, message, read)
          values (NEW.id, v_partner_id, 'partner', 'partner_pickup_alert', v_partner_title, v_partner_message, false)
          on conflict do nothing;
        exception when others then
          raise notice 'notify_delivery_status: partner insert failed: %', SQLERRM;
        end;
      elsif v_notif_type = 'package_out_for_delivery' then
        v_partner_title := 'Package out for delivery';
        v_partner_message := coalesce(v_homeowner_name, 'A homeowner') || '''s ' || coalesce(v_carrier, 'package') || ' is out for delivery. Get ready to pick it up.';
        begin
          insert into public.notifications (shipment_id, recipient_id, recipient_role, type, title, message, read)
          values (NEW.id, v_partner_id, 'partner', 'package_out_for_delivery', v_partner_title, v_partner_message, false)
          on conflict do nothing;
        exception when others then
          raise notice 'notify_delivery_status: partner OFD insert failed: %', SQLERRM;
        end;
      end if;
    end;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 2. Create the trigger on shipments table
drop trigger if exists trg_delivery_status_notify on public.shipments;
create trigger trg_delivery_status_notify
  after update of delivery_status on public.shipments
  for each row execute function public.notify_delivery_status_change();

-- 3. Grant execute on the trigger function
grant execute on function public.notify_delivery_status_change() to authenticated;
