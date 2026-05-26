# Stripe integration

Stripe handles **four** distinct payment flows in this system:

1. **MAP1 service payments** — recurring quarterly or one-time payment for the VFO membership engagement. Customers, Checkout Sessions, PaymentIntents, and Transfers (revenue share to advisors).
2. **Tax Planning payments** — retainer (Tax 3) + implementation off-session charge (Tax 5). Routed by `metadata.payment_kind` in `retainer` / `implementation`. See [../flows/tax-planning.md](../flows/tax-planning.md).
3. **Advisor Onboarding payments** — one-time charge for advisor's chosen plan combo (dynamic $4,000–$8,600 based on vfo_ft / pft / corporate checkbox picks at BoldSign sign time). `setup_future_usage=off_session` so the card is saved for 6-month renewal review (no auto-renew cron yet). See `ADVISOR_ONBOARDING_RESUMPTION.md` at repo root.
4. **GC marketplace purchases** — one-shot Stripe Checkout for buying gift credits.

All four flows route through the same webhook endpoint (the `vfo-admin-api` function gated by `stripe-signature`). They are disambiguated by Checkout-Session metadata. The webhook handler verifies the incoming signature against BOTH `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET_SANDBOX` — whichever validates wins, so live and sandbox Stripe accounts can both deliver to the same URL.

### Metadata convention

| Field | MAP1 | Tax | Advisor | GC |
|---|---|---|---|---|
| `metadata.pipeline` | (none) | `TAX` | `ADVISOR_ONBOARDING` | (none) |
| `metadata.payment_kind` | (none — uses `payment_number` for quarterly) | `retainer` / `implementation` | `onboarding` | (none — uses `member_number` + `credits`) |
| `metadata.payment_number` | `1` (P1) / `2-4` (chargescheduled sweep) | — | — | — |
| `metadata.client_id` / `metadata.onboarding_id` | `client_id` | `tax_plan_id` (via `client_tax_plans`) | `onboarding_id` | — |

The webhook router uses these fields to pick the right DB table on `checkout.session.completed` and `payment_intent.succeeded`. Fallback chain: MAP1 lookup by `stripe_customer_id` → Tax lookup → Advisor lookup.

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
cancel_url:  https://jlathamert.github.io/vfo-portal/pay?token=<token>
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
success_url: https://jlathamert.github.io/vfo-portal/?gc_success=1
cancel_url:  https://jlathamert.github.io/vfo-portal/
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
| `https://jlathamert.github.io/vfo-portal/?gc_success=1` | GC checkout success URL ([line 2815](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) |
| Card processing fee constants | `2.9%` and `$0.30` — embedded in the gross-up math at line 1116 and PayPage:79 |
| 5-minute timestamp tolerance | Stripe webhook replay guard ([line 243](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) |

## Pipeline-table fields driven by Stripe

See [../tables/pipeline.md](../tables/pipeline.md) for the full column list. Quick reference:

- `stripe_customer_id` — created by `automation_CONTRACT_stripecustomer`
- `checkout_token` — created alongside, used as `/pay?token=...` URL key
- `payment_method_type`, `acct_last4`, `card_processing_fee` — set on first webhook
- `pay1_status` … `pay4_status`, `pay1_date` … `pay4_date` — written by webhook
- `rec1_rev_share` … `rec4_rev_share`, `rec1_rev_paid` … `rec4_rev_paid` — written by `_revshare`
