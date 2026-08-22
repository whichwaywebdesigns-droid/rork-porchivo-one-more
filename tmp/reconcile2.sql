-- Drift reconciliation pass 2 (2026-08-22).
-- Brings live amazon_orders and support_tickets up to the repo schema so the
-- remaining migration sections complete. All columns nullable/defaults —
-- safe on existing rows. Idempotent.

-- amazon_orders: repo + app expect status/item_name/otp_code/expected_delivery/
-- delivered_at; live (old shape) has delivery_status etc. (table is empty —
-- no backfill needed)
alter table public.amazon_orders
  add column if not exists status            text not null default 'pending',
  add column if not exists item_name         text not null default '',
  add column if not exists otp_code          text not null default '',
  add column if not exists expected_delivery date,
  add column if not exists delivered_at      timestamptz;

update public.amazon_orders
   set status = delivery_status
 where status = 'pending' and delivery_status is not null;

-- support_tickets: repo expects ai_draft_* + staff/resolution/context columns;
-- live (old shape) has ai_draft_response/message/device_info instead.
alter table public.support_tickets
  add column if not exists body                  text,
  add column if not exists staff_reply           text,
  add column if not exists staff_replied_at      timestamptz,
  add column if not exists resolution_note       text,
  add column if not exists attachment_url        text,
  add column if not exists device_model          text,
  add column if not exists ai_draft_reply        text,
  add column if not exists ai_draft_generated_at timestamptz,
  add column if not exists ai_draft_model        text,
  add column if not exists ai_draft_feedback     text;
