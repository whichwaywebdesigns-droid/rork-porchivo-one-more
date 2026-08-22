#!/usr/bin/env python3
"""Apply a SQL file to the Porchivo Supabase project via the Management API."""
import json
import sys
import urllib.request

REF = "axmdzrtyznphlfganljb"
TOKEN = None
with open("expo/.env") as f:
    for line in f:
        if line.startswith("SUPABASE_ACCESS_TOKEN="):
            TOKEN = line.split("=", 1)[1].strip().strip('"')
            break

def run_query(sql: str) -> dict:
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
    with urllib.request.urlopen(req, timeout=280) as resp:
        return json.loads(resp.read().decode())

if __name__ == "__main__":
    path = sys.argv[1]
    with open(path) as f:
        sql = f.read()
    print(f"Applying {path} ({len(sql)} bytes)...", flush=True)
    try:
        result = run_query(sql)
        print(json.dumps(result)[:2000], flush=True)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:3000]
        print(f"HTTP {e.code}: {body}", flush=True)
        sys.exit(1)
    print("DONE", flush=True)
