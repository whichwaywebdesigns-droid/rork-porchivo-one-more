# Porchivo · Supabase Deploy Runbook

One ordered pass to bring a Supabase project fully up to date: database first, then edge functions. Both steps are idempotent — safe to re-run.

## Prerequisites (once)

1. Install the Supabase CLI: https://supabase.com/docs/guides/cli
2. Log in: `supabase login`
3. Link the project: `supabase link --project-ref <your-ref>`
   (find `<your-ref>` in Dashboard → Project Settings → General)

## Step 1 — Database (migrations)

Run the consolidated master migration. It bundles all migrations in dependency order with idempotent guards.

**Option A — SQL Editor (simplest):** open `master-deploy.sql`, paste the full contents into the Supabase SQL Editor, and run.

**Option B — CLI:**
```bash
cd supabase
supabase db execute --file master-deploy.sql
```

> Regenerating `master-deploy.sql`: if you add or change a migration, rebuild it with `python build-master.py`, then re-run this step.

## Step 2 — Edge functions

Deploy all functions in one pass.

```bash
cd supabase
./deploy-functions.sh                # deploy all functions
./deploy-functions.sh --with-secrets # also push secrets from .env.functions
```

This deploys the public webhooks (`connect-webhook`, `verification-webhook`, `revenuecat-webhook`, `stripe-webhook`) and the server-to-server `send-email` queue drainer with `--no-verify-jwt`, plus the authenticated functions (including the hardened `api-gateway`) with default JWT verification.

The `stripe-webhook` function needs one extra secret (create the endpoint per `STRIPE_SETUP.md` → Subscription Webhooks):

```
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...   # from the stripe-webhook endpoint
```

**Secrets:** copy `.env.functions.example` → `.env.functions`, fill in the values, then run with `--with-secrets` (or run `supabase secrets set --env-file .env.functions` once). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform — never set them yourself.

The Resend email queue (`send-email`) needs these extra secrets:

```
RESEND_API_KEY=re_...                          # Resend API key
EMAIL_FROM="Porchivo <noreply@porchivo.com>"   # verified Resend sender
EMAIL_FN_SECRET=<long-random-string>           # shared secret guarding the function
DAILY_EMAIL_CAP=100                            # optional, defaults to 100 (free-tier cap)
```

## Step 2b — Schedule the email queue drainer

The `send-email` function queues and sends transactional email via Resend with
automatic retry/backoff. Queued jobs drain when the `process` action runs, so it
must be invoked on a timer. `email-queue-cron.sql` (bundled in
`master-deploy.sql`) handles this automatically: it defines a `drain_email_queue()`
function and a pg_cron job that runs it every minute. Just enable
**Database → Extensions → pg_cron** before (or right after) running the master
file — no project ref or secret to paste in.

The cron job reads its target URL and `EMAIL_FN_SECRET` from the same
`app_config` rows the welcome trigger uses (see Step 2c), so configuring those
once wires up both. Until they exist the drainer no-ops safely. The schedule is
idempotent — re-running the master file re-creates it cleanly.

Enqueue an email from any server-side code (Edge Function, DB trigger, or HTTP)
by calling the `enqueue_email` RPC, or POSTing `{ "action": "enqueue", ... }` to
the function with the `x-email-secret` header. The drainer respects
`DAILY_EMAIL_CAP`, so anything over the free-tier limit stays queued and sends
the next day instead of being dropped.

## Step 2c — Enable the welcome email on signup

`welcome-email-trigger.sql` (bundled in `master-deploy.sql`) adds a trigger on
`auth.users` that sends every new user a branded welcome email through the
`send-email` `branded` template — so it carries the porchivo.com/guide Field
Guide link automatically. The trigger reads its target URL and secret from a
private `app_config` table; populate it once after deploy:

```sql
insert into public.app_config (key, value) values
  ('functions_base_url', 'https://<your-ref>.supabase.co/functions/v1'),
  ('email_fn_secret',    '<EMAIL_FN_SECRET>')
on conflict (key) do update set value = excluded.value;
```

Until both rows exist the trigger no-ops (it never blocks a signup). Use the
same `EMAIL_FN_SECRET` value you set as the function secret above.

## Step 3 — Wire up external webhooks

After deploy, point your providers at the public webhook URLs printed by the script:

```
https://<your-ref>.supabase.co/functions/v1/connect-webhook       # Stripe Connect
https://<your-ref>.supabase.co/functions/v1/verification-webhook  # identity verification
https://<your-ref>.supabase.co/functions/v1/revenuecat-webhook    # RevenueCat
https://<your-ref>.supabase.co/functions/v1/stripe-webhook        # Stripe subscriptions (invoice.paid, invoice.payment_failed, customer.subscription.deleted, checkout.session.completed)
```

## Security gateway

`security-gateway-migration.sql` (run it after the master file, or rebuild `master-deploy.sql` with `python build-master.py`) provisions the hardened API gateway infrastructure:

- `idempotency_keys` — 24h replay cache for creating POSTs (`Idempotency-Key` header required)
- `stripe_processed_events` — Stripe webhook event-id idempotency ledger
- `security_events` — rate-limit breaches, auth failures, cross-context denials (super_admin read-only)
- `get_gateway_auth_context()` — DB-authoritative role + enrolled contexts (JWT claims are never trusted)
- widens `package_log_items.status` with a `pending` pre-arrival state

The `api-gateway` function exposes the hardened data routes:

```
GET  /functions/v1/api-gateway/packages              # list (context-scoped)
POST /functions/v1/api-gateway/packages              # create (staff, Idempotency-Key required)
GET  /functions/v1/api-gateway/packages/:id          # fetch one (ownership enforced, 403 never 404)
POST /functions/v1/api-gateway/packages/:id/status   # ONLY way to change status (strict machine)
```

Status machine (API statuses): `pending → arrived → held/picked_up/returned`, `held → picked_up/returned`, any → `lost` (manager/admin only). Invalid transitions return 422. Rate limits: 60 req/min per user, 20/min for mutations, 10/min per IP unauthenticated.

## Cleanup — orphaned `expire-grants` function (done)

A legacy `expire-grants` Edge Function existed from an earlier architecture where
pg_cron called it via `net.http_post` to revoke expired `trust_doc_grants`. The
system was later refactored so the cron job (`trust-expire-grants-hourly`) calls
`public.trust_expire_grants()` directly — a pure SQL `UPDATE` with no network
hop, no vault reference, and no Edge Function call. The audit trigger on
`trust_doc_grants` logs `grant_expired` automatically when `revoked_at` flips.

The old `expire-grants` function was **orphaned** (nothing invoked it) and has
been deleted from Supabase. It is NOT in `supabase/functions/` and is NOT listed
in `deploy-functions.sh`. The original `schedule_expire_grants_cron` migration
that referenced `vault.decrypted_secrets` is historical dead code that was never
part of `master-deploy.sql` — it partially failed at deploy time and the cron job
was re-registered with the new command later. No action needed for either.

## Re-running

Both steps are upserts: the master migration uses idempotent guards, and `functions deploy` redeploys the latest code. Run Step 1 then Step 2 anytime to sync a new environment or push updates.
