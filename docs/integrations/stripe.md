# Stripe integration

Stripe handles **nine** distinct payment flows in this system:

1. **MAP1 service payments** — recurring quarterly or one-time payment for the VFO membership engagement. Customers, Checkout Sessions, PaymentIntents, and Transfers (revenue share to advisors).
2. **Tax Planning payments** — retainer (Tax 3) + implementation off-session charge (Tax 5). Routed by `metadata.payment_kind` in `retainer` / `implementation`. See [../flows/tax-planning.md](../flows/tax-planning.md).
3. **Advisor Onboarding payments** — one-time charge for advisor's chosen plan combo (dynamic $4,000–$8,600 based on vfo_ft / pft / corporate checkbox picks at BoldSign sign time). `setup_future_usage=off_session` so the card is saved for 6-month renewal review (no auto-renew cron yet). See `ADVISOR_ONBOARDING_RESUMPTION.md` at repo root.
4. **Accountant Onboarding payments** — one-time charge for accountant's plan combo (dynamic $2,000 / $2,600 / $4,000 / $4,600 based on partnership choice + corporate add-on). `setup_future_usage=off_session` so the card is saved for 6-month renewal review (no auto-renew cron yet). See `ACCOUNTANT_ONBOARDING_RESUMPTION.md` at repo root.
5. **PIP Meetings purchases** — one-shot purchase for Tax Planning or N Additional PIP meetings. See [../flows/pip-meetings.md](../flows/pip-meetings.md).
6. **GC marketplace purchases** — one-shot Stripe Checkout for buying gift credits.
7. **Specialist Onboarding background-check payments** (2026-06-03) — one-time Core ($350) or Max ($950) charge for the specialist's background check (Stage 3). ACH or Card; card grosses up the 2.9%+$0.30 fee. No `setup_future_usage`. Confirmation email at payment time; receipt + invoice PDFs on clearance. See [../flows/specialist-onboarding.md](../flows/specialist-onboarding.md).
8. **Specialist Onboarding monthly LICENSE** (2026-06-05) — the **first and only Stripe SUBSCRIPTION in the system** (`mode=subscription`). $99/mo recurring after the Stage-4 agreement is signed; card grossed-up / ACH flat; reuses the specialist's background-check Stripe customer. Stripe owns the recurring billing/dunning — **no custom sweep**. Routed by `metadata.payment_kind=license`. See [../flows/specialist-onboarding.md](../flows/specialist-onboarding.md).
9. **Admin-initiated payment-method change** (2026-06-16, Phase D) — the **first and only `mode=setup` / SetupIntent flow in the system**. **No charge** — it saves a new reusable card/bank so the **next** off-session charge of an existing engagement (MAP 1 quarterly sweep / Tax implementation / Specialist license renewal) uses it. An admin (Jake-only) emails the payer a `/update-card?token=` link; the payer enters the new method on Stripe's hosted setup page; a `checkout.session.completed` + `mode=setup` webhook saves it as the customer/engagement default. Routed by `metadata.payment_kind=card_update` (+ `pipeline` + `row_id`). Because each engagement has its **own** Stripe customer, a change is **per-engagement**. See [../flows/payment-method-change.md](../flows/payment-method-change.md).

