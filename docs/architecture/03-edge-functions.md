# Edge functions

Two Supabase edge functions deployed to project `ejpsprsmhpufwogbmxjv`. Both are `Deno.serve`-style functions; both use the Supabase service-role key (so RLS is bypassed; auth is enforced application-side).

| Function | Layout | `verify_jwt` |
|---|---|---|
| `vfo-admin-api` | `supabase/functions/vfo-admin-api/` — ~120-line `index.ts` orchestrator + `router/`, `middleware/`, `actions/`, `utils/`, `constants/`, `types/`, `integrations/` subdirs (~335 .ts files total — incl. `actions/advisor/` for Phase 1-6 Advisor Onboarding, `actions/accountant/` for Accountant Onboarding, `actions/pft/` for the Partnership Fast Track engagement track (7 actions; added 2026-06-05) + `actions/msm/pip-*.ts` for the PIP Meetings purchase chain + `actions/auth/client-*.ts` for client-portal login/setup + `actions/vault/{tax,gen,client-vault}-*.ts` for the client document/tax-return vault, all added this session; plus the Specialist portal go-live actions added this session — `actions/onboarding/{skool-invite,create-specialist,login-setup-email,load-login-setup,submit-login-setup}.ts`, `actions/auth/specialist-login.ts`, and `actions/vault/specialist-vault-*.ts`; plus the `actions/payments/` group — per-person/global `*_payments_load` + `all-payments-load.ts` sharing `normalize.ts` row builders, and the **Phase D admin card/bank-change** trio `card-update-send.ts` / `card-update-load.ts` / `card-update-checkout.ts` over shared `card-update-shared.ts`, added 2026-06-16; plus the **Advisor Growth Plan** group `actions/growth/` — Phases 1–6 CRUD [`load`/`load-history`/`save-score`/`save-summary`/`save-actions`/`save-accountability`] over `shared.ts`, PLUS this session's Phase 7–8 additions [`load-admins`, `load-audit`, `set-accountability`, `add-action`, `delete-action`, `overdue-sweep` (PUBLIC service-role cron), `history.ts` (audit logger), `notify.ts` (accountability FYIs)], see [../GROWTH_PLAN_HANDOFF.md](../GROWTH_PLAN_HANDOFF.md)) | `false` (config.toml + live registry, matched) |
| `boldsign-webhook` | `supabase/functions/boldsign-webhook/index.ts` (single file; extended four times — tax / advisor / advisor `_stripecustomer` chain / accountant fallthrough + `_stripecustomer` + `_ceocountersign` chains) | `false` (live registry; config.toml says `true` — see note below) |

> Live versions increment per deploy; see Supabase Dashboard → Edge Functions for the current value of each.

> **Refactor history.** `vfo-admin-api` was a single 4371-line `index.ts` until v194 (deployed 2026-05-07). The modular extraction was completed in 18 phased commits across the `refactor/vfo-admin-api-modularize` branch and deployed as v196 on 2026-05-08. Behavior (action names, response shapes, DB writes, chain semantics) is byte-equivalent; only file structure and 4 explicitly-approved dead-code removals changed. See `.refactor-resume.md` and `.refactor-baseline.md` in the worktree for the full history.

> **`verify_jwt` note.** v195 of `vfo-admin-api` regressed when deploying with the default `verify_jwt = true` from config.toml — Kong gateway 401'd public-token endpoints (`/decide`, `/pay`) before requests reached the function. Fixed in v196 by changing config.toml to `verify_jwt = false`, matching the historical deploy practice. The standalone `boldsign-webhook` config still says `true` (untouched per safety rules) but its deployed registry value is `false`. If you ever redeploy `boldsign-webhook`, mirror the fix or pass `--no-verify-jwt`.

---

## `vfo-admin-api` — overall shape

The ~120-line orchestrator at `supabase/functions/vfo-admin-api/index.ts` does:

1. **OPTIONS short-circuit** + per-request CORS headers
2. **Stripe webhook** (header-shape detection via `router/webhooks.ts::maybeHandleStripeWebhook`)
3. **Body-size cap + JSON body parse** — rejects bodies >2,000,000 bytes with HTTP **413** (`{error:"Payload too large"}`); a malformed body now returns HTTP **400** (`{error:"Invalid JSON body"}`) instead of the old 200 `{ok:true}` (M2a, 2026-06-18). Also extracts the client IP from the first `x-forwarded-for` entry and threads it into the 5 login dispatches (for the H1 throttle).
4. **Login handlers** inline (admin_login / member_login / client_login / specialist_login / login — pre-webhook ordering preserved verbatim; 5 logins as of this session, `client_login` dispatched to `actions/auth/client-login.ts`, `specialist_login` to `actions/auth/specialist-login.ts` — verifies salted passcode against `specialist_logins`, returns `{role:'specialist', expert_id}`; all 5 now take the extracted client IP and apply the `login-throttle.ts` rate limit — 429 when blocked)
5. **BoldSign webhook** (body-shape detection via `router/webhooks.ts::maybeHandleBoldSignWebhook`)
6. **`PUBLIC_HANDLERS` dispatch** (router/dispatch.ts) — public-token + chain-callable handlers, no auth required (added this session: `load_client_setup` / `submit_client_setup` PUBLIC handlers in `actions/auth/client-setup-load.ts` / `client-setup-submit.ts`, plus the PUBLIC-token `tax_upload_url` in `actions/vault/tax-upload-url.ts`; the Phase D card-change client legs `payments_loadcardupdate` / `payments_cardupdate_checkout` are also PUBLIC-token, served off the emailed link)
7. **Auth gate** (`middleware/auth.ts::authenticate`) — validates body.token against `admin_sessions`, applies role gates from `constants/role-gates.ts`
8. **`AUTH_HANDLERS` dispatch** (router/dispatch.ts) — every other action, post-auth (`actions/payments/` group: 3 per-person `*_payments_load` [admin-only] added 2026-06-15 + `all_payments_load` [superadmin GLOBAL Payments page] added 2026-06-16 + `payments_send_card_update` [superadmin, the admin-initiated card/bank-change "Phase D" capability] added 2026-06-16, sharing `normalize.ts` row builders. The card-update load/checkout legs `payments_loadcardupdate` / `payments_cardupdate_checkout` are PUBLIC-token, not AUTH)
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
| `sendNewModelSaleEmail(supabase, table, onboardingId)` | `utils/new-model-sale-email.ts` | Drafts the internal **"New Model Sale"** team notification when an advisor/accountant is created (the final onboarding step). Loads the `email_templates` row `pipeline='TEAM'`/`template_name='new_model_sale'` and drafts a Gmail TO every address on the row's `to_list` jsonb (no Cc/Bcc; in sandbox it routes to `pipeline_sandbox_config.sandbox_email` only). Atomic single-send claim on `<table>.new_model_sale_email_sent_at` (rolled back if the draft fails); never throws. Called from both the happy + idempotent-retry paths of advisor/accountant `create-member`. Imports `draftGmail`/`getGmailAccessToken` + `dedupeEmails`. |
| `sendStage3CompletionEmail()` / `maybeAdvanceStage3()` | `utils/specialist-stage3-emails.ts` | (added 2026-06-04, gotcha #73) Drafts the per-item Specialist Stage-3 completion emails (`SPECIALIST_bg_passed`/`_ddc_approved`/`_revshare_complete`, blue "Step 3 progress" card, idempotent via `<item>_complete_emailed` markers) and advances Specialist Stage 3→4 only when all three items complete (+ fires Stage-4 reviewer-notes reminders). Called from `save-progress` / `ddc-approve` / `revshare-final` / `revshare-finalize`. |
| `allocateDocNumber(supabase, opts)` | `utils/doc-numbers.ts` | **Collision-safe** INV/REC allocation (added 2026-06-09, gotcha #92). Counts (global or per-owner) → builds the number via a `buildNumber(seq)` callback → bumps + retries until the `UNIQUE(number)` insert succeeds; stamps exactly one owner FK. Used by ALL invoice/receipt handlers (MAP1/Tax/PIP/Advisor/Accountant/Specialist-bg/Specialist-license). Replaced the old per-handler `count → insert-once → ignore-error`. |
| `TIM_EMAIL` / `TRACY_EMAIL` / `TAX_OWNERS` / `taxPfRecipients(pf)` / `insertTaxNotifications()` | `utils/tax-notify.ts` | TAX notification routing (added 2026-06-09, gotcha #96). No tax notification uses the shared `admin` bell — `taxPfRecipients` maps `clients.assigned_pf` → @elitert.com login (Tim+Tracy fallback, never `admin`); `insertTaxNotifications` inserts one row per recipient. |
| `notifyTracyRevShareNeeded()` | `utils/revshare-tracy-notify.ts` | FYI to Tracy to enter the revenue-share split into the VFO Services - Private Info sheet (added 2026-06-09). Fired from MAP 1 + Tax revshare `pending` branches; deduped on the unread row. |
| `notifyJakeFailure()` / `clearJakeFailure()` / `clearJakeFailuresContaining()` | `utils/notify-jake-failure.ts` | Alert to `jlatham@elitert.com` on any money-movement failure across pipelines (added 2026-06-09; **expanded 2026-06-15** to ACH-bounce / failed-PI / subscription-lapse / dispute / refund-fail / transfer-reversed). `actionRequired` makes it non-dismissible; the `clear*` helpers auto-clear on recovery. Deduped on the unread row. |
| `resolveStripeFirstPaymentFailure()` | `utils/resolve-stripe-failure.ts` | Maps a Stripe customer + metadata → pipeline row / status column / admin link (added 2026-06-15); shared by the `async_payment_failed` + broadened `payment_intent.payment_failed` webhook branches. |
| `denyIfNotOwnClient()` / `denyIfNotOwnEnrollment()` | `utils/client-ownership.ts` | **C2 caller-ownership guards (added 2026-06-18).** The standard mechanism for scoping a member caller to their own `client_id` / `enrollment_id` when the value rides in the request body (which `MEMBER_SCOPED_ACTIONS` cannot scope). Each keys off `auth.callerMemberNumber` (un-spoofable), returns a 403 `Response` for a member touching someone else's resource, and is a no-op for admins. A sibling `denyIfNotOwnCiq()` lives in `actions/ciq/shared.ts`. Use these for any new member-allowed handler that takes a foreign key. See [04-auth-and-sessions.md](04-auth-and-sessions.md#caller-ownership-guards-c2--memberresource-idor-scoping-2026-06-18). |
| `checkLoginThrottle()` / `recordLoginFailure()` / `clearLoginFailures()` | `utils/login-throttle.ts` | **H1 login brute-force throttle (added 2026-06-18).** DB-backed via the `login_attempts` table (service-role only); 5 failures/15min per email + 20/15min per IP on a rolling window. All 5 login handlers `check` before the credential lookup (429 if blocked), `record` on each 401, and `clear` on success. `index.ts` supplies the client IP. See [04-auth-and-sessions.md](04-auth-and-sessions.md#login-throttle-brute-force-protection). |
| `ADMIN_ONLY_ACTIONS` / `MEMBER_SCOPED_ACTIONS` / `CLIENT_ALLOWED_ACTIONS` / `SPECIALIST_ALLOWED_ACTIONS` | `constants/role-gates.ts` | Action-name arrays consumed by the auth middleware. `ADMIN_ONLY_ACTIONS` gained 8 client-vault actions + the 2 admin-only specialist-vault actions (`specialist_vault_admin_list` / `_admin_download`) + (this session, security fix) the 16 advisor/accountant onboarding AUTH actions — the admin-triggered `load_*`/`create_*`/`save_*`/`automation_*_decision`/`automation_*_createmember`/`automation_load_*_pipelines` set incl. the new `save_advisor_team_member` / `save_accountant_team_member` (the PUBLIC token / chain / cron onboarding handlers bypass the auth gate and are intentionally NOT listed); `CLIENT_ALLOWED_ACTIONS` lists the 4 client-scoped vault actions + `client_showroom_load` the `client` role may call; `SPECIALIST_ALLOWED_ACTIONS` lists the 4 specialist-scoped vault actions the `specialist` role may call. |
| `TEAM_MEMBER_NAMES` / `teamMemberRecipient(name)` | `constants/onboarding-team.ts` | Maps an onboarding "team member" display name (5 names: Rachael Hopson / Ian Welham / Anton Anderson / Paul Latham / Seth Hartford) → that person's `@elitert.com` admin **login email** so the onboarding's stall/decision/ready notifications land in THAT person's bell (the bell filters on `session.email`); falls back to the shared `'admin'` bell when unset/unmapped. Set by `save_advisor_team_member` / `save_accountant_team_member`; consumed by the advisor/accountant `sweep` (96h stall), `invoice-receipt` ("Ready to create" notification), and `client-decision` handlers. Keep in sync with `SALES_TEAM_NAMES` in the frontend `NewModelSaleModal.jsx`. |
| `pfNotificationRecipient(pf)` | `constants/map1-pfs.ts` | Maps a MAP 1 Planning-Facilitator NAME (`clients.assigned_pf`: Evan / Bridger / Ian) → their `allowed_admins` **@elitert.com LOGIN email** for notification routing; falls back to `'admin'`. DISTINCT from `utils/pf-emails.ts` (which holds the @vfo-services.com CC identity — routing a notification there never matches `session.email`). |
| `isTaxAdmin(email)` | `constants/tax-access.ts` | Allowlist (Jake `jlatham@`, Tim `tgacsy@`, Tray `tvaldes@`, Paul `platham@` elitert.com — Paul added 2026-06-19) gating who may view/download/share client tax returns. |
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
  ├─ 2. Body-size cap (>2,000,000 bytes → 413) + JSON body parse: const body = await req.json()
  │      • malformed JSON → 400 { error: "Invalid JSON body" } (was 200 {ok:true})
  │      • clientIp = (x-forwarded-for ?? "").split(",")[0].trim()
  │      const { action } = body
  │
  ├─ 3. Inline login handlers (admin_login / member_login / client_login / specialist_login / login)
  │      Pre-webhook order preserved (an admin login request never reaches BoldSign-shape detection)
  │      Each runs the login-throttle (utils/login-throttle.ts): 429 if blocked, else passes clientIp through
  │
  ├─ 4. router/webhooks.ts::maybeHandleBoldSignWebhook(body, ...)
  │      • Triggered by body.event?.eventType
  │      • Returns Response or null
  │
  ├─ 5. PUBLIC_HANDLERS[action]  (from router/dispatch.ts)
  │      • 102 entries: public-token + server-to-server chain-callable (6 Tax actions moved to AUTH 2026-06-16; +2 Phase D card-change legs 2026-06-16)
  │      • Dispatched ctx: { body, supabase, json, req }
  │
  ├─ 6. await middleware/auth.ts::authenticate(action, body, supabase, json)
  │      • Reads body.token, looks up admin_sessions
  │      • Returns 401 if missing/expired
  │      • Detects role: admin (allowed_admins), member (member_logins), client, or specialist (both deny-by-default)
  │      • Applies SUPERADMIN_ONLY_ACTIONS gate (NEW 2026-06-16; 14 actions; 403 for non-superadmin incl. regular admins; runs first)
  │      • Applies ADMIN_ONLY_ACTIONS gate (403 for member callers on listed actions)
  │      • Applies MEMBER_SCOPED_ACTIONS gate (forces body.member_number to caller's own)
  │      • Applies CLIENT_ALLOWED_ACTIONS gate (client role limited to 4 vault actions, scoped to auth.callerClientId)
  │      • Applies SPECIALIST_ALLOWED_ACTIONS gate (specialist role limited to 4 vault actions, scoped to auth.callerSpecialistId)
  │
  ├─ 7. AUTH_HANDLERS[action]  (from router/dispatch.ts)
  │      • 200 entries
  │      • Dispatched ctx: { body, supabase, json, auth, req }
  │      • Some handlers take auth (.auth.session.email etc.)
  │      • Three handlers take req for HTTP chain Authorization forwarding
  │        (PIPFU_decision, PCADMIN_pricing, PCADMIN_extrameeting)
  │
  └─ 8. Unknown-action fallthrough
         • !action → 200 { ok: true }
         • else    → 400 { error: "Unknown action: <name>" }
```

Total handler count: **307 actions** (5 logins + 302 dispatched = 102 PUBLIC + 200 AUTH). The post-refactor baseline was 128; subsequent features added MAP1 sweeps/check path/sandbox toggle, the full Tax Planning track (~29 in `actions/tax/`, incl. `presentation-schedule.ts` + `presentation-sweep.ts`), Advisor Onboarding (22 in `actions/advisor/`, incl. `save-team-member.ts`), PIP Meetings (14 in `actions/msm/pip-*.ts`), Accountant Onboarding (23 in `actions/accountant/`, incl. `save-partnership.ts` + `save-team-member.ts`), and the **Specialist Onboarding pipeline (~33 in `actions/onboarding/`** — Stages 1–2 automation + Stage 2 exec voting + Stage 3 background-check Stripe chain + Further Questions + DD Checklist + the reminder sweep + the **2026-06-05 Stage-4 agreement + monthly-license flow**: `sendagreement`/`ceocountersign`/`license-*` [8 handlers] + `boldsign-webhook` specialist branch + 3 `webhooks.ts` subscription blocks; shared `utils/gmail-draft.ts`, `utils/specialist-html-templates.ts`, `constants/specialist-execs.ts`, `utils/specialist-stage3-emails.ts`; see [../flows/specialist-onboarding.md](../flows/specialist-onboarding.md)). The authoritative count is in [05-api-action-catalog.md](05-api-action-catalog.md).

### Key cross-cutting concerns

#### Stripe webhook (`router/webhooks.ts::maybeHandleStripeWebhook`)

Triggered by presence of `stripe-signature` header. Verifies HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`, with a 5-minute timestamp tolerance.

Handles these event types (plus the failure events below):

- **`checkout.session.completed`** — branches by `metadata`/`mode`:
  1. **GC credit purchase**: metadata has `member_number` and `credits`. Increments `gc_balances`, inserts `gc_transactions` row.
  2. **MAP1 first payment**: looks up `pipeline_map1` row by `stripe_customer_id`. Expands `payment_intent` to extract `payment_method.type` (card vs us_bank_account) and `last4`. Sets `pay1_status` to `"succeeded"` (card) or `"processing"` (ACH). Computes `card_processing_fee` from `amount_received` vs `net_invoice / payment_count`. Writes quarterly schedule (`pay2/3/4_date` = +91/182/273 days).
     - **Chains:** `automation_CONTRACT_confirmationemail` (always); for card only, also `automation_CONTRACT_invoicereceipt` and then `automation_CONTRACT_revshare` (P1). ACH waits for `payment_intent.succeeded` to chain invoicereceipt + revshare.

- **`payment_intent.succeeded`** — four cases:
  1. MAP 1 quarterly subsequent payment (metadata `payment_number` is 2-4): sets `payN_status='succeeded'`, chains `automation_CONTRACT_invoicereceipt` then `automation_CONTRACT_revshare` for that payment number.
  2. MAP 1 ACH first-payment cleared (`pay1_status === "processing"`): flips to `"succeeded"`, chains `automation_CONTRACT_invoicereceipt` then `automation_CONTRACT_revshare` for payment 1.
  3. Tax retainer ACH cleared OR tax implementation off-session charge succeeded (`metadata.payment_kind` in `retainer` / `implementation`): writes the appropriate `client_tax_plans` status columns and chains `automation_TAX_confirmationemail` + `automation_TAX_invoicereceipt` / `automation_TAX_implementation_receipt`.
  4. Advisor onboarding ACH cleared (`metadata.pipeline === 'ADVISOR_ONBOARDING'`, `payment_status === 'processing'`): flips `advisor_onboarding.payment_status='succeeded'`, writes `payment_completed_at` + `renewal_date` (via `computeAdvisorRenewalDate`: payment date + `engagement_term_months` rounded UP to the next 15th — never less than the term), chains `automation_ADVISOR_confirmationemail` (which chains `automation_ADVISOR_invoicereceipt`).

The Stripe webhook handler additionally routes `checkout.session.completed` for advisor onboarding (lookup by `stripe_customer_id` after MAP1 + Tax misses, branching by `metadata.payment_kind='onboarding'`) — writes `payment_status`, `payment_method_type`, `card_processing_fee`, `acct_last4`, `stripe_payment_intent_id`, `payment_completed_at` (card path), and `renewal_date` (same always-15th rule).

The cascade extends further: after Advisor miss → PIP lookup on `client_priority_tracks` by `pip_stripe_customer_id` (branched by `metadata.pipeline='PIP'` + `metadata.payment_kind='purchase'`), then after PIP miss → Accountant lookup on `accountant_onboarding` by `stripe_customer_id` (branched by `metadata.pipeline='ACCOUNTANT_ONBOARDING'` + `metadata.payment_kind='onboarding'`). The Accountant branch writes the same shape as Advisor (status, method, fee, renewal_date) and chains `automation_ACCOUNTANT_confirmationemail` (which chains `automation_ACCOUNTANT_invoicereceipt`). No revshare chain on accountant payment — accountants don't have a `revenue_decision`, so VFO holds the share internally. `payment_intent.succeeded` has a parallel branch on `metadata.pipeline='ACCOUNTANT_ONBOARDING'` for the ACH-clears path, using `computeAccountantRenewalDate` (same algorithm as advisor). After Accountant → **Specialist background-check** lookup on `specialist_onboarding` by `bg_stripe_customer_id` (`metadata.payment_kind='background_check'`). **Specialist monthly LICENSE** (`metadata.payment_kind='license'`, `mode=subscription`, 2026-06-05) is handled by **three SEPARATE additive blocks** (not the customer cascade): `checkout.session.completed` (subscription) records the subscription + chains `licconfirmation`; **`invoice.paid`/`invoice.payment_succeeded`** (routed by `lic_stripe_customer_id`; subscription ref via `invoice.parent.subscription_details.subscription`) captures the payment method if not yet set + per-invoice idempotency on `lic_last_invoice_id`, first invoice → `licinvoicereceipt` + advance Stage 4→5, recurring → monthly receipt; **`invoice.payment_failed`** → Tracy dunning. This is the first/only `mode=subscription` + `invoice.*` handling in the codebase — those two events must be enabled on the Stripe webhook endpoint (sandbox done, live pending; GOTCHAS.md gotchas #75–#77).

**Payment-method change (Phase D, 2026-06-16, v483):** a separate `checkout.session.completed` branch (isolated — does NOT touch the MAP1 `pipeRow` logic above) handles `session.mode==='setup'` with `metadata.payment_kind==='card_update'`. This is the **first and only setup-mode / SetupIntent handling in the system** (every prior checkout was `mode=payment` or `mode=subscription`; no SetupIntent was ever read before). Routed by `metadata.pipeline` ∈ {`MAP 1`, `TAX`, `SPECIALIST_LICENSE`} + `metadata.row_id` (both stamped when `payments_send_card_update` mints the setup session). It expands the SetupIntent (`expand[]=payment_method`) to read the newly-entered method, then: (1) sets the Stripe customer's `invoice_settings.default_payment_method`; (2) writes the engagement row's `default_payment_method_id` + `payment_method_type` + `acct_last4` (TAX → `client_tax_plans`; SPECIALIST_LICENSE → `specialist_onboarding.lic_*` columns and additionally PATCHes the live subscription's `default_payment_method` so renewals use it); (3) for **MAP 1** only, recomputes `card_processing_fee` for the new method (card grossed up 2.9%+$0.30, ACH = 0) AND **freezes** already-paid/processing installments' `pay{N}_method`/`pay{N}_last4` to the OLD method before switching, so the Payments tab keeps each past installment's real fee while scheduled installments project from the new method. Each engagement has its OWN per-engagement Stripe customer (not one customer per person), so the saved method is engagement-scoped. The two client-facing legs (`payments_loadcardupdate`, `payments_cardupdate_checkout`) are PUBLIC-token; only `payments_send_card_update` (mint-and-email) is superadmin-gated. The off-session charge paths now consume this saved method: the MAP 1 quarterly charger `actions/pipeline/contract-chargescheduled-sweep.ts` and the Tax `actions/tax/charge-implementation.ts` prefer `default_payment_method_id` when set, falling back to exact prior behavior when unset.

**Failure events (2026-06-15):** `checkout.session.async_payment_failed` (ACH first-payment bounce, all pipelines, via `utils/resolve-stripe-failure.ts` → flips the first-payment status to `failed`), broadened `payment_intent.payment_failed` (non-Specialist first payments; skips off-session installments owned by the sweeps), `customer.subscription.updated`/`deleted` (Specialist license lapse/cancel → revoke-access alert; auto-clears on return to active), `charge.dispute.created`/`closed` (chargebacks), `charge.refunded` + `charge.refund.updated`/`refund.updated`/`refund.failed` (refund tracking incl. Dashboard-issued + failed-refund alert), and `transfer.reversed` (rev-share clawback) all route to Jake via `notifyJakeFailure` (action-required + auto-clear for rev-share/license/disputes; dismissible FYI for the rest). A catch-all `console.log("Stripe webhook event:", event.type)` records every event. These require the matching event subscriptions on the Stripe endpoint.

The revshare chain **pays the share immediately** on payment-clear (the Tracy Revenue-Master cross-check was removed 2026-07-01, gotcha #164 — amounts come from the PF input form on the row) — the daily `pg_cron` sweep (02:00 UTC, see `supabase/cron/revshare-sweep.sql`) now only retries **failed** transfers.

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
3. Detects role via `allowed_admins` row (admin), `member_logins.member_number` (member), the `client` role, or the `specialist` role (added this session — both deny-by-default gates; see [04-auth-and-sessions.md](04-auth-and-sessions.md)).
4. Applies `SUPERADMIN_ONLY_ACTIONS` (NEW 2026-06-16 — 14 actions: 12 Automation-panel + the global Payments page `all_payments_load` + the Phase D card-change send `payments_send_card_update` → 403 for any non-superadmin incl. regular admins; runs first) THEN `ADMIN_ONLY_ACTIONS` (constants/role-gates.ts) — 403 for member callers on listed actions.
5. Applies `MEMBER_SCOPED_ACTIONS` (constants/role-gates.ts) — overwrites `body.member_number` with caller's for scoped reads/writes.
6. For the `client` role, allows only `CLIENT_ALLOWED_ACTIONS` (deny-by-default) and scopes client-vault handlers to `auth.callerClientId`.
7. For the `specialist` role, allows only `SPECIALIST_ALLOWED_ACTIONS` (deny-by-default) and scopes specialist-vault handlers to `auth.callerSpecialistId`.

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
| ~~`MASTER_SHEET_ID`~~ | ~~`actions/pipeline/contract-revshare.ts`~~ | **REMOVED 2026-07-01 (gotcha #164)** — the Revenue-Master read is gone; no code reads a Google Sheet anymore |
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
- `specialist-dd-materials` (**PRIVATE**) — Due Diligence Checklist uploads. Written via signed upload URLs (`actions/onboarding/ddc-upload-url.ts`); read via signed download URLs (`actions/onboarding/ddc-download.ts`). Paths namespaced `<onboarding_id>/<slot>/<rand>_<file>`. Added 2026-06-04, gotcha #69.
- `client-tax-returns` (**PRIVATE**) — sensitive client tax-return vault (added this session). Written/read via signed URLs by `actions/vault/tax-*.ts`: `tax-upload-url.ts` (PUBLIC token), `tax-admin-upload-url.ts`, `tax-list.ts`, `tax-download.ts`, `tax-delete.ts` (AUTH admin; download/delete/admin-upload further gated by `isTaxAdmin` in `constants/tax-access.ts`). Also one of the two client-scoped buckets (see below).
- `client-documents` (**PRIVATE**) — general client document vault (added this session). Written/read via signed URLs by `actions/vault/gen-*.ts`: `gen-list.ts`, `gen-upload-url.ts`, `gen-download.ts`, `gen-delete.ts` (AUTH, any admin). Also one of the two client-scoped buckets (see below).
- `specialist-documents` (**PRIVATE**) — specialist portal vault, namespaced by `expert_id`. Written/read via signed URLs by `actions/vault/specialist-vault-*.ts`: specialist-role `specialist-vault-list.ts` / `-upload-url.ts` / `-download.ts` / `-delete.ts` (scoped to `auth.callerSpecialistId`) + admin-only `specialist-vault-admin-list.ts` / `-admin-download.ts` / `-admin-upload-url.ts` / `-admin-delete.ts` (the upload/delete admin handlers added 2026-06-10 — admins can view, add, and remove). Also populated by `actions/onboarding/create-specialist.ts`, which copies the DD-checklist files from `specialist-dd-materials` into this bucket on specialist creation (and auto-fills the specialist's short/long bio + revenue share from the SIF/DDC).
- `map1-assets` (public, added this session) — holds `PIP-FollowUp-Presentation.pdf`.

**Client-scoped vault** — `actions/vault/client-vault-*.ts` (`client-vault-upload-url.ts` / `-list.ts` / `-download.ts` / `-delete.ts`, AUTH `client` role, scoped to `auth.callerClientId`) operate over BOTH private buckets via the `CLIENT_VAULT_BUCKETS` `{sensitive:'client-tax-returns', general:'client-documents'}` map exported from `client-vault-upload-url.ts`.

> **Storage write gotcha (added this session).** Writes from the edge function MUST use the supabase-js storage client (`createClient(...).storage`), NOT a hand-rolled `Authorization: Bearer <SERVICE_ROLE_KEY>` to `/storage/v1/object` — the `sb_secret_…` key is rejected with `403 Invalid Compact JWS`.

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
