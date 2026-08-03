# WhichWay — Compliance Automation Platform

---

## 1. Executive Vision

WhichWay Web Labs LLC is the parent company, and Porchivo is its flagship product — a platform handling resident PII, package delivery records, property access logs, and payment data across HOAs, condos, and multi-unit residential properties. Every one of those data classes carries compliance obligations. The moment Porchivo lands its first enterprise HOA or property-management contract, the buyer's security team will send a 200-question questionnaire and a vendor risk assessment. Today, WhichWay would answer that by hand, scrape together screenshots, and hope nothing has drifted by the time the auditor arrives.

**WhichWay** is a continuous compliance operating system that turns the existing stack — Supabase, GitHub Actions, Stripe, Expo, Edge Functions — into a live, self-documenting evidence pipeline. Instead of treating compliance as an annual panic, WhichWay monitors controls daily, collects evidence automatically, flags drift in real time, and produces an audit-ready dossier on demand. It also generates a public-facing Trust Center that lets prospective buyers self-serve the security review before they ever email your sales team.

The problem it solves is simple: Porchivo handles sensitive data in a regulated-adjacent space, and every enterprise deal will gate on proof of security. WhichWay makes that proof continuous, automated, and trustworthy — so compliance becomes a growth lever, not a bottleneck.

---

## 2. Product Naming

| # | Name | Positioning | Tone | Why it fits Porchivo |
|---|------|-------------|------|----------------------|
| 1 | **Sentinel** | The watchman for your stack — always on, always verifying | Calm, authoritative, protective | Evokes the porch-watch ethos of Porchivo itself; security as a sentinel over resident data |
| 2 | **Trustline** | Your continuous line of trust from code to customer | Direct, infrastructure-grade | Connects to Porchivo's trust-building mission with residents and property managers |
| 3 | **Aegis** | The shield between your startup and audit failure | Premium, mythic, enterprise | Matches Porchivo's shield iconography and security-first branding |
| 4 | **WhichWay** | The compliance layer native to Porchivo's stack | Product-extension, branded | Leverages existing brand equity; signals it's built for PropTech, not generic SaaS |
| 5 | **Clearline** | Compliance with nothing hidden — continuous, visible, honest | Transparent, modern, anti-corporate | Echoes Porchivo's "see every delivery, clearly" tagline; compliance should be clear, not opaque |

**Chosen name: WhichWay.** WhichWay Web Labs LLC is the parent company, and Porchivo is its first product. As the product line expands beyond Porchivo, the compliance platform carries the corporate brand forward. "WhichWay" is short, ownable, and signals directional clarity — your organization always knows where it stands on trust and compliance. It pairs naturally with Porchivo without feeling like a bolt-on, and it leaves room for future products under the same umbrella.

---

## 3. Ideal Customer Profile

### Primary Users
- **Founder / CTO at a lean SaaS startup** (1–20 people) handling sensitive user data who needs SOC 2 readiness without hiring a compliance officer. They live in GitHub, ship daily, and want compliance to be code-native, not spreadsheet-native.
- **Security-conscious PropTech / HOA-tech operators** who handle resident PII, access records, and payment data and need to prove trust to property-management buyers, HOA boards, and enterprise real-estate clients.

### Secondary Users
- **Virtual CISOs and compliance consultants** who manage multiple startup clients and want a unified dashboard to monitor all of them.
- **Enterprise buyer security teams** who consume the Trust Center to self-assess vendor risk before procurement.
- **Auditors** (CPA firms) who need read-only access to evidence vaults during an audit window.

### Buyers
- **Startup founders / CTOs** — purchase to unblock enterprise deals and reduce audit cost
- **VP Engineering / Head of Security at SMBs** — purchase to continuous-monitor without headcount
- **Property-tech company leadership** — purchase because buyer (HOA, property manager, enterprise real estate) demanded proof of security

### Use Cases
- **Startup SOC 2 Type I → Type II journey** — automate evidence collection from day one
- **PropTrust verification** — Porchivo-specific: prove RLS enforcement, PII access logging, and package-data isolation to HOA buyers
- **Vendor security questionnaire response** — AI-drafted answers from your actual control state, not a static template
- **Continuous RLS / policy monitoring** — detect when a Supabase migration weakens a policy before it reaches production
- **Mobile app store compliance posture** — track privacy nutrition labels, permission justifications, and data-handling disclosures across iOS/Android/web

---

## 4. Core Modules

### 4.1 Compliance Command Center
**What it does:** Single-screen dashboard showing your real-time compliance posture across all frameworks (SOC 2, HIPAA, ISO 27001, PCI, privacy reviews). Displays control health, evidence coverage, open risks, and days-to-audit-readiness.

**Why it matters:** Replaces the "where do we stand" panic with a live answer. The first screen a founder opens in the morning and the screen they show to buyers.

**Key workflows:** View posture by framework → drill into failing controls → see evidence gaps → assign remediation → track to closure.

**Data inputs:** Control definitions, evidence collection results, risk register, audit status, vendor assessments.

**Automations:** Daily control evaluation, drift detection, posture score recalculation, alert on control failure.

**Metrics/KPIs:** Overall compliance score, control pass rate, evidence freshness (avg age), open risks by severity, days-to-audit-ready.

---

### 4.2 Continuous Monitoring
**What it does:** Runs scheduled and event-driven checks against your actual infrastructure — Supabase RLS policies, GitHub branch protection, MFA enrollment, Stripe webhook signature verification, Edge Function security headers, expired secrets, disabled API keys.

**Why it matters:** Compliance is only valid at the moment of evidence collection. A policy change on Tuesday invalidates Monday's screenshot. Continuous monitoring catches drift before an auditor or attacker does.

**Key workflows:** Configure monitors per control → receive alerts on failure → view historical control state → export evidence timeline.

**Data inputs:** Supabase SQL queries (RLS policy state, role grants, table permissions), GitHub API (branch protection, required reviews, secret scanning), Stripe API (webhook config), Expo/EAS config, environment variable inventory.

**Automations:** Scheduled checks (hourly/daily/weekly), webhook-triggered checks (on Supabase migration deploy, on GitHub push, on Stripe config change), auto-evidence capture on pass.

**Metrics/KPIs:** Monitor coverage (%), mean time to detect (MTTD) control drift, control uptime (%), false positive rate.

---

### 4.3 Evidence Vault
**What it does:** Immutable, timestamped, hash-chained storage for every piece of compliance evidence — RLS policy snapshots, branch protection configs, MFA enrollment screenshots, access review exports, training completion records. Each artifact has provenance (who/what collected it, when, from where) and a content hash for tamper detection.

**Why it matters:** Auditors don't trust screenshots. They trust evidence with lineage. The Vault makes every artifact verifiable and exportable in audit-ready format.

**Key workflows:** Auto-collect evidence on monitor pass → manual upload for offline evidence → tag by framework/control → export dossier for auditor → verify hash chain integrity.

**Data inputs:** Monitor results, manual uploads, API snapshots, log exports.

**Automations:** Auto-collect on schedule, auto-tag by control mapping, auto-expire stale evidence (configurable TTL per control), hash verification on export.

**Metrics/KPIs:** Evidence coverage by control (%), avg evidence age, hash chain integrity (100%), export-ready dossier completeness (%).

---

### 4.4 Policy Manager
**What it does:** Versioned policy library with AI-assisted drafting, acknowledgment tracking, and distribution automation. Includes starter policies for SOC 2 (security, access control, incident response, vendor management, data retention) pre-tailored to a Supabase/Expo/GitHub stack.

**Why it matters:** Policies are the skeleton of compliance. Most startups copy-paste a template and never get acknowledgments. The Policy Manager ensures every employee has read and accepted the current version, with a timestamped record.

**Key workflows:** Create/edit policy → AI draft from control requirements → route for approval → distribute to team → track acknowledgments → version on change → re-acknowledge.

