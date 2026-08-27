#!/usr/bin/env python3
"""Seed reviewer@porchivo.com with an active hoa_admin org membership + demo data."""
import json
import sys
import urllib.request
import urllib.error

REF = "axmdzrtyznphlfganljb"
TOKEN = [l.split("=", 1)[1].strip().strip('"') for l in open("expo/.env") if l.startswith("SUPABASE_ACCESS_TOKEN=")][0]


def run_query(sql: str) -> list:
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


if __name__ == "__main__":
    sql = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    print(json.dumps(run_query(sql), indent=2, default=str)[:6000])
