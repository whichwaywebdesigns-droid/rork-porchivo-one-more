-- ============================================================================
-- Deep-link CTA migration — route email CTAs to real in-app screens
-- ============================================================================
-- Previously tracking_url / message_url / directory_url / stats_url pointed at
-- the generic /app entry. Now:
--   directory_url  → /app/resident-directory   (member-joined)
--   message_url    → /app/chat?shipmentId=…    (partner pickup, when a shipment
--                  exists; package-hold path → /app/packages — chat requires a
--                  shipment id, which package_holds doesn't carry)
--   stats_url      → /app/safety-score         (milestone)
--   tracking_url   → /app/shipment-detail?id=… (arriving-today fallback when no
--                  carrier_tracking_url; carrier URL still wins)
-- dashboard_url / return_url stay on /app (home IS the dashboard; re-engagement
-- is a generic return).
--
-- The marketing shell's AppRedirect now preserves /app/<screen> subpaths and
-- the Expo app reconstructs them pre-boot (expo/lib/webDeepLink.ts), so these
-- URLs land on the actual screens.
--
-- Replaces 5 functions with full bodies; URL lines are the only changes.
-- ============================================================================

-- 8d. New member joined an existing community → notify other members ─────────
create or replace function public.notify_org_member_joined()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org record; v_member record; v_rec record; v_member_count int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  select name, admin_user_id into v_org from public.organizations where id = new.org_id;
  if v_org.admin_user_id = new.user_id then return new; end if;  -- org creator's own org
  select count(*) into v_member_count from public.org_memberships
    where org_id = new.org_id and status = 'active';
  if v_member_count < 2 then return new; end if;  -- not an existing community
  select name, email, address into v_member from public.profiles where id = new.user_id;
  for v_rec in
    select om.user_id, p.email, p.name
    from public.org_memberships om
    join public.profiles p on p.id = om.user_id
    where om.org_id = new.org_id and om.status = 'active'
      and om.user_id <> new.user_id and p.email like '%@%'
    limit 100
  loop
    begin
      perform public.enqueue_template_email(
        'member-joined', v_rec.email, v_rec.user_id, 'community',
        'join:' || new.id::text || ':' || v_rec.user_id::text,
        jsonb_build_object(
          'first_name',     coalesce(split_part(v_rec.name, ' ', 1), 'there'),
          'member_name',    coalesce(nullif(v_member.name, ''), 'A new neighbor'),
          'member_address', coalesce(nullif(v_member.address, ''), 'Your community'),
          'join_date',      to_char(coalesce(new.joined_at, now()), 'Mon DD, YYYY'),
          'community_name', v_org.name,
          'directory_url',  public.email_web_base() || '/app/resident-directory'
        ),
        'org_memberships', new.id
      );
    exception when others then raise warning 'notify_org_member_joined: %', sqlerrm;
    end;
  end loop;
  return new;
end; $$;

-- 8g. Package picked up by Porch Partner (assignment goes active) ────────────
create or replace function public.notify_assignment_pickup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_homeowner record; v_partner record; v_item_name text;
begin
  select id, name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select id, name, email, address into v_partner  from public.profiles where id = new.partner_id;
  if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then return new; end if;
  if new.shipment_id is not null then
    select coalesce(nullif(packages_expected, ''), 'Your package') into v_item_name
    from public.shipments where id = new.shipment_id;
  end if;
  begin
    perform public.enqueue_template_email(
      'package-picked-up', v_homeowner.email, v_homeowner.id, 'packages',
      'asg-act:' || new.id::text,
      jsonb_build_object(
        'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
        'partner_name',    coalesce(nullif(v_partner.name, ''), 'Your Porch Partner'),
        'item_name',       coalesce(v_item_name, 'Your package'),
        'pickup_time',     to_char(now(), 'Mon DD at HH12:MI AM'),
        'partner_address', coalesce(nullif(v_partner.address, ''), 'Nearby'),
        'message_url',     case
                             when new.shipment_id is not null then
                               public.email_web_base() || '/app/chat?shipmentId=' || new.shipment_id::text
                             else public.email_web_base() || '/app/packages'
                           end
      ),
      'partner_assignments', new.id
    );
  exception when others then raise warning 'notify_assignment_pickup: %', sqlerrm;
  end;
  return new;
end; $$;

-- 8h. Package hold picked up (second pickup path) ────────────────────────────
create or replace function public.notify_package_hold_pickup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_homeowner record; v_partner record;
begin
  select id, name, email, address into v_homeowner from public.profiles where id = new.homeowner_id;
  select id, name, email, address into v_partner  from public.profiles where id = new.partner_id;
  if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then return new; end if;
  begin
    perform public.enqueue_template_email(
      'package-picked-up', v_homeowner.email, v_homeowner.id, 'packages',
      'hold-pu:' || new.id::text,
      jsonb_build_object(
        'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
        'partner_name',    coalesce(nullif(v_partner.name, ''), 'Your Porch Partner'),
        'item_name',       'Package ' || left(new.package_id, 12),
        'pickup_time',     to_char(coalesce(new.picked_up_at, now()), 'Mon DD at HH12:MI AM'),
        'partner_address', coalesce(nullif(v_partner.address, ''), 'Nearby'),
        -- package_holds carries no shipment id (chat requires one) → packages tab
        'message_url',     public.email_web_base() || '/app/packages'
      ),
      'package_holds', new.id
    );
  exception when others then raise warning 'notify_package_hold_pickup: %', sqlerrm;
  end;
  return new;
end; $$;

-- 11d. Milestone — lifetime packages-protected crossing 10/50/100/250/500/1000
create or replace function public.run_milestone_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_u record; v_sent int := 0; v_count int; v_threshold int;
  v_join date; v_partner_uses int; v_blocked int;
begin
  for v_u in
    select p.id, p.email, p.name, p.created_at,
           (select count(*) from public.shipments s
            where s.homeowner_id = p.id
              and s.delivery_status in ('delivered','delivered_to_homeowner')) as lifetime
    from public.profiles p
    where p.deletion_requested_at is null and p.email like '%@%'
  loop
    v_count := v_u.lifetime;
    if v_count not in (10,50,100,250,500,1000) then continue; end if;
    select count(*) into v_partner_uses from public.partner_assignments
      where homeowner_id = v_u.id and status = 'completed';
    select count(*) into v_blocked from public.suspicious_alerts
      where user_id = v_u.id and category = 'package_taken';
    begin
      perform public.enqueue_template_email(
        'milestone', v_u.email, v_u.id, 'community',
        'mile:' || v_u.id::text || ':' || v_count::text,
        jsonb_build_object(
          'first_name',             coalesce(split_part(v_u.name, ' ', 1), 'there'),
          'package_milestone',      v_count::text,
          'join_date',              to_char(v_u.created_at, 'Mon DD, YYYY'),
          'partner_uses',           v_partner_uses::text,
          'theft_attempts_blocked', v_blocked::text,
          'stats_url',              public.email_web_base() || '/app/safety-score'
        ),
        'profiles', v_u.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'milestone %: %', v_u.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;

-- 11g. Arriving today — shipments flagged out-for-delivery with today's window
create or replace function public.run_arriving_today_job()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_s record; v_homeowner record;
  v_sent int := 0;
begin
  for v_s in
    select *
    from public.shipments
    where delivery_status = 'out_for_delivery'
      and status in ('open','accepted')
      and (delivery_window_start::date = current_date or delivery_window_end::date = current_date)
    limit 200
  loop
    select id, name, email into v_homeowner from public.profiles where id = v_s.homeowner_id;
    if v_homeowner.email is null or position('@' in v_homeowner.email) = 0 then continue; end if;
    begin
      perform public.enqueue_template_email(
        'package-arriving', v_homeowner.email, v_homeowner.id, 'packages',
        'arrive:' || v_s.id::text,
        jsonb_build_object(
          'first_name',      coalesce(split_part(v_homeowner.name, ' ', 1), 'there'),
          'item_name',       coalesce(nullif(v_s.packages_expected, ''), 'Your package'),
          'carrier_name',    v_s.carrier,
          'delivery_window', to_char(v_s.delivery_window_start, 'HH12:MI AM') || ' – ' || to_char(v_s.delivery_window_end, 'HH12:MI AM'),
          'tracking_number', coalesce(v_s.tracking_number, '—'),
          'tracking_url',    coalesce(v_s.carrier_tracking_url, public.email_web_base() || '/app/shipment-detail?id=' || v_s.id::text)
        ),
        'shipments', v_s.id
      );
      v_sent := v_sent + 1;
    exception when others then raise warning 'arriving %: %', v_s.id, sqlerrm;
    end;
  end loop;
  return v_sent;
end; $$;
