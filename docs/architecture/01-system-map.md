# System map

The top-level picture. Two repos, one Supabase project, four external integrations, one static-hosted SPA. The whole system is held together by a single 4964-line edge function.

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
                          │   (~125 actions, 4964 lines, single file)    │
                          │                                              │
                          │   Three glued handlers:                      │
                          │   1. Stripe webhook  (stripe-signature hdr)  │
                          │   2. BoldSign webhook (body.event shape)     │
                          │   3. Action dispatcher (body.action)         │
                          │                                              │
                          │   Token gate at line 2190; admin/member      │
                          │   role gates at lines 2226/2261.             │
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
- **Browser → admin-api (token-link pages)**: `/decide` and `/pay` use raw `fetch` with URL token (no session). Bypass the auth gate at admin-api line 2190 by routing to public-token actions (`automation_PCADMIN_finaldecision`, `automation_CONTRACT_loadpayment`, `automation_CONTRACT_stripecheckout`).
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
              │  vfo-admin-api dispatcher                              │
              │                                                        │
              │  Public actions (above line 2190):                     │
              │    automation_PCADMIN_finaldecision (URL token)        │
              │    automation_CONTRACT_loadpayment  (URL token)        │
              │    automation_CONTRACT_stripecheckout (URL token)      │
              │    automation_CONTRACT_*  (server-to-server only)      │
              │    admin_login / member_login / login (credentials)    │
              │                                                        │
              │  ─── Token gate (line 2190) ──────────                 │
              │    Reads body.token, looks up admin_sessions.          │
              │    Detects role: admin (allowed_admins) or member      │
              │    (member_logins).                                    │
              │                                                        │
              │  ADMIN_ONLY_ACTIONS (line 2226): ~52 mutations         │
              │    - 403 for member callers                            │
              │                                                        │
              │  MEMBER_SCOPED_ACTIONS (line 2261): ~17 reads/writes   │
              │    - body.member_number forced to caller's own         │
              │                                                        │
              │  ~70 actions in NEITHER list:                          │
              │    Both roles can call. Application-level scoping only.│
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
- **No environment-specific configs** for the frontend (Supabase URL is hardcoded; only `VITE_API_URL` is honored, and only by `DecidePage`).
- **No observability beyond `console.log`/`console.error`** in either edge function. No structured logging, no metrics export.
- **No background jobs / cron** observed. Several columns suggest reminders should run periodically (`c14_followup1_sent`, etc.) but no implementation found.