**Data inputs:** Policy templates, control mappings, employee roster (from GitHub org / Google Workspace), acknowledgment records.

**Automations:** AI draft generation, auto-distribute on publish, auto-reminder for unacknowledged policies, auto-flag expired acknowledgments (annual re-attestation).

**Metrics/KPIs:** Policy acknowledgment rate (%), avg time to acknowledge, policies current vs. expired, acknowledgment audit trail completeness.

---

### 4.5 Access Review Engine
**What it does:** Periodic access reviews for Supabase roles, GitHub repository collaborators, Stripe dashboard access, and any integrated system. Generates review campaigns, routes to managers, tracks approvals/removals, and produces audit-grade records.

**Why it matters:** SOC 2 CC6.2 requires periodic access reviews. Most startups do this in a spreadsheet once a year and lie about it. This module makes it a 5-minute quarterly workflow with a real audit trail.

**Key workflows:** Generate access snapshot per system → assign reviewer → reviewer approves/removes → changes propagate back to source system → evidence stored in Vault.

**Data inputs:** Supabase role assignments, GitHub collaborator list, Stripe team members, Google Workspace users, reviewer assignments.

**Automations:** Quarterly review campaign generation, auto-flag dormant accounts (no login in 90 days), auto-flag excessive permissions (service_role usage in user-facing code), auto-evidence on review completion.

**Metrics/KPIs:** Review completion rate (%), avg review cycle time, dormant accounts removed, excessive permissions detected.

---

### 4.6 Vendor Risk Hub
**What it does:** Inventory and risk assessment for every third-party vendor in Porchivo's stack — Supabase, Stripe, RevenueCat, Resend/SendGrid, Expo/EAS, Sentry, Ship24, Apple/Google. Tracks SOC 2 reports, security questionnaires, data processing agreements, and renewal dates.

**Why it matters:** SOC 2 CC9.2 requires vendor risk management. Enterprise buyers will also ask about your sub-processors. This module makes vendor risk a living inventory, not a forgotten spreadsheet.

**Key workflows:** Add vendor → auto-classify by data sensitivity → request/collect security documentation → score vendor risk → monitor for certification expiry → generate sub-processor list for Trust Center.

**Data inputs:** Vendor inventory, security documentation (SOC 2 reports, DPA, questionnaires), data flow mappings.

**Automations:** Auto-detect new vendors from Stripe/Supabase/GitHub integrations, expiry monitoring for certifications, auto-remind for document renewal, auto-generate sub-processor list.

**Metrics/KPIs:** Vendor coverage (%), vendors with current SOC 2 (%), avg vendor risk score, documents expiring in 30 days.

---

### 4.7 Incident & Risk Register
**What it does:** Centralized log of security incidents, near-misses, and identified risks with severity scoring, root-cause analysis, remediation tracking, and post-incident review workflows. Integrates with the existing `activity_audit` and `security_events` tables in Porchivo's Supabase schema.

**Why it matters:** SOC 2 CC7.3/CC7.4 require incident response and logging. The register turns the existing audit infrastructure into a structured incident management system with full chain-of-custody.

**Key workflows:** Log incident (auto from security_events or manual) → classify severity → assign responder → track remediation → conduct post-incident review → close with evidence → auto-feed to Trust Center incident history (optional public disclosure).

**Data inputs:** `security_events` table, `activity_audit` table, manual incident reports, GitHub issue integration, Sentry alerts.

**Automations:** Auto-create incident from security_events breach detection, auto-escalate based on severity, auto-generate incident timeline from audit logs, auto-notify stakeholders.

**Metrics/KPIs:** Mean time to detect (MTTD), mean time to respond (MTTR), incident closure rate, open risks by severity, recurring incident rate.

---

### 4.8 Trust Center
**What it does:** Public-facing, branded page that showcases Porchivo's security posture to prospective buyers and partners. Includes certifications, sub-processor list, security policies (public versions), incident history, data handling practices, and a request-access flow for detailed documents (SOC 2 reports under NDA).

**Why it matters:** This is the conversion mechanism. Enterprise buyers self-serve their security review before talking to sales. It compresses the procurement cycle from weeks to days and signals maturity.

**Key workflows:** Configure public/ gated content → auto-sync certifications and sub-processors → buyer requests access → NDA flow → grant time-boxed access to evidence vault → track engagement.

**Data inputs:** Certification status, sub-processor list from Vendor Hub, public policy versions, incident disclosure decisions.

**Automations:** Auto-update Trust Center on certification renewal, auto-sync sub-processor list, auto-notify on access request, auto-expire gated access.

**Metrics/KPIs:** Trust Center visits, document access requests, conversion rate (visitor → access request → deal), time-to-security-approval reduction.

---

### 4.9 Audit Readiness Workspace
**What it does:** Pre-audit preparation interface that maps all evidence to specific framework controls, identifies gaps, generates a readiness score, and produces an auditor-ready evidence package. Supports parallel frameworks (SOC 2 + HIPAA simultaneously).

**Why it matters:** Auditors charge by the hour. Every missing artifact costs time and money. The Workspace ensures you walk into an audit with 100% evidence coverage and a clean mapping.

**Key workflows:** Select framework → auto-map evidence to controls → identify gaps → assign remediation → generate evidence package → grant auditor read-only Vault access → track audit findings to closure.

**Data inputs:** Framework control definitions, evidence from Vault, control mappings, remediation status.

**Automations:** Auto-map evidence by control ID, auto-generate gap report, auto-compile evidence package, auto-track finding remediation.

**Metrics/KPIs:** Readiness score by framework, evidence coverage (%), gaps remaining, audit findings open vs. closed, audit cycle time.

---

### 4.10 Questionnaire Automation
**What it does:** AI-assisted response generation for inbound security questionnaires (SIG, CAIQ, custom buyer questionnaires). Matches questions to your actual control state and evidence, drafts answers, and routes for human approval before sending.

**Why it matters:** Security questionnaires are the #1 bottleneck in enterprise procurement. A 200-question SIG takes 40+ hours manually. This module cuts it to under 2 hours with AI drafting + human review.

**Key workflows:** Import questionnaire (PDF/Excel/CSV) → AI matches questions to control library → AI drafts answers from evidence and policy → human reviews/edits → export in original format → store response for future reuse.

**Data inputs:** Questionnaire input, control library, evidence vault, policy library, prior questionnaire responses.

**Automations:** Question-to-control matching, answer drafting, confidence scoring, prior-response reuse, answer library growth.

**Metrics/KPIs:** Questions auto-answered (%), avg confidence score, questionnaire turnaround time, answer library coverage (%).

---

### 4.11 AI Remediation Copilot
**What it does:** When a control fails or a gap is identified, the Copilot analyzes the failure, explains it in plain English, and generates specific, stack-aware remediation steps — including code snippets, SQL policies, GitHub Actions YAML, and Edge Function patches tailored to the Supabase/Expo/GitHub stack.

**Why it matters:** Most compliance tools tell you what's broken. None tell you exactly how to fix it in your specific stack. This is the killer feature for a technical founder — remediation as code, not as consultant hours.

**Key workflows:** Control fails → Copilot analyzes failure context → generates remediation plan with code snippets → founder reviews → applies fix → Copilot verifies fix → auto-re-evaluates control → evidence captured.

**Data inputs:** Control failure details, stack configuration (Supabase schema, GitHub repo state, Expo config), existing codebase patterns, remediation knowledge base.

**Automations:** Auto-trigger on control failure, context-aware snippet generation, fix verification, auto-re-evaluation, evidence auto-capture on remediation.

**Metrics/KPIs:** Remediation suggestions accepted (%), avg time to remediate, auto-verified fixes (%), repeat failure rate.

---

