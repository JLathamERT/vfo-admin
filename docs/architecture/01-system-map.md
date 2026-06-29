# System map

The top-level picture. Two repos, one Supabase project, four external integrations, one static-hosted SPA. The whole system is held together by an **88-line orchestrator** in `vfo-admin-api/index.ts` that dispatches to **~206 modular action handlers** plus two routers (`router/dispatch.ts`, `router/webhooks.ts`).

> **Refactor + feature history.** The edge function was a single 4371-line file as of `vfo-admin-api` v194 (deployed 2026-05-07). The modular extraction was completed in 18 phased commits and deployed as v196 on 2026-05-08. All 128 action handlers at that point preserved their original behavior byte-equivalently — the public API contract (action names, response shapes, DB writes) was unchanged. Post-refactor additions: MAP1 sweeps (`automation_CONTRACT_revshare_sweep`, `automation_CONTRACT_chargescheduled_sweep`, `automation_CONTRACT_checkreminder_sweep`), MAP1 check path, sandbox toggle, the full Tax Planning automation track (~27 new tax handlers in `actions/tax/`), the Tax 4 meeting-date nudge, the Advisor Onboarding pipeline (21 handlers in `actions/advisor/` — Phases 1-6 deployed 2026-05-22 through 2026-05-26 + member-portal login setup chain + admin Automation Panel loader added 2026-05-28 + always-15th renewal-date rule), the PIP Meetings automation chain (13 handlers in `actions/msm/pip-*.ts` + 1 panel loader — deployed 2026-05-27), and the Accountant Onboarding pipeline (21 handlers in `actions/accountant/` + new Partnership? step — deployed 2026-05-28 as v323→v330, mirrors advisor pattern with conditional $4,000/$2,000 pricing per partnership, dual `agreement_templates` rows, no revenue_decision on member, 06:00 UTC reminder cron). Member numbering was later (2026-05-29, v336) reworked into the durable `member_category` taxonomy + category-relative `nextMemberNumber` helper — see GOTCHAS.md gotcha #48; the old fixed 30000/60100/90000 ranges are gone. Later additions include the read-only Payments aggregation tabs (per-person + global `all_payments_load`) and, in v483 (2026-06-16, "Phase D"), the **admin-initiated payment-method change** capability: a superadmin "send card-update link" action (`payments_send_card_update`) + two PUBLIC-token client legs that mint a Stripe `mode=setup` checkout, whose `checkout.session.completed` is handled by the system's first SetupIntent webhook branch — saving the new card/bank as the engagement's default for future off-session charges across MAP 1 / Tax / Specialist-license. **Current total (v483): 307** (5 logins + 102 PUBLIC + 200 AUTH). See [03-edge-functions.md](03-edge-functions.md) for the new file layout, [../flows/tax-planning.md](../flows/tax-planning.md) for the tax track, [../flows/pip-meetings.md](../flows/pip-meetings.md) for the PIP Meetings track, `ADVISOR_ONBOARDING_RESUMPTION.md` for the advisor onboarding state, and `ACCOUNTANT_ONBOARDING_RESUMPTION.md` (both at repo root) for the accountant onboarding state.

