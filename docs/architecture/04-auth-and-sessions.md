# Authentication & sessions

The portal uses a **custom session-token scheme** layered on top of the Supabase anon JWT — *not* Supabase Auth. There is no `auth.users` table involvement; identity is `allowed_admins` (admin role) and `member_logins` (member role), and tokens live in `admin_sessions` (single table for both roles, despite the name).

## Storage layout

| Where | What | Key |
|---|---|---|
| Browser `sessionStorage` | The active session object as JSON | `vfo_session` |
| Browser `sessionStorage` | UI state per panel | `adminActiveTab`, `adminMembersSection`, `adminSpecialistsSection`, `adminAutomationSection`, `adminSelectedMember`, `adminMemberFeatureTab`, `memberActiveTab` |
| Supabase `admin_sessions` | Server-side token record | `token` PK, `email`, `expires_at` |

Helpers in [src/lib/api.js](src/lib/api.js):

| Helper | Lines | Purpose |
|---|---|---|
| `callApi(action, payload)` | 4-29 | Wraps `fetch` POST + retry ×3 + 401 redirect |
| `getSession()` | 31-33 | Reads `vfo_session` from `sessionStorage` |
| `setSession(session)` | 35-37 | Writes `vfo_session` |
| `clearSession()` | 39-41 | Removes `vfo_session` |

## Session object shape

After `admin_login` ([AdminLogin.jsx:22](src/pages/AdminLogin.jsx)):
```
{ token, email, name, role: 'admin', is_superadmin: boolean }
```

After `member_login` ([MemberLogin.jsx:19](src/pages/MemberLogin.jsx)):
```
{ token, email, name, role: 'member', member_number, website_enabled }
```

> **Inconsistency:** The session created at login does **not** include `ciq_enabled` / `ciq_vfos_managed`, but [MemberPortal.jsx:132](src/pages/MemberPortal.jsx) reads `session.ciq_enabled` / `session.ciq_vfos_managed` to gate the CIQ tab. Those fields *are* returned by `member_login` (see `actions/auth/member-login.ts`) but are **not persisted to `vfo_session`** by [MemberLogin.jsx:19](src/pages/MemberLogin.jsx). The tab will currently render with `ciqEnabled={undefined}` / `ciqVfosManaged={undefined}`. Behavior in `MemberCIQ.jsx` should be checked under that condition — flagged for Phase E.

## Login flow

```
RolePicker (/) ──► /admin/login ──► callApi('admin_login') ──► setSession ──► /admin
                └─► /member/login ──► callApi('member_login') ──► setSession ──► /member
```

[AdminLogin.jsx](src/pages/AdminLogin.jsx) and [MemberLogin.jsx](src/pages/MemberLogin.jsx) both clear UI-state sessionStorage keys before navigation (lines 18-21 and 18 respectively) — preventing a previous user's tab/section state from leaking into the new session.

## On-the-wire request shape (every authenticated call)

```
POST https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api
Headers:
  Authorization: Bearer <hardcoded-anon-jwt>
  Content-Type: application/json
Body:
  { "action": "<name>", "token": "<session-token>", ...payload }
```

The `Bearer` JWT is the **anon key**, hardcoded into [src/lib/api.js:2](src/lib/api.js). Both edge functions have `verify_jwt = false` (matched in `vfo-edge-functions/supabase/config.toml` and the live registry), so this header is informational rather than enforced at the Kong gateway level. Authentication is the `token` field in the body, validated by `vfo-admin-api/middleware/auth.ts::authenticate()`.

Public-token pages bypass `callApi` entirely — they raw-fetch with no `Authorization` header at all:

| Page | Direct fetch | Token source |
|---|---|---|
| [DecidePage.jsx:33](src/pages/DecidePage.jsx) | `automation_PCADMIN_finaldecision` | URL `?token=...` (matches `pipeline_map1.c15_token`) |
| [PayPage.jsx:20](src/pages/PayPage.jsx) | `automation_CONTRACT_loadpayment` | URL `?token=...` (matches `pipeline_map1.checkout_token`) |
| [PayPage.jsx:38](src/pages/PayPage.jsx) | `automation_CONTRACT_stripecheckout` | same URL token |

