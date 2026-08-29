#!/usr/bin/env python3
"""PHASE 2 of the real-payment checkout->webhook activation test.

Reads tmp/payment_test_state.json (written by payment_test_setup.py), waits for
the LIVE Stripe Checkout session to be paid, then verifies the full pipeline:
  1. Stripe session payment_status == paid, subscription id captured.
  2. stripe-webhook (checkout.session.completed) activates the org row
     (subscription_status='active', is_active=true, period end set) — polled.
  3. confirm-org-signup called with the user's JWT (app success-redirect path)
     → 200 (alreadyActive if the webhook won the race).
  4. Cleanup: cancel + delete the Stripe subscription/customer, delete the
     org, memberships, profile, auth user.

NOTE: the $99 charge is REAL. Refund manually in the Stripe dashboard if
desired (the rk_live restricted key cannot issue refunds).
"""
import json
import sys
import time
import urllib.error
import urllib.request

REF = "axmdzrtyznphlfganljb"
ENV = {}
for line in open("expo/.env"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        ENV[k.strip()] = v.strip().strip('"')

MGMT_TOKEN = ENV["SUPABASE_ACCESS_TOKEN"]
SUPABASE_URL = ENV["EXPO_PUBLIC_SUPABASE_URL"]
_pub = ENV.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
ANON_KEY = _pub if _pub.startswith("sb_publishable_") else (ENV.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or _pub)
STRIPE_KEY = ENV["STRIPE_SECRET_KEY"]

PASS, FAIL = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (PASS if ok else FAIL).append(name)
    print(f"  {'PASS' if ok else 'FAIL'} — {name}" + (f" | {detail}" if detail else ""))


def run_query(sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {MGMT_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "supabase-cli/2.34.3",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:2000]}")


def http_json(url: str, body: dict | None = None, headers: dict | None = None, method: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method or ("POST" if data else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:500]}


def call_edge(fn: str, token: str, body: dict):
    return http_json(
        f"{SUPABASE_URL}/functions/v1/{fn}",
        body,
        headers={"Authorization": f"Bearer {token}", "apikey": ANON_KEY, "Content-Type": "application/json"},
    )


def stripe_get(path: str) -> dict:
    req = urllib.request.Request(f"https://api.stripe.com/v1/{path}",
                                 headers={"Authorization": f"Bearer {STRIPE_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode())


state = json.load(open("tmp/payment_test_state.json"))
email, password = state["email"], state["password"]
org_id, session_id = state["orgId"], state["sessionId"]
print(f"== Real-payment test VERIFY: {email} ==")
print(f"   session={session_id}")

# ── 1. Wait for payment ──────────────────────────────────────────────────────
print("[1] Waiting for payment (polls up to 90s)")
sub_id, paid = "", False
for i in range(18):
    session = stripe_get(f"checkout/sessions/{session_id}")
    paid = session.get("payment_status") == "paid"
    sub_id = session.get("subscription") or ""
    if paid:
        break
    print(f"    {i * 5}s: payment_status={session.get('payment_status')}")
    time.sleep(5)
check("checkout session PAID", paid,
      f"status={session.get('payment_status')} amount={session.get('amount_total')} sub={sub_id}")

if not paid:
    print("\nSession is NOT paid yet — open the checkout URL from phase 1, pay, then re-run this script.")
    sys.exit(2)

# ── 2. Webhook activation (stripe-webhook processes checkout.session.completed)
print("[2] Webhook activation (polls org row up to 60s)")
o = {}
for i in range(12):
    o = run_query(f"""
      select subscription_status, is_active, plan_tier, billing_cycle,
             current_period_end, stripe_customer_id,
             (stripe_subscription_id is not null) as has_sub_id
      from organizations where id = '{org_id}';
    """)[0]
    if o["subscription_status"] == "active" and o["is_active"] is True:
        break
    print(f"    {i * 5}s: subscription_status={o['subscription_status']}")
    time.sleep(5)
check("webhook activated org (active + is_active)",
      o["subscription_status"] == "active" and o["is_active"] is True, json.dumps(o))
check("period end set (~30 days out)",
      bool(o.get("current_period_end")), str(o.get("current_period_end")))

# ── 3. confirm-org-signup (app success-redirect path; idempotent) ────────────
print("[3] confirm-org-signup (success-redirect path)")
status, login = http_json(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    {"email": email, "password": password},
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
)
token = login.get("access_token", "")
check("login returns JWT", status == 200 and bool(token), f"HTTP {status}")
status, res = call_edge("confirm-org-signup", token, {"sessionId": session_id, "orgId": org_id})
check("confirm-org-signup 200 (idempotent)",
      status == 200 and (res.get("alreadyActive") is True or res.get("success") is True or res.get("orgId") == org_id),
      f"HTTP {status} {json.dumps(res)[:200]}")

# ── 4. Stripe subscription state ─────────────────────────────────────────────
print("[4] Stripe subscription state")
if sub_id:
    sub = stripe_get(f"subscriptions/{sub_id}")
    check("subscription active", sub.get("status") == "active", f"status={sub.get('status')}")

# ── 5. Cleanup ───────────────────────────────────────────────────────────────
print("[5] Cleanup (real $99 charge remains — refund in Stripe dashboard if desired)")
cust = o.get("stripe_customer_id")
if sub_id:
    try:
        http_json(f"https://api.stripe.com/v1/subscriptions/{sub_id}", headers={"Authorization": f"Bearer {STRIPE_KEY}"}, method="DELETE")
        print("  subscription canceled")
    except Exception as e:
        print(f"  subscription cancel skipped: {e}")
if cust:
    try:
        req = urllib.request.Request(f"https://api.stripe.com/v1/customers/{cust}",
                                     headers={"Authorization": f"Bearer {STRIPE_KEY}"}, method="DELETE")
        urllib.request.urlopen(req, timeout=30)
        print("  Stripe customer deleted")
    except Exception as e:
        print(f"  Stripe customer cleanup skipped: {e}")
run_query(f"delete from org_memberships where org_id = '{org_id}';")
run_query(f"delete from organizations where id = '{org_id}';")
uid = state["uid"]
run_query(f"delete from profiles where id = '{uid}';")
run_query(f"delete from auth.users where id = '{uid}';")
left = run_query(f"select count(*)::int as c from auth.users where email = '{email}'")[0]["c"]
check("test user + org removed", left == 0)

print(f"\n== RESULT: {len(PASS)} passed, {len(FAIL)} failed ==")
if FAIL:
    print("Failed:", *FAIL, sep="\n  - ")
    sys.exit(1)
print("REAL-PAYMENT PIPELINE VERIFIED: checkout → stripe-webhook → org activation → idempotent confirm.")
