#!/usr/bin/env python3
"""PHASE 1 of the real-payment checkout->webhook activation test.

Creates a fresh test user + pending org + a LIVE Stripe Checkout session for
the cheapest plan (Starter $99/mo, no onboarding fee) and prints the hosted
payment URL. Nothing is charged here — the session sits unpaid (expires 24h)
until the user completes payment with a real card.

State is saved to tmp/payment_test_state.json for tmp/payment_test_verify.py.
"""
import json
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

TEST_EMAIL = f"e2e-pay-{int(time.time())}@porchivo.test"
TEST_PASSWORD = "E2e-Pay-2026!"


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


def http_json(url: str, body: dict | None = None, headers: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data else "GET")
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


print(f"== Real-payment test setup: {TEST_EMAIL} ==")

# 0. Sweep leftovers from any earlier crashed run
run_query("delete from profiles where email like 'e2e-pay-%@porchivo.%';")
run_query("delete from auth.users where email like 'e2e-pay-%@porchivo.%';")

# 1. Test user via GoTrue signup + SQL email-confirm (manual INSERT breaks GoTrue)
status, res = http_json(
    f"{SUPABASE_URL}/auth/v1/signup",
    {"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
)
assert status in (200, 201) or (status == 400 and "registered" in res.get("msg", "")), (status, res)
uid = run_query(f"select id from auth.users where email = '{TEST_EMAIL}'")[0]["id"]
run_query(f"update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = '{uid}';")
run_query(f"""
  insert into profiles (id, email, name, is_onboarded)
  values ('{uid}', '{TEST_EMAIL}', 'E2E Pay Tester', true)
  on conflict (id) do update set name = 'E2E Pay Tester', is_onboarded = true;
""")
print(f"[1] user ready: {uid}")

# 2. Login JWT
status, login = http_json(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    {"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
)
token = login.get("access_token", "")
assert status == 200 and token, (status, login)
print("[2] login ok")

# 3. Checkout: Starter / monthly — cheapest live plan, no onboarding fee
status, res = call_edge("create-org-checkout", token, {
    "name": "E2E Payment Test Org",
    "type": "hoa",
    "address": "1 Payment Test Way",
    "city": "Testville",
    "state": "TX",
    "zip": "73301",
    "totalUnits": 20,
    "planTier": "starter",
    "billingCycle": "monthly",
    "returnUrl": "porchivo://org-signup/success",
})
assert status == 200, (status, res)
org_id, session_id, checkout_url = res["orgId"], res["sessionId"], res["checkoutUrl"]
print(f"[3] org={org_id} session={session_id}")
print(f"    url={checkout_url}")

# 4. Stripe API: session is subscription-mode, unpaid, $99.00/mo only
req = urllib.request.Request(
    f"https://api.stripe.com/v1/checkout/sessions/{session_id}?expand%5B%5D=line_items.data.price.product",
    headers={"Authorization": f"Bearer {ENV['STRIPE_SECRET_KEY']}"},
)
session = json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
lis = session.get("line_items", {}).get("data", [])
assert session["mode"] == "subscription" and session["payment_status"] == "unpaid"
assert any(li["price"]["unit_amount"] == 9900 and (li["price"].get("recurring") or {}).get("interval") == "month" for li in lis), lis
names = [(li["price"].get("product") or {}).get("name", "") for li in lis]
print(f"[4] Stripe session verified: subscription, unpaid, $99.00/mo, items={names}")

# 5. Org row pending
o = run_query(f"select subscription_status, is_active, max_communities, onboarding_fee_cents from organizations where id = '{org_id}'")[0]
assert o["subscription_status"] == "pending" and o["is_active"] is False
print(f"[5] org pending: {o}")

state = {
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "uid": uid,
    "orgId": org_id,
    "sessionId": session_id,
    "checkoutUrl": checkout_url,
    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}
with open("tmp/payment_test_state.json", "w") as f:
    json.dump(state, f, indent=2)
print("\nSTATE SAVED -> tmp/payment_test_state.json")
print("\n>>> PAY NOW (real card, $99.00 charged):")
print(checkout_url)
print("\nSession expires in 24h. After paying, tell the agent and run phase 2 (payment_test_verify.py).")
