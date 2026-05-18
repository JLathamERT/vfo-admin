# Edge functions

Two Supabase edge functions deployed to project `ejpsprsmhpufwogbmxjv`. Both are `Deno.serve`-style functions; both use the Supabase service-role key (so RLS is bypassed; auth is enforced application-side).

| Function | Layout | `verify_jwt` |
|---|---|---|
| `vfo-admin-api` | `supabase/functions/vfo-admin-api/` — 88-line `index.ts` orchestrator + `router/`, `middleware/`, `actions/`, `utils/`, `constants/`, `types/`, `integrations/` subdirs (~150 .ts files total) | `false` (config.toml + live registry, matched) |
| `boldsign-webhook` | `supabase/functions/boldsign-webhook/index.ts` (95 lines, single file) | `false` (live registry; config.toml says `true` — see note below) |

> Live versions increment per deploy; see Supabase Dashboard → Edge Functions for the current value of each.

> **Refactor history.** `vfo-admin-api` was a single 4371-line `index.ts` until v194 (deployed 2026-05-07). The modular extraction was completed in 18 phased commits across the `refactor/vfo-admin-api-modularize` branch and deployed as v196 on 2026-05-08. Behavior (action names, response shapes, DB writes, chain semantics) is byte-equivalent; only file structure and 4 explicitly-approved dead-code removals changed. See `.refactor-resume.md` and `.refactor-baseline.md` in the worktree for the full history.

> **`verify_jwt` note.** v195 of `vfo-admin-api` regressed when deploying with the default `verify_jwt = true` from config.toml — Kong gateway 401'd public-token endpoints (`/decide`, `/pay`) before requests reached the function. Fixed in v196 by changing config.toml to `verify_jwt = false`, matching the historical deploy practice. The standalone `boldsign-webhook` config still says `true` (untouched per safety rules) but its deployed registry value is `false`. If you ever redeploy `boldsign-webhook`, mirror the fix or pass `--no-verify-jwt`.

---

## `vfo-admin-api` — overall shape

The 88-line orchestrator at `supabase/functions/vfo-admin-api/index.ts` does:

1. **OPTIONS short-circuit** + per-request CORS headers
2. **Stripe webhook** (header-shape detection via `router/webhooks.ts::maybeHandleStripeWebhook`)
3. **JSON body parse**
4. **Login handlers** inline (admin_login / member_login / login — pre-webhook ordering preserved verbatim)
5. **BoldSign webhook** (body-shape detection via `router/webhooks.ts::maybeHandleBoldSignWebhook`)
6. **`PUBLIC_HANDLERS` dispatch** (router/dispatch.ts) — public-token + chain-callable handlers, no auth required
7. **Auth gate** (`middleware/auth.ts::authenticate`) — validates body.token against `admin_sessions`, applies role gates from `constants/role-gates.ts`
8. **`AUTH_HANDLERS` dispatch** (router/dispatch.ts) — every other action, post-auth
9. **Unknown-action fallthrough** (200 if action missing, else 400)

### Top-of-file constants & helpers

All previously-inline helpers have been extracted to per-file modules:

| Symbol | File | Purpose |
|---|---|---|
| `generateInvoiceHTML` / `generateReceiptHTML` | `utils/html-templates.ts` | HTML builders for invoice/receipt PDFs (used by `automation_CONTRACT_invoicereceipt`) |
| `ALLOWED_ORIGINS` | `constants/allowed-origins.ts` | CORS allowlist: `https://jlathamert.github.io`, `http://localhost:5173`, `http://localhost:5174`. |
| `SUPERADMIN_EMAIL` | `constants/superadmin.ts` | Hardcoded `"jlatham@elitert.com"`. Drives `is_superadmin` flag in session, gates Admin Editor in [AdminPortal.jsx:205](src/pages/AdminPortal.jsx). |
| `getPfEmail()` | `utils/pf-emails.ts` | Hardcoded map of PF (Planning Facilitator) name → email. Three entries: Evan Anderson, Bridger Silvester, Lindsay Morris. |
| `generateToken()` | `utils/crypto.ts` | 32-byte crypto-random hex — used for sessions, `c15_token`, `checkout_token`. |
| `hashPasscode()` | `utils/crypto.ts` | **SHA-256, no salt** — used for `allowed_admins.passcode` and `member_logins.passcode`. (Migration `hash_passcodes_and_cleanup_sessions` introduced this.) |
| `jsonResponse(data, status, corsHeaders)` | `utils/json.ts` | Response helper. **Phase 1 fixed the previous module-level mutable `corsHeaders` global** — now scoped per-request via a closure created in `index.ts::serve()`. |
| `buildCorsHeaders(req)` | `utils/cors.ts` | Builds CORS headers for a single request (origin echo if allowed). |
| `formatLongDate(isoDate)` | `utils/format-date.ts` | Formats a `YYYY-MM-DD` string as `"August 18, 2026"` (en-US long month/day/year, parsed + rendered in UTC to avoid local-tz drift). Returns input unchanged for non-date strings like `"TBD"`. Used by `automation_CONTRACT_checkreminder_sweep` and `automation_PIP1_reconfirmationemail`. |
| `ADMIN_ONLY_ACTIONS` / `MEMBER_SCOPED_ACTIONS` | `constants/role-gates.ts` | Action-name arrays consumed by the auth middleware. |
| `JsonResponder`, `AuthContext`, `PublicHandlerCtx`, `AuthedHandlerCtx` | `types/index.ts` | Shared TS types for handler signatures. |

