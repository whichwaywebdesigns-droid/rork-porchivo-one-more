-- ============================================================
-- PORCHIVO: Verification Notification Support Migration
-- Run in Supabase SQL Editor AFTER migration.sql
-- ============================================================
-- 1. Make shipment_id nullable so non-shipment events (IDV,
--    tier changes, payout updates) can insert notifications.
-- 2. Extend the type check constraint to include IDV and tier
--    notification types.
-- ============================================================

-- 1. Drop the NOT NULL constraint on shipment_id
ALTER TABLE public.notifications
  ALTER COLUMN shipment_id DROP NOT NULL;

-- 2. Drop the existing type check constraint and recreate it
--    with the extended list of allowed types.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- Existing shipment notification types
    'tracking_added',
    'package_delivered',
    'partner_pickup_alert',
    'partner_completed',
    'package_out_for_delivery',
    'package_picked_up',

    -- Identity verification types (no shipment_id)
    'idv_approved',
    'idv_requires_input',
    'idv_cancelled',

    -- Trust tier promotion (no shipment_id)
    'tier_promoted',

    -- Payout / Connect account types (no shipment_id)
    'payout_account_active',
    'payout_received'
  ));

-- 3. Index for fast lookup of unread verification notifications
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications(type);

-- 4. Partial index for common "unread" queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(recipient_id, created_at DESC)
  WHERE read = false;
