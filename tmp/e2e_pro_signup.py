#!/usr/bin/env python3
"""End-to-end test of a Professional org signup (2026-08-28 B2B features).

Flow tested against LIVE backend (project axmdzrtyznphlfganljb):
  1. Create + confirm a dedicated test user (not the reviewer account).
  2. Password login -> JWT.
  3. create-org-checkout (professional / monthly) -> expect 200, sessionId,
     orgId, plan.onboardingFeeCents=50000.
  4. Verify the pending organizations row (max_communities=3, fee=50000,
     stripe_customer_id set).
  5. Retrieve the Stripe Checkout session via the Stripe API (the hosted page
     is JS-rendered, so HTML scraping proves nothing) -> expect $499.00
     recurring + $500.00 one-time onboarding line items.
  6. confirm-org-signup with the UNPAID session -> expect 402 guard.
  7. Resident membership present -> second org attempt -> expect 409.
  8. Staff (hoa_admin) membership, community plan (cap 1) with 1 administered
     org -> expect 403 upgrade message.
  9. Cleanup: delete org, memberships, profile, auth user.

Stripe side effects that remain in LIVE mode (harmless): 1 customer, 1
uncompleted checkout session (expires in 24h, never charged).
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
# Legacy anon JWT keys were disabled on this project (2026-07-12) — the
# publishable key (sb_publishable_...) is the live one. Prefer it.
_pub = ENV.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
ANON_KEY = _pub if _pub.startswith("sb_publishable_") else (
    ENV.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or _pub
)

TEST_EMAIL = f"e2e-pro-{int(time.time())}@porchivo.test"
TEST_PASSWORD = "E2e-Pro-Signup-2026!"
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
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
        },
    )


print(f"== E2E Professional signup: {TEST_EMAIL} ==")

# ── 0. Clean up any leftover probe users from earlier crashed runs ──────────
run_query("delete from profiles where email like 'e2e-pro-%@porchivo.%' or email like 'dbg-probe-%@porchivo.%';")
run_query("delete from auth.users where email like 'e2e-pro-%@porchivo.%' or email like 'dbg-probe-%@porchivo.%';")

# ── 1. Create test user via GoTrue signup (proper identities row) ───────────
# Manually INSERTing into auth.users breaks GoTrue's password grant (500
# "Database error querying schema"), so create the user through the public
# signup API and confirm the email via SQL instead.
print("[1] Create test user via /auth/v1/signup")
status, res = http_json(
    f"{SUPABASE_URL}/auth/v1/signup",
    {"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
)
check("signup accepted", status in (200, 201) or (status == 400 and "registered" in res.get("msg", "")),
      f"HTTP {status} {json.dumps(res)[:200]}")
uid_rows = run_query(f"select id from auth.users where email = '{TEST_EMAIL}'")
uid = uid_rows[0]["id"] if uid_rows else ""
run_query(f"update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = '{uid}';")
run_query(f"""
  insert into profiles (id, email, name, is_onboarded)
  values ('{uid}', '{TEST_EMAIL}', 'E2E Pro Tester', true)
  on conflict (id) do update set name = 'E2E Pro Tester', is_onboarded = true;
""")
check("user confirmed + profile ready", bool(uid))

# ── 2. Login ─────────────────────────────────────────────────────────────────
print("[2] Password login")
status, login = http_json(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    {"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
)
token = login.get("access_token", "")
check("login returns JWT", status == 200 and bool(token), f"HTTP {status}")

# ── 3. create-org-checkout: professional / monthly ───────────────────────────
print("[3] create-org-checkout (professional, monthly)")
status, res = call_edge("create-org-checkout", token, {
    "name": "E2E Professional Test Org",
    "type": "hoa",
    "address": "1 Test Way",
    "city": "Testville",
    "state": "TX",
    "zip": "73301",
    "totalUnits": 120,
    "planTier": "professional",
    "billingCycle": "monthly",
    "returnUrl": "porchivo://org-signup/success",
})
check("checkout created (HTTP 200)", status == 200, f"HTTP {status} {json.dumps(res)[:300]}")
org_id = res.get("orgId", "")
session_id = res.get("sessionId", "")
checkout_url = res.get("checkoutUrl", "")
plan = res.get("plan", {})
check("plan payload fee = 50000", plan.get("onboardingFeeCents") == 50000, json.dumps(plan))
check("returned sessionId + orgId + checkoutUrl",
      bool(org_id) and bool(session_id) and checkout_url.startswith("https://checkout.stripe.com/"))

# ── 4. Verify pending org row ────────────────────────────────────────────────
print("[4] organizations row")
rows = run_query(f"""
  select name, plan_tier, billing_cycle, subscription_status, is_active,
         max_communities, onboarding_fee_cents, max_units,
         (stripe_customer_id is not null) as has_customer,
         admin_user_id = '{uid}' as admin_ok
  from organizations where id = '{org_id}';
