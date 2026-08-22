#!/usr/bin/env python3
"""Pre-create tables from a master-deploy.sql section, then re-run sections.

Usage:
  python3 tmp/apply_fix.py tables <section>       # apply only CREATE TABLE stmts
  python3 tmp/apply_fix.py sections <s1> <s2> ...  # apply whole sections in order
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

def split_sections():
    with open("supabase/master-deploy.sql") as f:
        lines = f.readlines()
    sections = {}
    current_name, current = "_header", []
    for line in lines:
        m = re.match(r"^-- ##\s+(.+?)\s*$", line)
        if m:
            if current:
                sections[current_name] = "".join(current)
            current_name, current = m.group(1), []
        else:
            current.append(line)
    if current:
        sections[current_name] = "".join(current)
    return sections

def extract_create_tables(sql: str) -> list:
    """Extract full CREATE TABLE statements (balanced parens, case-insensitive)."""
    stmts = []
    pattern = re.compile(r"create\s+table\s+if\s+not\s+exists", re.IGNORECASE)
    i = 0
    n = len(sql)
    while i < n:
        m = pattern.search(sql, i)
        if not m:
            break
        # walk to the matching close paren of the column list, then the ';'
        depth = 0
        j = m.end()
        started = False
        while j < n:
            c = sql[j]
            if c == "(":
                depth += 1
                started = True
            elif c == ")":
                depth -= 1
            elif c == ";" and started and depth == 0:
                break
            j += 1
        stmts.append(sql[m.start():j + 1] + "\n")
        i = j + 1
    return stmts

if __name__ == "__main__":
    mode = sys.argv[1]
    sections = split_sections()
    if mode == "tables":
        name = sys.argv[2]
        stmts = extract_create_tables(sections[name])
        print(f"{len(stmts)} CREATE TABLE statements from {name}:", flush=True)
        for s in stmts:
            tname = re.search(r"public\.(\w+)", s)
            print(f"  - {tname.group(1) if tname else '?'}", flush=True)
        try:
            run_query("\n\n".join(stmts))
            print("OK", flush=True)
        except urllib.error.HTTPError as e:
            print(f"FAILED: {e.read().decode()[:500]}", flush=True)
            sys.exit(1)
    elif mode == "sections":
        failures = []
        for name in sys.argv[2:]:
            print(f"=== {name}", flush=True)
            try:
                run_query(sections[name])
                print("    OK", flush=True)
            except urllib.error.HTTPError as e:
                body = e.read().decode()[:400]
                print(f"    FAILED: {body}", flush=True)
                failures.append((name, body))
            except Exception as e:  # noqa: BLE001
                print(f"    ERROR: {e}", flush=True)
                failures.append((name, str(e)))
        print(f"\n{len(failures)} failed", flush=True)
        for name, err in failures:
            print(f"  - {name}: {err[:200]}", flush=True)
        print("DONE", flush=True)
