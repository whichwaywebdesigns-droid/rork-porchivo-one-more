#!/usr/bin/env bash
# =============================================================
# PORCHIVO · ONE-SHOT EDGE FUNCTION DEPLOY
# =============================================================
# Deploys every Supabase Edge Function in one pass and (optionally)
# pushes the function secrets they need. Safe to re-run — `supabase
# functions deploy` upserts, so running again just redeploys the
# latest code.
#
# PREREQUISITES
#   1. Supabase CLI installed:  https://supabase.com/docs/guides/cli
#   2. Logged in:               supabase login
#   3. Project linked once:     supabase link --project-ref <your-ref>
#      (find <your-ref> in Dashboard -> Project Settings -> General)
#
# USAGE
#   cd supabase
#   ./deploy-functions.sh                # deploy all functions
#   ./deploy-functions.sh --with-secrets # also push secrets from .env.functions
#
# NOTE: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
# injected automatically by the platform — never set those yourself.
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

# --- Functions that must stay PUBLIC (no JWT) because external services
#     (Stripe, RevenueCat) call them directly with their own signatures. ---
NO_JWT_FUNCTIONS=(
  "connect-webhook"
  "verification-webhook"
  "revenuecat-webhook"
  "stripe-webhook"      # Stripe subscription events: verified via stripe-signature
  "send-email",          # server-to-server: protected by x-email-secret header
  "support-ticket-ai-draft"   # DB trigger fires pg_net POSTs; bearer-token auth
)

# --- Everything else is deployed with default JWT verification. ---
JWT_FUNCTIONS=(
  "api-gateway"          # hardened data gateway: packages + status machine
  "compile-invoice-period"
  "create-assignment"
  "create-connect-account"
  "initiate-verification"
  "partner-payout"
  "send-notification"
  "track-shipment",
  "dev-confirm-user"          # dev-only QA tool (anon-key check)
)

is_no_jwt() {
  local name="$1"
  for f in "${NO_JWT_FUNCTIONS[@]}"; do
    [[ "$f" == "$name" ]] && return 0
  done
  return 1
}

push_secrets() {
  if [[ ! -f ".env.functions" ]]; then
    echo "!! .env.functions not found — copy .env.functions.example, fill it in, and re-run." >&2
    exit 1
  fi
  echo ">> Pushing function secrets from .env.functions"
  supabase secrets set --env-file .env.functions
}

main() {
  if [[ "${1:-}" == "--with-secrets" ]]; then
    push_secrets
  fi

  echo ">> Deploying public (no-JWT) webhook functions"
  for fn in "${NO_JWT_FUNCTIONS[@]}"; do
    echo "   - $fn (--no-verify-jwt)"
    supabase functions deploy "$fn" --no-verify-jwt
  done

  echo ">> Deploying authenticated functions"
  for fn in "${JWT_FUNCTIONS[@]}"; do
    echo "   - $fn"
    supabase functions deploy "$fn"
  done

  echo ""
  echo "Done. Deployed ${#NO_JWT_FUNCTIONS[@]} webhook + ${#JWT_FUNCTIONS[@]} authenticated functions."
  echo "Webhook URLs (give these to Stripe / RevenueCat):"
  for fn in "${NO_JWT_FUNCTIONS[@]}"; do
    echo "   https://<your-ref>.supabase.co/functions/v1/$fn"
  done
}

main "$@"
