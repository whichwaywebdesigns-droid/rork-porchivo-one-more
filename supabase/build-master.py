#!/usr/bin/env python3
"""Build a single idempotent master deployment file from all Porchivo migrations.

Concatenates every migration in dependency order and rewrites non-idempotent
statements (CREATE POLICY / CREATE TRIGGER / bare CREATE TYPE) so the whole file
can be pasted into the Supabase SQL Editor in ONE pass — even on a database where
some migrations are already applied.
"""
import re
import sys

# Dependency-ordered migration list. Base tables first, then layers that
# reference them, then cross-cutting functions/triggers last.
ORDER = [
    "migration.sql",                          # profiles, shipments, notifications
    "hardened-rls.sql",                       # tighten base RLS
    "verification-notification-migration.sql",# loosen notifications schema
    "push-notification-trigger.sql",          # expo push via pg_net
    "rate-limit-migration.sql",
    "analytics-events-migration.sql",         # client funnel telemetry (referenced by hardened-rls + delete-account)
    "consent-tracking-migration.sql",         # versioned ToS/privacy consent audit trail
    "email-queue-migration.sql",        # Resend email queue + retry infra
    "welcome-email-trigger.sql",        # branded welcome email on signup
    "email-queue-cron.sql",            # pg_cron drainer that sends queued emails
    "subscription-entitlements-migration.sql",
    "amazon-orders-migration.sql",
    "chat-messages-migration.sql",
    "porch-partners-alerts-migration.sql",
    "partner-verification-migration.sql",     # partner_verifications, partner_assignments
    "idv-trigger-chain-migration.sql",         # trg_sync_idv_to_profile, trg_notify_idv_change (depends on partner_verifications + notifications)
    "invoicing-migration.sql",                # references partner_assignments
    "multi-context-migration.sql",            # organizations, properties, units, memberships
    "role-management-migration.sql",
    "announcements-v2-migration.sql",
    "announcement-variations-migration.sql",
    "resident-directory-migration.sql",
    "property-management-migration.sql",
    "rls-lockdown.sql",                       # close partner_verifications PII leak
    "package-ops-board-migration.sql",
    "admin-dashboard-migration.sql",
    "maintenance-requests-migration.sql",
    "org-payments-migration.sql",              # HOA dues/assessment ledger (Community Payments tab)
    "community-calendar-migration.sql",
    "incident-review-migration.sql",
    "community-analytics-migration.sql",
    "activity-audit-migration.sql",
    "security-gateway-migration.sql",         # idempotency, stripe events, security log (api-gateway)
    "onboarding-experiment-config.sql",       # experiment_config remote control surface
    "onboarding-experiment-results.sql",      # results/retention views (depends on config)
    "support-tickets-migration.sql",          # support_tickets + AI-drafted replies (references profiles + update_updated_at)
    "support-reply-templates-migration.sql",  # staff reply-templates library (references profiles + update_updated_at)
    "avatar-storage-migration.sql",           # public avatars bucket + owner-scoped Storage RLS
    "portfolio-vendors-branding-migration.sql", # org portfolio caps, brand_color, org_vendors
    "b2b-feature-gaps-migration.sql",          # org_documents + private org-documents bucket, org_amenities + reservations (Starter/Community tier gaps)
    "api-keys-migration.sql",                  # Enterprise API keys (api-gateway Bearer keys)
    "email-templates-migration.sql",           # 22 Resend templates: prefs, dedupe, triggers, jobs, referrals
    "org-billing-currency-migration.sql",      # organizations.billing_currency — MXN launch (Starter/Professional, IVA incluido)
    "delete-account-procedure.sql",           # references most tables — run last
    "add_apns_token.sql",                    # native iOS APNS token column on profiles
    "add_is_volunteer.sql",                  # volunteer partner flag + stats view rebuild
]