> **Resolved.** Previously [PayPage.jsx:4](src/pages/PayPage.jsx) and [src/lib/api.js:1](src/lib/api.js) hardcoded the production URL while only [DecidePage.jsx:4](src/pages/DecidePage.jsx) honored `import.meta.env.VITE_API_URL`. As of `test/frontend-vs-local-function` branch (commit `3bf0963`), all three honor the env var with the production URL as the fallback. Production behavior unchanged when the env var is unset.

## Server-side auth gate

`vfo-admin-api/middleware/auth.ts::authenticate(action, body, supabase, json)` is the single entry point for all token validation and role-gating. It runs after the public-handler dispatch and before the authed-handler dispatch in `index.ts`.

For every action that reaches this gate (i.e., not in `PUBLIC_HANDLERS` and not a login):

1. Reads `body.token`. Returns `401` if missing.
2. Looks up `admin_sessions` row by token. Returns `401` if missing or `expires_at` past (and deletes the expired row).
3. Looks up `allowed_admins` by email → if found: `callerRole='admin'`, `is_superadmin = (email === SUPERADMIN_EMAIL)`. Otherwise `callerRole='member'` and resolves `callerMemberNumber` via `member_logins`.

The function returns either an `AuthResult` of kind `"response"` (early-return 401/403) or kind `"auth"` carrying the full `AuthContext` (defined in `types/index.ts`). Handlers that take `auth` as a 4th parameter receive that context.

### Session lifetime

- Created by `admin_login` / `member_login` / `login` (in `actions/auth/`) with `expires_at = now() + 8h`.
- Note: [tables/auth.md](../tables/auth.md) earlier said "24h" based on token-flow inspection — actual code shows **8 hours**. This doc supersedes that.
- Migration `auto_cleanup_expired_sessions` (2026-04-28) presumably installs a periodic delete; not verified by reading migration content. Flagged.

### Role gates

| Gate | File | Behavior |
|---|---|---|
| `ADMIN_ONLY_ACTIONS` array (~52 entries) | `constants/role-gates.ts` | Member callers get `403 Forbidden` |
| `MEMBER_SCOPED_ACTIONS` array (~17 entries) | `constants/role-gates.ts` | For member callers, `body.member_number` is overwritten with the caller's own value before dispatch |

**Gaps explicitly visible:**
- `add_client_note`, `update_client_note`, `delete_client_note` are in **neither** list — both admin and member can call them, with no DB-level scoping. Security relies on the caller knowing a `note_id` they're allowed to touch.
- `gc_redeem` is not admin-gated; member callers can redeem services for their own `member_number` (which IS forced by `MEMBER_SCOPED_ACTIONS`).
- The whole `ciq_*`, `tax_*`, `coaching_*`, `msm_save_priority_task`, `msm_save_client_task` family is also unrestricted at the role level — relies on application-level ownership checks.

### Front-of-component auth checks

| Component | Check | Action on fail |
|---|---|---|
| [AdminPortal.jsx:79](src/pages/AdminPortal.jsx) | `!session \|\| session.role !== 'admin'` | `navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search))` |
| [MemberPortal.jsx:27](src/pages/MemberPortal.jsx) | `!session \|\| session.role !== 'member'` | `navigate('/member/login')` (no `?next=` preservation — member side not yet updated) |
| [ClientDetail.jsx:59](src/pages/ClientDetail.jsx) | `!session` | `navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search))` (always to admin login, even when arriving from /member route — see flag below) |

> **Post-login redirect**: `AdminLogin.jsx` reads `?next=` from `window.location.search` after a successful sign-in and navigates there if it starts with `/admin/`. Routes outside that prefix fall back to `/admin` (open-redirect safety). The `?next=` value uses the basename-relative path from react-router's `useLocation()` — NOT `window.location.pathname` (which includes Vite's `/vfo-portal/` basename and would fail the prefix check). Pattern was added so admins clicking deep-link admin URLs (e.g. notification-bell links, the Tax 4 Tim-nudge `Open client` button) land on the intended page rather than the admin home after login.

