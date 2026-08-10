# Authentication & sessions

The portal uses a **custom session-token scheme** layered on top of the Supabase anon JWT — *not* Supabase Auth. There is no `auth.users` table involvement; identity is `allowed_admins` (admin role), `member_logins` (member role), `client_logins` (client role), `specialist_logins` (specialist role), and — added 2026-07-22 — **`tax_planner_logins` (tax_planner role)**, and tokens live in `admin_sessions` (single table for all five roles, despite the name).

## Storage layout

| Where | What | Key |
|---|---|---|
| Browser `sessionStorage` | The active session object as JSON | `vfo_session` |
| Browser `sessionStorage` | UI state per panel | `adminActiveTab`, `adminMembersSection`, `adminSpecialistsSection`, `adminAutomationSection`, `adminSelectedMember`, `adminMemberFeatureTab`, `memberActiveTab` |
| Supabase `admin_sessions` | Server-side token record | `token` PK, `email`, `expires_at` |

Helpers in [src/lib/api.js](src/lib/api.js):

| Helper | Lines | Purpose |
|---|---|---|
| `callApi(action, payload)` | 16-70 | Wraps `fetch` POST + retry ×3 + 401 redirect (login 401s shown inline — see below) |
| `getSession()` | 31-33 | Reads `vfo_session` from `sessionStorage` |
| `setSession(session)` | 35-37 | Writes `vfo_session` |
| `clearSession()` | 39-41 | Removes `vfo_session` |

## Session object shape

After `admin_login` ([AdminLogin.jsx:22](src/pages/AdminLogin.jsx)):
```
{ token, email, name, role: 'admin', is_superadmin: boolean }
```