### Request flow (current)

```
serve(req)
  ├─ OPTIONS → 204 + CORS
  ├─ GET     → 200 "OK"
  ├─ POST:
  │
  ├─ 1. router/webhooks.ts::maybeHandleStripeWebhook(req, ...)
  │      • Triggered by stripe-signature header
  │      • Consumes req.text() for HMAC verification (so MUST run before req.json())
  │      • Returns Response or null
  │
  ├─ 2. JSON body parse: const body = await req.json()
  │      const { action } = body
  │
  ├─ 3. Inline login handlers (admin_login / member_login / login)
  │      Pre-webhook order preserved (an admin login request never reaches BoldSign-shape detection)
  │
  ├─ 4. router/webhooks.ts::maybeHandleBoldSignWebhook(body, ...)
  │      • Triggered by body.event?.eventType
  │      • Returns Response or null
  │
  ├─ 5. PUBLIC_HANDLERS[action]  (from router/dispatch.ts)
  │      • 9 entries: public-token + server-to-server chain-callable
  │      • Dispatched ctx: { body, supabase, json, req }
  │
  ├─ 6. await middleware/auth.ts::authenticate(action, body, supabase, json)
  │      • Reads body.token, looks up admin_sessions
  │      • Returns 401 if missing/expired
  │      • Detects role: admin (allowed_admins) or member (member_logins)
  │      • Applies ADMIN_ONLY_ACTIONS gate (403 for member callers on listed actions)
  │      • Applies MEMBER_SCOPED_ACTIONS gate (forces body.member_number to caller's own)
  │
  ├─ 7. AUTH_HANDLERS[action]  (from router/dispatch.ts)
  │      • 116 entries
  │      • Dispatched ctx: { body, supabase, json, auth, req }
  │      • Some handlers take auth (.auth.session.email etc.)
  │      • Three handlers take req for HTTP chain Authorization forwarding
  │        (PIPFU_decision, PCADMIN_pricing, PCADMIN_extrameeting)
  │
  └─ 8. Unknown-action fallthrough
         • !action → 200 { ok: true }
         • else    → 400 { error: "Unknown action: <name>" }
```

Total handler count: **134 unique action handlers** (3 logins + 12 public + 119 authed). Phase 6 mechanical of the modular refactor removed the dup `msm_update_client` handler and the dead `automation_CONTRACT_stripewebhook` handler, dropping the post-refactor baseline to 128. Subsequent features have added 6 actions: `_revshare_sweep`, `save_sandbox_config`, `_chargescheduled_sweep`, `_paidbycheck`, `_checkcleared`, `_checkreminder_sweep`. The authoritative count is the one published in [05-api-action-catalog.md](05-api-action-catalog.md).

### Key cross-cutting concerns

#### Stripe webhook (`router/webhooks.ts::maybeHandleStripeWebhook`)

