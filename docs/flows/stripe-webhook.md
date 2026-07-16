# Stripe webhook flow

What happens when Stripe tells the system that a payment occurred. The Stripe webhook handles **two unrelated flows** at the same endpoint, disambiguated by Checkout Session metadata: MAP1 service payments and GC credit purchases.

## Trigger

Stripe POSTs an event to the admin-api endpoint with the `stripe-signature` HTTP header set:

```
POST https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api
Headers:
  stripe-signature: t=<timestamp>,v1=<HMAC-SHA256>
Body: <raw event JSON>
```

The Stripe webhook URL is configured **outside this codebase** in the Stripe Dashboard.

## Handler dispatch ([admin-api:222-441](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts))

Triggered by presence of the `stripe-signature` header. Always returns before reaching the action dispatcher.

### Step 0 — Signature verification ([lines 226-262](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts))

1. Reads BOTH `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET_SANDBOX` env vars. At least one must be set (returns 500 otherwise).
2. Parses the `stripe-signature` header into `t` (timestamp) and `v1` (signature) parts.
3. Rejects if timestamp is older than **5 minutes** (replay guard).
4. Computes HMAC-SHA256 over `<timestamp>.<rawBody>` against EACH configured secret. Whichever matches wins — so a single endpoint can receive both live and sandbox webhooks.
5. Returns 401 if neither secret produces a matching signature.
6. Parses raw body as JSON. Returns 400 on parse failure.

### Step 1 — Dispatch by event type

The handler `if`-checks `event.type === "checkout.session.completed"` and `event.type === "payment_intent.succeeded"` (Branches A/B below). It ALSO handles a set of failure/lifecycle events (`payment_intent.payment_failed`, `checkout.session.async_payment_failed`, subscription/dispute/refund/transfer events — see [SESSION_REFERENCE.md](../SESSION_REFERENCE.md) "Failure-event handling"), including the v612 late-ACH off-session branches described in **Branch C** below. All other event types are ignored (200 OK with `{received: true}`).

---

## Branch A — `checkout.session.completed`

> **Multi-pipeline routing.** As of 2026-05-28 the handler cascades through FIVE pipeline lookups by `stripe_customer_id`: MAP1 (`pipeline_map1`) → Tax (`client_tax_plans`) → Advisor (`advisor_onboarding`) → **PIP Meetings** (`client_priority_tracks` WHERE `track_type='pip'`) → **Accountant** (`accountant_onboarding`). The PIP branch additionally gates `pi.metadata.pipeline === "PIP"` on the `payment_intent.succeeded` path for ACH-clearing. The Accountant branch gates `pi.metadata.pipeline === "ACCOUNTANT_ONBOARDING"` + `metadata.payment_kind === "onboarding"` and mirrors the advisor cascade shape (card path immediately chains `automation_ACCOUNTANT_confirmationemail` → `automation_ACCOUNTANT_invoicereceipt`; ACH waits for `payment_intent.succeeded`). No revshare chain on accountant — accountants don't have `revenue_decision`. See [pip-meetings.md](pip-meetings.md) and `ACCOUNTANT_ONBOARDING_RESUMPTION.md` for full routing detail.

### Sub-branch A1 — GC credit purchase ([lines 270-288](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts))

**Trigger:** customer paid for a GC credit purchase (initiated via `gc_create_checkout`).

**Discriminant:** `session.metadata.member_number` and `session.metadata.credits` are both set.

**What it does:**
1. Reads existing `gc_balances.balance` for the member (or 0 if no row).
2. UPSERTs `gc_balances` with `balance = current + credits`.
3. INSERTs `gc_transactions` row: `type='purchased'`, `amount=<credits>`, `balance_after=<new balance>`, `description="<credits> credits purchased via Stripe"`.

**Tables read:** `gc_balances`.
**Tables written:** `gc_balances` (insert or update), `gc_transactions` (insert).
**Chains:** none.

### Sub-branch A2 — MAP1 first payment ([lines 290-392](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts))

**Trigger:** client paid the first MAP1 payment via `/pay`.

**Discriminant:** `session.customer` matches a `pipeline_map1.stripe_customer_id`. (Note: A1 and A2 are NOT mutually exclusive — the handler runs both blocks sequentially. The metadata-based GC check fails if no `member_number` is present, so it's a no-op for MAP1 payments. Vice versa, the customer-based MAP1 check fails if no `stripe_customer_id` matches, so it's a no-op for GC purchases.)

