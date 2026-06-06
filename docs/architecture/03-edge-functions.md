# Edge functions

Two Supabase edge functions deployed to project `ejpsprsmhpufwogbmxjv`. Both are `Deno.serve`-style functions; both use the Supabase service-role key (so RLS is bypassed; auth is enforced application-side).

| Function | Layout | `verify_jwt` |
|---|---|---|
| `vfo-admin-api` | `supabase/functions/vfo-admin-api/` — 88-line `index.ts` orchestrator + `router/`, `middleware/`, `actions/`, `utils/`, `constants/`, `types/`, `integrations/` subdirs (~202 .ts files total — incl. `actions/advisor/` for Phase 1-6 Advisor Onboarding, `actions/accountant/` for Accountant Onboarding, `actions/pft/` for the Partnership Fast Track engagement track (7 actions; added 2026-06-05) + `actions/msm/pip-*.ts` for the PIP Meetings purchase chain) | `false` (config.toml + live registry, matched) |
| `boldsign-webhook` | `supabase/functions/boldsign-webhook/index.ts` (single file; extended four times — tax / advisor / advisor `_stripecustomer` chain / accountant fallthrough + `_stripecustomer` + `_ceocountersign` chains) | `false` (live registry; config.toml says `true` — see note below) |

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
| `hashPasscodeSalted()` / `verifyPasscodeSalted()` / `isSaltedHash()` | `utils/crypto.ts` | **Salted PBKDF2-HMAC-SHA256** (210k iterations) — produce/verify `allowed_admins.passcode_hash` and `member_logins.passcode_hash` (`pbkdf2$sha256$<iter>$<salt>$<hash>`). The legacy unsalted-SHA-256 `hashPasscode()` + `passcode` column were removed 2026-05-29 (v335). |
| `verifyPasscode(passcode, row)` | `utils/passcode-verify.ts` | Shared salted-hash verify used by `admin_login` / `member_login` / legacy `login` (fetch-by-email then verify). |
| `jsonResponse(data, status, corsHeaders)` | `utils/json.ts` | Response helper. **Phase 1 fixed the previous module-level mutable `corsHeaders` global** — now scoped per-request via a closure created in `index.ts::serve()`. |
| `buildCorsHeaders(req)` | `utils/cors.ts` | Builds CORS headers for a single request (origin echo if allowed). |
| `formatLongDate(isoDate)` | `utils/format-date.ts` | Formats a `YYYY-MM-DD` string as `"August 18, 2026"` (en-US long month/day/year, parsed + rendered in UTC to avoid local-tz drift). Returns input unchanged for non-date strings like `"TBD"`. Used by `automation_CONTRACT_checkreminder_sweep` and `automation_PIP1_reconfirmationemail`. |
| `nextMemberNumber(supabase, category, model)` | `utils/member-number.ts` | Single source of truth for member-number assignment (added 2026-05-29, gotcha #48). Scans `members` for the max integer number in the (`member_category` × `advisor_model`) bucket → +1; falls back to the `member_number_baselines` seed when the bucket is empty; returns an actionable error if empty with no baseline. Used by `add_member_full` + advisor/accountant `create-member`. |
| `sendStage3CompletionEmail()` / `maybeAdvanceStage3()` | `utils/specialist-stage3-emails.ts` | (added 2026-06-04, gotcha #73) Drafts the per-item Specialist Stage-3 completion emails (`SPECIALIST_bg_passed`/`_ddc_approved`/`_revshare_complete`, blue "Step 3 progress" card, idempotent via `<item>_complete_emailed` markers) and advances Specialist Stage 3→4 only when all three items complete (+ fires Stage-4 reviewer-notes reminders). Called from `save-progress` / `ddc-approve` / `revshare-final` / `revshare-finalize`. |
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
  │      • 44 entries: public-token + server-to-server chain-callable
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
  │      • 132 entries
  │      • Dispatched ctx: { body, supabase, json, auth, req }
  │      • Some handlers take auth (.auth.session.email etc.)
  │      • Three handlers take req for HTTP chain Authorization forwarding
  │        (PIPFU_decision, PCADMIN_pricing, PCADMIN_extrameeting)
  │
  └─ 8. Unknown-action fallthrough
         • !action → 200 { ok: true }
         • else    → 400 { error: "Unknown action: <name>" }
```

Total handler count: **251 actions** (3 logins + 248 dispatched). The post-refactor baseline was 128; subsequent features added MAP1 sweeps/check path/sandbox toggle, the full Tax Planning track (~27 in `actions/tax/`), Advisor Onboarding (21 in `actions/advisor/`), PIP Meetings (14 in `actions/msm/pip-*.ts`), Accountant Onboarding (21 in `actions/accountant/`), and the **Specialist Onboarding pipeline (~33 in `actions/onboarding/`** — Stages 1–2 automation + Stage 2 exec voting + Stage 3 background-check Stripe chain + Further Questions + DD Checklist + the reminder sweep + the **2026-06-05 Stage-4 agreement + monthly-license flow**: `sendagreement`/`ceocountersign`/`license-*` [8 handlers] + `boldsign-webhook` specialist branch + 3 `webhooks.ts` subscription blocks; shared `utils/gmail-draft.ts`, `utils/specialist-html-templates.ts`, `constants/specialist-execs.ts`, `utils/specialist-stage3-emails.ts`; see [../flows/specialist-onboarding.md](../flows/specialist-onboarding.md)). The authoritative count is in [05-api-action-catalog.md](05-api-action-catalog.md).

### Key cross-cutting concerns

#### Stripe webhook (`router/webhooks.ts::maybeHandleStripeWebhook`)

Triggered by presence of `stripe-signature` header. Verifies HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`, with a 5-minute timestamp tolerance.

Handles two event types:

- **`checkout.session.completed`** — handles two cases via metadata:
  1. **GC credit purchase**: metadata has `member_number` and `credits`. Increments `gc_balances`, inserts `gc_transactions` row.
  2. **MAP1 first payment**: looks up `pipeline_map1` row by `stripe_customer_id`. Expands `payment_intent` to extract `payment_method.type` (card vs us_bank_account) and `last4`. Sets `pay1_status` to `"succeeded"` (card) or `"processing"` (ACH). Computes `card_processing_fee` from `amount_received` vs `net_invoice / payment_count`. Writes quarterly schedule (`pay2/3/4_date` = +91/182/273 days).
     - **Chains:** `automation_CONTRACT_confirmationemail` (always); for card only, also `automation_CONTRACT_invoicereceipt` and then `automation_CONTRACT_revshare` (P1). ACH waits for `payment_intent.succeeded` to chain invoicereceipt + revshare.

- **`payment_intent.succeeded`** — four cases:
  1. MAP 1 quarterly subsequent payment (metadata `payment_number` is 2-4): sets `payN_status='succeeded'`, chains `automation_CONTRACT_invoicereceipt` then `automation_CONTRACT_revshare` for that payment number.
  2. MAP 1 ACH first-payment cleared (`pay1_status === "processing"`): flips to `"succeeded"`, chains `automation_CONTRACT_invoicereceipt` then `automation_CONTRACT_revshare` for payment 1.
  3. Tax retainer ACH cleared OR tax implementation off-session charge succeeded (`metadata.payment_kind` in `retainer` / `implementation`): writes the appropriate `client_tax_plans` status columns and chains `automation_TAX_confirmationemail` + `automation_TAX_invoicereceipt` / `automation_TAX_implementation_receipt`.
  4. Advisor onboarding ACH cleared (`metadata.pipeline === 'ADVISOR_ONBOARDING'`, `payment_status === 'processing'`): flips `advisor_onboarding.payment_status='succeeded'`, writes `payment_completed_at` + `renewal_date` (via `computeAdvisorRenewalDate`: payment date + `engagement_term_months` rounded UP to the next 15th — never less than the term), chains `automation_ADVISOR_confirmationemail` (which chains `automation_ADVISOR_invoicereceipt`).

The Stripe webhook handler additionally routes `checkout.session.completed` for advisor onboarding (lookup by `stripe_customer_id` after MAP1 + Tax misses, branching by `metadata.payment_kind='onboarding'`) — writes `payment_status`, `payment_method_type`, `card_processing_fee`, `acct_last4`, `stripe_payment_intent_id`, `payment_completed_at` (card path), and `renewal_date` (same always-15th rule).

The cascade extends further: after Advisor miss → PIP lookup on `client_priority_tracks` by `pip_stripe_customer_id` (branched by `metadata.pipeline='PIP'` + `metadata.payment_kind='purchase'`), then after PIP miss → Accountant lookup on `accountant_onboarding` by `stripe_customer_id` (branched by `metadata.pipeline='ACCOUNTANT_ONBOARDING'` + `metadata.payment_kind='onboarding'`). The Accountant branch writes the same shape as Advisor (status, method, fee, renewal_date) and chains `automation_ACCOUNTANT_confirmationemail` (which chains `automation_ACCOUNTANT_invoicereceipt`). No revshare chain on accountant payment — accountants don't have a `revenue_decision`, so VFO holds the share internally. `payment_intent.succeeded` has a parallel branch on `metadata.pipeline='ACCOUNTANT_ONBOARDING'` for the ACH-clears path, using `computeAccountantRenewalDate` (same algorithm as advisor). After Accountant → **Specialist background-check** lookup on `specialist_onboarding` by `bg_stripe_customer_id` (`metadata.payment_kind='background_check'`). **Specialist monthly LICENSE** (`metadata.payment_kind='license'`, `mode=subscription`, 2026-06-05) is handled by **three SEPARATE additive blocks** (not the customer cascade): `checkout.session.completed` (subscription) records the subscription + chains `licconfirmation`; **`invoice.paid`/`invoice.payment_succeeded`** (routed by `lic_stripe_customer_id`; subscription ref via `invoice.parent.subscription_details.subscription`) captures the payment method if not yet set + per-invoice idempotency on `lic_last_invoice_id`, first invoice → `licinvoicereceipt` + advance Stage 4→5, recurring → monthly receipt; **`invoice.payment_failed`** → Tracy dunning. This is the first/only `mode=subscription` + `invoice.*` handling in the codebase — those two events must be enabled on the Stripe webhook endpoint (sandbox done, live pending; SESSION_REFERENCE gotchas #75–#77).

The revshare chain typically returns `pending: true` immediately after payment (Tracy's Revenue Master sheet not yet updated) — the daily `pg_cron` sweep (02:00 UTC, see `supabase/cron/revshare-sweep.sql`) retries until it succeeds or remains permanently failed.

#### BoldSign webhook (`router/webhooks.ts::maybeHandleBoldSignWebhook`)

Triggered by `body.event.eventType` shape. Looks up `pipeline_map1` row by `boldsign_doc_id`.

- `eventType === "Completed"` → set both `c17_client_signed='Yes'` and `c18_ceo_signed='Yes'`.
- `eventType === "Signed"` with signer email matching CEO (`aanderson@elitert.com`, hardcoded) → set `c18_ceo_signed='Yes'`.
- `eventType === "Signed"` with any other signer → set `c17_client_signed='Yes'`.

If the document doesn't match a MAP1 row, the handler falls through to tax (`client_tax_plans`), then advisor (`advisor_onboarding`), then accountant (`accountant_onboarding`) — each level looks up by document id and applies the equivalent signing logic + chains the appropriate `_stripecustomer` / `_ceocountersign` actions. Returns `{ok:true, branch:'<pipeline>'}` so the chain reason is visible in net._http_response. (Initial implementation chained downstream only for advisor + accountant; tax CEO countersign was already chained by the standalone webhook.)

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
- `tax-agreements` — `actions/tax/decision.ts` (static `tax-planning.pdf` attachment for Tax 3 Undecided email).
- `map1-agreements` — `actions/pipeline/pcadmin-final-decision.ts` (`proactive-lite.pdf` / `proactive-core.pdf` / `proactive-max.pdf` Undecided attachments per service level).
- `advisor-onboarding-agreements` — `actions/advisor/decision.ts` (`Advisor_Implementation_Agreement.pdf` Undecided attachment; uploaded 2026-06-01).
- `accountant-onboarding-agreements` — `actions/accountant/decision.ts` (TWO partnership-branched Undecided attachments — `Accountant_Implementation_Agreement_Partnership.pdf` / `_No_Partnership.pdf`, picked by `ob.accountant_partnership`; both uploaded 2026-06-01, gotcha #58).
- `specialist-onboarding-assets` (public) — `actions/onboarding/prelim-email.ts` (Specialist Onboarding Stage 1 email): `onboarding-process.png` (inline image in Stage 1, Stage 2 + Step 3 receipt emails), `VFO-Specialist-Agreement.pdf` + `revenue_share_examples.pdf` + `VFO-Specialist-Onboarding-Presentation.pdf` (static attachments on the Stage 1 yes/continue email; presentation PDF added 2026-06-05). Added 2026-06-02, gotcha #59.
- `specialist-dd-materials` (**PRIVATE** — only private bucket in the system) — Due Diligence Checklist uploads. Written via signed upload URLs (`actions/onboarding/ddc-upload-url.ts`); read via signed download URLs (`actions/onboarding/ddc-download.ts`). Paths namespaced `<onboarding_id>/<slot>/<rand>_<file>`. Added 2026-06-04, gotcha #69.

---

## `boldsign-webhook` — overall shape

A `Deno.serve` that handles BoldSign webhook POSTs. **Untouched by the original refactor** but extended four times since with explicit per-extension user approval:

1. **Tax** — fallback routing after MAP1 miss to `client_tax_plans`.
2. **Advisor** — fallback after Tax miss to `advisor_onboarding`.
3. **Advisor `_stripecustomer` chain** — fires on Completed event after both signed.
4. **Accountant** — fallback after Advisor miss to `accountant_onboarding`; chains `automation_ACCOUNTANT_stripecustomer` on Completed and `automation_ACCOUNTANT_ceocountersign` on the non-CEO Signed event.

Cascade order:

```
POST → parse body → look up pipeline_map1 by boldsign_doc_id
  ├─ MAP1 match: update c17/c18 (no chain — pre-refactor behavior)
  └─ MAP1 miss → look up client_tax_plans by boldsign_doc_id
        ├─ Tax match: update client_signed/ceo_signed; chain TAX_stripecustomer / TAX_ceocountersign
        └─ Tax miss → look up advisor_onboarding by boldsign_document_id
              ├─ Advisor match: update agreement_signed_by_advisor_at / _ceo_at; chain ADVISOR_stripecustomer / ADVISOR_ceocountersign
              └─ Advisor miss → look up accountant_onboarding by boldsign_document_id
                    ├─ Accountant match: update agreement_signed_by_accountant_at / _ceo_at; chain ACCOUNTANT_stripecustomer / ACCOUNTANT_ceocountersign
                    └─ Accountant miss → log "No pipeline, tax plan, advisor, or accountant onboarding found" + return 200 OK
```

Deploys MUST pass `--no-verify-jwt`. The config.toml says `verify_jwt = true` for safety in case `config.toml` is ever re-applied; the live registry value is `false`. If a deploy regresses this, BoldSign webhooks 401-silently and signed documents go nowhere.

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
