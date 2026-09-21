-- billing-event-log-migration.sql
-- Append-only billing webhook audit tables (foundation for the RevenueCat
-- receiver + future exception alerts). Base tables were created ad-hoc on the
-- live DB 2026-09-21; this file formalizes them for master-deploy and carries
-- the same-day immutability FIX:
--
--   * billing_event_log: append-only. Receipt rows are immutable EXCEPT the
--     processing-outcome columns (processing_status, error_code,
--     error_message) — insert at receipt ('received'), then a single guarded
--     UPDATE to a terminal status after processing. Deletes always blocked.
--     (The original blanket trigger blocked ALL updates, so processing_status
--     could never advance past 'received'.)
--   * billing_event_alerts: fully immutable occurrence record. Email-delivery
--     state is owned by the existing email_queue / email_sends pipeline
--     (enqueue_template_email dedupe + caps) — the mutable delivery columns
--     (delivered_at, delivery_attempts, last_delivery_error) are REMOVED; they
--     were unwritable under the immutability trigger. Exception alerts ride
--     the email pipeline to support@porchivo.com — no parallel delivery table.
--
-- RLS: deny-all for anon/authenticated (service_role bypasses). The receiver
-- edge functions use the service role; clients never read these tables.

CREATE TABLE IF NOT EXISTS public.billing_event_log (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider = any (array['eas'::text, 'app_store_connect'::text, 'revenuecat'::text])),
    event_id text not null,
    event_type text,
    received_at timestamp with time zone not null default now(),
    signature_verified boolean not null default false,
    processing_status text not null default 'received'::text check (processing_status = any (array['received'::text, 'processed'::text, 'duplicate'::text, 'rejected'::text, 'failed'::text])),
    payload_sha256 text not null,
    raw_payload jsonb not null,
    request_headers jsonb not null default '{}'::jsonb,
    error_code text,
    error_message text,
    source_ip inet,
    constraint billing_event_log_provider_event_id_key unique (provider, event_id)
);

CREATE INDEX IF NOT EXISTS billing_event_log_received_at_idx
    ON public.billing_event_log (received_at DESC);

CREATE INDEX IF NOT EXISTS billing_event_log_status_idx
    ON public.billing_event_log (processing_status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_event_alerts (
    id uuid primary key default gen_random_uuid(),
    event_log_id uuid references public.billing_event_log (id) on delete restrict,
    provider text not null,
    event_id text not null,
    alert_code text not null,
    alert_message text not null,
    context jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default now()
);

ALTER TABLE public.billing_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_event_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_event_log_no_client_access
    ON public.billing_event_log FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

CREATE POLICY billing_event_alerts_no_client_access
    ON public.billing_event_alerts FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

-- Blanket immutability (used by billing_event_alerts: UPDATE and DELETE blocked).
CREATE OR REPLACE FUNCTION public.prevent_billing_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $fn$
begin
  raise exception 'billing event records are immutable';
end;
$fn$;

-- Outcome guard for billing_event_log: receipt row immutable except the
-- processing-outcome columns; deletes blocked.
CREATE OR REPLACE FUNCTION public.allow_billing_log_outcome_update()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'billing_event_log is append-only: deletes are not permitted';
  END IF;
  IF NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified
     OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
     OR NEW.raw_payload IS DISTINCT FROM OLD.raw_payload
     OR NEW.request_headers IS DISTINCT FROM OLD.request_headers
     OR NEW.source_ip IS DISTINCT FROM OLD.source_ip THEN
    RAISE EXCEPTION 'billing_event_log is append-only: only processing_status, error_code, error_message may change';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS billing_event_log_immutable ON public.billing_event_log;
CREATE TRIGGER billing_event_log_outcome_guard
    BEFORE UPDATE OR DELETE ON public.billing_event_log
    FOR EACH ROW EXECUTE FUNCTION public.allow_billing_log_outcome_update();

CREATE TRIGGER billing_event_alerts_immutable
    BEFORE UPDATE OR DELETE ON public.billing_event_alerts
    FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_event_mutation();

-- Correction applied to any live pre-fix shape: delivery tracking columns were
-- unwritable under the immutability trigger (dead columns). Dropping them also
-- drops the partial index billing_event_alerts_pending_idx (references
-- delivered_at) — delivery state now lives in email_queue/email_sends.
ALTER TABLE public.billing_event_alerts
    DROP COLUMN IF EXISTS delivered_at,
    DROP COLUMN IF EXISTS delivery_attempts,
    DROP COLUMN IF EXISTS last_delivery_error;