## High-level diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (gh-pages SPA)                                │
│                  https://jlathamert.github.io/vfo-portal/                        │
│                                                                                  │
│   /          /admin       /admin/login   /admin/client/:id   /decide?token=...   │
│              /member      /member/login  /member/client/:id  /pay?token=...      │
│                                                              /tax-pay?token=...  │
│                                                              /advisor-pay?token  │
│                                                              /accountant-pay?... │
│                                                              /pip-pay?token=...  │
│                                                              /member-setup?token │
│                                                                                  │
│   sessionStorage: vfo_session = { token, role, name, ... }                       │
└──────────────────────────────┬─────────────────────────────────┬─────────────────┘
                               │ Bearer ANON_KEY                  │ no Authorization
                               │ + body.token (session)           │ + URL ?token=
                               │                                  │
                               ▼                                  ▼
                          ┌─────────────────────────────────────────────┐
                          │   SUPABASE EDGE FUNCTION: vfo-admin-api      │
                          │   (307 actions, 88-line orchestrator         │
                          │    + ~211 handler files + 2 routers)         │
                          │                                              │
                          │   Three dispatch surfaces:                   │
                          │   1. Stripe webhook  (router/webhooks.ts —   │
                          │      stripe-signature hdr)                   │
                          │   2. BoldSign webhook (router/webhooks.ts —  │
                          │      body.event shape)                       │
                          │   3. Action dispatcher (router/dispatch.ts — │
                          │      PUBLIC_HANDLERS + AUTH_HANDLERS maps)   │
                          │                                              │
                          │   Token gate via middleware/auth.ts;         │
                          │   role gates from constants/role-gates.ts.   │
                          └────┬────────┬────────┬──────────┬────────────┘
                               │        │        │          │
              service_role     │        │        │          │ chains
              (RLS bypass)     │        │        │          │ (admin-api → admin-api)
                               │        │        │          │ via SERVICE_ROLE_KEY
                               ▼        │        │          ▼
                       ┌──────────────┐ │        │     ┌────────────────────┐
                       │  POSTGRES    │ │        │     │  vfo-admin-api     │
                       │  51 tables   │ │        │     │  (loopback)        │
                       │  RLS denies  │ │        │     └────────────────────┘
                       │  anon by     │ │        │
                       │  default     │ │        │
                       └──────────────┘ │        │
                                        │        │
                       ┌────────────────┘        │
                       ▼                         │
              ┌──────────────────┐               ▼
              │ Storage buckets  │       ┌─────────────────────────────────┐
              │ - headshots      │       │  EXTERNAL APIs                  │
              │ - member-vault   │       │  ─────────────                  │
              └──────────────────┘       │  Stripe         (payments,      │
                                         │                  transfers,     │
                                         │                  webhook)       │
              ┌──────────────────┐       │  BoldSign       (e-sign,        │
              │  STANDALONE FN:  │       │                  webhook)       │
              │ boldsign-webhook │◄──────│  Gmail API      (drafts only)   │
              │  (95 lines)      │       │  Google Sheets  (read-only,     │
              └────────┬─────────┘       │                  rev share)     │
                       │ chains          │  Google Drive   (per-client     │
                       └────────────────►│                  PDF folder)    │
                                         │  html2pdf.app   (PDF gen)       │
                                         └─────────────────────────────────┘

                                         ┌─────────────────────────────────┐
                                         │  WEBHOOK INGRESS                │
                                         │  ─────────────                  │
                                         │  Stripe ───► vfo-admin-api      │
                                         │  BoldSign ─► boldsign-webhook   │
                                         │             OR vfo-admin-api    │
                                         │             (configured ext.)   │
                                         └─────────────────────────────────┘
```

## Repos

| Repo | Path | Purpose |
|---|---|---|
| `vfo-react` | `C:\vfo-react\.claude\worktrees\determined-elgamal-40071c` (this worktree) | React + Vite + react-router-dom v6 SPA. Static-hosted to GitHub Pages. |
| `vfo-edge-functions` | `C:\vfo-edge-functions` | Two Supabase edge functions. No local migrations directory — schema is managed remotely. |

## Runtime targets

| Component | Runtime | Where it runs |
|---|---|---|
| SPA | Browser (Vite-built static bundle) | `https://jlathamert.github.io/vfo-portal/` |
| `vfo-admin-api` | Deno 2 (Supabase Edge Runtime) | Supabase project `ejpsprsmhpufwogbmxjv`, region `us-east-2` |
| `boldsign-webhook` | same | same |
| Postgres | Supabase Postgres 17 | same project |
| Storage | Supabase Storage | same project, buckets `headshots` (public read) + `member-vault` (signed URLs) |

## Data direction

- **Browser → admin-api**: every action via [src/lib/api.js](src/lib/api.js). Includes session token in body.
- **Browser → admin-api (token-link pages)**: `/decide`, `/pay`, `/tax-decide`, `/tax-pay`, `/tax-implement-decide`, `/tax-postreview-decide`, `/advisor-decide`, `/advisor-pay`, `/accountant-decide`, `/accountant-pay`, `/pip-pay`, `/member-setup` use raw `fetch` with URL token (no session). Reach the public-token handlers via `PUBLIC_HANDLERS` in `router/dispatch.ts` (which is dispatched BEFORE the `middleware/auth.ts` gate). Public-token actions span MAP1, Tax, Advisor Onboarding, Accountant Onboarding, and PIP pipelines — see [05-api-action-catalog.md](05-api-action-catalog.md). The `/member-setup` page falls through advisor → accountant token lookup so one shared page handles login-setup for both onboarding pipelines.
- **admin-api → Postgres**: via `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` — service-role bypasses RLS. Auth is application-level.
- **admin-api → admin-api (loopback chains)**: server-to-server `fetch` with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Used by webhooks and automation handlers to chain into other handlers. The chains route to public-token actions, so they bypass the user-session gate.
- **admin-api → external APIs**: Stripe, BoldSign, Google OAuth, Gmail, Sheets, Drive, html2pdf.app. All via `fetch` with API-specific auth.
- **Stripe → admin-api**: webhook with `stripe-signature` header, HMAC-verified.
- **BoldSign → ???**: webhook with `body.event.eventType`. URL configured externally — could be the standalone function OR the embedded handler in admin-api. Only the standalone version chains downstream.

## State carriers