## 5. Stack-Aware Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Web App     │  │  Expo Mobile │  │  Trust Center         │  │
│  │  (React +    │  │  (Companion  │  │  (Public-facing       │  │
│  │   Vite + TW) │  │   app)       │  │   Next.js/React)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                            │
│                                                                  │
│  Supabase Edge Functions (Deno/TS)                               │
│  ├── /auth (JWT verify + DB role fetch)                          │
│  ├── /controls (CRUD + evaluation)                               │
│  ├── /evidence (collect, vault, export)                          │
│  ├── /monitors (schedule, run, alert)                            │
│  ├── /policies (version, distribute, acknowledge)                │
│  ├── /vendors (inventory, assess, score)                         │
│  ├── /incidents (log, track, close)                              │
│  ├── /questionnaires (import, draft, export)                     │
│  ├── /trust-center (public read, gated access)                   │
│  └── /ai-copilot (remediation, drafting — proxied to LLM)        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA & AUTOMATION LAYER                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Supabase PostgreSQL                                     │   │
│  │  ├── RLS-enforced compliance schema                      │   │
│  │  ├── Evidence Vault (hash-chained, immutable)            │   │
│  │  ├── Control state history (time-series)                 │   │
│  │  ├── Access review campaigns + results                   │   │
│  │  ├── Vendor inventory + risk scores                      │   │
│  │  ├── Incident register + audit trail                     │   │
│  │  ├── Policy versions + acknowledgments                   │   │
│  │  ├── Questionnaire response library                      │   │
│  │  └── AI interaction log (prompt/response/approval)       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Automation Engine                                        │   │
│  │  ├── Supabase pg_cron (scheduled monitors)               │   │
│  │  ├── GitHub Actions (repo state checks, deploy hooks)     │   │
│  │  ├── Edge Function triggers (event-driven checks)         │   │
│  │  ├── Webhook listeners (Stripe, GitHub, Supabase)         │   │
│  │  └── AI Gateway (Rork proxy → LLM for Copilot)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model Overview

**Core tables (all RLS-enforced, multi-tenant via `org_id`):**

- `orgs` — tenant organizations (WhichWay + future customers)
- `users` — org members with roles (admin, auditor_readonly, member)
- `frameworks` — compliance frameworks (SOC 2, HIPAA, ISO 27001, PCI, custom)
- `controls` — individual control definitions per framework
- `control_mappings` — many-to-many between controls across frameworks
- `monitors` — check definitions (type, schedule, target, expected state)
- `monitor_results` — time-series results (pass/fail, evidence_ref, timestamp)
- `evidence` — immutable artifacts (hash, type, source, collected_at, collected_by)
- `evidence_chain` — hash linkage table for tamper detection
- `policies` — versioned policy documents
- `policy_acknowledgments` — user × policy × version × timestamp
- `access_reviews` — campaign definitions + results
- `vendors` — vendor inventory + risk scores
- `vendor_documents` — SOC 2 reports, DPAs, questionnaires
- `incidents` — incident register
- `incident_timeline` — auto-generated from audit logs
- `risks` — risk register entries
- `questionnaires` — inbound questionnaire metadata
- `questionnaire_responses` — per-question AI-drafted + human-approved answers
- `answer_library` — reusable answer fragments
- `ai_interactions` — full prompt/response/approval audit log
- `trust_center_config` — public/gated content configuration
- `trust_center_access` — time-boxed access grants for buyers

### Event Model

```
Events flow through a central event bus (Supabase Realtime + pg_notify):

1. MonitorScheduled      → pg_cron fires → monitor executes → result stored
2. MonitorFailed         → incident auto-created → alert sent → Copilot triggered
3. EvidenceCollected     → hash stored → chain updated → control re-evaluated
4. PolicyPublished       → notifications sent → acknowledgment requests generated
5. AccessReviewStarted   → snapshots taken → reviewers assigned → notifications sent
6. VendorCertExpiring    → alert sent → Trust Center flagged
7. QuestionnaireImported → AI matching starts → drafts generated → human review queue
8. ControlRemediated     → monitor re-run → evidence captured → posture recalculated
9. TrustCenterAccessReq  → NDA flow → access granted → engagement tracked
10. AICopilotInvoked     → prompt logged → response generated → approval required → action logged
```

### Integration Strategy

| Integration | What it provides | Connection method |
|---|---|---|
| **Supabase** | Core database, RLS state, auth, Edge Functions, Realtime | Native (same project or linked) |
| **GitHub** | Repo metadata, branch protection, collaborator list, secret scanning, Actions runs | GitHub App (OAuth + webhooks) |
| **GitHub Actions** | CI/CD as evidence, deploy hooks for event triggers | Workflow runs → webhook to WhichWay |
| **Stripe** | Webhook config, team access, billing security | Stripe API + webhook events |
| **Google Workspace** | User directory, MFA enrollment, access review source | Admin SDK API (OAuth domain-wide) |
| **Expo / EAS** | App config, build metadata, store submission records | EAS API + app.config.ts parsing |
| **Sentry** | Error monitoring, incident detection | Sentry webhook → incident register |
| **Resend / SendGrid** | Email delivery for policy distribution, alerts | API + webhook for delivery confirmation |
| **AWS / Azure** (future) | Cloud posture checks, IAM review, backup verification | Cloud SDK + Config API |
| **Okta / SSO** (future) | Identity provider, MFA enforcement, SSO coverage | SCIM + API |
| **MDM** (future) | Device posture for laptop security checks | Jamf/Intune API |
| **LLM (via Rork AI Gateway)** | Copilot remediation, questionnaire drafting, policy suggestions | Rork proxy → OpenAI/Anthropic |

### Secrets and Security Strategy

- **No secrets in client code** — all API keys, OAuth tokens, and LLM keys stored in Supabase Vault (pg_crypto) or environment secrets on Edge Functions
- **OAuth tokens encrypted at rest** — GitHub/Google/Stripe OAuth refresh tokens encrypted with org-specific keys
- **LLM proxy** — all AI calls go through the Rork AI Gateway proxy, never directly to OpenAI/Anthropic from the client
- **Evidence Vault immutability** — append-only table with hash chain; no UPDATE or DELETE permissions for any role
- **Auditor access** — time-boxed, read-only, scoped to evidence only, no access to remediation or incident details unless explicitly granted
- **PII redaction** — all logs, AI prompts, and evidence artifacts are scanned for PII patterns before storage
- **Service role isolation** — `service_role` used only for cross-tenant monitor execution and evidence collection, never for user-facing queries

### Multi-Tenant Considerations

- **Row-level isolation** — every table has `org_id` with RLS policies enforcing `auth.uid() = org_member.user_id AND org_member.org_id = row.org_id`
- **Monitor isolation** — scheduled monitors execute in the context of a specific org; no cross-tenant data leakage
- **Trust Center isolation** — each org gets a unique subdomain (`acme.sentinel.trust`) with its own branding
- **AI isolation** — Copilot prompts include only the requesting org's control state and evidence; no cross-org context
- **Evidence Vault per-org encryption** — future: per-org encryption keys for evidence at rest
- **Super admin** — platform-level admin for WhichWay to manage all tenants, strictly separated via role hierarchy

---

## 6. Compliance Automation Engine

### Evidence Collection

