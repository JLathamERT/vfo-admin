# VFO architecture documentation

Read-only architecture map of the VFO portal system. Documents what exists in the code, where, and what triggers what — with `file:line` citations to the actual source.

> This documentation describes the system as it stood when the map was generated (2026-05-07). It does not prescribe changes. Where uncertainties exist, they are flagged explicitly rather than papered over with assumptions.

## What's in this system

Two repos, one Supabase project, four external integrations, one static-hosted SPA — held together by a single 4964-line edge function dispatching ~125 actions. See [architecture/01-system-map.md](architecture/01-system-map.md) for the high-level picture.

The central business flow is the **MAP1 contract-and-payment chain**: PIP1 reconfirmation → PF decision → PCADMIN pricing → BoldSign agreement → CEO countersign → Stripe payment → confirmation/invoice/receipt → revenue share. State lives in a single ~80-column row of `pipeline_map1`, with each handler advancing specific columns. See [flows/contract-and-payment.md](flows/contract-and-payment.md) for the end-to-end trace.

## Doc tree

```
docs/
├── README.md                         (this file — start here)
├── glossary.md                       (MAP1, PIP, PCADMIN, MSM, CIQ, etc.)
│
├── architecture/                     (the "where" layer — files, routes, dispatchers)
│   ├── 01-system-map.md              (top-level diagram)
│   ├── 02-frontend-shell.md          (routes + AdminPortal/MemberPortal/ClientDetail)
│   ├── 03-edge-functions.md          (vfo-admin-api + boldsign-webhook structure)
│   ├── 04-auth-and-sessions.md       (token model, session storage, role gates)
│   ├── 05-api-action-catalog.md      (all ~125 actions, concise table format)
│   └── 06-orchestration-files.md     (file ranking by feature ownership)
│
├── tables/                           (the "noun" layer — 51 public-schema tables)
│   ├── README.md                     (51-table index by group)
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
│   └── notifications.md
│
├── flows/                            (the "verb" layer — end-to-end business processes)
│   ├── README.md                     (flow index + global open questions)
│   ├── contract-and-payment.md       (the master MAP1 flow — all 13 steps)
│   ├── boldsign-webhook.md           (sign events → pipeline updates → chains)
│   ├── stripe-webhook.md             (payment events → pipeline updates → chains)
│   ├── ciq.md                        (intake questionnaire workflow)
│   ├── specialist-onboarding.md      (multi-stage vetting workflow)
│   ├── msm-tracking.md               (32-action MSM subsystem map)
│   ├── coaching-renewals.md          (coaching meeting + renewal log)
│   ├── gift-credits.md               (GC marketplace buy/redeem)
│   └── notifications.md              (in-portal bell feed)
│
└── integrations/                     (the "external" layer — APIs and secrets)
    ├── stripe.md                     (Customer/Checkout/PaymentIntent/Transfer/webhook)
    ├── boldsign.md                   (document/send + getEmbeddedSignLink + webhook)
    ├── gmail.md                      (drafts API + token-refresh pattern)
    ├── google-sheets.md              (Revenue Master + per-batch sheet reads)
    ├── google-drive.md               (per-client folder PDF uploads)
    ├── supabase.md                   (project, RLS, storage buckets, migrations)
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
3. **Reminder followup columns** — `c14_followup{1,2}_sent`, `c17_followup{1,2}_sent`, `pay1_followup{1,2}_sent`, `c17_followup_sent_date` exist but no code writes them. Cron / external / unimplemented? See [flows/contract-and-payment.md](flows/contract-and-payment.md#reminder-followups-unimplemented).
4. **`gc_create_checkout` admin-only gate** — gated by `ADMIN_ONLY_ACTIONS` but invoked from a member-mounted React component. Members would currently get HTTP 403. See [flows/gift-credits.md](flows/gift-credits.md#auth).
5. **Gmail OAuth account identity** — which Gmail account owns the refresh token, and where do the drafts appear? Not visible from code.
6. **`boldsign_template_id` column** — read but never used in the BoldSign API request. Vestigial?
7. **`stripe_test_mode` column** — exists on `pipeline_sandbox_config` but no code reads it.

## Verification

This doc map can be audited against the source:

- Every `file:line` citation should resolve to the claimed handler — try opening any link.
- The action catalog count (130 in [05-api-action-catalog.md](architecture/05-api-action-catalog.md)) should match `grep -c 'if (action === ' vfo-admin-api/index.ts`.
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

Generated: 2026-05-07. Project ID: `ejpsprsmhpufwogbmxjv`. Postgres 17. Edge functions: `vfo-admin-api` v194, `boldsign-webhook` v23.
