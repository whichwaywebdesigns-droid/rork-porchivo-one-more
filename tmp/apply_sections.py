#!/usr/bin/env python3
"""Split master-deploy.sql into per-migration sections and apply each in order.

Each Management API call runs in its own transaction, so a failed section
rolls back only itself; we log the failure and continue.
"""
import json
import re
import sys
import urllib.error
import urllib.request

REF = "axmdzrtyznphlfganljb"
TOKEN = None
with open("expo/.env") as f:
    for line in f:
        if line.startswith("SUPABASE_ACCESS_TOKEN="):
            TOKEN = line.split("=", 1)[1].strip().strip('"')
            break

def run_query(sql: str):
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

def split_sections(path: str):
    with open(path) as f:
        lines = f.readlines()
    sections = []  # (name, sql)
    current_name, current = "_header", []
    for line in lines:
        m = re.match(r"^-- ##\s+(.+?)\s*$", line)
        if m:
            if current:
                sections.append((current_name, "".join(current)))
            current_name, current = m.group(1), []
        else:
            current.append(line)
    if current:
        sections.append((current_name, "".join(current)))
    return sections

if __name__ == "__main__":
    failures = []
    for name, sql in split_sections("supabase/master-deploy.sql"):
        if name == "_header":
            continue
        print(f"=== {name} ({len(sql)}b)", flush=True)
        try:
            run_query(sql)
            print(f"    OK", flush=True)
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:400]
            print(f"    FAILED: {body}", flush=True)
            failures.append((name, body))
        except Exception as e:  # noqa: BLE001
            print(f"    ERROR: {e}", flush=True)
            failures.append((name, str(e)))
    print(f"\nSUMMARY: {len(failures)} failed sections", flush=True)
    for name, err in failures:
        print(f"  - {name}: {err[:200]}", flush=True)
    print("DONE", flush=True)