| Evidence type | Collection method | Trigger | Storage |
|---|---|---|---|
| RLS policy state | SQL query against `pg_policies` + `pg_roles` | Daily + on migration deploy | Evidence Vault (hash-chained) |
| Branch protection config | GitHub API `GET /repos/{owner}/{repo}/branches/{branch}/protection` | Daily + on push event | Evidence Vault |
| MFA enrollment | Google Workspace Admin SDK / Supabase auth query | Weekly | Evidence Vault |
| Secret scanning status | GitHub API `GET /repos/{owner}/{repo}/secret-scanning-alerts` | Daily | Evidence Vault |
| Stripe webhook config | Stripe API `GET /v1/webhook_endpoints` | Weekly | Evidence Vault |
| Edge Function security headers | HTTP probe of deployed function endpoints | Daily | Evidence Vault |
| Environment variable inventory | Parse `.env.example` + verify presence in secrets manager | Weekly | Evidence Vault (values redacted) |
| Deploy records | GitHub Actions workflow run history | On each deploy | Evidence Vault |
| Access review results | Supabase role query + GitHub collaborator query | Quarterly (campaign) | Evidence Vault |
| Training completion | Manual upload or LMS API (future) | On completion | Evidence Vault |

### Trigger-Based Automations

```
ON Supabase migration deploy (GitHub Actions webhook):
  → Capture RLS policy state (before + after)
  → Diff policies
  → IF policy weakened → create security_event → create incident → alert
  → IF policy strengthened → capture evidence → re-evaluate control
  → Store diff in Evidence Vault

ON GitHub branch protection change (GitHub webhook):
  → Capture new config
  → IF protection removed → create incident → alert
  → IF protection added → capture evidence → re-evaluate control

ON Stripe webhook config change (Stripe webhook):
  → Verify signature verification still enabled
  → IF disabled → create incident → alert
  → Store config in Evidence Vault

ON control failure (monitor result = fail):
  → Create/update risk register entry
  → Trigger AI Copilot for remediation
  → Alert assigned owner
  → Update compliance score
  → Flag Trust Center if public-facing control
```

### Scheduled Jobs (pg_cron + GitHub Actions)

| Job | Frequency | What it does |
|---|---|---|
| RLS policy check | Every 6 hours | Query all policies, compare to baseline, flag drift |
| Branch protection check | Daily | Verify all production branches have protection rules |
| MFA enrollment check | Weekly | Query auth users, flag any without MFA |
| Secret scanning check | Daily | Check for open secret scanning alerts |
| Expired secrets scan | Weekly | Scan for secrets expiring in 30 days |
| Evidence freshness check | Daily | Flag evidence older than control-defined TTL |
| Vendor cert expiry | Daily | Check vendor SOC 2 / certifications expiring in 60 days |
| Policy acknowledgment reminder | Weekly | Notify users with unacknowledged policies |
| Dormant account scan | Monthly | Flag accounts with no activity in 90 days |
| Posture score recalculation | Daily | Recalculate org compliance score from all monitor results |
| AI Copilot confidence audit | Weekly | Review low-confidence AI outputs for human override rate |

### Webhook Flows

```
GitHub → WhichWay webhook endpoint:
  POST /webhooks/github
  ├── Verify X-Hub-Signature-256
  ├── Parse event type (push, branch_protection_config, member, secret_scanning_alert)
  ├── Route to appropriate monitor
  └── Store raw event in audit log (redacted)

Stripe → WhichWay webhook endpoint:
  POST /webhooks/stripe
  ├── Verify stripe-signature
  ├── Parse event type (account.updated, webhook_endpoint.updated)
  ├── Route to Stripe config monitor
  └── Store event ID in stripe_processed_events (idempotency)

Supabase → WhichWay webhook (db_changes):
  POST /webhooks/supabase
  ├── Verify Supabase webhook secret
  ├── Parse table + event type
  ├── Route to RLS/policy monitor
  └── Store in audit log
```

### Exception Handling

- **Monitor execution failure** — retry 3x with exponential backoff, then alert admin and log to `monitor_failures` table. Does not affect compliance score (score only updates on successful execution).
- **Evidence collection failure** — log failure, mark evidence as stale, alert owner. Control remains in last-known state with a "stale evidence" flag visible in dashboard.
- **AI Copilot failure** — graceful degradation: show control failure without remediation suggestion, log AI failure, queue for retry. Never block remediation workflow on AI availability.
- **Integration OAuth expiry** — auto-refresh where possible, alert admin 7 days before expiry if refresh not possible, mark related monitors as "degraded" (not failed).

### Manual Override Logic

- **Control override** — admin can mark a control as "pass with exception" with a written justification, expiration date, and approval chain. Override is logged in audit trail and visible to auditors.
- **Evidence waiver** — admin can waive an evidence requirement for a specific control with justification. Waiver has TTL and requires re-justification on expiry.
- **Risk acceptance** — admin can formally accept a risk instead of remediating. Requires severity classification, acceptance rationale, and review date. Visible in risk register and Trust Center (optionally).

---

## 7. AI Copilot

### Capabilities

| Capability | Input | Output | Human approval required |
|---|---|---|---|
| Summarize failing controls | Control failure list + context | Plain-English summary of what's broken and why it matters | No (informational) |
| Draft remediation steps | Failed control + stack context | Step-by-step fix with code snippets (SQL, YAML, TS) | Yes — before applying |
| Generate questionnaire answers | Question text + control library + evidence | Drafted answer with confidence score + source citations | Yes — before sending |
| Suggest policy language | Control requirement + org context | Draft policy section with placeholders for org-specific details | Yes — before publishing |
| Identify missing evidence | Control list + evidence vault inventory | Gap report: which controls lack evidence and what's needed | No (informational) |
| Explain compliance gaps | Gap report + framework context | Plain-English explanation for non-technical stakeholders | No (informational) |
| Generate dev remediation snippets | Failed control + codebase pattern analysis | Copy-pasteable code fix (SQL policy, GitHub Actions step, Edge Function patch) | Yes — before applying |

### Safe Prompt Design

- **System prompt isolation** — Copilot system prompts are stored server-side in Edge Functions, never sent to or modifiable by the client
- **Context injection** — relevant control state, evidence, and stack configuration are injected into the prompt context server-side; client only sends the request intent
- **No raw secrets** — prompts never include API keys, passwords, or PII; stack configuration is abstracted ("GitHub repo has branch protection: false" not the actual API response)
- **Framework-aware** — prompt includes the specific compliance framework context (SOC 2 CC6.1, HIPAA §164.312(a)(1), etc.) for accurate remediation targeting
- **Stack-specific instructions** — prompt explicitly instructs the LLM to generate fixes for Supabase SQL, GitHub Actions YAML, TypeScript Edge Functions, and Expo/React Native — not generic recommendations

### Human Approval Boundaries

- **Auto-applied (no approval):** control summaries, gap reports, plain-English explanations, informational insights
- **Human review required:** remediation code snippets, questionnaire answers, policy drafts, Trust Center content
- **Human + secondary approval:** policy publications, Trust Center incident disclosures, risk acceptances
- **Never automated:** evidence fabrication, control pass/fail override without justification, auditor communication, NDA gating decisions

### Audit Logging Requirements

- Every AI interaction logged in `ai_interactions` table:
  - `id`, `org_id`, `user_id`, `request_type`, `prompt_hash` (not raw prompt — for PII safety), `response_text`, `model_used`, `confidence_score`, `human_approved`, `approved_by`, `approved_at`, `applied_action`, `timestamp`
- AI-generated remediation that was applied: linked to the monitor result it fixed, creating a full chain from failure → AI suggestion → human approval → fix applied → control re-evaluated → evidence captured
- AI-generated questionnaire answers: linked to the questionnaire and the answer library entry for future reuse tracking

### Hallucination Controls

- **Confidence scoring** — every AI output includes a confidence score (0.0–1.0). Outputs below 0.7 are flagged "Low confidence — review carefully" and cannot be auto-applied.
- **Source citation** — questionnaire answers and policy drafts must cite the specific control or evidence they're based on. Uncited claims are flagged.
- **Stack verification** — remediation code snippets are syntax-validated server-side before being shown to the user (SQL parsed, YAML validated, TypeScript type-checked).
- **Human override tracking** — if a human edits an AI output, the delta is stored. High edit rates on specific request types trigger a prompt review.
- **Periodic accuracy audit** — weekly job samples 5% of AI outputs and checks them against actual control state. Accuracy below 90% triggers prompt revision.

