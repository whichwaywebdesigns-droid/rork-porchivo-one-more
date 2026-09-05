import json, os, urllib.request
tok = ""
with open("../expo/.env") as f:
    for line in f:
        if line.startswith("SUPABASE_ACCESS_TOKEN="):
            tok = line.strip().split("=",1)[1]
proj = "axmdzrtyznphlfganljb"
def sql(q):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{proj}/database/query",
        data=json.dumps({"query": q}).encode(),
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())
rows = sql("select template_slug, status, reference_number, provider_message_id, left(coalesce(last_error,''),120) as err, sent_at from email_sends order by created_at desc limit 15")
for r in rows: print(json.dumps(r))
print("---queue---")
q = sql("select id, status, attempts, left(coalesce(last_error,''),100) as err, created_at from email_queue where metadata->>'template_id' is not null order by created_at desc limit 10")
for r in q: print(json.dumps(r))
