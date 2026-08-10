# VFO architecture documentation

Read-only architecture map of the VFO portal system. Documents what exists in the code, where, and what triggers what — with `file:line` citations to the actual source.

> This documentation describes the system as it stood when the map was generated (2026-05-07). It does not prescribe changes. Where uncertainties exist, they are flagged explicitly rather than papered over with assumptions.

## What's in this system

Two repos, one Supabase project, four external integrations, one static-hosted SPA — held together by a modular `vfo-admin-api` edge function (88-line orchestrator + ~206 handler files) dispatching **458 actions** (6 logins + 452 dispatched PUBLIC/AUTH). See [architecture/01-system-map.md](architecture/01-system-map.md) for the high-level picture.

The central business flow is the **MAP1 contract-and-payment chain**: PIP1 reconfirmation → PF decision → PCADMIN pricing → BoldSign agreement → CEO countersign → Stripe payment → confirmation/invoice/receipt → revenue share. State lives in a single ~80-column row of `pipeline_map1`, with each handler advancing specific columns. See [flows/contract-and-payment.md](flows/contract-and-payment.md) for the end-to-end trace.

Four parallel automation chains follow the same pattern: **Tax Planning** ([flows/tax-planning.md](flows/tax-planning.md) — on `client_tax_plans`), **Advisor Onboarding** (`ADVISOR_ONBOARDING_RESUMPTION.md` at repo root — on `advisor_onboarding`), **Accountant Onboarding** (`ACCOUNTANT_ONBOARDING_RESUMPTION.md` at repo root — on `accountant_onboarding`; mirrors advisor with a new Partnership? step gating pricing $4,000/$2,000 + dual agreement_templates rows + revenue_decision omitted), and **PIP Meetings** ([flows/pip-meetings.md](flows/pip-meetings.md) — on `client_priority_tracks` rows with `track_type='pip'`; mirrors MAP1 payment + invoice/receipt + revshare but without BoldSign + with 1-time payment only).

## Doc tree

```
docs/
├── README.md                         (this file — start here)
├── SESSION_REFERENCE.md              (the LEAN live-state hub — read in FULL at session start)
├── CHANGELOG.md                      (archived session-by-session history — newest-first; read on demand)
├── GOTCHAS.md                        (full numbered gotcha registry #1–#348 — read on demand)
├── NOTIFICATION_AUDIT.md             (every bell notification: who/type/timing, editable in Automation → Notification Editor; + gap analysis)
├── glossary.md                       (MAP1, PIP, PCADMIN, MSM, CIQ, etc.)
├── GROWTH_PLAN_HANDOFF.md            (Advisor Growth Plan — full feature build state; Phases 1–8 + custom priorities/sub-tasks)
├── SPECIALIST_DOC_SHARING_HANDOFF.md (spec-only — future per-document client→specialist sharing feature; not built)
│
├── architecture/                     (the "where" layer — files, routes, dispatchers)
│   ├── 01-system-map.md              (top-level diagram)
│   ├── 02-frontend-shell.md          (routes + AdminPortal/MemberPortal/ClientDetail)
│   ├── 03-edge-functions.md          (vfo-admin-api + boldsign-webhook structure)
│   ├── 04-auth-and-sessions.md       (token model, session storage, role gates)
│   ├── 05-api-action-catalog.md      (all 458 actions, concise table format)
│   └── 06-orchestration-files.md     (file ranking by feature ownership)
│
├── tables/                           (the "noun" layer — 52 public-schema tables)
│   ├── README.md                     (52-table index by group)
│   ├── auth.md                       (admin_sessions, allowed_admins, member_logins)
│   ├── pipeline.md                   (pipeline_map1 — ~80 columns documented)
│   ├── members.md                    (members + plugin settings + history)
│   ├── clients.md                    (clients + contacts + notes + progress)
│   ├── ciq.md                        (client_ciqs + answers + priorities + snapshots)
│   ├── tax.md                        (client_tax_*)
│   ├── programs.md                   (programs + phases + tasks + enrollments)
│   ├── specialists.md                (experts + onboarding workflow)
│   ├── coaching.md                   (coaching meetings + renewals)
│   ├── marketplace-gc.md             (gc_*)
│   ├── documents.md                  (agreement_templates + email_templates + document_numbers)
│   ├── growth.md                     (growth_plan_scores/actions/partnerships/history — Advisor Growth Plan)
│   └── notifications.md
│
├── flows/                            (the "verb" layer — end-to-end business processes)
│   ├── README.md                     (flow index + global open questions)
│   ├── contract-and-payment.md       (the master MAP1 flow — all 13 steps)
│   ├── tax-planning.md               (the Tax Planning flow within Holistic Planning — parallel to MAP1)
│   ├── boldsign-webhook.md           (sign events → pipeline updates → chains)
│   ├── stripe-webhook.md             (payment events → pipeline updates → chains)
│   ├── ciq.md                        (intake questionnaire workflow)
│   ├── specialist-onboarding.md      (multi-stage vetting workflow)
│   ├── msm-tracking.md               (32-action MSM subsystem map)
│   ├── coaching-renewals.md          (coaching meeting + renewal log)
│   ├── gift-credits.md               (GC marketplace buy/redeem)
│   ├── pip-meetings.md               (PIP Meetings purchase + payment + invoice/receipt + revshare + unlock)
│   ├── partnership-fast-track.md     (PFT accountant engagement track + meeting emails + discovery form + onboarding handoff)
│   └── notifications.md              (in-portal bell feed)
│
└── integrations/                     (the "external" layer — APIs and secrets)
    ├── stripe.md                     (Customer/Checkout/PaymentIntent/Transfer/webhook)
    ├── boldsign.md                   (document/send + getEmbeddedSignLink + webhook)
    ├── gmail.md                      (drafts API + token-refresh pattern)
    ├── google-sheets.md              (HISTORICAL — Revenue-Master read removed 2026-07-01, gotcha #164; no code reads Sheets now)
    ├── google-drive.md               (per-client folder PDF uploads)
    ├── supabase.md                   (project, RLS, storage buckets, migrations)
    ├── sentry.md                     (frontend error monitoring; DSN hardcoded, not a secret)
    └── env-vars.md                   (complete env-var inventory + action matrix)
```

