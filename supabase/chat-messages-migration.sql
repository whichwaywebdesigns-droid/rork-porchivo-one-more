-- ============================================
-- PORCHIVO: Chat Messages Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- CHAT_MESSAGES TABLE
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  shipment_id uuid references public.shipments(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  sender_name text not null default '',
  sender_avatar_url text,
  text text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view messages for their shipments"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.shipments s
      where s.id = chat_messages.shipment_id
      and (s.homeowner_id = auth.uid() or s.partner_id = auth.uid())
    )
  );

create policy "Users can insert messages for their shipments"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.shipments s
      where s.id = chat_messages.shipment_id
      and (s.homeowner_id = auth.uid() or s.partner_id = auth.uid())
    )
  );

-- INDEXES
create index if not exists idx_chat_messages_shipment on public.chat_messages(shipment_id);
create index if not exists idx_chat_messages_created on public.chat_messages(created_at);

-- ENABLE REALTIME
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;