POLICY_RE = re.compile(
    r'create\s+policy\s+(?P<name>"[^"]+"|[a-zA-Z_]\w*)\s+on\s+(?P<table>[a-zA-Z_][\w.]*)',
    re.IGNORECASE,
)
TRIGGER_RE = re.compile(
    r'create\s+trigger\s+(?P<name>[a-zA-Z_]\w*)\b(?P<mid>[\s\S]*?)\bon\s+(?P<table>[a-zA-Z_][\w.]*)',
    re.IGNORECASE,
)
# Bare top-level CREATE TYPE ... AS ENUM (...);  (incident-review only)
TYPE_RE = re.compile(
    r'^CREATE\s+TYPE\s+(?P<name>[\w.]+)\s+AS\s+ENUM\b[\s\S]*?;',
    re.IGNORECASE | re.MULTILINE,
)


def _on_comment_line(sql: str, start: int) -> bool:
    """True if the match at `start` sits on a line that is SQL-commented (-- ...).
    Prevents rewriting commented-out CREATE POLICY/TRIGGER statements, which would
    otherwise inject a newline that strips the leading `-- ` and revives dead SQL."""
    line_start = sql.rfind("\n", 0, start) + 1
    return "--" in sql[line_start:start]


def make_policies_idempotent(sql: str) -> str:
    def repl(m: re.Match) -> str:
        if _on_comment_line(sql, m.start()):
            return m.group(0)
        return (
            f'DROP POLICY IF EXISTS {m.group("name")} ON {m.group("table")};\n'
            f'{m.group(0)}'
        )
    return POLICY_RE.sub(repl, sql)


def make_triggers_idempotent(sql: str) -> str:
    def repl(m: re.Match) -> str:
        if _on_comment_line(sql, m.start()):
            return m.group(0)
        return (
            f'DROP TRIGGER IF EXISTS {m.group("name")} ON {m.group("table")};\n'
            f'{m.group(0)}'
        )
    return TRIGGER_RE.sub(repl, sql)


def make_types_idempotent(sql: str) -> str:
    def repl(m: re.Match) -> str:
        body = m.group(0)
        indented = "\n".join("  " + line if line.strip() else line
                             for line in body.splitlines())
        return (
            "DO $$ BEGIN\n"
            f"{indented}\n"
            "EXCEPTION WHEN duplicate_object THEN null; END $$;"
        )
    return TYPE_RE.sub(repl, sql)


def main() -> int:
    parts: list[str] = []
    parts.append(
        "-- =============================================================\n"
        "-- PORCHIVO · MASTER SUPABASE DEPLOYMENT FILE  (AUTO-GENERATED)\n"
        "-- =============================================================\n"
        "-- Source: build-master.py  ·  do not hand-edit. Re-run the script\n"
        "-- after changing any individual migration:  python3 build-master.py\n"
        "--\n"
        "-- HOW TO USE\n"
        "--   1. Supabase Dashboard -> SQL Editor -> New query\n"
        "--   2. Paste this entire file and Run.\n"
        "--   3. (One-time) enable the pg_net extension if prompted\n"
        "--      Database -> Extensions -> pg_net -> Enable.\n"
        "--\n"
        "-- SAFE TO RE-RUN: policies, triggers, and enum types are guarded, and\n"
        "-- tables/indexes use IF NOT EXISTS. Running this on a partially-migrated\n"
        "-- database brings it fully up to date without erroring on existing objects.\n"
        "--\n"
        f"-- Bundles {len(ORDER)} migrations in dependency order.\n"
        "-- ============================================================="
    )

    for fname in ORDER:
        try:
            with open(fname, "r", encoding="utf-8") as fh:
                sql = fh.read()
        except FileNotFoundError:
            print(f"MISSING: {fname}", file=sys.stderr)
            return 1
        sql = make_policies_idempotent(sql)
        sql = make_triggers_idempotent(sql)
        sql = make_types_idempotent(sql)
        banner = (
            "\n\n\n-- #############################################################\n"
            f"-- ##  {fname}\n"
            "-- #############################################################\n"
        )
        parts.append(banner + sql.rstrip())

    out = "\n".join(parts) + "\n"
    with open("master-deploy.sql", "w", encoding="utf-8") as fh:
        fh.write(out)
    print(f"Wrote master-deploy.sql ({len(out)} bytes) from {len(ORDER)} migrations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
