-- 20260826120000_chat_moderation.sql
-- App Store Guideline 1.2 (UGC safety) for org chat:
--   * message_reports  — residents can report abusive chat messages
--   * blocked_users    — residents can block members; blocked members'
--                        messages are excluded from the reporter's feed
-- Both tables are auth-scoped via RLS; no service-role access from clients.

-- ---------------------------------------------------------------- reports
create table if not exists public.message_reports (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.chat_messages (id) on delete cascade,
  reporter_id     uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason          text not null default 'other',
  note            text,
  created_at      timestamptz not null default now()
);

alter table public.message_reports enable row level security;

drop policy if exists "reporters insert own" on public.message_reports;
create policy "reporters insert own" on public.message_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "reporters read own" on public.message_reports;
create policy "reporters read own" on public.message_reports
  for select to authenticated
  using (reporter_id = auth.uid());

create index if not exists message_reports_message_idx on public.message_reports (message_id);
create index if not exists message_reports_reporter_idx on public.message_reports (reporter_id);

-- ---------------------------------------------------------------- blocks
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "blockers manage own" on public.blocked_users;
create policy "blockers manage own" on public.blocked_users
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- ---------------------------------------------------------------- report RPC
-- Staff-safe way to report: validates the message exists and derives the
-- reported user server-side, so clients cannot forge reported_user_id.
create or replace function public.report_chat_message(
  p_message_id uuid,
  p_reason text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
begin
  select sender_id into v_sender from public.chat_messages where id = p_message_id;
  if v_sender is null then
    raise exception 'message not found';
  end if;

  insert into public.message_reports (message_id, reporter_id, reported_user_id, reason, note)
  values (p_message_id, auth.uid(), v_sender, p_reason, p_note);
end;
$$;

revoke all on function public.report_chat_message(uuid, text, text) from public, anon;
grant execute on function public.report_chat_message(uuid, text, text) to authenticated;