All nine flows route through the same webhook endpoint (the `vfo-admin-api` function gated by `stripe-signature`). They are disambiguated by Checkout-Session metadata. The webhook verifies the signature against BOTH `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET_SANDBOX` — whichever validates wins. **Events handled:** `checkout.session.completed` (now also handles **`mode=setup`** sessions — the Phase D card-update flow, 2026-06-16), `payment_intent.succeeded`, `payment_intent.payment_failed` (SPECIALIST bg → `bg_payment_status='failed'`), and — added 2026-06-05 for the license subscription — **`invoice.paid` / `invoice.payment_succeeded`** AND (2026-07-07, newer Stripe API versions) **`invoice_payment.paid`** (all three funnel through the shared `processSpecialistLicenseInvoicePaid()`; recurring billing + receipts; routed by `lic_stripe_customer_id`; the subscription ref is read from whichever location the event provides — `invoice.subscription`, `invoice.parent.subscription_details.subscription`, or the line-item `subscription_item_details.subscription` — falling back to the row's stored `lic_subscription_id` if the event provides none at all, so the handler is never gated on it, gotchas #76/#187) and **`invoice.payment_failed`** (dunning FYI to Tracy). For the CARD-payment case, the first invoice/receipt + Stage 4→5 advance ALSO fires inline from `checkout.session.completed` by expanding the subscription's `latest_invoice`, so it no longer depends on a separate invoice event arriving at all (gotcha #187). The per-invoice idempotency claim (`lic_last_invoice_id`) is written via a `SECURITY DEFINER` RPC (`claim_specialist_license_invoice` — atomic conditional UPDATE, committed to the repo as migration `20260708130000_claim_specialist_license_invoice_rpc.sql`, gotcha #196), not a plain table update — a PostgREST schema-cache anomaly was observed intermittently rejecting direct writes to that column (gotcha #188). Hardening (2026-07-08, v561): because the license reuses the background-check's Stripe customer, the processor now SKIPS an invoice whose event names a subscription that differs from the stored `lic_subscription_id` (a foreign-subscription invoice on the shared customer must never be claimed as a license payment); the event-omits-ref fallback is unchanged. ⚠️ The `invoice.*` events must be **enabled on the Stripe webhook endpoint** — done on **sandbox**; the **live** endpoint still needs them before any real specialist license payment (gotcha #75).

### Metadata convention

| Field | MAP1 | Tax | Advisor | Accountant | PIP | GC | Specialist | Card-update |
|---|---|---|---|---|---|---|---|---|
| `metadata.pipeline` | (none) | `TAX` | `ADVISOR_ONBOARDING` | `ACCOUNTANT_ONBOARDING` | `PIP` | (none) | `SPECIALIST_ONBOARDING` | `MAP 1` / `TAX` / `SPECIALIST_LICENSE` (which engagement) |
| `metadata.payment_kind` | (none — uses `payment_number` for quarterly) | `retainer` / `implementation` | `onboarding` | `onboarding` | `purchase` | (none — uses `member_number` + `credits`) | `background_check` (+ `bg_type=core\|max`) **or `license`** (`mode=subscription`, $99/mo) | **`card_update`** (`mode=setup`, no charge) |
| `metadata.payment_number` | `1` (P1) / `2-4` (chargescheduled sweep) | — | — | — | — | — | — | — |
| `metadata.client_id` / `metadata.onboarding_id` | `client_id` | `tax_plan_id` (via `client_tax_plans`) | `onboarding_id` | `onboarding_id` | `priority_track_id` | — | `row_id` (the engagement row) + `token` |

The webhook router uses these fields to pick the right DB table on `checkout.session.completed` and `payment_intent.succeeded`. Fallback chain: MAP1 lookup by `stripe_customer_id` → Tax lookup → Advisor lookup → PIP lookup → Accountant lookup. The **card-update** `mode=setup` branch is matched by `payment_kind=card_update` and routed directly by `metadata.pipeline` + `metadata.row_id` (no customer-id cascade).

## Env vars

| Var | Purpose | Sandbox toggle |
|---|---|---|
| `STRIPE_SECRET_KEY` | Live secret key | — |
| `STRIPE_SECRET_KEY_SANDBOX` | Test-mode secret key | Selected when `pipeline_sandbox_config.sandbox_mode=true` for "MAP 1" |
| `STRIPE_WEBHOOK_SECRET` | HMAC secret for verifying **live** webhook signatures | Verification handler tries this first |
| `STRIPE_WEBHOOK_SECRET_SANDBOX` | HMAC secret for verifying **test/sandbox** webhook signatures | Verification handler also tries this; either secret validates a webhook |

Sandbox switching is per-pipeline and per-action: handlers read `pipeline_sandbox_config` (`pipeline='MAP 1'`) at the top of each call and pick the live/sandbox key accordingly. **Notable exception:** `gc_create_checkout` uses `STRIPE_SECRET_KEY` unconditionally ([vfo-admin-api/index.ts:2810](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — no sandbox path for GC purchases.

## API endpoints used

| Stripe API | When | Where (admin-api) |
|---|---|---|
| `POST /v1/customers` | Create customer for new MAP1 client | line 896 (`automation_CONTRACT_stripecustomer`) |
| `POST /v1/checkout/sessions` | MAP1 payment Checkout Session | line 1140 (`automation_CONTRACT_stripecheckout`) |
| `POST /v1/checkout/sessions` | GC purchase Checkout Session | line 2824 (`gc_create_checkout`) |
| `GET /v1/payment_intents/{id}?expand[]=payment_method` | Read card last4 + payment method type after webhook | lines 317, 1190 (Stripe webhook handler + dead `_stripewebhook` action) |
| `POST /v1/transfers` | Revenue share payout to member's connected account | line 1463 (`automation_CONTRACT_revshare`) |

All requests use HTTP **Basic auth** with `Authorization: Basic <base64(STRIPE_KEY + ":")>` — no Stripe-Account or Stripe-Version header is set.

## Customer lifecycle

A `pipeline_map1.stripe_customer_id` is created **once** by `automation_CONTRACT_stripecustomer` ([line 861](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) and reused for the life of the engagement. The handler is idempotent — if `stripe_customer_id` already exists it returns success without re-creating.

The customer is created with:
- `email` = `clients.email`
- `name` = `clients.first_name + ' ' + clients.last_name`
- `metadata[client_id]` = the integer `clients.id`

## Checkout Session shape — MAP1 payment

[`automation_CONTRACT_stripecheckout`](../architecture/05-api-action-catalog.md) ([line 1086](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):

```
mode: payment
customer: <pipeline_map1.stripe_customer_id>
payment_method_types: ["card"] OR ["us_bank_account"]
line_items[0]:
  price_data.currency: usd
  price_data.unit_amount: <chargeAmount cents>
  price_data.product_data.name: "VFO Services Membership — Payment 1"
  quantity: 1
success_url: https://www.vfo-services.com/payment-successful/   (hardcoded)
cancel_url:  https://vfoportal.com/pay?token=<token>
payment_intent_data.setup_future_usage: off_session
payment_intent_data.metadata.client_id: <int>
payment_intent_data.metadata.checkout_token: <pipeline_map1.checkout_token>

if ACH:
  payment_method_options.us_bank_account.verification_method: instant
```

### Card-fee gross-up

For `method === "card"`, `chargeAmount = round((baseAmount + 0.30) / (1 - 0.029) * 100)` cents — i.e. the customer pays the gross-up so that VFO receives `baseAmount` net of Stripe fees. ACH has no fee gross-up.

> **Frontend note:** [PayPage.jsx:79](src/pages/PayPage.jsx) displays the card amount using a *different* (naive add-on) formula. The displayed total is informational; the actual Stripe charge uses the gross-up. See [02-frontend-shell.md](../architecture/02-frontend-shell.md).

## Checkout Session shape — GC purchase

[`gc_create_checkout`](../architecture/05-api-action-catalog.md) ([line 2806](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):

```
mode: payment
success_url: https://vfoportal.com/?gc_success=1
cancel_url:  https://vfoportal.com/
line_items[0]:
  price_data.currency: usd
  price_data.unit_amount: <price * 100>
  price_data.product_data.name: "<amount> Growth Credits"
  quantity: 1
metadata.member_number: <member_number>
metadata.credits: <amount>
```

No `customer` is attached. Sandbox keys are not honored here — purchases always go to live Stripe.

## Webhook handler ([line 222](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts))

A request is identified as a Stripe webhook by the presence of the `stripe-signature` HTTP header. The handler:

1. **Verifies signature** using HMAC-SHA256 over `<timestamp>.<rawBody>`.
2. **Rejects timestamps older than 5 minutes** — replay protection (line 243).
3. **Parses event JSON.**
4. Dispatches by `event.type`:

### `checkout.session.completed`

Two handlers run in sequence on this event:

- **GC purchase fulfillment** (lines 270-288): reads `session.metadata.member_number` and `session.metadata.credits`. If both present, updates `gc_balances` (or inserts new row) and appends `gc_transactions` row with `type='purchased'`.
- **MAP1 first-payment handler** (lines 290-392): looks up `pipeline_map1` row by `session.customer` (Stripe customer id). If found and `pay1_status` empty:
  - Expands the PaymentIntent to extract `payment_method.type` (`card` or `us_bank_account`) and `last4`.
  - Sets `pay1_status` = `succeeded` (card) or `processing` (ACH).
  - Computes `card_processing_fee` from `amount_received - baseAmount`.
  - For Quarterly plans, computes `pay2_date`, `pay3_date`, `pay4_date` as +91/+182/+273 days.
  - Sets `confirmation_status='Confirmation Needed'`.
  - **Chains** `automation_CONTRACT_confirmationemail` (always).
  - **Chains** `automation_CONTRACT_invoicereceipt` only for card (ACH waits for `payment_intent.succeeded`).

### `payment_intent.succeeded`

Two cases (lines 394-438):

1. `metadata.payment_number` ∈ {2,3,4}: subsequent quarterly payment cleared. Sets `pay${n}_status='succeeded'`. **Chains** `automation_CONTRACT_invoicereceipt` for that payment number.
2. `pipeRow.pay1_status === 'processing'`: ACH first-payment cleared. Flips to `'succeeded'`. **Chains** `automation_CONTRACT_invoicereceipt` for payment 1.

> **How `metadata.payment_number` gets set for payments 2-4:** by `automation_CONTRACT_chargescheduled_sweep`, a daily-`pg_cron`-driven PUBLIC action (service-role gated). It uses the saved-on-customer payment method (captured by P1's `setup_future_usage: off_session`), creates the PaymentIntent server-side with `Idempotency-Key: chargescheduled-{client_id}-P{N}-{YYYY-MM-DD}`, and stamps `metadata.payment_number=N` so this webhook branch fires the correct chain. See [flows/contract-and-payment.md](../flows/contract-and-payment.md) Step 10½ and [flows/stripe-webhook.md](../flows/stripe-webhook.md).

### Failure events (added 2026-06-15)

Every money-movement failure routes an alert to Jake's bell via `utils/notify-jake-failure.ts` (`notifyJakeFailure`, with an `actionRequired` flag + `clearJakeFailure`/`clearJakeFailuresContaining` for auto-clear), in ADDITION to any existing Tracy/admin/PF alert. A shared `utils/resolve-stripe-failure.ts` maps a Stripe customer + metadata to the right pipeline row + status column (same cascade as `checkout.session.completed`).

- **`checkout.session.async_payment_failed`** — an ACH first payment that bounced after the session completed (previously silent everywhere). Flips the row's first-payment status to `failed` across MAP 1 / Tax retainer / Advisor / Accountant / PIP / Specialist bg.
- **`payment_intent.payment_failed`** — broadened beyond Specialist to all first-payment pipelines; skips off-session installments (`metadata.payment_number` / `payment_kind='implementation'`) which the charge sweeps already detect synchronously.
- **`customer.subscription.updated` / `.deleted`** — Specialist $99/mo license past_due/canceled → "consider revoking access" alert (routed by `lic_subscription_id`); auto-clears + restores `lic_payment_status` on return to active.
- **`charge.dispute.created` / `.closed`** — chargeback alert (action-required); close clears the opened alert, then posts the won/lost outcome.
- **`charge.refunded`** + **`charge.refund.updated` / `refund.updated` / `refund.failed`** — tracks every refund (incl. Stripe-Dashboard-issued) and alerts on a failed refund.
- **`transfer.reversed`** — a rev-share Connect transfer reversed/clawed back.
- Catch-all `console.log("Stripe webhook event:", event.type)` logs every event for observability.

These only fire if the Stripe endpoint subscribes to the event types (config, both live + sandbox). Alert policy: action-required + auto-clear for rev-share/license/disputes (clean recovery event); dismissible FYI for the rest (no programmatic recovery → would be permanent clutter).

> Note: the `checkout.session.completed` / `payment_intent.succeeded` sections above are MAP 1-centric and carry pre-refactor line refs; the **authoritative current webhook routing** (tax / advisor / accountant / pip / specialist cascade + these failure events) lives in `SESSION_REFERENCE.md` → "Stripe webhook chain order".

## Setup mode / SetupIntent — admin-initiated card-update (2026-06-16, Phase D)

This is the **first and only `mode=setup` / SetupIntent usage** in the system. Every other Checkout Session is `mode=payment` (charges) or `mode=subscription` (the specialist license). A setup session **saves a reusable payment method with no charge** so the *next* off-session charge of an existing engagement uses it. Full flow: [../flows/payment-method-change.md](../flows/payment-method-change.md).

**Checkout Session shape — card-update** (`payments_cardupdate_checkout`, [actions/payments/card-update-checkout.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/payments/card-update-checkout.ts)):

```
mode: setup                         # no line_items, no charge
customer: <the engagement's EXISTING Stripe customer>
payment_method_types: ["card"] OR ["us_bank_account"]
success_url: <portal>/update-card?token=<token>&updated=1
cancel_url:  <portal>/update-card?token=<token>
metadata.payment_kind: card_update
metadata.pipeline:     MAP 1 | TAX | SPECIALIST_LICENSE
metadata.row_id:       <engagement row id>
metadata.token:        <card_update_tokens.token>
setup_intent_data.metadata: { payment_kind, pipeline, row_id }   # mirrored onto the SetupIntent
if ACH: payment_method_options.us_bank_account.verification_method: instant
```

**Webhook — `checkout.session.completed` with `mode==='setup'` and `metadata.payment_kind==='card_update'`** ([router/webhooks.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/router/webhooks.ts)): a NEW isolated branch (does **not** touch the MAP 1 `pipeRow` logic). It expands the **SetupIntent** (`GET /v1/setup_intents/{id}?expand[]=payment_method`) to read the new method's id/type/last4, then:

1. `POST /v1/customers/{cus}` → `invoice_settings.default_payment_method = <pm>` (customer-level default for future invoices/charges).
2. Writes the engagement row's `default_payment_method_id` (`lic_default_payment_method_id` for the specialist license) + `payment_method_type` + `acct_last4`.
3. **MAP 1** also recomputes `card_processing_fee` for the new method and **freezes** already-paid installments' `pay{N}_method` / `pay{N}_last4`.
4. **SPECIALIST_LICENSE** also `POST /v1/subscriptions/{sub}` → `default_payment_method = <pm>` so renewals bill the new method.

> Because each engagement has its **own** Stripe customer (member-paid MAP 1 / Tax → the *member's* customer), a card-update is **per-engagement** — one setup session per customer. The `card_update_tokens` token is person-keyed, but the setup session and webhook operate on exactly one engagement.

### Off-session charges now prefer the stored default PM

After Phase D, the two custom off-session charge paths **prefer the engagement's `default_payment_method_id`** when set (saved by the card-update webhook), falling back to their prior method-selection otherwise:

- **MAP 1 quarterly sweep** ([actions/pipeline/contract-chargescheduled-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-chargescheduled-sweep.ts)) — uses `default_payment_method_id` if present, else lists the customer's saved methods and picks the most recent (prior behavior).
- **Tax implementation** ([actions/tax/charge-implementation.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/charge-implementation.ts)) — uses `default_payment_method_id` if present (this also lets a check-paid retainer be charged off-session once a card/bank is added), else reuses the retainer charge's method. The idempotency-key PM suffix derives from `default_payment_method_id` when set, so the key auto-rotates when the method changes.
- The **Specialist $99/mo license** already keys off its subscription's default PM, which the webhook repoints in step 4 above.

## Stripe Connect & revenue share

`automation_CONTRACT_revshare` ([line 1248](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) creates a Stripe Transfer:

```
POST /v1/transfers
amount: <round(shareAmount * 100)>
currency: usd
destination: <members.stripe_account_id>
description: "VFO Revenue Share — <client_ref> Payment <N>"
```

This requires:
- A Stripe Connect account configured for each member (`members.stripe_account_id` populated).
- The platform's Stripe account (the `STRIPE_SECRET_KEY` holder) to have sufficient balance for the transfer.

The handler **only transfers** if:
- `members.revenue_decision !== "Money Mapping"` (else: marked `"Money Mapping"`, no transfer)
- `shareAmount > 0` (else: marked `"N/A — No Share Due"`)
- `members.stripe_account_id` is set (else: skipped silently)

## Sandbox vs live transitions

| Setting | Live | Sandbox |
|---|---|---|
| `pipeline_sandbox_config.sandbox_mode` | `false` | `true` |
| `pipeline_sandbox_config.stripe_test_mode` | `false` | `true` (informational — code reads `sandbox_mode` only) |
| Stripe key used | `STRIPE_SECRET_KEY` | `STRIPE_SECRET_KEY_SANDBOX` |
| Recipient email override | none | `pipeline_sandbox_config.sandbox_email` |

> **Inconsistency flagged:** the column `stripe_test_mode` exists on `pipeline_sandbox_config` but the handlers all read `sandbox_mode` instead. The `stripe_test_mode` column appears unused in the code. Either dead UX state or undocumented intent. [Schema source](../tables/pipeline.md).

## Frontend touch-points

- [PayPage.jsx:39](src/pages/PayPage.jsx) → `automation_CONTRACT_stripecheckout` → window.location to Stripe URL.
- [MemberGCMarketplace.jsx:47](src/components/member/MemberGCMarketplace.jsx) → `gc_create_checkout` → window.location to Stripe URL.
- [AutomationPanel.jsx](src/components/admin/AutomationPanel.jsx) read-only — never calls Stripe.

## Hardcoded Stripe URLs / values

| Value | Where |
|---|---|
| `https://www.vfo-services.com/payment-successful/` | MAP1 checkout success URL ([line 1120](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) |
| `https://vfoportal.com/?gc_success=1` | GC checkout success URL ([line 2815](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) |
| Card processing fee constants | `2.9%` and `$0.30` — embedded in the gross-up math at line 1116 and PayPage:79 |
| 5-minute timestamp tolerance | Stripe webhook replay guard ([line 243](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) |

## Pipeline-table fields driven by Stripe

See [../tables/pipeline.md](../tables/pipeline.md) for the full column list. Quick reference:

- `stripe_customer_id` — created by `automation_CONTRACT_stripecustomer`
- `checkout_token` — created alongside, used as `/pay?token=...` URL key
- `payment_method_type`, `acct_last4`, `card_processing_fee` — set on first webhook
- `pay1_status` … `pay4_status`, `pay1_date` … `pay4_date` — written by webhook
- `rec1_rev_share` … `rec4_rev_share`, `rec1_rev_paid` … `rec4_rev_paid` — written by `_revshare`
- `default_payment_method_id` (also `client_tax_plans.default_payment_method_id`, `specialist_onboarding.lic_default_payment_method_id`) — written by the **card-update** `mode=setup` webhook; preferred by the off-session charge paths. (Phase D, 2026-06-16)
- `pay1_method` … `pay4_method`, `pay1_last4` … `pay4_last4` — frozen per-installment method/last4, written by the card-update webhook so the Payments tab keeps each past installment's real fee after a method change. (Phase D)