### Privacy Boundaries

- **No PII in prompts** — all user data, resident data, and customer data is stripped/abstracted before entering the prompt context
- **No cross-tenant data** — prompts are scoped to the requesting org only; no information from other WhichWay tenants is included
- **No training on customer data** — all LLM calls go through the Rork AI Gateway proxy with training-opt-out flags; customer data is never used for model training
- **Prompt storage** — raw prompts are not stored; only a hash is kept for audit trail. Response text is stored for auditability but PII-scanned and redacted before persistence.
- **Right to deletion** — org admins can purge all AI interaction logs for their org (retention policy configurable, default 90 days)

---

## 8. Porchivo-Specific Advantage

### Mobile-First Compliance Posture
Generic compliance platforms (Vanta, Drata, Secureframe) were built for web-only SaaS companies. They check GitHub, AWS, and Google Workspace. None of them understand mobile-specific compliance: App Store privacy nutrition labels, Android data safety declarations, Expo/EAS build pipeline security, push notification token handling, mobile deep-link security, or on-device data storage posture. WhichWay is built by a mobile-first company (WhichWay) for mobile-first companies. It checks what mobile auditors actually ask about.

### PropTech / HOA / Resident-Trust Use Cases
Porchivo operates in a space where trust is the product. HOAs and property managers don't just want a SOC 2 report — they want proof that resident data is isolated, that package delivery records are access-controlled, and that property access logs are tamper-evident. WhichWay can verify these Porchivo-specific invariants directly: RLS policies on the `packages` table, audit logging on `activity_audit`, PII access patterns in `security_events`. No generic GRC tool can do this because they don't know your schema. WhichWay does.

### Package Delivery / Property Access Sensitivity
Porchivo handles a unique data class: delivery records that reveal when residents are home, what they buy, and who has access to their property. This is more sensitive than typical SaaS data and less regulated than healthcare data — it falls into a gap where generic compliance frameworks don't provide adequate coverage. WhichWay can define Porchivo-specific controls (package data access logging, delivery photo retention limits, porch partner background check verification) and monitor them continuously.

### Customer Trust Workflows
When Porchivo pitches an HOA board or property management company, the buyer's #1 concern is "can we trust you with our residents' data?" Today, that conversation is a sales pitch. With WhichWay's Trust Center, it becomes a self-serve proof point: the buyer visits `porchivo.sentinel.trust`, sees your live compliance posture, downloads your SOC 2 report under NDA, and reviews your sub-processor list — all before the first sales call. This compresses the trust-building cycle from weeks to hours.

### Operational Simplicity for Lean Teams
WhichWay is a lean, technical team. Generic compliance platforms require a dedicated compliance owner to manage them. WhichWay is designed to run itself: monitors execute automatically, evidence is collected without human intervention, policies auto-distribute, and the AI Copilot handles remediation drafting. The founder's only interaction is reviewing alerts and approving AI suggestions — 15 minutes per week, not 15 hours.

### Future Enterprise Sales Enablement
Every enterprise deal Porchivo closes will trigger a security review. Today, that's a manual questionnaire response cycle. With WhichWay, the response is already drafted from your live control state. The Trust Center handles the self-serve portion. The Questionnaire Automation module handles the inbound questionnaire. The Evidence Vault handles the auditor's evidence request. The entire enterprise procurement security cycle is compressed from 6 weeks to 5 days — and Porchivo can use WhichWay as a competitive differentiator: "We run on WhichWay continuous compliance. Here's our live Trust Center."

---

## 9. UX / Design Direction

### Design Brief

**Vanta-class trust and calm. Stripe-level polish. Linear-style clarity.**

The interface should feel like the cockpit of a well-built machine — every pixel earns its place. No decorative gradients, no generic AI SaaS template elements, no dashboard noise. The user should open it and immediately know: "This system is watching my back."

### Layout System

- **App shell:** Left sidebar navigation (collapsible, icon-only on mobile), top bar with org switcher + search + notifications, main content area.
- **Density:** Comfortable but information-rich. 14px base font, 6px/8px/12px/16px/24px spacing scale. No wasted whitespace, but no cramped tables either.
- **Grid:** 12-column responsive grid. Dashboard widgets use a card-based masonry layout that reflows from 4 columns (desktop) to 2 (tablet) to 1 (mobile).

### Navigation Structure

```
Sidebar:
├── Command Center (dashboard home)
├── Continuous Monitoring
│   ├── Active Monitors
│   ├── Monitor History
│   └── Configure
├── Evidence Vault
│   ├── Browse
│   ├── Export
│   └── Hash Verification
├── Policies
│   ├── Library
│   ├── Acknowledgments
│   └── Templates
├── Access Reviews
│   ├── Active Campaign
│   └── History
├── Vendor Risk
│   ├── Inventory
│   ├── Assessments
│   └── Sub-processors
├── Incidents & Risks
│   ├── Incident Register
│   ├── Risk Register
│   └── Post-Incident Reviews
├── Audit Readiness
│   ├── Framework Status
│   ├── Gap Analysis
│   └── Evidence Package
├── Questionnaires
│   ├── Inbox
│   ├── Response Library
│   └── Drafts
├── AI Copilot
│   ├── Remediation Queue
│   ├── Draft Reviews
│   └── Interaction Log
├── Trust Center
│   ├── Public Page Config
│   ├── Access Requests
│   └── Analytics
└── Settings
    ├── Integrations
    ├── Team & Roles
    └── Frameworks
```

### Dashboard Widgets (Command Center)

1. **Posture Score** — large circular gauge (0–100) with trend arrow and delta from last week. Color: green (85+), amber (70–84), red (<70).
2. **Framework Status** — horizontal bars showing readiness % per framework (SOC 2, HIPAA, etc.) with gap count.
3. **Control Health** — grid of small status dots (green/amber/red) grouped by control family. Hover for detail.
4. **Evidence Freshness** — timeline showing evidence collection events over the last 30 days. Stale evidence flagged in amber.
5. **Open Risks** — prioritized list (severity-ordered) with age and owner. Click to drill in.
6. **Recent Incidents** — last 5 incidents with severity, status, and time-to-close.
7. **AI Copilot Queue** — count of pending remediation reviews and questionnaire drafts awaiting approval.
8. **Monitor Status** — last-run status of all monitors with time since last check.
9. **Trust Center Activity** — recent visits, document access requests, conversion funnel.
10. **Quick Actions** — one-click access to start access review, import questionnaire, export evidence package.

### Colors

