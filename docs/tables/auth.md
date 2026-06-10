# Auth tables

Session tokens and login credentials for all portals. The frontend never talks to Supabase Auth — instead it calls `vfo-admin-api` actions `admin_login` / `member_login` / `client_login` / `specialist_login`, which return a token stored in `sessionStorage` and presented on every subsequent request.

## `admin_sessions`

Stores live admin tokens. Cleaned up by the `auto_cleanup_expired_sessions` migration trigger.

| Column | Type | Notes |
|---|---|---|
| `token` | text | not null. Bearer token presented in API call body. |
| `email` | text | not null. Admin's email; joined to `allowed_admins`. |
| `expires_at` | timestamptz | not null. |
| `created_at` | timestamptz | default `now()`. |

**Touched by:** `admin_login`, every authenticated `vfo-admin-api` action (token validation), `update_my_passcode`.

---

## `allowed_admins`

The admin allow-list. Passcodes are stored as a salted PBKDF2 hash in `passcode_hash` (the unsalted-SHA-256 `passcode` column was dropped 2026-05-29 — see SESSION_REFERENCE gotcha #47).

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `email` | text | not null |
| `name` | text | |
| `passcode_hash` | text | Salted PBKDF2-HMAC-SHA256, format `pbkdf2$sha256$<iter>$<salt>$<hash>`. (Replaced the dropped unsalted `passcode` column.) |
| `role` | text | default `'admin'`. Values seen in code: `'admin'`, `'superadmin'` (gates Admin Editor button). |
| `member_number` | text | Optional link to `members.member_number` (admin-as-member case). |
| `created_at` | timestamptz | default `now()` |

**Status fields:** `role` controls UI gating in [AdminPortal.jsx:205](src/pages/AdminPortal.jsx) (`is_superadmin` checked from session).

**Touched by:** `admin_login`, `load_admins`, `create_admin`, `delete_admin`, `update_my_passcode`.

---

## `member_logins`

Per-member portal logins (separate from `allowed_admins`).

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `email` | text | not null |
| `name` | text | not null |
| `passcode_hash` | text | Salted PBKDF2-HMAC-SHA256, format `pbkdf2$sha256$<iter>$<salt>$<hash>`. (Replaced the dropped unsalted `passcode` column.) |
| `member_number` | text | not null. fk → `member_plugin_settings.plugin_member_number` (cascade). |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `member_login`, `login` (unified), `load_member_login`, `load_my_login`, `create_member_login`, `update_member_login`.

---

## `client_logins`

The third login type (after admin/member) — per-client portal logins for the end customer. RLS enabled, **service-role only** (no policies; all access goes through edge-function handlers). The caller role `'client'` is fenced to `CLIENT_ALLOWED_ACTIONS`.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | serial pk |
| `email` | text | **UNIQUE** |
| `name` | text | |
| `passcode_hash` | text | Salted PBKDF2. |
| `client_id` | integer | fk → `clients.id` (CASCADE). |
| `created_at` | timestamptz | default `now()` |

**Touched by:** written by `submit_client_setup`; read by `client_login`.

---

## `specialist_logins`

The fourth login type (after admin/member/client) — per-specialist portal logins, each linked to an `experts` row. RLS enabled, **no policies** (service-role mediated; all access goes through edge-function handlers). The caller role `'specialist'` is fenced to `SPECIALIST_ALLOWED_ACTIONS`. Shares the `admin_sessions` token table with the other three login types. Migration: `specialist_login_and_expert_link`.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | identity pk |
| `email` | text | not null. **Unique index on `lower(email)`.** |
| `name` | text | not null |
| `passcode_hash` | text | not null. Salted PBKDF2. |
| `expert_id` | bigint | not null. fk → `experts(id)` ON DELETE CASCADE. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** written by `automation_SPECIALIST_submitloginsetup`; read by `specialist_login`.

---

## Token flow

1. Client calls `admin_login` / `member_login` with `{email, passcode}`.
2. Edge function fetches the row by email, verifies the passcode against the salted `passcode_hash` (PBKDF2) via `verifyPasscode()`, inserts a row into `admin_sessions` with a generated token + **8h** expiry, returns the token.
3. Frontend stashes `{token, email, name, role, ...}` in `sessionStorage` under key `vfo_session` ([api.js:5](src/lib/api.js)).
4. Every subsequent `callApi(action, payload)` includes `token` in the request body.
5. Edge function does its own session check on each action. On 401, `callApi` clears the session and hard-redirects to `/vfo-portal/` ([api.js:17-21](src/lib/api.js)).