> **Inconsistency 3:** [ClientDetail.jsx:59](src/pages/ClientDetail.jsx) redirects to `/admin/login` even when the route is `/member/client/:clientId`. A logged-out member hitting a member URL would land on the admin login. The sign-out button at line 106 *does* branch correctly on `isMember`, but the missing-session redirect does not. (The `?next=` preservation works for both flows; only the destination login URL is admin-biased.)

## Logout

- [AdminPortal.jsx:113](src/pages/AdminPortal.jsx): `signOut()` → `clearSession()` + `navigate('/')` (returns to RolePicker).
- [MemberPortal.jsx:54](src/pages/MemberPortal.jsx): same.
- [ClientDetail.jsx:106](src/pages/ClientDetail.jsx): `sessionStorage.clear()` + redirect to `/admin/login` or `/member/login` based on `isMember`. **Note:** uses `sessionStorage.clear()`, which wipes UI-state keys too. The portal pages use `clearSession()` which only removes `vfo_session`. Functional difference is small (UI state is regenerated on next login), but it's an inconsistency.

Logout is **client-only** — there is no admin-api action to delete the `admin_sessions` row at sign-out. The token remains valid server-side until `expires_at` passes. A copy of `vfo_session` could in theory be replayed for the remaining lifetime.

## 401 auto-redirect

[src/lib/api.js:17-21](src/lib/api.js): on any 401 response:
```
clearSession()
window.location.href = window.location.origin + '/vfo-portal/'
```

The `'/vfo-portal/'` path is the gh-pages base path. On localhost dev (Vite at port 5173), this redirect lands on `http://localhost:5173/vfo-portal/` which doesn't exist — flagged for the dev-environment doc. In production it resolves correctly to `https://jlathamert.github.io/vfo-portal/`.

## Passcode hashing

**Salted PBKDF2-HMAC-SHA256** (210,000 iterations, 16-byte random salt), stored as `pbkdf2$sha256$<iter>$<saltB64>$<hashB64>` in `allowed_admins.passcode_hash` / `member_logins.passcode_hash`. Helpers live in `vfo-admin-api/utils/crypto.ts` (`hashPasscodeSalted`, `verifyPasscodeSalted`, `isSaltedHash`); the shared `verifyPasscode()` is in `utils/passcode-verify.ts`.

Because each row has its own salt, the login handlers (`admin_login`, `member_login`, legacy `login`) **fetch the row by email, then verify the passcode in code** — they can no longer match the hash inside the SQL query. Writers (`create_member_login`, `update_member_login`, `create_admin`, `update_my_passcode`, advisor/accountant `submit-login-setup`) write only `passcode_hash`.

History: passcodes were unsalted SHA-256 (migration `hash_passcodes_and_cleanup_sessions`, 2026-04-28) until the 2026-05-29 salted rollout (v335) — add nullable `passcode_hash`, dual-write + transparently re-hash each row on its next successful login, then drop the legacy `passcode` column once all rows were salted (migrations `add_passcode_hash_columns`, `passcode_drop_not_null`, `drop_legacy_passcode_column`). The legacy `passcode` column no longer exists.

## Notification polling

[NotificationBell.jsx:12-16](src/components/NotificationBell.jsx) calls `callApi('load_notifications')` on mount and again every **30 seconds** via `setInterval`. This is the only background polling in the frontend. If a session expires while the bell is mounted, the next poll will 401 → trigger the global redirect — observed in transcript reports as "user gets bumped to login while idle."

## Cross-references

- Edge-function auth gate detail: [03-edge-functions.md](03-edge-functions.md#token-auth-gate-line-2190)
- Auth tables: [../tables/auth.md](../tables/auth.md)
- Login action handlers: [05-api-action-catalog.md#auth-no-token-required](05-api-action-catalog.md)