**Dark mode (primary):**
- Background: `#0B0E14` (near-black with a blue undertone — not generic dark gray)
- Surface: `#121620` (elevated cards)
- Surface elevated: `#1A1F2E`
- Border: `#1E2433` (subtle, almost invisible — Linear style)
- Text primary: `#E4E8F0`
- Text secondary: `#8B92A5`
- Text tertiary: `#5C6478`
- Accent (trust/safe): `#3DD68C` (emerald — not generic green)
- Accent (warning): `#F5B342` (warm amber)
- Accent (danger): `#F2545B` (coral red — not aggressive)
- Accent (brand): `#4A9EFF` (trust blue — close to Porchivo's #3A7BD5 but brighter for dark mode)
- Evidence Vault hash chain: `#7C5CFC` (subtle purple — used only for evidence/integrity indicators)

**Light mode:**
- Background: `#FAFBFC` (warm off-white — not pure white)
- Surface: `#FFFFFF`
- Surface elevated: `#F4F6F8`
- Border: `#E1E5EB`
- Text primary: `#1A1F2E`
- Text secondary: `#5C6478`
- Text tertiary: `#8B92A5`
- Accents: same as dark mode, slightly desaturated

### Typography

- **Primary:** Inter (or Inter Variable) — clean, modern, excellent at small sizes. Not Space Grotesk (overused in AI SaaS).
- **Monospace:** JetBrains Mono — for evidence hashes, control IDs, code snippets, SQL in remediation.
- **Scale:** 12px (labels), 13px (secondary), 14px (body), 16px (section), 20px (page title), 28px (metric), 48px (posture score).
- **Weight:** 400 (body), 500 (emphasis), 600 (section headers), 700 (metrics).
- **Line height:** 1.5 for body, 1.2 for headers.

### States

- **Loading:** Skeleton screens (not spinners) matching the layout of the content that will load. Shimmer effect in brand blue at 20% opacity.
- **Empty:** Illustration-free. Centered text with a clear next action. "No monitors configured yet. Connect your first integration to start collecting evidence." + button.
- **Error:** Inline error with actionable message. No stack traces. "We couldn't reach GitHub. Check your integration status in Settings → Integrations." + retry button.
- **Success:** Subtle toast (bottom-right, dark mode: `#1A1F2E` surface with emerald left border). Auto-dismiss after 4 seconds. No modal interrupts.
- **Control failure:** Red status dot + inline explanation. No alarmist full-screen banners. The dashboard already shows it; the user is informed, not panicked.

### Trust-Building Microcopy

- Posture score label: "Live compliance posture — updated 3 minutes ago"
- Monitor status: "12 of 14 monitors passing. 2 need attention."
- Evidence Vault: "1,247 artifacts collected. Hash chain verified. Last integrity check: passed."
- Trust Center: "Your Trust Center has had 23 visits this month. 4 organizations requested document access."
- AI Copilot: "I found a fix for this control. Review it before applying — I can be wrong."
- Policy acknowledgment: "3 team members haven't acknowledged the latest Information Security Policy. Remind them?"
- Audit readiness: "You're 92% ready for your SOC 2 Type II audit. 3 evidence gaps remain."
- Questionnaire: "I drafted answers for 187 of 200 questions. 13 need your review. Average confidence: 84%."

### Motion

- **Page transitions:** 200ms ease-out fade. No slide animations (feels cheap in dashboards).
- **Widget updates:** 300ms spring for posture score changes. Status dots pulse once on state change (1s, then settle).
- **Data updates:** Stagger 50ms delay between widget refreshes to avoid simultaneous re-render flicker.
- **AI Copilot typing:** 15ms per character, with a subtle cursor blink. Feels alive without being slow.
- **Trust Center:** Gentle entrance animation on public page load (400ms fade + 8px rise). Conveys calm, not flashiness.

---

## 10. Monetization

### SaaS Pricing

| Tier | Price/mo | Target | What's included |
|---|---|---|---|
| **Starter** | $99/mo | Solo founders, pre-revenue startups | 1 framework (SOC 2), 1 user, 25 monitors, Evidence Vault (1GB), Policy Manager (5 policies), basic Trust Center, community support |
| **Growth** | $399/mo | Seed-stage SaaS, SMBs | 3 frameworks, 5 users, unlimited monitors, Evidence Vault (10GB), full Policy Manager, Access Review Engine, Vendor Risk Hub, Questionnaire Automation (10/mo), AI Copilot (100 interactions/mo), custom Trust Center, priority support |
| **Enterprise** | $1,499/mo | Series A+, multi-framework, regulated industries | Unlimited frameworks, unlimited users, unlimited monitors, Evidence Vault (100GB), all modules, unlimited questionnaires, AI Copilot (unlimited), custom Trust Center domain, SSO/SAML, audit prep sessions, dedicated CSM, SLA |

### Service Revenue

| Service | Price | What's included |
|---|---|---|
| **Implementation sprint** | $2,500 one-time | Stack integration setup, initial monitor configuration, baseline evidence collection, first policy set deployment. 1-week turnaround. |
| **Policy setup package** | $1,500 one-time | Custom-drafted SOC 2 policy suite tailored to your stack (12 policies), legal review coordination, acknowledgment workflow setup. |
| **Audit prep coaching** | $3,000 one-time | Pre-audit gap analysis, evidence package assembly, auditor liaison prep, mock audit session. Paired with Audit Readiness Workspace. |
| **Trust Center customization** | $750 one-time | Custom branding, sub-domain setup, gated content strategy, conversion optimization. |
| **Managed compliance** | $1,000/mo | Monthly compliance review call, quarterly access review facilitation, incident response on-call, policy update management. For teams without a dedicated compliance owner. |
| **Custom framework** | $2,500 one-time | Define a custom compliance framework (e.g., HOA-specific data protection standard, PropTech industry framework) with controls, monitors, and evidence mappings. |

### Revenue Logic

- SaaS subscription is the base — predictable, scalable, high-margin
- Services are the wedge — high-touch onboarding builds trust and lock-in
- Enterprise expansion is the multiplier — each new framework and integration increases switching cost
- AI Copilot usage-based overage: $0.50 per interaction above tier limit (Growth), negotiated for Enterprise

---

## 11. 90-Day Build Roadmap

### Phase 1: MVP (Days 1–30)

**Features:**
- Compliance Command Center (dashboard with posture score)
- Continuous Monitoring (5 core monitors: RLS policies, GitHub branch protection, MFA enrollment, secret scanning, Stripe webhook config)
- Evidence Vault (auto-collect, hash-chain, export)
- Policy Manager (5 starter SOC 2 policies, acknowledgment tracking)
- Integrations: Supabase, GitHub, Stripe
- AI Copilot v1 (remediation summaries only — no code generation yet)

**Engineering tasks:**
- Set up Supabase schema (all core tables with RLS)
- Build Edge Function API gateway (auth, controls, evidence, monitors, policies)
- Build React web app (Command Center, Monitoring, Evidence Vault, Policies)
- Implement GitHub App integration (OAuth, webhook listener, API queries)
- Implement Supabase monitor (SQL queries for RLS, roles, policies)
- Implement Stripe monitor (API queries for webhook config)
- Build Evidence Vault with hash-chain integrity
- Implement pg_cron scheduled monitor execution
- Deploy Trust Center skeleton page (static, no dynamic content yet)

**Data work:**
- Design and deploy all core tables
- Create RLS policies for multi-tenant isolation
- Set up pg_cron jobs for monitor scheduling
- Create baseline evidence schema (type, source, hash, timestamp)

**Security tasks:**
- JWT verification on all Edge Functions (reuse Porchivo's verifyAuth pattern)
- Input validation with Zod on all routes
- Rate limiting (reuse Porchivo's rate-limit infrastructure)
- Evidence Vault immutability (no UPDATE/DELETE permissions)
- OAuth token encryption at rest
- PII redaction in all logs

**Launch criteria:**
- 5 monitors running and collecting evidence automatically
- Posture score calculating correctly from monitor results
- Policy Manager distributing and tracking acknowledgments
- Evidence Vault exporting a clean evidence package
- Web app functional in dark and light mode
- All Edge Functions type-checked and deployed
- RLS policies tested with cross-tenant isolation verification

---

### Phase 2: Automation Depth (Days 31–60)

**Features:**
- Access Review Engine (quarterly campaigns, GitHub + Supabase + Stripe)
- Vendor Risk Hub (inventory, document collection, scoring)
- Incident & Risk Register (auto-creation from monitor failures, timeline from audit logs)
- AI Copilot v2 (remediation code snippets — SQL, YAML, TS)
- Questionnaire Automation v1 (import, AI matching, draft answers, export)
- Additional monitors: expired secrets, dormant accounts, Edge Function security headers, deploy records
- GitHub Actions integration (deploy hooks → event-triggered monitors)
- Sentry integration (error alerts → incident register)

**Engineering tasks:**
- Build access review campaign system (snapshot, assign, review, evidence)
- Build vendor inventory + document management
- Build incident register with auto-creation from security_events
- Integrate LLM via Rork AI Gateway for Copilot v2
- Build questionnaire import (PDF/Excel/CSV parsing) + AI answer matching
- Implement GitHub Actions webhook listener for deploy events
- Implement Sentry webhook listener
- Build answer library for questionnaire reuse

**Data work:**
- Access review tables (campaigns, snapshots, results)
- Vendor tables (inventory, documents, risk scores)
- Incident tables (register, timeline, post-incident reviews)
- Questionnaire tables (inbound, responses, answer library)
- AI interaction log table

**Security tasks:**
- AI prompt safety pipeline (PII stripping, context injection server-side)
- Confidence scoring implementation
- Human approval workflow for AI outputs
- Questionnaire answer audit trail
- Vendor document access control (gated by role)

**Launch criteria:**
- Access review campaign completes end-to-end with evidence
- Vendor inventory populated with all Porchivo sub-processors
- Incident auto-creation working from monitor failures
- AI Copilot generating stack-specific remediation snippets with ≥85% accuracy
- Questionnaire import + AI drafting + human review + export working end-to-end
- 10+ monitors running
- All AI interactions logged with confidence scores

---

### Phase 3: External Trust + Enterprise Readiness (Days 61–90)

**Features:**
- Trust Center (public-facing, branded, dynamic content)
- Audit Readiness Workspace (framework mapping, gap analysis, evidence package export, auditor access)
- AI Copilot v3 (policy drafting, questionnaire confidence scoring with source citations)
- Google Workspace integration (user directory, MFA enrollment, access review source)
- SSO/SAML for Enterprise tier
- Multi-framework support (SOC 2 + HIPAA + ISO 27001 simultaneously)
- Custom framework builder
- Platform multi-tenancy (onboard WhichWay's first WhichWay customer)

**Engineering tasks:**
- Build Trust Center public page (Next.js or React, custom subdomain)
- Build gated access flow (NDA, time-boxed, audit-logged)
- Build audit readiness workspace (framework mapping, gap report, evidence package compiler)
- Implement Google Workspace Admin SDK integration
- Implement SAML 2.0 SSO (via Supabase auth + SAML provider)
- Build framework control mapping engine (many-to-many between frameworks)
- Build custom framework definition UI
- Implement tenant onboarding flow (org creation, initial admin, integration setup)

**Data work:**
- Trust Center config + access grant tables
- Framework mapping tables (control-to-control across frameworks)
- SSO provider configuration table
- Tenant onboarding audit trail

**Security tasks:**
- Trust Center public page: no sensitive data exposure, rate-limited, CDN-cached
- Gated access: NDA verification, time-boxed tokens, access logging
- Auditor access: read-only, scoped to evidence only, auto-expiring
- SSO: SAML response verification, certificate validation
- Multi-tenant isolation verification for first external customer

**Launch criteria:**
- Trust Center live at `sentinel.trust` with Porchivo's real compliance data
- Audit readiness workspace produces a complete SOC 2 evidence package
- Google Workspace integration collecting MFA + user data
- SSO working with at least one SAML provider (Okta or Google)
- Multi-framework: SOC 2 + HIPAA running in parallel
- First external tenant onboarded (if WhichWay has a design partner)
- AI Copilot generating policy drafts with human approval workflow
- Full end-to-end: monitor detects drift → Copilot suggests fix → human approves → fix applied → control passes → evidence captured → Trust Center updates → posture score improves

---

## 12. Killer Differentiators

1. **Stack-native, not integration-generic.** Vanta checks if you have MFA on Google Workspace. WhichWay checks if your Supabase RLS policies on the `packages` table actually isolate resident data — because it knows your schema. It checks if your Edge Functions verify JWT signatures on every request — because it can read your code. It checks if your Stripe webhook actually validates `stripe-signature` — because it can probe your endpoint. Generic GRC tools can't do this. WhichWay can because it's built by and for the Supabase/Expo/GitHub stack.

2. **Mobile compliance posture.** No compliance platform monitors App Store privacy nutrition labels, Android data safety declarations, Expo build pipeline security, push notification token handling, or mobile deep-link security. WhichWay does. For a mobile-first product like Porchivo, this is table stakes that no competitor covers.

3. **Remediation as code, not as consultant.** When a control fails, Vanta tells you "enable branch protection." WhichWay generates the exact `gh api` command or GitHub Actions YAML snippet to fix it, validates the syntax, and verifies the fix after you apply it. Remediation is a pull request, not a meeting.

4. **Evidence with cryptographic lineage.** Every evidence artifact is hash-chained to the previous one, creating a tamper-evident timeline. Auditors can verify the chain hasn't been broken. No screenshot can be silently replaced. This is blockchain-grade integrity without blockchain-grade stupidity.

5. **Porchivo-specific controls.** WhichWay ships with control definitions for PropTech-specific risks: package data access logging, delivery photo retention, porch partner background verification, property access audit trail. No generic GRC platform even knows these data classes exist.

6. **Trust Center as a sales tool.** The Trust Center isn't just a public page — it tracks visitor engagement, conversion to document access requests, and time-to-security-approval. It's a sales funnel for trust, with analytics that tie compliance investment directly to deal velocity.

7. **AI Copilot with auditable boundaries.** Every AI suggestion has a confidence score, source citation, human approval record, and applied-action trail. You can show an auditor exactly what the AI suggested, what the human changed, and what was applied — with timestamps. No black-box compliance.

8. **Lean-team operational model.** WhichWay is designed to run on 15 minutes of founder attention per week. Monitors auto-run, evidence auto-collects, policies auto-distribute, AI auto-drafts. The human's job is review and approval — not data entry and screenshot collection.

9. **Questionnaire automation from live state.** Most questionnaire tools use a static answer library. WhichWay drafts answers from your current control state and evidence — if a monitor started passing yesterday, the answer reflects that today. Your questionnaire responses are never stale.

10. **Founder-built, founder-fast.** WhichWay can ship WhichWay in 90 days because the stack is already in place — Supabase, Edge Functions, GitHub Actions, React. No new infrastructure to learn, no new deployment pipeline to build. The same skills that built Porchivo build WhichWay. Speed is the moat.

---

## 13. Brutal Risk Review

### Product Risks

| Risk | Mitigation |
|---|---|
| **Scope creep into generic GRC** — trying to be Vanta for everyone instead of the best compliance tool for the Supabase/Expo/PropTech niche | Hard niche focus for first 12 months. Reject generic feature requests. Every feature must answer: "Does this specifically help a stack-native, mobile-first, PropTech company?" If no, it's a v2 item. |
| **AI Copilot accuracy degradation** — LLM hallucinations in remediation snippets or questionnaire answers could erode trust and cause real security issues | Confidence scoring + mandatory human review for all applied actions + weekly accuracy audit + syntax validation before display. Never auto-apply. The Copilot suggests; the human decides. |
| **Trust Center becoming a liability** — public-facing compliance claims that drift from actual state could be worse than no Trust Center at all | Trust Center auto-syncs from monitor results. If a control fails, the Trust Center automatically reflects the degraded state or removes the claim. No manual updates. No stale claims. |

### Security Risks

| Risk | Mitigation |
|---|---|
| **WhichWay itself becomes the attack surface** — a compliance platform with access to GitHub, Supabase, Stripe, and Google Workspace is a high-value target | Minimum-scope OAuth tokens (read-only where possible), token encryption at rest, no raw secret storage, all API calls via Edge Functions (not client), regular pen testing, bug bounty program from day one. |
| **Evidence Vault tampering** — if the hash chain is compromised, the entire audit trail is questionable | Append-only table with database-level INSERT-only permissions (no UPDATE/DELETE for any role). Hash chain verified on every export. Daily integrity check job. Any chain break triggers a critical incident. |
| **Cross-tenant data leakage** — a bug in RLS or a monitor query could expose one customer's compliance data to another | RLS is the primary defense. Additionally, all monitor queries are scoped with an explicit `org_id` WHERE clause. Cross-tenant integration test suite runs on every deploy. Pen test includes tenant isolation verification. |
| **AI prompt injection** — a malicious questionnaire or vendor document could contain prompt injection attempting to manipulate the Copilot | All external text (questionnaire content, vendor documents) is treated as untrusted input. It's placed in a delimited context block with explicit instructions to the LLM to treat it as data, not instructions. Prompt injection detection patterns are scanned before LLM submission. |

### Compliance Risks

| Risk | Mitigation |
|---|---|
| **WhichWay's own compliance gap** — selling a compliance tool that isn't itself SOC 2 compliant is a credibility killer | WhichWay uses WhichWay from day one (dogfooding). Phase 3 includes WhichWay's own SOC 2 Type I audit. The Trust Center hosts WhichWay's own compliance posture. |
| **Framework accuracy** — incorrect control mappings or outdated framework definitions could lead to false compliance confidence | Framework control definitions are sourced from official framework documentation (AICPA TSC for SOC 2, NIST SP 800-53 mappings). Versioned with release notes. Manual review by a compliance advisor before each framework version is published. |
| **Audit rejection** — an auditor may not accept AI-collected evidence or may question the Evidence Vault's integrity | Engage with a CPA firm during Phase 1 to validate evidence collection methodology. Get written confirmation that the approach meets AICPA standards. Auditor access is read-only and scoped — they can verify the hash chain themselves. |

### Go-to-Market Risks

| Risk | Mitigation |
|---|---|
| **Market saturation** — Vanta, Drata, Secureframe, Vero, Tugboat Logic already exist | Niche focus: mobile-first, PropTech-specific, stack-native. Don't compete on breadth — compete on depth for a specific audience. Vanta doesn't know what an Expo privacy label is. WhichWay does. |
| **Pricing resistance** — $399/mo for Growth may be steep for pre-revenue startups | Starter tier at $99/mo with real value (not a crippled free tier). Implementation sprint as a wedge — once you're integrated, switching cost is high. Open-source the monitor definitions so the community contributes monitors, increasing value without engineering cost. |
| **Channel conflict with Porchivo** — building two products simultaneously could split focus | WhichWay is built on Porchivo's existing infrastructure. 80% of the backend patterns (auth, RLS, rate limiting, edge functions) are already built. The 90-day build leverages existing code, not greenfield. WhichWay also directly benefits Porchivo by enabling enterprise deals. |

### Technical Debt Traps

| Risk | Mitigation |
|---|---|
| **Monitor definition sprawl** — ad-hoc monitors without a structured definition format become unmaintainable | Every monitor is defined as a typed TypeScript module implementing a `Monitor` interface: `id`, `name`, `controlId`, `schedule`, `execute()`, `evaluate()`, `collectEvidence()`. No string-based configs. No inline SQL. |
| **Framework definition rigidity** — hardcoding SOC 2 controls makes it hard to add HIPAA/ISO later | Frameworks are data-driven, defined in JSON/TypeScript config files with version tracking. Control mappings are many-to-many. Adding a framework is a config addition, not a code change. |
| **Evidence Vault scaling** — hash-chain verification becomes O(n) as the vault grows | Periodic hash tree construction (Merkle tree) for O(log n) verification. Evidence older than 2 years is archived to cold storage with a tree root hash. Active verification only on recent evidence. |

### Fake Enterprise Feature Traps

| Risk | Mitigation |
|---|---|
| **Building SSO before anyone asks for it** — SSO/SAML is expensive to build and maintain. If no enterprise customer has asked for it, it's a distraction. | SSO is Phase 3 (day 60–90) only if a design partner requires it. Otherwise, defer to post-MVP. Don't build enterprise features on spec. |
| **Custom framework builder before product-market fit** — a visual framework builder is a 3-month feature that 2 customers will use. | Ship with SOC 2 + HIPAA + ISO 27001 pre-built. Custom framework builder is a post-launch feature gated behind Enterprise tier demand. |
| **Multi-region deployment before single-region works** — don't build for global scale before you have 10 customers. | Single-region (Supabase US-East) for first 12 months. Multi-region is a post-Series-A concern. Focus on product quality, not infrastructure heroics. |

---

## Final Deliverables

### A. Product Positioning Statement

WhichWay is the stack-native compliance automation platform that turns your Supabase, GitHub, and Stripe infrastructure into a continuous, self-documenting evidence pipeline — so mobile-first companies like Porchivo can prove trust to enterprise buyers on demand, not in six weeks.

### B. Investor Pitch

Every PropTech and mobile SaaS company hitting the enterprise market faces the same wall: a 200-question security questionnaire and a demand for a SOC 2 report. Today, they spend $50K and 6 months with Vanta or a compliance consultant to get there — and the result is a static snapshot that's stale the day it's issued. WhichWay is different: it's built by a mobile-first, Supabase-native company for mobile-first, Supabase-native companies. It monitors your actual RLS policies, branch protection rules, and webhook security continuously — not once a year. It generates remediation as code, not as consultant hours. It ships a public Trust Center that lets buyers self-serve the security review before the first sales call. And it does it all on a stack the founder already knows, in 90 days, at a price point that starts at $99/mo. The compliance market is $3B and growing, and the incumbents don't understand mobile, don't understand PropTech, and don't understand lean teams. WhichWay does. We're not building a better Vanta — we're building the only Vanta that actually fits.

### C. Landing Page Hero Copy

Your stack runs on Supabase, ships from GitHub, and bills through Stripe. Your compliance should run on the same rails. WhichWay watches your RLS policies, branch protection, webhook signatures, and MFA enrollment continuously — collecting evidence automatically, flagging drift before an auditor finds it, and generating a public Trust Center that lets enterprise buyers self-serve their security review. No screenshots. No spreadsheets. No annual panic. Just continuous trust, built for the stack you already use.

### D. Internal Memo from the CEO

**Team,**

We're building WhichWay — a compliance automation platform that turns our own Supabase/GitHub/Stripe infrastructure into a continuous evidence pipeline. Here's why.

Every enterprise HOA, property management company, and real estate buyer we talk to asks the same question before they'll sign: "Can we trust you with our residents' data?" Today, our answer is a sales pitch. With WhichWay, our answer is a link to a live Trust Center that shows our compliance posture in real time, auto-collected from our actual infrastructure.

But this isn't just about Porchivo. Every mobile-first, Supabase-native startup hitting the enterprise market faces the same wall — a 200-question security questionnaire and a demand for SOC 2. Vanta, Drata, and Secureframe were built for web-only SaaS companies with dedicated compliance teams. They don't check RLS policies. They don't know what an Expo privacy label is. They don't generate remediation as code. We do, because we live in this stack.

We can ship WhichWay in 90 days because 80% of the infrastructure is already built — our auth, RLS, rate limiting, edge functions, and audit logging are all production-ready from the Porchivo security gateway. The same skills that built Porchivo build WhichWay. The same stack that runs Porchivo runs WhichWay.

WhichWay dogfoods itself from day one — we are our first customer. By the time we open it to external tenants, we'll have 90 days of dogfooded evidence, a working Trust Center, and a SOC 2 Type I audit in flight. That's not a pitch deck. That's a product.

Focus stays on Porchivo. WhichWay is built on Porchivo's infrastructure, not a distraction from it. Every WhichWay feature makes Porchivo more enterprise-ready. Every Porchivo security improvement makes WhichWay more credible.

We start Monday. Phase 1 is 30 days. Ship the Command Center, 5 monitors, and the Evidence Vault. Make it real.

Let's build the trust layer for the stack we already believe in.

— CEO, WhichWay Web Labs LLC