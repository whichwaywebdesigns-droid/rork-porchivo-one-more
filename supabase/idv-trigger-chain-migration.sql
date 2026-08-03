-- ============================================================
-- PORCHIVO: IDV Trigger Chain Migration
-- Run AFTER partner-verification-migration.sql and
-- verification-notification-migration.sql
-- ============================================================
-- Replaces the old pattern where verification-webhook touched
-- profiles directly and called sendVerificationPush() to insert
-- notification rows. Now the DB handles the entire chain:
--
--   partner_verifications UPDATE
--     → trg_sync_idv_to_profile  (bumps profiles.updated_at for Realtime)
--     → trg_notify_idv_change    (inserts notification row)
--       → on_notification_created (sends Expo push via pg_net)
--
-- This keeps edge functions thin (upsert only) and ensures the
-- notification + push path is consistent regardless of caller.
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. trg_sync_idv_to_profile
--    Fires AFTER UPDATE on partner_verifications.
--    Bumps profiles.updated_at so the app's Realtime subscription
--    re-fetches the profile (and in turn re-reads partner_verifications
--    via the app's existing query). No PII is copied to profiles.
-- ───────────────────────────────────────────────────────────
create or replace function public.sync_idv_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when idv_status or tier actually changed
  if (TG_OP = 'UPDATE') then
    if NEW.idv_status is distinct from OLD.idv_status
       or NEW.tier is distinct from OLD.tier then
      update public.profiles
        set updated_at = now()
        where id = NEW.user_id;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_idv_to_profile on public.partner_verifications;
create trigger trg_sync_idv_to_profile
  after update on public.partner_verifications
  for each row execute function public.sync_idv_to_profile();

-- ───────────────────────────────────────────────────────────
-- 2. trg_notify_idv_change
--    Fires AFTER UPDATE on partner_verifications.
--    When idv_status transitions to a terminal state, inserts a
--    notification row (shipment_id = null, recipient_role = 'partner').
--    The existing on_notification_created trigger then sends the
--    Expo push via pg_net — no edge-function push dispatch needed.
-- ───────────────────────────────────────────────────────────
create or replace function public.notify_idv_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type      text;
  v_title     text;
  v_message   text;
  v_first     text;
begin
  -- Only fire when idv_status actually changed
  if NEW.idv_status is not distinct from OLD.idv_status then
    return NEW;
  end if;

  v_first := coalesce(NEW.legal_first_name, '');

  if NEW.idv_status = 'verified' then
    v_type    := 'idv_approved';
    v_title   := 'Identity Verified';
    v_message := case
      when v_first <> '' then
        'Your ID has been verified, ' || v_first || '. You can now accept paid package holds and start earning.'
      else
        'Your ID has been verified. You can now accept paid package holds and start earning.'
    end;

  elsif NEW.idv_status = 'requires_input' then
    v_type    := 'idv_requires_input';
    v_title   := 'Verification Action Needed';
    v_message := 'Your ID check needs attention. Tap to resubmit.';

  elsif NEW.idv_status = 'cancelled' then
    v_type    := 'idv_cancelled';
    v_title   := 'Verification Cancelled';
    v_message := 'Your identity verification was cancelled. You can restart it any time from the Partner section.';

  elsif NEW.idv_status = 'failed' then
    v_type    := 'idv_requires_input';
    v_title   := 'Verification Failed';
    v_message := 'Your ID verification could not be completed. Tap to try again.';

  else
    -- No notification for pending or not_started transitions
    return NEW;
  end if;

  insert into public.notifications
    (shipment_id, type, title, message, recipient_id, recipient_role, read)
  values
    (null, v_type, v_title, v_message, NEW.user_id, 'partner', false);

  return NEW;
end;
$$;

drop trigger if exists trg_notify_idv_change on public.partner_verifications;
create trigger trg_notify_idv_change
  after update on public.partner_verifications
  for each row execute function public.notify_idv_change();