## How to navigate

### "I want to understand X"

| If you want... | Start with |
|---|---|
| The 30-second pitch of the system | [architecture/01-system-map.md](architecture/01-system-map.md) |
| What the React app looks like | [architecture/02-frontend-shell.md](architecture/02-frontend-shell.md) |
| What every action does | [architecture/05-api-action-catalog.md](architecture/05-api-action-catalog.md) |
| The MAP1 contract flow specifically | [flows/contract-and-payment.md](flows/contract-and-payment.md) |
| What a column in `pipeline_map1` means | [tables/pipeline.md](tables/pipeline.md) |
| What env vars need to be set | [integrations/env-vars.md](integrations/env-vars.md) |
| How auth works | [architecture/04-auth-and-sessions.md](architecture/04-auth-and-sessions.md) |
| Definitions of MAP1, PIP, MSM, etc. | [glossary.md](glossary.md) |

### "I want to trace through a specific scenario"

| Scenario | Read in this order |
|---|---|
| Client signs an agreement | [flows/contract-and-payment.md](flows/contract-and-payment.md) (Steps 4-7) → [flows/boldsign-webhook.md](flows/boldsign-webhook.md) → [integrations/boldsign.md](integrations/boldsign.md) |
| Client pays first quarterly payment | [flows/contract-and-payment.md](flows/contract-and-payment.md) (Steps 9-12) → [flows/stripe-webhook.md](flows/stripe-webhook.md) → [integrations/stripe.md](integrations/stripe.md) |
| Admin changes a client/member/specialist's card or bank on file | [flows/payment-method-change.md](flows/payment-method-change.md) → [integrations/stripe.md](integrations/stripe.md) |
| Member buys credits | [flows/gift-credits.md](flows/gift-credits.md) → [flows/stripe-webhook.md](flows/stripe-webhook.md#sub-branch-a1--gc-credit-purchase) |
| Admin logs in | [architecture/04-auth-and-sessions.md](architecture/04-auth-and-sessions.md) |
| Member fills out a CIQ | [flows/ciq.md](flows/ciq.md) → [tables/ciq.md](tables/ciq.md) |
| Admin reviews the pipeline state | [architecture/02-frontend-shell.md](architecture/02-frontend-shell.md#what-automationpanel-shows) → [tables/pipeline.md](tables/pipeline.md) |

### "I want to find a specific file"

The biggest files in the codebase are catalogued in [architecture/06-orchestration-files.md](architecture/06-orchestration-files.md), tier-ranked by feature surface.

## Open questions (cross-cutting)

These items are flagged across multiple docs and remain unresolved without external confirmation:

1. **BoldSign webhook URL** — both standalone and embedded handlers exist; only the standalone chains downstream. Live URL must be confirmed in BoldSign's account settings. See [flows/boldsign-webhook.md](flows/boldsign-webhook.md).
2. **Stripe quarterly payments 2-4** — no observed code path creates them with `metadata.payment_number`. May be manual / external / unimplemented. See [flows/stripe-webhook.md](flows/stripe-webhook.md#sub-branch-b1--quarterly-subsequent-payment).
3. ~~Reminder followup columns~~ — **RESOLVED 2026-05-21.** The 48h/96h reminder ladder is now implemented for the three MAP 1 stalls; the legacy unimplemented columns were dropped and replaced with active `*_email_sent_at` / `*_reminder_sent_at` / `*_pf_notified_at` timestamptz columns driven by `automation_CONTRACT_revshare_sweep`. See [flows/contract-and-payment.md](flows/contract-and-payment.md#reminder-ladder-48h-client-reminder--96h-pf-notification).
4. **`gc_create_checkout` admin-only gate** — gated by `ADMIN_ONLY_ACTIONS` but invoked from a member-mounted React component. Members would currently get HTTP 403. See [flows/gift-credits.md](flows/gift-credits.md#auth).
5. **Gmail OAuth account identity** — which Gmail account owns the refresh token, and where do the drafts appear? Not visible from code.
6. **`boldsign_template_id` column** — read but never used in the BoldSign API request. Vestigial?
7. **`stripe_test_mode` column** — exists on `pipeline_sandbox_config` but no code reads it.

## Verification

This doc map can be audited against the source:

- Every `file:line` citation should resolve to the claimed handler — try opening any link.
- The action catalog count (319 in [05-api-action-catalog.md](architecture/05-api-action-catalog.md)) is the sum of the 5 logins in `index.ts` + the 314 dispatch entries (`(c) =>`) in `router/dispatch.ts`.
- The 51-table inventory in [tables/README.md](tables/README.md) should match `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`.
- The 15-migration list in [integrations/supabase.md](integrations/supabase.md) should match Supabase's migration registry.
- Pick any flow doc and trace a "Trigger → Step-by-step → Tables touched → Chains" sequence; every code reference should resolve.

## What this doc explicitly does NOT cover

- **Recommendations** — this is a description of what exists, not what should exist.
- **RLS policy correctness** — `get_advisors` was not run; out of scope.
- **Data inspection** — only structural data was queried (table list, column metadata, the 1-row `pipelines` registry).
- **Remote-system configuration** — BoldSign / Stripe / Gmail OAuth client setup is external to the repos and was not inspected.
- **The biggest React components in detail** — files like [MemberCIQ.jsx](src/components/shared/MemberCIQ.jsx) (111KB), [MSMTracking.jsx](src/components/admin/MSMTracking.jsx) (90KB) were grepped for `callApi` calls but not read in full. Their UI logic is summarized rather than transcribed.

## Source-of-truth notes

When this map and the code disagree, **the code wins**. Memory of past states (e.g., a comment in this doc tree mentioning a column name) becomes stale the moment a handler is rewritten. To verify any claim:
- Open the `file:line` citation
- Run the SQL counterpart against Supabase
- Read the actual handler

Project ID: `ejpsprsmhpufwogbmxjv`. Postgres 17. Edge functions: `vfo-admin-api`, `boldsign-webhook` (current live versions in Supabase Dashboard → Edge Functions). Originally drafted 2026-05-07; updated per feature as the system evolves.