`member_login` (2026-07-02, v535) **rejects Lost/Removed members**: after passcode verification it reads `members.elite_status` and returns **403** "Your membership is no longer active…" for `Lost`/`Removed` — the `member_logins` row is kept, so flipping the member back to Active restores access with the same credentials. The check runs after verification so a wrong password still reads "Invalid credentials" (no status leak). Client/specialist logins are separate types and unaffected; the legacy `login` action authenticates only `allowed_admins`, so there is no member bypass. Existing sessions survive until their 8h expiry. (Gotcha #171.)

After `member_login` ([MemberLogin.jsx:19](src/pages/MemberLogin.jsx)):
```
{ token, email, name, role: 'member', member_number, website_enabled }
```

After `client_login` ([ClientLogin.jsx](src/pages/ClientLogin.jsx)) — new this session:
```
{ token, email, name, role: 'client', client_id }
```

After `specialist_login`:
```
{ token, email, name, role: 'specialist', expert_id }
```

After `tax_planner_login` (added 2026-07-22 — the Tax Planner portal, 5th portal / 6th login type):
```
{ token, email, name, role: 'tax_planner', tax_planner_id }
```

> **Inconsistency:** The session created at login does **not** include `ciq_enabled` / `ciq_vfos_managed`, but [MemberPortal.jsx:132](src/pages/MemberPortal.jsx) reads `session.ciq_enabled` / `session.ciq_vfos_managed` to gate the CIQ tab. Those fields *are* returned by `member_login` (see `actions/auth/member-login.ts`) but are **not persisted to `vfo_session`** by [MemberLogin.jsx:19](src/pages/MemberLogin.jsx). The tab will currently render with `ciqEnabled={undefined}` / `ciqVfosManaged={undefined}`. Behavior in `MemberCIQ.jsx` should be checked under that condition — flagged for Phase E.

## Login flow

```
RolePicker (/) ──► /admin/login ──► callApi('admin_login') ──► setSession ──► /admin
                └─► /member/login ──► callApi('member_login') ──► setSession ──► /member
                └─► /client/login ──► callApi('client_login') ──► setSession ──► /client
```

> **Client setup:** clients don't pre-exist in `client_logins`. They arrive via a token link (`/client-setup?token=`, matched to `clients.client_setup_token`) sent in the first-payment email, set a passcode (`submit_client_setup` → creates the `client_logins` row + stamps `client_setup_completed_at`), then log in at `/client/login`. Mirrors the advisor/accountant member-setup pattern.

> **Specialist login:** `specialist_login` is a pre-auth action in `index.ts` (mirrors `client_login`) — it looks up `specialist_logins` by lowercased email, verifies the passcode (salted PBKDF2 via `verifyPasscode`), creates an `admin_sessions` token (8h), and returns `{ token, name, email, role: "specialist", expert_id }`. The `specialist_logins.passcode_hash` row is written by `automation_SPECIALIST_submitloginsetup`.

> **Tax Planner login (2026-07-22):** `tax_planner_login` is a pre-auth action in `index.ts` (same shape) — it looks up `tax_planner_logins` by lowercased email, verifies the salted passcode, mints an 8h `admin_sessions` token, and returns `{ token, name, email, role: "tax_planner", tax_planner_id }`. The row is written by the unified login-setup flow (`submit_login_setup` with `login_type='tax_planner'`, keyed on `tax_planner_id`) and by the self-service `tax_planner_update_login`. Entry point: the VFOS/ERT login page (`AdminLogin.jsx`) links "Are you a Tax Planner? Sign in here" → `/tax-planner/login` (`TaxPlannerLogin.jsx`) → the `/tax-planner` portal (5th portal — one "Tax Planning" tab, no admin chrome).

> **Self-service passcode reset (2026-08-10, v716) — four portals, never admin.** The four non-admin login pages carry a **"Forgot passcode?"** link to `/forgot-password?type=<member|specialist|client|tax_planner>`, whose single email field POSTs the PUBLIC **`request_password_reset`** (`actions/login-setup/request-reset.ts`). The handler **throttles first** on the identifier **`reset:<email>`** — a deliberately separate namespace from the login throttle below, recording **every request** (5 requests / 15 min) rather than every failure, so reset traffic can neither be used to probe addresses nor lock the same person out of *signing in* — and then **always answers `{ success: true }`** behind a **1200 ms timing floor**, whatever it finds. On a hit it **expires (never deletes)** every prior unused `login_setup_tokens` row for that person, mints a **1-hour** token (`created_by='self-service'`; admin-sent setup links are **14-day**) and auto-sends `email_templates` `LOGIN_SETUP`/`password_reset` (id 216) carrying a `/set-password?token=` link — from there the existing `submit_login_setup` path completes the reset unchanged. Consequences worth knowing: **an admin-sent setup link dies the moment its recipient uses forgot-password** (latest link wins), and **admin passcode resets remain manual by design** — `login_type='admin'` is a 400 and the admin login page has no link. Never add a distinguishing error branch or widen the response (gotcha **#355**).

> **Login forms must carry autofill identity (2026-08-10, gotcha #354).** All five login pages, `SetPasswordPage` and `ChangePasswordCard` now render `id` + `name` + `autoComplete` (`username` / `current-password` / `new-password`) on their fields and read `state || ref.current?.value` on submit. Without that metadata a password manager cannot recognise the field to *update* a saved entry after a reset, so it re-fills the dead passcode until the throttle locks the account — the failure presents as "the passcode works right after a reset and stops working after the next logout", and `login_attempts` will show genuine wrong-password rows against a provably-good hash. `setSession` stores the email that actually authenticated rather than the state variable, for the same reason.

[AdminLogin.jsx](src/pages/AdminLogin.jsx) and [MemberLogin.jsx](src/pages/MemberLogin.jsx) both clear UI-state sessionStorage keys before navigation (lines 18-21 and 18 respectively) — preventing a previous user's tab/section state from leaking into the new session.

### Login throttle (brute-force protection)

All six login handlers (`admin_login`, `member_login`, `client_login`, `specialist_login`, `tax_planner_login`, legacy `login`) are rate-limited via `vfo-admin-api/utils/login-throttle.ts`, backed by the `public.login_attempts` table (RLS deny-all → service-role only; edge functions are stateless so an in-memory counter wouldn't survive across isolates). The flow per login:

1. `checkLoginThrottle(supabase, identifier, ip)` runs **before** the credential lookup. If blocked, the handler returns **HTTP 429** immediately and records nothing further.
2. On either 401 path (no row / bad passcode) the handler calls `recordLoginFailure(supabase, identifier, ip)` (insert + opportunistic prune of rows >1h old).
3. On success, `clearLoginFailures(supabase, identifier)` deletes the identifier's failures.

Limits are a rolling **15-minute window**, keyed on BOTH dimensions: **5 failures per identifier (email)** and **20 failures per source IP**. `index.ts` extracts the client IP from the first entry of the `x-forwarded-for` header and passes it (`ip = ""` default) to all five login dispatches.

**A seventh caller shares this table but not its namespace (2026-08-10):** `request_password_reset` calls the same `checkLoginThrottle` / `recordLoginFailure` pair with the identifier **prefixed `reset:`**, so its rows never count toward — or clear — the login limit for the same address. It records on **every** request rather than on failure, because the point there is to cap probing rather than to cap guessing; the 20-per-IP cap is genuinely shared. See gotcha **#355**.

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
| [UpdateCardPage.jsx:29](src/pages/UpdateCardPage.jsx) | `payments_loadcardupdate` | URL `?token=...` (matches `card_update_tokens.token`) — Phase D admin-initiated card/bank change |
| [UpdateCardPage.jsx:48](src/pages/UpdateCardPage.jsx) | `payments_cardupdate_checkout` | same URL token (mints a Stripe `mode:'setup'` session for the picked engagement) |

> **Resolved.** Previously [PayPage.jsx:4](src/pages/PayPage.jsx) and [src/lib/api.js:1](src/lib/api.js) hardcoded the production URL while only [DecidePage.jsx:4](src/pages/DecidePage.jsx) honored `import.meta.env.VITE_API_URL`. As of `test/frontend-vs-local-function` branch (commit `3bf0963`), all three honor the env var with the production URL as the fallback. Production behavior unchanged when the env var is unset.

## Server-side auth gate

`vfo-admin-api/middleware/auth.ts::authenticate(action, body, supabase, json)` is the single entry point for all token validation and role-gating. It runs after the public-handler dispatch and before the authed-handler dispatch in `index.ts`.

For every action that reaches this gate (i.e., not in `PUBLIC_HANDLERS` and not a login):

1. Reads `body.token`. Returns `401` if missing.
2. Looks up `admin_sessions` row by token. Returns `401` if missing or `expires_at` past (and deletes the expired row).
3. **Role precedence (updated 2026-07-22):** `allowed_admins` by email → `callerRole='admin'`, `is_superadmin = (email === SUPERADMIN_EMAIL)`. Else `client_logins` by email → `callerRole='client'`, `callerClientId = <client_id>`. Else `specialist_logins` by email → `callerRole='specialist'`, `callerSpecialistId = <experts.id>`. Else `tax_planner_logins` by email → `callerRole='tax_planner'`, `callerTaxPlannerId = <tax_planners.id>`. Else `callerRole='member'` and resolves `callerMemberNumber` via `member_logins`. (Admin > client > specialist > **tax_planner** > member — so a planner whose email is also an admin is treated as admin; the ownership guards mirror this precedence, gotcha #257.)
4. **Client deny-by-default gate:** if `callerRole==='client'` and the action is NOT in `CLIENT_ALLOWED_ACTIONS`, returns `403` immediately (before the admin/member gates). A client session can ONLY reach the 4 `client_vault_*` actions + `client_showroom_load`.
5. **Specialist deny-by-default gate:** if `callerRole==='specialist'` and the action is NOT in `SPECIALIST_ALLOWED_ACTIONS`, returns `403` immediately (mirrors the client gate). A specialist session can ONLY reach the 4 `specialist_vault_*` actions.
5a. **Tax-planner deny-by-default gate (2026-07-22):** if `callerRole==='tax_planner'` and the action is NOT in `TAX_PLANNER_ALLOWED_ACTIONS` (~36 entries), returns `403` immediately (mirrors the client/specialist gates). A planner SKIPS both the tab gate and the `ADMIN_ONLY_ACTIONS` gate — the allowlist is the ONLY role boundary — but can NEVER run `SUPERADMIN_ONLY_ACTIONS`. Because the allowlist is the only boundary, every planner-callable handler ALSO carries an in-handler group-scope ownership guard (see the guards section below + gotcha #257). To accommodate the planner (who is neither admin nor member), the `ADMIN_ONLY_ACTIONS` predicate was changed from `callerRole !== "admin"` to `callerRole === "member"` — verified safe: clients/specialists/planners are each fenced by their own allowlist FIRST (they never reach the admin gate), and every `allowed_admins` row is role 'admin'.
6. **Superadmin-only gate (2026-06-16):** if the action is in `SUPERADMIN_ONLY_ACTIONS` and `!is_superadmin`, returns `403` immediately — runs BEFORE the admin-only gate, so it denies even regular (non-Jake) admins. Locks the admin "Automation" tab + its panels, the admin GLOBAL "Payments" tab, AND the "Send Email to Change Payment Method" button to the superadmin (Jake). **14 entries** — 12 Automation-panel-EXCLUSIVE actions + `all_payments_load` (the global Payments page) + `payments_send_card_update` (the Phase D card/bank-update email, added 2026-06-16 / v483; see the role-gates table below).

The function returns either an `AuthResult` of kind `"response"` (early-return 401/403) or kind `"auth"` carrying the full `AuthContext` (defined in `types/index.ts` — includes `callerClientId: number | null`, `callerSpecialistId: number | null`, and — added 2026-07-22 — `callerTaxPlannerId: number | null`; the `callerRole` union now includes `"specialist"` and `"tax_planner"`). Handlers that take `auth` as a 4th parameter receive that context.

### Session lifetime

- Created by `admin_login` / `member_login` / `login` (in `actions/auth/`) with `expires_at = now() + 8h`.
- Note: [tables/auth.md](../tables/auth.md) earlier said "24h" based on token-flow inspection — actual code shows **8 hours**. This doc supersedes that.
- Migration `auto_cleanup_expired_sessions` (2026-04-28) presumably installs a periodic delete; not verified by reading migration content. Flagged.

### Role gates

| Gate | File | Behavior |
|---|---|---|
| `SUPERADMIN_ONLY_ACTIONS` array (14 entries) | `constants/role-gates.ts` | **2026-06-16.** Only the superadmin (Jake — `SUPERADMIN_EMAIL`) may call these; EVERY other caller, including regular admins, gets `403`. Runs BEFORE the `ADMIN_ONLY_ACTIONS` gate, so it is the operative restriction. Scope = the admin "Automation" tab's panels: `automation_load_pipelines`/`_tax_plans`/`_pip_pipelines`/`_advisor_pipelines`/`_accountant_pipelines`/`_specialist_pipelines`, `automation_CONTRACT_paidbycheck`/`_checkcleared`, `automation_TAX_paidbycheck`/`_checkcleared`, `automation_load_email_templates`/`automation_save_email_template`; plus `all_payments_load` (the admin GLOBAL "Payments" tab / `AllPaymentsTab` — NOT an Automation panel, but the same Jake-only restriction, added 2026-06-16); plus `payments_send_card_update` (the Phase D "Send Email to Change Payment Method" button on every per-person Payments tab — drafts the `/update-card` email; added 2026-06-16 / v483). Each Automation entry is fired by exactly one Automation-panel component. Deliberately NOT here (so all admins keep them): `automation_load_pipeline_data` (shared with the client-detail MAP 1 track) + the onboarding-workflow + per-client track-tab actions. The two PUBLIC `/update-card` token-page actions (`payments_loadcardupdate`, `payments_cardupdate_checkout`) are intentionally NOT listed — they live in `PUBLIC_HANDLERS` and bypass the auth gate entirely. |
| `ADMIN_ONLY_ACTIONS` array | `constants/role-gates.ts` | Non-admin callers get `403 Forbidden`. **This is an explicit deny-list for members** — the middleware default for a member caller is ALLOW, so any AUTH action *not* on this list (and not member-scoped) is reachable by a member unless its handler self-guards. Includes the client vault admin actions (`vault_tax_admin_upload_url`, `vault_tax_list`, `vault_tax_download`, `vault_tax_delete`, `vault_gen_list`, `vault_gen_upload_url`, `vault_gen_download`, `vault_gen_delete`), the specialist vault add/remove handlers (`specialist_vault_admin_upload_url` + `specialist_vault_admin_delete`, **added 2026-06-10**, alongside `specialist_vault_admin_list`/`_admin_download`), and — **added 2026-06-15** — the 16 advisor/accountant onboarding AUTH actions (`load_advisor_onboardings`, `load_advisor_onboarding`, `create_advisor_onboarding`, `save_advisor_prelim_meeting`, `save_advisor_team_member`, `automation_ADVISOR_decision`, `automation_ADVISOR_createmember`, `automation_load_advisor_pipelines` + the 8 accountant equivalents incl. `save_accountant_partnership` + `save_accountant_team_member`). These onboarding actions had been unlisted (so a member could reach them via the default-allow) — now closed. Their PUBLIC token/chain/cron counterparts (send-agreement, ceo-countersign, sweep, stripe-customer, etc.) bypass the auth gate entirely (they live in `PUBLIC_HANDLERS`) and are intentionally NOT listed here. Also **added 2026-06-15**: the 3 read-only per-person Payments aggregation actions (`client_payments_load`, `member_payments_load`, `specialist_payments_load`) — **kept admin-only** (the originally-planned Track-3 portal move was CANCELLED 2026-06-16: payments stay admin-only, no portal Payments tabs). The GLOBAL `all_payments_load` (added 2026-06-16) is superadmin-only — in `SUPERADMIN_ONLY_ACTIONS`, NOT here. Also **added 2026-06-16**: 7 client-detail Tax actions (`automation_TAX_pricing`/`_extrameeting`/`_decision`/`_readyfortax3`/`_highlevelmeeting_confirm`/`_presentation_schedule`/`_depositrefund`) — hardening the Tax pipeline to match MAP 1's `PCADMIN_*`; 3 of them (`pricing`/`extrameeting`/`save_meeting_date`) were ALSO moved from `PUBLIC_HANDLERS` to `AUTH_HANDLERS` because they had been callable with no token (gotcha #127). Also **added 2026-06-17** (Growth Plan Phases 7–8): `growth_plan_save_score`, `growth_plan_save_summary`, `growth_plan_set_accountability`, `growth_plan_load_admins` (admin-only growth scoring / accountability-toggle / admin-roster). The other growth writes — `growth_plan_save_actions`/`_save_accountability`/`_add_action`/`_delete_action` — are deliberately NOT here: they self-guard in-handler (member allowed ONLY when the current plan's `accountability_mode` is on), an example of the "unless its handler self-guards" exception. Also **corrected 2026-06-18** (the list always intended these, but the entries had drifted to dead names): the client-note writes are now `add_client_note` + `update_client_note` + `load_client_notes` (joining the already-listed `delete_client_note`; the old `save_client_note` name never matched a real action), and the coaching writes are now `coaching_log_meeting` + `coaching_process_renewal` (replacing the non-existent `coaching_add_meeting` / `coaching_add_renewal`). All four client-note actions and both coaching writes are now genuinely admin-only. |
| `MEMBER_SCOPED_ACTIONS` array | `constants/role-gates.ts` | For member callers, `body.member_number` is overwritten with the caller's own value before dispatch. (2026-06-18: `ciq_load_settings` added here so a member's CIQ-settings read is scoped to their own member number. 2026-06-19: `member_save_exclusions` added — the member-portal Specialists Save; writes only the caller's own `member_exclusions`, never `member_plugin_settings`. **2026-07-30 (v680): `vault_upload_url` added — SECURITY FIX.** It mints signed upload URLs into the private `member-vault` / `member-tax-returns` buckets taking `member_number` from the BODY, and it had been in **no gate list at all**, so any authenticated member session could mint a write into any other member's folder (a write-only hole — `vault_list`/`vault_download` were already scoped). Member-scoped rather than `ADMIN_ONLY` **on purpose**: the member portal itself uploads through it (`MemberPortal.jsx` → `MemberVault admin=false` → `VaultSections` "+ Add document"), so admin-only would have broken the member's own vault; the middleware rewrite is the confinement, and admins keep passing any member's number. Gotcha **#309**.) |
| `CLIENT_ALLOWED_ACTIONS` array (5 entries) | `constants/role-gates.ts` | A `client` session may call ONLY these: `client_vault_list`, `client_vault_upload_url`, `client_vault_download`, `client_vault_delete`, and `client_showroom_load` (added 2026-06-12). Any other action → 403 (deny-by-default). All scope to `auth.callerClientId` (from the session, never the body) — the vault four touch only the caller's own `<client_id>/` files; `client_showroom_load` returns the caller's connected member's enabled specialists. |
| `SPECIALIST_ALLOWED_ACTIONS` array | `constants/role-gates.ts` | A `specialist` session may call ONLY this allowlist; any other action → 403 (deny-by-default, mirrors the client gate). The 4 vault actions (`specialist_vault_list`/`_upload_url`/`_download`/`_delete`) scope to `auth.callerSpecialistId` (the specialist's `experts.id`, from the session, never the body) over the private `specialist-documents` bucket. Also on the allowlist: the `specialist_shared_*` doc-sharing reads (Feature A) + `specialist_update_login` (self-service password); and — **added 2026-06-19** — `specialist_showroom_load` (all Active experts for the specialist-portal Showroom tab; public-style showroom data, email stripped). |
| `TAX_PLANNER_ALLOWED_ACTIONS` array (~36 entries) | `constants/role-gates.ts` | **Added 2026-07-22.** A `tax_planner` session may call ONLY this allowlist; any other action → 403 (deny-by-default). Unlike the client/specialist allowlists, the planner set is BROAD — it re-exposes the whole tax editing surface but under a WHOLE-GROUP ownership guard rather than a single-id scope: the 4 portal actions (`tax_planner_login` is pre-auth; `tax_planner_update_login`, `tax_planner_portal_clients`, `tax_planner_portal_experts`, `tax_save_assess_form`), the ~18 tax editing handlers (save-task, allocate-planner, decision, ready-for-tax3, highlevel-meeting-confirm, presentation-schedule, request-returns, pricing, extra-meeting, implement-decision, postreview-decision, deposit-refund, save-deposit-pi, add-specialist, load-specialists, load-progress, `automation_TAX_sendagreement` [chain target], `msm`-update-tax-status), the client-scoped loaders (`tax_load_plans`, `load_client_notes`, `msm_load_client_home`, `msm_load_client_progress`), the client-note WRITES (`add_client_note`/`update_client_note`/`delete_client_note`, added 2026-07-23 for the planner portal per-phase Notes, group-scoped by `denyIfNotPlannerClient`/`denyIfNotPlannerNote` — #273), the vault reads (`vault_gen_list`/`_download`, `admin_ert_list`/`_download`, `vault_tax_list`/`_download`), and `load_notifications`/`mark_notification_read`. It SKIPS the tab gate and `ADMIN_ONLY_ACTIONS`, so the allowlist + the per-handler group-scope guards are the ONLY boundary (gotcha #257); it can NEVER run `SUPERADMIN_ONLY_ACTIONS`. NOT allowlisted: `tax_start_plan` (no "+ Start Tax Plan" in planner mode) and the PUBLIC_HANDLERS chain targets `automation_TAX_refund`/`_charge_implementation` (they bypass the gate). |

> **Member client-add (v337):** `msm_add_client` (Holistic / Tax / Partnership Fast Track "+ Add Client") and `msm_add_client_contact` are in `MEMBER_SCOPED_ACTIONS`, so a member caller's `body.member_number` is forced to their own. The middleware rewrite is only the first layer — the **handlers themselves add an ownership guard** because `enrollment_id` / `client_id` are NOT scoped by the middleware: `add-client.ts` rejects (`403`) when `enrollment.member_number !== member_number` (applies to all callers; no-op for admins who pass matching pairs), and `add-client-contact.ts` rejects when the target client isn't the caller's (member callers only — keyed on `body.member_number` being present). This is the pattern to follow for any other member-allowed write that takes a foreign-key the middleware can't scope.

### Caller-ownership guards (C2 — member→resource IDOR scoping, 2026-06-18)

`MEMBER_SCOPED_ACTIONS` only forces `body.member_number`; it cannot scope a `client_id` / `ciq_id` / `enrollment_id` carried in the body. Before this session a member could pass another member's client/CIQ/enrollment id to several read+write handlers and have it honored. The fix is a set of reusable **per-request ownership guards** that every affected handler now calls at the top, returning a 403 `Response` (or `null` to proceed). All three key off `auth.callerMemberNumber` (session-derived, un-spoofable) and are **no-ops for admins** (`auth.callerRole !== "member"` → returns `null` so admins stay unrestricted):

| Guard | File | Checks |
|---|---|---|
| `denyIfNotOwnClient(supabase, clientId, auth, json)` | `utils/client-ownership.ts` | `clients.member_number` of `clientId` matches the caller. |
| `denyIfNotOwnEnrollment(supabase, enrollmentId, auth, json)` | `utils/client-ownership.ts` | `member_enrollments.member_number` of `enrollmentId` matches the caller. |
| `denyIfNotOwnCiq(supabase, ciqId, auth, json)` | `actions/ciq/shared.ts` | `client_ciqs.member_number` of `ciqId` matches the caller. |

Handlers that gained an `auth: AuthContext` param + a guard (and whose `router/dispatch.ts` registrations now pass `c.auth`):
- **`denyIfNotOwnClient`:** `msm_update_client`, `msm_load_client_home`, `msm_load_client_detail`, `msm_save_client_task`, `msm_load_client_progress`, `msm_delete_client_contact`, `member_load_pipeline`.
- **`denyIfNotOwnCiq`:** `ciq_load`, `ciq_save`, `ciq_complete`, `ciq_load_priorities`, `ciq_save_priorities`, `ciq_complete_priorities`, `ciq_save_priority_snapshot`, `ciq_load_priority_snapshots`, `ciq_set_accountability`.
- **`denyIfNotOwnEnrollment`:** `coaching_load_meetings`, `coaching_load_renewals`.

Additionally, `actions/msm/update-client.ts` now **ignores `status` and `assigned_pf` from member callers** — those are admin-only fields (members are view-only on them); only an admin session has them applied.

### Tax-planner group-scope guards (2026-07-22 — the planner IDOR fence)

The `tax_planner` role is deny-by-default to `TAX_PLANNER_ALLOWED_ACTIONS`, so a second layer scopes each allowed call to the caller's **Tax Planning Group**. `utils/tax-planner-ownership.ts` exports:

> **Allowlist TRIMMED 2026-07-22 (gotcha #262):** the original broad allowlist was narrowed — planners LOST `automation_TAX_decision`/`_readyfortax3`/`_presentation_schedule`/`_request_returns`/`_pricing`/`_extrameeting`/`_depositrefund`/`_sendagreement`/`tax_save_deposit_pi`/`tax_allocate_planner`/`msm_update_tax_status` and KEEP `tax_save_task`, `tax_save_assess_form`, `tax_add_specialist`, `automation_TAX_highlevelmeeting_confirm`, `automation_TAX_implementdecision`, `automation_TAX_postreviewdecision` + loaders/vault/notifications/portal/login. Per-step edits via `tax_save_task` are further gated by the three-surface `PLANNER_EDITABLE_TASK_NAMES` whitelist. The group-scope guards below still live on the de-allowlisted handlers as defence-in-depth, but a planner can no longer reach them.


| Guard | Checks |
|---|---|
| `denyIfNotPlannerClient(supabase, clientId, body, json)` | the `client`'s tax plan(s) are allocated to a planner in the caller's group. |
| `denyIfNotPlannerPlan(supabase, taxPlanId, body, json)` | the `client_tax_plans` row's `tax_planner_id` is a planner in the caller's group. |
| `resolvePlannerGroupIds(...)` | (helper) resolves the set of `tax_planners.id` sharing the caller's `member_type` (empty `member_type` = a group of one). |

Key differences from the C2 member guards: (1) they resolve the caller from **`body.token`** (`admin_sessions` → an allowed_admins precedence mirror FIRST → `tax_planner_logins`) rather than a pre-computed `auth` — so they mirror the middleware precedence and no-op (return `null`) for any non-planner caller (admin/member/client/specialist stay unrestricted); (2) rights are **WHOLE-GROUP**, not single-id — a planner may view/edit any client allocated to ANY planner in their group. They're applied at the top of the ~18 tax handlers + client-scoped loaders + vault handlers listed in gotcha #257. `allocate-planner` additionally restricts a planner caller to allocating a TARGET planner INSIDE their own group. **Added 2026-07-23 (gotcha #273):** a THIRD guard `denyIfNotPlannerNote(supabase, noteId, body, json)` scopes the client-note WRITES — it resolves `client_notes.client_id` from the note id FIRST (403 on blank/missing note or out-of-group client) then runs the same whole-GROUP client check; `add_client_note` uses `denyIfNotPlannerClient(client_id)`, `update_client_note`/`delete_client_note` use `denyIfNotPlannerNote(note_id)`. All are no-ops for admin callers.

> **Specialist admin-collision caveat (same as the client caveat):** if a specialist's email is also in `allowed_admins`, admin wins in the precedence chain → the session re-types to admin and the `specialist_vault_*` actions 403 (`callerSpecialistId` is null for an admin session). For testing, use a non-admin email/alias for the specialist login.

**Gaps explicitly visible:**
- `add_client_note`, `update_client_note`, `load_client_notes`, `delete_client_note` are now in `ADMIN_ONLY_ACTIONS` (corrected 2026-06-18 — they had been listed under dead names, leaving them member-reachable). Members can no longer call them. **As of 2026-07-23 the three WRITES + `load_client_notes` are ALSO in `TAX_PLANNER_ALLOWED_ACTIONS`** (planner portal per-phase Notes) — they stay in `ADMIN_ONLY_ACTIONS` too, and the writes carry the group-scope guards `denyIfNotPlannerClient`/`denyIfNotPlannerNote`; planner reads are UNFILTERED (internal = team incl. planners). Gotcha #273.
- `gc_redeem` is not admin-gated; member callers can redeem services for their own `member_number` (which IS forced by `MEMBER_SCOPED_ACTIONS`).
- **Member vault, post-2026-07-30 (v680):** `vault_list` / `vault_download` / `vault_upload_url` are all `MEMBER_SCOPED_ACTIONS` (the last of the three was added that session — see #309 above). `vault_delete` is `ADMIN_ONLY_ACTIONS`, **but `VaultSections` still renders a Remove button to members that 403s on click** — a dead control rather than a hole, left as-is pending a decision on whether to hide the button or member-scope the action. `vault_upload` (the legacy base64 path) is unused by the UI and remains ungated — it is a candidate for deletion, not a gate.
- The `tax_*`, `msm_save_priority_task`, and `msm_save_priority_progress` family remains open at the role level (member-reachable, relying on application-level ownership checks where present). **The `ciq_*` reads/writes and `msm_save_client_task` are no longer in this gap as of 2026-06-18** — they carry the C2 caller-ownership guards (`denyIfNotOwnCiq` / `denyIfNotOwnClient`; see the guards section above), so a member can only touch their own CIQ/client. **`coaching_log_meeting` + `coaching_process_renewal` are now in `ADMIN_ONLY_ACTIONS`** (member-unreachable), and the read-only `coaching_load_meetings` / `coaching_load_renewals` carry `denyIfNotOwnEnrollment`. **Feature-enablement exception (2026-06-18):** `ciq_create` + `ciq_add_client_and_create` (both `MEMBER_SCOPED`) additionally carry an in-handler gate (`actions/ciq/shared.ts` `blockIfMemberCannotStart`) that 403s a member caller when `members.ciq_enabled` is false — layered on top of the role gates, not a role gate itself. `ciq_set_accountability` ("Update Progress" toggle) is in neither role-gate list (callable by admin + member) but now carries `denyIfNotOwnCiq`.

### Front-of-component auth checks

| Component | Check | Action on fail |
|---|---|---|
| [AdminPortal.jsx:79](src/pages/AdminPortal.jsx) | `!session \|\| session.role !== 'admin'` | `navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search))` |
| [MemberPortal.jsx:27](src/pages/MemberPortal.jsx) | `!session \|\| session.role !== 'member'` | `navigate('/member/login')` (no `?next=` preservation — member side not yet updated) |
| [ClientPortal.jsx](src/pages/ClientPortal.jsx) (new) | `!session \|\| session.role !== 'client'` | `navigate('/client/login')` |
| [ClientDetail.jsx:59](src/pages/ClientDetail.jsx) | `!session` | `navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search))` (always to admin login, even when arriving from /member route — see flag below) |

> **Post-login redirect**: `AdminLogin.jsx` reads `?next=` from `window.location.search` after a successful sign-in and navigates there if it starts with `/admin/`. Routes outside that prefix fall back to `/admin` (open-redirect safety). The `?next=` value uses the basename-relative path from react-router's `useLocation()` — NOT `window.location.pathname` (the Vite basename was `/vfo-portal/` before the custom-domain switch and is now `/`; `useLocation()` remains the correct source for the `/admin/` prefix check). Pattern was added so admins clicking deep-link admin URLs (e.g. notification-bell links, the Tax 4 decision-nudge `Open client` button) land on the intended page rather than the admin home after login.

> **Inconsistency 3:** [ClientDetail.jsx:59](src/pages/ClientDetail.jsx) redirects to `/admin/login` even when the route is `/member/client/:clientId`. A logged-out member hitting a member URL would land on the admin login. The sign-out button at line 106 *does* branch correctly on `isMember`, but the missing-session redirect does not. (The `?next=` preservation works for both flows; only the destination login URL is admin-biased.)

## Logout

- [AdminPortal.jsx:113](src/pages/AdminPortal.jsx): `signOut()` → `clearSession()` + `navigate('/')` (returns to RolePicker).
- [MemberPortal.jsx:54](src/pages/MemberPortal.jsx): same.
- [ClientDetail.jsx:106](src/pages/ClientDetail.jsx): `sessionStorage.clear()` + redirect to `/admin/login` or `/member/login` based on `isMember`. **Note:** uses `sessionStorage.clear()`, which wipes UI-state keys too. The portal pages use `clearSession()` which only removes `vfo_session`. Functional difference is small (UI state is regenerated on next login), but it's an inconsistency.

Logout is **client-only** — there is no admin-api action to delete the `admin_sessions` row at sign-out. The token remains valid server-side until `expires_at` passes. A copy of `vfo_session` could in theory be replayed for the remaining lifetime.

## 401 auto-redirect

[src/lib/api.js](src/lib/api.js): on a 401 response — **except for login actions** (the `LOGIN_ACTIONS` allowlist: `admin_login`/`member_login`/`client_login`/`specialist_login`/`tax_planner_login`/`login`):
```
clearSession()
window.location.href = window.location.origin + '/'
```

A **401 on a login action** instead `throw`s the server error (`data.error`, e.g. "Invalid credentials") so the login page shows it inline rather than bouncing the user to portal selection (added 2026-06-18, gotcha #144) — this is also what surfaces the H1 "Too many login attempts" **429** on the login screen. Genuine session-expiry 401s on non-login actions still clear the session + redirect.

The `'/'` path is the site root — since the custom-domain switch the app is served at the domain root (`https://vfoportal.com/`), not a `/vfo-portal/` subpath. On localhost dev (Vite at port 5173) it resolves to `http://localhost:5173/`.

## Passcode hashing

**Salted PBKDF2-HMAC-SHA256** (210,000 iterations, 16-byte random salt), stored as `pbkdf2$sha256$<iter>$<saltB64>$<hashB64>` in `allowed_admins.passcode_hash` / `member_logins.passcode_hash` / `client_logins.passcode_hash` / `specialist_logins.passcode_hash` / `tax_planner_logins.passcode_hash` (the tax_planner table added 2026-07-22; its hash is written by the unified `submit_login_setup` [`login_type='tax_planner'`] and by `tax_planner_update_login`, both via `hashPasscodeSalted`). Helpers live in `vfo-admin-api/utils/crypto.ts` (`hashPasscodeSalted`, `verifyPasscodeSalted`, `isSaltedHash`); the shared `verifyPasscode()` is in `utils/passcode-verify.ts`.

Because each row has its own salt, the login handlers (`admin_login`, `member_login`, legacy `login`) **fetch the row by email, then verify the passcode in code** — they can no longer match the hash inside the SQL query. Writers (`create_member_login`, `update_member_login`, `create_admin`, `update_my_passcode`, advisor/accountant `submit-login-setup`) write only `passcode_hash`.

History: passcodes were unsalted SHA-256 (migration `hash_passcodes_and_cleanup_sessions`, 2026-04-28) until the 2026-05-29 salted rollout (v335) — add nullable `passcode_hash`, dual-write + transparently re-hash each row on its next successful login, then drop the legacy `passcode` column once all rows were salted (migrations `add_passcode_hash_columns`, `passcode_drop_not_null`, `drop_legacy_passcode_column`). The legacy `passcode` column no longer exists.

## Notification polling

[NotificationBell.jsx:12-16](src/components/NotificationBell.jsx) calls `callApi('load_notifications')` on mount and again every **30 seconds** via `setInterval`. This is the only background polling in the frontend. If a session expires while the bell is mounted, the next poll will 401 → trigger the global redirect — observed in transcript reports as "user gets bumped to login while idle."

## Cross-references

- Edge-function auth gate detail: [03-edge-functions.md](03-edge-functions.md#token-auth-gate-line-2190)
- Auth tables: [../tables/auth.md](../tables/auth.md)
- Login action handlers: [05-api-action-catalog.md#auth-no-token-required](05-api-action-catalog.md)