Triggered by presence of `stripe-signature` header. Verifies HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`, with a 5-minute timestamp tolerance.

Handles two event types:

- **`checkout.session.completed`** — handles two cases via metadata:
  1. **GC credit purchase**: metadata has `member_number` and `credits`. Increments `gc_balances`, inserts `gc_transactions` row.
  2. **MAP1 first payment**: looks up `pipeline_map1` row by `stripe_customer_id`. Expands `payment_intent` to extract `payment_method.type` (card vs us_bank_account) and `last4`. Sets `pay1_status` to `"succeeded"` (card) or `"processing"` (ACH). Computes `card_processing_fee` from `amount_received` vs `net_invoice / payment_count`. Writes quarterly schedule (`pay2/3/4_date` = +91/182/273 days).
     - **Chains:** `automation_CONTRACT_confirmationemail` (always); for card only, also `automation_CONTRACT_invoicereceipt` and then `automation_CONTRACT_revshare` (P1). ACH waits for `payment_intent.succeeded` to chain invoicereceipt + revshare.

- **`payment_intent.succeeded`** — two cases:
  1. Quarterly subsequent payment (metadata `payment_number` is 2-4): sets `payN_status='succeeded'`, chains `automation_CONTRACT_invoicereceipt` then `automation_CONTRACT_revshare` for that payment number.
  2. ACH first-payment cleared (`pay1_status === "processing"`): flips to `"succeeded"`, chains `automation_CONTRACT_invoicereceipt` then `automation_CONTRACT_revshare` for payment 1.

The revshare chain typically returns `pending: true` immediately after payment (Tracy's Revenue Master sheet not yet updated) — the daily `pg_cron` sweep (02:00 UTC, see `supabase/cron/revshare-sweep.sql`) retries until it succeeds or remains permanently failed.

#### BoldSign webhook (`router/webhooks.ts::maybeHandleBoldSignWebhook`)

Triggered by `body.event.eventType` shape. Looks up `pipeline_map1` row by `boldsign_doc_id`.

- `eventType === "Completed"` → set both `c17_client_signed='Yes'` and `c18_ceo_signed='Yes'`.
- `eventType === "Signed"` with signer email matching CEO (`aanderson@elitert.com`, hardcoded) → set `c18_ceo_signed='Yes'`.
- `eventType === "Signed"` with any other signer → set `c17_client_signed='Yes'`.

> **Important:** This embedded handler **does not chain** to any downstream action. The standalone `boldsign-webhook` function (below) does. It is unclear which one is the live BoldSign webhook target — the chained behavior only fires if BoldSign is calling the standalone function.

#### Token auth gate (`middleware/auth.ts`)

Below the public dispatch step, every action does:

1. Reads `body.token`. Returns 401 if missing.
2. Looks up `admin_sessions` row by token. Returns 401 if missing or `expires_at` is past (and deletes the expired row).
3. Detects role via `allowed_admins` row (admin) or falls back to `member` and looks up `member_logins.member_number`.
4. Applies `ADMIN_ONLY_ACTIONS` (constants/role-gates.ts) — 403 for member callers on listed actions.
5. Applies `MEMBER_SCOPED_ACTIONS` (constants/role-gates.ts) — overwrites `body.member_number` with caller's for scoped reads/writes.

### Hardcoded constants worth knowing

These remain hardcoded in their respective handler files (preserved verbatim — extracting them was outside refactor scope):

| Value | File | Purpose |
|---|---|---|
| `aanderson@elitert.com` | `router/webhooks.ts`, multiple `actions/pipeline/*.ts` | CEO signer + BCC on automation emails |
| `platham@elitert.com` | `actions/pipeline/pip1-reconfirmation-email.ts`, `pipfu-decision.ts`, `contract-send-agreement.ts`, `contract-confirmation-email.ts`, `pcadmin-final-decision.ts`, `pcadmin-extra-meeting.ts` | BCC on automation emails |
| `tnmiller@elitert.com` | `actions/pipeline/contract-revshare.ts` | "Tracy" — recipient of intro email on payment 1 |
| `tracy@vfo-services.com` | `actions/pipeline/contract-invoice-receipt.ts` | CC on `automation_CONTRACT_invoicereceipt` (separate address from above) |
| `aipc@vfo-services.com` | `actions/pipeline/contract-send-agreement.ts` | `From:` on `automation_CONTRACT_sendagreement` Gmail draft |
| `https://jlathamert.github.io/vfo-portal/pay?token=...` | `actions/pipeline/contract-payment-email.ts`, `contract-stripe-checkout.ts` | Pay-page redirect URL |
| `https://www.vfo-services.com/payment-successful/` | `actions/pipeline/contract-stripe-checkout.ts` | Stripe Checkout success URL |
| `MASTER_SHEET_ID = "1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0"` | `actions/pipeline/contract-revshare.ts` | Revenue Master Google Sheet |
| `BrandId = "f6b2e092-73a4-438e-b786-ebd20e472732"` | `actions/pipeline/contract-send-agreement.ts` | BoldSign brand for `automation_CONTRACT_sendagreement` |

### Phase 6 mechanical removals (intentional behavior changes)

These were removed in commit `6615141` with explicit per-item approval:

- **Duplicate `msm_update_client` handler** (was in Phase 4G2 as `update-client-dup.ts`). Originally a second `if (action === "msm_update_client")` block at baseline line 2427 — unreachable at runtime because the first dispatch always returned. File deleted; only one `msm_update_client` registration in `router/dispatch.ts`.
- **Dead `automation_CONTRACT_stripewebhook` handler** (was in Phase 4H3). Doubly-dead: real Stripe events have stripe-signature header (caught by webhook block); the synthetic-action assignment that would have routed to this handler was unreachable from dispatch (the `action` const was destructured before the mutation). File deleted; entry removed from `PUBLIC_HANDLERS`; synthetic-action assignment removed from `index.ts`.
- **Debug Gmail draft fetch** in `actions/pipeline/contract-invoice-receipt.ts` (was hardcoded draft id `r-8771745882155742140?format=full`). Removed.
- **Dead `vfo_assignments` table reference** in `actions/specialists/delete.ts`. Removed (the table doesn't exist in current schema; the delete was a silent no-op).

Behavior change observable from outside: an explicit POST with `{ "action": "automation_CONTRACT_stripewebhook" }` now returns 401 (no token; falls through to auth gate) or 400 "Unknown action" (with token). v194 returned `{"ok":true}`. No real caller invokes this action by name.

### Storage buckets referenced

- `headshots` — `actions/specialists/upload-headshot.ts`. Migration `lock_down_headshots_storage` indicates RLS-locked.
- `member-vault` — `actions/vault/list.ts`, `actions/vault/upload.ts`, `actions/vault/delete.ts`.

---

## `boldsign-webhook` — overall shape

A 95-line `Deno.serve` that handles BoldSign webhook POSTs. **Untouched by the refactor** (separate function, per safety rules).

```
POST → parse body → look up pipeline_map1 by boldsign_doc_id
  ├─ event.eventType === "Completed":
  │     UPDATE pipeline_map1 SET c17_client_signed='Yes', c18_ceo_signed='Yes'
  │     CHAIN: POST /vfo-admin-api action=automation_CONTRACT_stripecustomer
  └─ event.eventType === "Signed":
        ├─ signer == CEO (aanderson@elitert.com — hardcoded line 64):
        │     UPDATE pipeline_map1 SET c18_ceo_signed='Yes'
        └─ else (client):
              if c17_client_signed already 'Yes' → idempotent skip
              else UPDATE c17_client_signed='Yes'
                   CHAIN: POST /vfo-admin-api action=automation_CONTRACT_ceocountersign
```

The two functions write to identical columns. The standalone version is the only one that chains downstream (creating the Stripe customer + sending the CEO countersign email). If both are configured as BoldSign webhook targets, the second invocation would idempotent-skip but still chain; if only the embedded handler is configured, the chains never fire and `automation_CONTRACT_ceocountersign` / `_stripecustomer` would have to be invoked manually.

---

## How frontend talks to the edge function

[src/lib/api.js](src/lib/api.js) is the single client (admin/member portals):

```js
const EDGE_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'
const ANON_KEY = '<hardcoded anon JWT>'

callApi(action, payload) →
  POST EDGE_URL
    headers: { Authorization: Bearer <ANON_KEY>, Content-Type: application/json }
    body:    { action, token: sessionStorage.vfo_session.token, ...payload }
  retry ×3 with 2s delay
  on 401: clearSession() + redirect to /vfo-portal/
```

The same `VITE_API_URL` env-var pattern is used by `src/pages/PayPage.jsx` and `src/pages/DecidePage.jsx`. Production behavior is unchanged when `VITE_API_URL` is unset — the fallback is the production Supabase URL. The env var is only set during local-dev (e.g., `$env:VITE_API_URL = "http://127.0.0.1:54321/functions/v1/vfo-admin-api"`) to point at a local function-serve.

The `Authorization: Bearer <ANON_KEY>` header is sent by all `callApi` traffic (admin/member portal). The `/decide` and `/pay` pages use raw `fetch` **without** an Authorization header — they're public-token endpoints. The `verify_jwt = false` setting on the function is what allows those headerless requests through Kong; the function itself enforces auth (or doesn't, for public-token actions) via the `PUBLIC_HANDLERS` vs `AUTH_HANDLERS` split in `router/dispatch.ts`.

Server-to-server chains (admin-api → admin-api) use `Authorization: Bearer <SERVICE_ROLE_KEY>` instead, and **do not** include the user's session token — they bypass the per-action auth gate by being routed through `PUBLIC_HANDLERS`. Three handlers chain in this style and forward `req.headers.get("Authorization")` to the chain target so the receiving handler has the same auth context: `automation_PIPFU_decision`, `automation_PCADMIN_pricing`, `automation_PCADMIN_extrameeting` (all chain to `automation_CONTRACT_sendagreement`). The Stripe-webhook handler chains via service-role key. The pre-auth `automation_CONTRACT_stripecustomer` chains to `automation_CONTRACT_paymentemail` via service-role key.

---

## Cross-references

- Action catalog with full table-touch + chain map: [05-api-action-catalog.md](05-api-action-catalog.md)
- File layout under `vfo-admin-api/`: [06-orchestration-files.md](06-orchestration-files.md)
- Pipeline column dictionary: [../tables/pipeline.md](../tables/pipeline.md)
- Auth tables: [../tables/auth.md](../tables/auth.md)
- Integration deep-dives: [../integrations/](../integrations/)
- End-to-end contract flow: [../flows/contract-and-payment.md](../flows/contract-and-payment.md)
- Refactor history + remaining work (deferred TS-error fix): `.refactor-resume.md` in `vfo-edge-functions/.claude/worktrees/refactor-modularize/`