| State | Where | Authority |
|---|---|---|
| Identity | `allowed_admins`, `member_logins` | Postgres |
| Active session | `admin_sessions` (server) + `vfo_session` in `sessionStorage` (client mirror) | Both — server validates, client transmits |
| Pipeline state machine | `pipeline_map1` row (~80 columns) | Postgres |
| Client/member/program state | various tables | Postgres |
| In-flight UI tab/section | `sessionStorage` keys (`adminActiveTab`, etc.) | Client only |
| Sandbox toggle | `pipeline_sandbox_config` per pipeline | Postgres |
| Email/agreement copy | `email_templates`, `agreement_templates` | Postgres (admin-editable) |

## Authentication boundary

```
              UNAUTHENTICATED                      AUTHENTICATED
              ───────────────                      ─────────────
              /decide   /pay                       /admin    /admin/client/:id
              (URL token)                          /member   /member/client/:id

              ↓ raw fetch                          ↓ callApi (Bearer ANON_KEY +
              ↓ no Authorization                   ↓         body.token = session)
              ↓                                    ↓
              ┌────────────────────────────────────────────────────────┐
              │  vfo-admin-api orchestrator (index.ts, 88 lines)       │
              │                                                        │
              │  1. router/webhooks.ts (Stripe + BoldSign by shape)    │
              │  2. admin_login / member_login / login (inline,        │
              │     pre-webhook order preserved)                       │
              │  3. PUBLIC_HANDLERS map (router/dispatch.ts):          │
              │       100 public-token + chain-callable handlers      │
              │       (PCADMIN_finaldecision, CONTRACT_loadpayment,    │
              │        CONTRACT_stripecheckout — URL token             │
              │        endpoints; CONTRACT_ceocountersign,             │
              │        CONTRACT_stripecustomer, CONTRACT_paymentemail, │
              │        CONTRACT_revshare, CONTRACT_confirmationemail,  │
              │        CONTRACT_invoicereceipt — server-to-server)     │
              │                                                        │
              │  ─── middleware/auth.ts (Token gate) ──────────        │
              │     Reads body.token, looks up admin_sessions.         │
              │     Role: admin / member / client / specialist;        │
              │     is_superadmin = email == SUPERADMIN_EMAIL.          │
              │                                                        │
              │  SUPERADMIN_ONLY_ACTIONS → 403 non-superadmin, then    │
              │  ADMIN_ONLY_ACTIONS → 403 for member callers.          │
              │                                                        │
              │  MEMBER_SCOPED_ACTIONS (constants/role-gates.ts):      │
              │     23 reads/writes → body.member_number forced        │
              │     to caller's own                                    │
              │                                                        │
              │  4. AUTH_HANDLERS map (router/dispatch.ts):            │
              │       116 authed handlers. Both roles can call most;   │
              │       application-level scoping by role-gates.         │
              └────────────────────────────────────────────────────────┘
```

## How to navigate this map

| If you want to know... | Read |
|---|---|
| The full table of routes / pages | [02-frontend-shell.md](02-frontend-shell.md) |
| The shape of the edge function | [03-edge-functions.md](03-edge-functions.md) |
| Auth tokens and gates in detail | [04-auth-and-sessions.md](04-auth-and-sessions.md) |
| Every action handler | [05-api-action-catalog.md](05-api-action-catalog.md) |
| Where logic lives, by file | [06-orchestration-files.md](06-orchestration-files.md) |
| What a specific table holds | [../tables/](../tables/) |
| How a feature works end-to-end | [../flows/](../flows/) |
| External APIs and env vars | [../integrations/](../integrations/) |

## What's NOT in the system

These are explicitly absent from the codebase (read-only observation, no judgement):

