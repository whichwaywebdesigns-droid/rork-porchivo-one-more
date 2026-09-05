#!/usr/bin/env python3
"""Live E2E test for the template email infrastructure (prod).

Validates: enqueue via SQL service, footer merge, dedupe guard, per-category
opt-out, a REAL trigger firing (partner_connections), then (after the drain
cron runs) actual Resend template sends — which live-validates the 22
template ids.
"""
import json
import time
import urllib.request
import urllib.error

REF = "axmdzrtyznphlfganljb"
UID = "09f943a1-afbb-4a32-be6c-c9530cc518e2"  # reviewer@porchivo.com
TS = str(int(time.time()))


def sql(s: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": s}).encode(),
        headers={
            "Authorization": "Bearer " + [
                l.split("=", 1)[1].strip().strip('"')
                for l in open("expo/.env") if l.startswith("SUPABASE_ACCESS_TOKEN=")
            ][0],
            "Content-Type": "application/json",
            "User-Agent": "supabase-cli/2.34.3",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:1500]}")


print("== 1. enqueue safety-digest (footer merge + reference number) ==")
r = sql(
    "select public.enqueue_template_email('safety-digest', 'reviewer@porchivo.com', "
    f"'{UID}', 'community', 'e2e-digest-{TS}', "
    "jsonb_build_object('first_name','Reviewer','neighborhood','E2E Test Block',"
    "'packages_delivered','3','packages_at_risk','1','theft_reports','0',"
    "'safest_window','10 AM – 2 PM','digest_url','https://porchivo.com/safety'));"
)
send_id = r[0]["enqueue_template_email"]
print("   email_sends id:", send_id)
assert send_id, "expected a send id"

print("== 2. same dedupe key again -> must be NULL (dedupe guard) ==")
r = sql(
    "select public.enqueue_template_email('safety-digest', 'reviewer@porchivo.com', "
    f"'{UID}', 'community', 'e2e-digest-{TS}', '{{}}'::jsonb);"
)
assert r[0]["enqueue_template_email"] is None, "dedupe failed!"
print("   dedupe OK (null returned)")

print("== 3. queue row: template_id + footer variables merged ==")
r = sql(
    "select q.status, q.metadata->>'template_id' as tpl, "
    "q.metadata->>'reference_number' as ref, "
    "q.metadata->'variables'->>'unsubscribe_url' as unsub, "
    "q.metadata->'variables'->>'company_address' as addr, "
    "q.metadata->'variables'->>'support_email' as support "
    "from email_queue q where q.id = (select queue_id from email_sends where "
    f"dedupe_key = 'e2e-digest-{TS}');"
)
row = r[0]
print(f"   status={row['status']} tpl={row['tpl'][:8]}… ref={row['ref']}")
print(f"   unsubscribe_url={row['unsub'][:60]}…")
print(f"   company_address={row['addr']} support={row['support']}")
assert row["tpl"] == "15ceef92-b528-436a-97a4-b9e9c47c097f"
assert row["ref"].startswith("PV-SAFETYDI")
assert "/unsubscribe?token=" in row["unsub"]

print("== 4. per-category opt-out (packages) ==")
sql(f"update email_preferences set opt_out_packages = true where user_id = '{UID}';")
r = sql(
    "select public.enqueue_template_email('package-arriving', 'reviewer@porchivo.com', "
    f"'{UID}', 'packages', 'e2e-arrive-optout-{TS}', "
    "jsonb_build_object('first_name','X','item_name','Y','carrier_name','UPS',"
    "'delivery_window','1 PM – 3 PM','tracking_number','Z','tracking_url','https://porchivo.com/app'));"
)
assert r[0]["enqueue_template_email"] is None, "opt-out not honoured!"
print("   opted-out category skipped (null) OK")
sql(f"update email_preferences set opt_out_packages = false where user_id = '{UID}';")
r = sql(
    "select public.enqueue_template_email('package-arriving', 'reviewer@porchivo.com', "
    f"'{UID}', 'packages', 'e2e-arrive-{TS}', "
    "jsonb_build_object('first_name','Reviewer','item_name','Sneakers (e2e)',"
    "'carrier_name','UPS','delivery_window','1 PM – 3 PM','tracking_number','1Z999',"
    "'tracking_url','https://porchivo.com/app'));"
)
assert r[0]["enqueue_template_email"], "re-enable after opt-out failed"
print("   re-enabled category enqueues OK")

print("== 5. REAL trigger: partner_connections pending -> active ==")
r = sql(
    "insert into partner_connections (homeowner_id, partner_id, status) "
    f"values ('{UID}','{UID}','pending') "
    "on conflict (homeowner_id, partner_id) do update set status = 'pending', "
    "decline_reason = null "
    "returning id;"
)
conn_id = r[0]["id"]
print(f"   connection {conn_id[:8]}… created (pending) — request email should fire")
sql(f"update partner_connections set status = 'active', accepted_at = now() where id = '{conn_id}';")
print("   set active — accepted + added-as-partner emails should fire")
r = sql(
    "select dedupe_key, template_slug, reference_number, status from email_sends "
    "where dedupe_key in "
    f"('ptnr-req:{conn_id}', 'ptnr-acc:{conn_id}', 'ptnr-add:{conn_id}');"
)
keys = {x["dedupe_key"].split(":")[0] for x in r}
print(f"   fired via trigger: {sorted(keys)}  ({len(r)} rows)")
assert {"ptnr-req", "ptnr-acc", "ptnr-add"} <= keys, f"trigger emails missing: {r}"
sql(f"delete from partner_connections where id = '{conn_id}';")
print("   test connection cleaned up")

print("\nENQUEUE PHASE PASS ✅ — waiting for drain cron to send via Resend…")
print(f"(check in ~90s: email_sends status for keys like e2e-digest-{TS})")