""")
o = rows[0] if rows else {}
check("pending, inactive, admin = test user",
      o.get("subscription_status") == "pending" and o.get("is_active") is False and o.get("admin_ok") is True,
      json.dumps(o))
check("max_communities=3, fee=50000, max_units=500",
      o.get("max_communities") == 3 and o.get("onboarding_fee_cents") == 50000 and o.get("max_units") == 500)

# ── 5. Stripe Checkout session line items (via Stripe API — the hosted page is
#      JS-rendered, so scraping its HTML proves nothing) ────────────────────
print("[5] Stripe Checkout session line items (Stripe API)")
req = urllib.request.Request(
    f"https://api.stripe.com/v1/checkout/sessions/{session_id}?expand%5B%5D=line_items.data.price.product",
    headers={"Authorization": f"Bearer {ENV['STRIPE_SECRET_KEY']}"},
)
session = json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
lis = session.get("line_items", {}).get("data", [])
check("subscription mode, unpaid", session.get("mode") == "subscription" and session.get("payment_status") == "unpaid",
      f"mode={session.get('mode')} payment={session.get('payment_status')}")
check("subscription line item $499.00/month",
      any(li["price"]["unit_amount"] == 49900 and (li["price"].get("recurring") or {}).get("interval") == "month" for li in lis))
check("onboarding fee line item $500.00 one-time",
      any(li["price"]["unit_amount"] == 50000 and not li["price"].get("recurring") for li in lis))
names = [(li["price"].get("product") or {}).get("name", "") for li in lis]
check("line item names (Professional + Onboarding)",
      any("Professional" in n for n in names) and any("Onboarding" in n for n in names), str(names))

# ── 6. Unpaid session must NOT activate ──────────────────────────────────────
print("[6] confirm-org-signup on UNPAID session")
status, res = call_edge("confirm-org-signup", token, {"sessionId": session_id, "orgId": org_id})
check("402 payment guard", status == 402 and res.get("error") == "Payment not completed",
      f"HTTP {status} {json.dumps(res)[:200]}")
st = run_query(f"select subscription_status, is_active from organizations where id = '{org_id}'")[0]
check("org still pending after 402", st["subscription_status"] == "pending" and st["is_active"] is False)

# ── 7. Resident membership -> 409 ────────────────────────────────────────────
print("[7] resident membership blocks org creation (409)")
run_query(f"""
  insert into org_memberships (user_id, org_id, status, joined_at)
  values ('{uid}', '{org_id}', 'active', now());
""")
status, res = call_edge("create-org-checkout", token, {
    "name": "E2E Should Not Exist", "type": "condo",
    "planTier": "starter", "billingCycle": "monthly",
})
check("409 resident single-community rule",
      status == 409 and "already a member" in res.get("error", ""),
      f"HTTP {status} {json.dumps(res)[:200]}")
extra_orgs = run_query(f"select count(*)::int as c from organizations where admin_user_id = '{uid}'")[0]["c"]
check("no org created by 409 attempt", extra_orgs == 1)

# ── 8. Staff + community plan cap -> 403 ─────────────────────────────────────
print("[8] community plan (cap 1) with 1 administered org -> 403")
run_query(f"delete from org_memberships where user_id = '{uid}';")
run_query(f"""
  insert into org_memberships (user_id, org_id, role, status, joined_at)
  values ('{uid}', '{org_id}', 'hoa_admin', 'active', now());
""")
status, res = call_edge("create-org-checkout", token, {
    "name": "E2E Should Not Exist 2", "type": "condo",
    "planTier": "community", "billingCycle": "monthly",
})
check("403 cap enforcement w/ upgrade message",
      status == 403 and "up to 1 community" in res.get("error", ""),
      f"HTTP {status} {json.dumps(res)[:200]}")
extra_orgs = run_query(f"select count(*)::int as c from organizations where admin_user_id = '{uid}'")[0]["c"]
check("no org created by 403 attempt", extra_orgs == 1)

# ── 9. Cleanup ───────────────────────────────────────────────────────────────
print("[9] Cleanup")
# Best-effort: delete the live Stripe test customer (ignore failures)
try:
    cust = run_query(f"select stripe_customer_id from organizations where id = '{org_id}'")[0]["stripe_customer_id"]
    if cust:
        req = urllib.request.Request(f"https://api.stripe.com/v1/customers/{cust}",
                                     headers={"Authorization": f"Bearer {ENV['STRIPE_SECRET_KEY']}"}, method="DELETE")
        urllib.request.urlopen(req, timeout=30)
        print("  Stripe test customer deleted")
except Exception as e:
    print(f"  Stripe customer cleanup skipped: {e}")
run_query(f"delete from org_memberships where user_id = '{uid}';")
run_query(f"delete from organizations where id = '{org_id}';")
run_query(f"delete from profiles where id = '{uid}';")
run_query(f"delete from auth.users where id = '{uid}';")
left = run_query(f"select count(*)::int as c from auth.users where email = '{TEST_EMAIL}'")[0]["c"]
check("test user + org removed", left == 0)

print(f"\n== RESULT: {len(PASS)} passed, {len(FAIL)} failed ==")
if FAIL:
    print("Failed:", *FAIL, sep="\n  - ")
    sys.exit(1)
