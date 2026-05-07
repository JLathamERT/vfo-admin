# Auth tables

Session tokens and login credentials for both portals. The frontend never talks to Supabase Auth — instead it calls `vfo-admin-api` actions `admin_login` / `member_login`, which return a token stored in `sessionStorage` and presented on every subsequent request.

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

The admin allow-list with hashed passcodes. Migration `hash_passcodes_and_cleanup_sessions` indicates `passcode` is hashed.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `email` | text | not null |
| `name` | text | |
| `passcode` | text | not null. Hashed. |
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
| `passcode` | text | not null. Hashed. |
| `member_number` | text | not null. fk → `member_plugin_settings.plugin_member_number` (cascade). |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `member_login`, `login` (unified), `load_member_login`, `load_my_login`, `create_member_login`, `update_member_login`.

---

## Token flow

1. Client calls `admin_login` / `member_login` with `{email, passcode}`.
2. Edge function verifies hash against `allowed_admins.passcode` / `member_logins.passcode`, inserts a row into `admin_sessions` with a generated token + 24h expiry, returns the token.
3. Frontend stashes `{token, email, name, role, ...}` in `sessionStorage` under key `vfo_session` ([api.js:5](src/lib/api.js)).
4. Every subsequent `callApi(action, payload)` includes `token` in the request body.
5. Edge function does its own session check on each action. On 401, `callApi` clears the session and hard-redirects to `/vfo-portal/` ([api.js:17-21](src/lib/api.js)).
