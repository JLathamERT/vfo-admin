# System map

The top-level picture. Two repos, one Supabase project, four external integrations, one static-hosted SPA. The whole system is held together by an **88-line orchestrator** in `vfo-admin-api/index.ts` that dispatches to **130 modular action handlers** plus two routers (`router/dispatch.ts`, `router/webhooks.ts`).

> **Refactor history.** The edge function was a single 4371-line file as of `vfo-admin-api` v194 (deployed 2026-05-07). The modular extraction was completed in 18 phased commits and deployed as v196 on 2026-05-08. All 128 action handlers at that point preserved their original behavior byte-equivalently — the public API contract (action names, response shapes, DB writes) was unchanged. Two new actions were added post-refactor: `automation_CONTRACT_revshare_sweep` (rev-share cron sweep) and `save_sandbox_config` (admin sandbox/live-mode toggle). Current total: 130. See [03-edge-functions.md](03-edge-functions.md) for the new file layout.

## High-level diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (gh-pages SPA)                                │
│                  https://jlathamert.github.io/vfo-portal/                        │
│                                                                                  │
│   /          /admin       /admin/login   /admin/client/:id   /decide?token=...   │
│              /member      /member/login  /member/client/:id  /pay?token=...      │
│                                                                                  │
│   sessionStorage: vfo_session = { token, role, name, ... }                       │
└──────────────────────────────┬─────────────────────────────────┬─────────────────┘
                               │ Bearer ANON_KEY                  │ no Authorization
                               │ + body.token (session)           │ + URL ?token=
                               │                                  │
                               ▼                                  ▼
                          ┌─────────────────────────────────────────────┐
                          │   SUPABASE EDGE FUNCTION: vfo-admin-api      │
                          │   (130 actions, 88-line orchestrator         │
                          │    + 130 handler files + 2 routers)          │
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
- **Browser → admin-api (token-link pages)**: `/decide` and `/pay` use raw `fetch` with URL token (no session). Reach the public-token handlers via `PUBLIC_HANDLERS` in `router/dispatch.ts` (which is dispatched BEFORE the `middleware/auth.ts` gate). Public-token actions: `automation_PCADMIN_finaldecision`, `automation_CONTRACT_loadpayment`, `automation_CONTRACT_stripecheckout`.
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
              │       9 public-token + chain-callable handlers         │
              │       (PCADMIN_finaldecision, CONTRACT_loadpayment,    │
              │        CONTRACT_stripecheckout — URL token             │
              │        endpoints; CONTRACT_ceocountersign,             │
              │        CONTRACT_stripecustomer, CONTRACT_paymentemail, │
              │        CONTRACT_revshare, CONTRACT_confirmationemail,  │
              │        CONTRACT_invoicereceipt — server-to-server)     │
              │                                                        │
              │  ─── middleware/auth.ts (Token gate) ──────────        │
              │     Reads body.token, looks up admin_sessions.         │
              │     Detects role: admin (allowed_admins) or member     │
              │     (member_logins).                                   │
              │                                                        │
              │  ADMIN_ONLY_ACTIONS (constants/role-gates.ts):         │
              │     ~52 mutations → 403 for member callers             │
              │                                                        │
              │  MEMBER_SCOPED_ACTIONS (constants/role-gates.ts):      │
              │     ~17 reads/writes → body.member_number forced       │
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
- **One background job: daily revshare sweep.** `pg_cron` runs `automation_CONTRACT_revshare_sweep` at 02:00 UTC via `pg_net.http_post`. See `vfo-edge-functions/supabase/cron/revshare-sweep.sql` for setup. Reminder columns on `pipeline_map1` (`c14_followup1_sent`, `c17_followup1_sent`, `pay1_followup1_sent`, etc.) remain unimplemented — no code writes them.