- **No backend HTTP server** beyond the Supabase edge functions. The frontend talks directly to `vfo-admin-api`.
- **No client-state library** (Redux, Zustand, etc.). Each page does its own load.
- **No GraphQL.** All API calls are POST with `{action, ...payload}`.
- **No Supabase Auth.** Identity is a custom session-token scheme over `allowed_admins` / `member_logins`.
- **No DB migrations directory** in either repo. Migrations are managed remotely on Supabase.
- **No CI / GitHub Actions** observed. Build and deploy are manual via `npm run deploy` (`gh-pages -d dist`).
- **No tests.** No `__tests__/`, no `.test.js`, no test runner config in `package.json`.
- **No TypeScript** in the React app (only in the Deno edge functions).
- **No environment-specific configs** for the frontend (Supabase ANON_KEY is hardcoded). `VITE_API_URL` IS honored by `src/lib/api.js`, `src/pages/PayPage.jsx`, and `src/pages/DecidePage.jsx` — production behavior unchanged via fallback to the hardcoded prod URL when the env var is unset. (Added on `test/frontend-vs-local-function` branch, commit `3bf0963`, for local-function smoke testing.)
- **No observability beyond `console.log`/`console.error`** in either edge function. No structured logging, no metrics export.
- **Twelve background jobs via `pg_cron` + `pg_net.http_post`** (staggered to avoid races on the same row; jobids 2–13. Also live: `regular-map4-followup-sweep-daily` jobid 11 @09:30 UTC and `growth-overdue-sweep-daily` jobid 12 @10:00 UTC):
  1. **Daily MAP 1 revshare sweep** — `automation_CONTRACT_revshare_sweep` at 02:00 UTC. Setup: `vfo-edge-functions/supabase/cron/revshare-sweep.sql`.
  2. **Daily Tax revshare sweep** — `automation_TAX_revshare_sweep` at 02:30 UTC. Retries Pending/Failed tax revshare AND drives Tax 3/4/5 reminder timers + Tax 4 meeting-date nudge. Setup: `vfo-edge-functions/supabase/cron/tax-revshare-sweep.sql`.
  3. **Daily scheduled-payment charger** — `automation_CONTRACT_chargescheduled_sweep` at 03:00 UTC. Creates off-session Stripe PaymentIntents for MAP1 quarterly card/ACH payments 2-4 once `payN_date` arrives. Setup: `vfo-edge-functions/supabase/cron/chargescheduled-sweep.sql`.
  4. **Daily check-payment reminder sweep** — `automation_CONTRACT_checkreminder_sweep` at 04:00 UTC. Drafts Gmail reminders for MAP1 quarterly check clients ~7 days before each P2/P3/P4 due date. Setup: `vfo-edge-functions/supabase/cron/check-reminder-sweep.sql`.
  5. **Daily Advisor Onboarding sweep** — `automation_ADVISOR_sweep` at 05:00 UTC. Three stalls × (48h reminder + 96h notification): Undecided email, agreement signing, payment link. The 96h notification routes to the onboarding's chosen **Team Member Responsible** (`onboarding_team_member` → `teamMemberRecipient`, falls back to the shared `admin` bell), not a generic PF — 2026-06-15. Also runs a 14-day implicit-No auto-decline on stalled Undecided rows. Setup: `vfo-edge-functions/supabase/cron/advisor-sweep.sql`.
  6. **Daily Accountant Onboarding sweep** — `automation_ACCOUNTANT_sweep` at 06:00 UTC. Same three stalls + 14-day implicit-No pattern as advisor, against `accountant_onboarding`. Chains `automation_ACCOUNTANT_declineemail` on auto-decline. Setup: `vfo-edge-functions/supabase/cron/accountant-sweep.sql`.
  7. **Daily Specialist Onboarding sweep** — `automation_SPECIALIST_sweep` at 07:00 UTC (7 stalls × 48h reminder + 96h Tracy FYI; no auto-decline). Setup: `vfo-edge-functions/supabase/cron/specialist-sweep.sql`.
  8. **Daily Partnership Fast Track sweep** — `automation_PFT_sweep` at 08:00 UTC. Discovery-form 2-day reminder email to the accountant + 4-day PF notice, and VFO Fast Track decision-email 2-day reminder + 4-day PF notice. Timers on `pft_engagement`; no auto-decline. Installed by cloning the specialist cron command in-SQL.
  9. **Daily Tax presentation-link sweep** — `automation_TAX_presentation_sweep` at 09:00 UTC (jobid 10). Drafts the `TAX_presentation_link` email (To member, Cc assigned PF) for any `client_tax_plans` row whose `presentation_send_date <= today` and `presentation_email_sent_at IS NULL` (the Tax 2 "Send presentation link to member before meeting" step). Drafts only — no auto-send. Installed via `cron.schedule` with the same Bearer pattern as the other jobs.
  10. **Daily VFO Specialist Revenue payout sweep** — `specialist_revenue_payout_sweep` at 11:00 UTC (jobid 13). Pass 1: retries `pending`/`awaiting_connect`/`failed` payout lines on RECEIVED requests. Pass 2: payment reminder ladder — 48h reminder email to the specialist + 96h FYI notification to Tracy. Setup: `vfo-edge-functions/supabase/cron/specialist-revenue-payout-sweep.sql`.

  The MAP 1 revshare sweep (#1 above) also drives a three-stall reminder ladder (PCADMIN Undecided email, agreement signing, Pay1 link) — 48h client reminder + 96h PF notification per stall. Timer-base columns are `c14_email_sent_at`, `c17_followup_sent_date`, `pay1_email_sent_at`; idempotency guards are `*_reminder_sent_at` / `*_pf_notified_at`. The older `c14_followup*` / `c17_followup1/2_sent` / `pay1_followup*` columns were dropped in migration `map1_reminder_ladder_columns` (2026-05-21). The `pay{2,3,4}_reminder_sent` columns are unrelated to this ladder — they're the 7-day pre-due-date nudges for check clients, written by sweep #3.