**What it does:**
1. Looks up `pipeline_map1` by `stripe_customer_id`. Bails if no row or `pay1_status` is already set (idempotent).
2. Reads `pipeline_sandbox_config` to pick live vs sandbox Stripe key.
3. Calls Stripe `GET /v1/payment_intents/<id>?expand[]=payment_method` to get:
   - `payment_method.type` → `'card'` or `'us_bank_account'`
   - `card.last4` or `us_bank_account.last4` → `acct_last4`
4. Computes `card_processing_fee = (amount_received_cents / 100) - baseAmount` (only for card; ACH has no fee).
5. UPDATEs `pipeline_map1`:
   - `pay1_status` = `'succeeded'` (card) or `'processing'` (ACH)
   - `payment_method_type`, `acct_last4`, `card_processing_fee`
   - `pay1_date` = today
   - For Quarterly plan: `pay2_date`, `pay3_date`, `pay4_date` = today + 91/182/273 days
   - `confirmation_status='Confirmation Needed'`
6. **Chains** `automation_CONTRACT_confirmationemail` (always).
7. **Chains** `automation_CONTRACT_invoicereceipt` for card only (ACH waits for `payment_intent.succeeded` to chain).
8. **Chains** `automation_CONTRACT_revshare` for card only (P1). As of 2026-07-01 (gotcha #164) the Tracy Revenue-Master cross-check was removed — this **pays the share immediately** on clear (amounts from the PF input form) and also transfers the 10% strategic-partner share when the connected member is a strategic member; the daily 02:00-UTC `_revshare_sweep` cron now only retries **failed** transfers.

**Tables read:** `pipeline_map1`, `pipeline_sandbox_config`.
**Tables written:** `pipeline_map1` (many columns).
**External calls:** Stripe `GET /v1/payment_intents`.
**Chains:** `automation_CONTRACT_confirmationemail`, `automation_CONTRACT_invoicereceipt` (card), `automation_CONTRACT_revshare` (card).

---

## Branch B — `payment_intent.succeeded`

[Lines 394-438](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)

**Trigger:** PaymentIntent moved to `succeeded` state. This fires:
- After ACH bank-debit clears (typically 2-4 business days after `checkout.session.completed`)
- For each subsequent quarterly payment (2, 3, 4) when charged off-session

### Sub-branch B1 — Quarterly subsequent payment

**Discriminant:** `pi.metadata.payment_number` ∈ {2, 3, 4}.

**What it does:**
1. Looks up `pipeline_map1` by `stripe_customer_id`.
2. UPDATEs `pay${n}_status='succeeded'`.
3. **Chains** `automation_CONTRACT_invoicereceipt` for that payment number.
4. **Chains** `automation_CONTRACT_revshare` for that payment number.

> **How payments 2-4 are created:** `automation_CONTRACT_chargescheduled_sweep` (PUBLIC, service-role gated) is invoked by a daily `pg_cron` job at 03:00 UTC. It scans `pipeline_map1` for due-but-unpaid quarterly payments, lists saved payment methods on the Stripe customer, and POSTs to `/v1/payment_intents` with `confirm=true off_session=true metadata.payment_number=N` and a **LOGICAL, date-less** `Idempotency-Key: chargescheduled-{client_id}-P{N}` (v612 — the old date suffix let a lost post-charge status write double-charge; gotcha #228). The resulting `payment_intent.succeeded` is what this webhook branch handles. See [contract-and-payment.md](contract-and-payment.md) Step 10½ and [05-api-action-catalog.md](../architecture/05-api-action-catalog.md#public-token-automation-public_handlers-in-routerdispatchts).

### Sub-branch B2 — ACH first-payment cleared

**Discriminant:** No `payment_number` metadata, AND `pipeRow.pay1_status === 'processing'` (i.e., this is the ACH bank-debit clearing).

**What it does:**
1. UPDATEs `pay1_status='succeeded'`.
2. **Chains** `automation_CONTRACT_invoicereceipt` for payment 1.
3. **Chains** `automation_CONTRACT_revshare` for payment 1.

---

## Branch C — `payment_intent.payment_failed` (late-ACH off-session, v612)

An off-session charge (a swept quarterly installment or a Tax implementation charge) paid by **ACH** returns `processing` at creation and can **bounce days later**. The old blanket rationale ("payment_intent.payment_failed skips off-session installments because the sweeps alert synchronously") is CARD-ONLY; the late ACH failure was being dropped, stranding the row in `processing` forever. v612 adds two additive branches, each keyed on a `'processing'` status guard so a card sync-decline the sweep already handled is not double-alerted (gotcha #229):

- **MAP1 installment** — `metadata.payment_number` ∈ {2,3,4}, row by `stripe_customer_id`, acts ONLY when `pay{N}_status === 'processing'`: flips it to `declined` + `notifyByRule MAP1_installment_charge_failed` + `notifyJakeFailure FAILURE_map1_installment_charge` + drafts the client `/pay` email via the shared `utils/map1-installment-failure.ts` (bell text conditional on `checkout_token`).
- **TAX implementation** — `metadata.payment_kind === 'implementation'`, acts ONLY when `implementation_charge_status === 'processing'`: flips it to `declined` + `notifyByRule TAX_impl_charge_failed` + `notifyJakeFailure FAILURE_tax_implementation_charge` (status + alerts only, no email — admin re-sends via Tax 5).

The rule keys deliberately reuse the synchronous sweep paths'. See [SESSION_REFERENCE.md](../SESSION_REFERENCE.md) "Failure-event handling" for the full failure-event roster.

---

## Tables touched (across all branches)

- **Read:** `pipeline_map1`, `pipeline_sandbox_config`, `gc_balances`.
- **Written:** `pipeline_map1` (status/method/dates), `gc_balances` (insert/update), `gc_transactions` (insert).

## Downstream chains

| Branch | Chains |
|---|---|
| A1 (GC) | none |
| A2 (MAP1 card) | `automation_CONTRACT_confirmationemail` + `automation_CONTRACT_invoicereceipt` + `automation_CONTRACT_revshare` (payment 1) |
| A2 (MAP1 ACH) | `automation_CONTRACT_confirmationemail` only |
| B1 (Quarterly N) | `automation_CONTRACT_invoicereceipt` + `automation_CONTRACT_revshare` (payment N) |
| B2 (ACH cleared) | `automation_CONTRACT_invoicereceipt` + `automation_CONTRACT_revshare` (payment 1) |

## Dead-code note

There is also `if (action === "automation_CONTRACT_stripewebhook")` at [admin-api:1156](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) — but reaching this requires a request that has neither the `stripe-signature` header nor an `action` field, just `body.object === "event"` (which line 540 then sets `body.action` to). In production, every Stripe webhook arrives with the signature header and gets handled at line 222 before line 1156 is ever reached. Treated as dead code in [03-edge-functions.md](../architecture/03-edge-functions.md#possibly-dead-code).

## Failure modes

1. **Signature missing or invalid** → 401, Stripe retries with backoff per its standard policy.
2. **Replay (timestamp > 5 min old)** → 400.
3. **`pipeline_map1` lookup fails** → returns 200 with no action. Stripe considers it delivered. Pipeline stalls.
4. **Chain call fails** (admin-api → admin-api) → caught and logged. DB writes succeeded, but downstream emails/PDFs not produced. Manual replay required.
5. **Both A1 and A2 blocks execute** for an event that incidentally has both a customer match AND member_number metadata — they touch independent tables (gc_* vs pipeline_map1) so this is benign, but worth noting that they're not gated as exclusive.
6. **Idempotency** — A2 is gated on `!pipeRow.pay1_status` — duplicate webhooks won't double-process. B2 is gated on `pay1_status === 'processing'` — won't fire if already 'succeeded'. A1 is **not idempotent** — duplicate delivery would credit twice. Stripe's "at-least-once" delivery model means this is theoretically possible.

## Open questions

1. **Subsequent quarterly payment creation mechanism** — see B1 above.
2. **Webhook idempotency for GC purchases** — A1 has no idempotency guard. Is Stripe's at-least-once delivery a real concern here? Confirm with user.

## Cross-references

- Master flow: [contract-and-payment.md](contract-and-payment.md#step-10--stripe-webhook-fires)
- Stripe integration detail: [../integrations/stripe.md](../integrations/stripe.md)
- GC marketplace flow: [gift-credits.md](gift-credits.md)
- Pipeline columns: [../tables/pipeline.md](../tables/pipeline.md)
