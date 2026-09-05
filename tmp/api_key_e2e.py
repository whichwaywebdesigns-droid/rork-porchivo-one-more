#!/usr/bin/env python3
"""End-to-end API key lifecycle test against PRODUCTION api-gateway.

Steps:
  1. Mint a real pvk_live_ key (32B -> base64url, same shape the portal generates).
  2. Insert (hash, prefix) into api_keys via Management API, created_by = reviewer uid.
  3. GET /packages with Bearer key        -> expect 200 + package list.
  4. Verify last_used_at was stamped.
  5. Revoke (UPDATE revoked_at)           -> audit-trail revoke, no delete.
  6. GET /packages again                  -> expect 401.
"""
import base64
import hashlib
import json
import os
import time
import urllib.request
import urllib.error

REF = "axmdzrtyznphlfganljb"
GATEWAY = f"https://{REF}.supabase.co/functions/v1/api-gateway"
TOKEN = [l.split("=", 1)[1].strip().strip('"') for l in open("expo/.env") if l.startswith("SUPABASE_ACCESS_TOKEN=")][0]
ORG_NAME = "Willow Creek Homeowners Association"
CREATED_BY = "09f943a1-afbb-4a32-be6c-c9530cc518e2"  # reviewer@porchivo.com


def sql_lit(v: str) -> str:
    """Postgres single-quoted string literal."""
    return "'" + v.replace("'", "''") + "'"


def mgmt_sql(sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
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


def gateway(path: str, key: str | None = None):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(f"{GATEWAY}{path}", headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode()[:600]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]


# ── 1. Mint key exactly like the portal does ─────────────────────────────────
raw = os.urandom(32)
secret = base64.urlsafe_b64encode(raw).decode().rstrip("=")
key = f"pvk_live_{secret}"
key_hash = hashlib.sha256(key.encode()).hexdigest()
key_prefix = key[:13]
print(f"[1] minted key: {key}")
print(f"    sha256: {key_hash}")

# ── 2. Insert row (service-side; RLS bypassed via Management API) ────────────
rows = mgmt_sql(
    f"select id from organizations where name = {sql_lit(ORG_NAME)} limit 1;"
)
if not rows:
    raise SystemExit("org not found")
org_id = rows[0]["id"]
name = "E2E Lifecycle Test Key"
mgmt_sql(
    "insert into api_keys (org_id, name, key_hash, key_prefix, created_by) "
    f"values ({sql_lit(org_id)}, {sql_lit(name)}, {sql_lit(key_hash)}, {sql_lit(key_prefix)}, {sql_lit(CREATED_BY)}) returning id;"
)
print(f"[2] inserted row (org {org_id[:8]}…, prefix {key_prefix}…)")

# ── 3. Call the gateway WITH the key ─────────────────────────────────────────
status, body = gateway("/packages", key)
print(f"[3] GET /packages with key -> HTTP {status}")
print(f"    body: {body}")
assert status == 200, "expected 200 with valid key"

# ── 4. last_used_at stamped? ─────────────────────────────────────────────────
rows = mgmt_sql(
    f"select last_used_at, revoked_at from api_keys where key_hash = {sql_lit(key_hash)};"
)
row = rows[0]
print(f"[4] last_used_at = {row['last_used_at']}, revoked_at = {row['revoked_at']}")
assert row["last_used_at"] is not None, "last_used_at not stamped"

# ── 5. Revoke ────────────────────────────────────────────────────────────────
mgmt_sql(
    f"update api_keys set revoked_at = now() where key_hash = {sql_lit(key_hash)} returning revoked_at;"
)
print("[5] revoked (revoked_at set — row kept for audit trail)")

# ── 6. Same key must now fail ────────────────────────────────────────────────
status, body = gateway("/packages", key)
print(f"[6] GET /packages with revoked key -> HTTP {status}")
print(f"    body: {body}")
assert status == 401, "expected 401 after revoke"

print("\nE2E PASS ✅  mint → 200 → last_used_at stamped → revoke → 401")
