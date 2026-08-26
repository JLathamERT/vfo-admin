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

> **Multi-pipeline routing.** As of 2026-05-28 the handler cascades through FIVE pipeline lookups by `stripe_customer_id`: MAP1 (`pipeline_map1`) → Tax (`client_tax_plans`) → Advisor (`advisor_onboarding`) → **PIP Meetings** (`client_priority_tracks` WHERE `track_type='pip'`) → **Accountant** (`accountant_onboarding`). The PIP branch additionally gates `pi.metadata.pipeline === "PIP"` on the `payment_intent.succeeded` path for ACH-clearing. The Accountant branch gates `pi.metadata.pipeline === "ACCOUNTANT_ONBOARDING"` + `metadata.payment_kind === "onboarding"` and mirrors the advisor cascade shape (card path immediately chains `automation_ACCOUNTANT_confirmationemail` → `automation_ACCOUNTANT_invoicereceipt`; ACH waits for `payment_intent.succeeded`). **No revshare chain on accountant** — unchanged, but the REASON moved: accountant-created members DO carry a `revenue_decision` as of 2026-08-12 / v730 (`'Money Mapping'`, gotcha #375). The accountant branch simply never had a revshare leg; VFO holds the share internally. Do not "restore" one by reading the new column. See [pip-meetings.md](pip-meetings.md) and `ACCOUNTANT_ONBOARDING_RESUMPTION.md` for full routing detail.

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
6. **Chains** `automation_CONTRACT_confirmationemail` (always — both methods, deliberately). That handler owns the "client paid" PF bell, the ERT vault agreement copy and Tracy's new-case email in addition to the email, so the gate lives INSIDE it: for a **card** first payment it skips the client Gmail draft and stamps `confirmation_status='Skipped - Card (Receipt Only)'` (no `confirmation_email_sent_at`); ACH gets the confirmation. See [contract-and-payment.md](contract-and-payment.md) Step 11.
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
1. Looks up `pipeline_map1` by `stripe_customer_id` (the `.select()` includes `rec2_email_sent, rec3_email_sent, rec4_email_sent` for step 3's guard, and — since 2026-08-26 — `pay2_status, pay3_status, pay4_status` for step 2's).
2. Reads `pay${n}_status` **before** overwriting it, then UPDATEs `pay${n}_status='succeeded'` + `pay${n}_paid_at`.
3. **Chains** `automation_CONTRACT_invoicereceipt` for that payment number — **SKIPPED (with a log line) when `rec${n}_email_sent` is already `true`.**
4. **Chains** `automation_CONTRACT_revshare` for that payment number (guarded independently by `contract-revshare.ts`'s own `isResolved` check).

> **CANCELLED-COLLECTED HARDENING (2026-08-26, v789).** A superadmin can close a MAP 1 installment from the client Payments tab — `pay{N}_status='cancelled'`, see [contract-and-payment.md](contract-and-payment.md) Step 10¾ — and money can still land on it: the charge was raised (by the sweep or a `/pay` link) **before** the cancel wrote, or Stripe **redelivers** this event afterwards (**#327** — there is still no event-id dedupe here). **The branch does NOT skip.** The money really moved, so the row must still say `succeeded` and the receipt + revshare chains must still run — a silent skip would leave a collected payment with no receipt and an unpaid member share. What the branch adds is the **action-required bell `FAILURE_map1_cancelled_installment_collected`** (`notifyJakeFailure`, `actionRequired: true`, `notification_rules` row seeded live, to Jake, link `/admin/client/<id>?tab=payments`), whose body says the installment was recorded as succeeded and the chains ran, and asks whether the client is owed a **refund** — because somebody had deliberately decided this money was written off. `pay{N}_status='cancelled'` is the ONLY discriminant; the pre-write read in step 1/2 is what makes it observable.

> **⚠️ THIS WEBHOOK CAN BE DELIVERED TWICE AND ONLY THIS ONE BRANCH IS LATCHED (2026-08-04, gotcha #327).** The router acks Stripe only after `await`ing the whole chain, and the receipt chain (PDF → Drive upload → Gmail draft) can exceed Stripe's ~30s timeout; Stripe then **redelivers the identical event**, and `router/webhooks.ts` keeps **no event-id dedupe**. Live consequence: two identical Gmail receipt drafts for one $1,050 MAP 1 installment, **sharing one receipt number** — while the revshare chain fired once, because it had a guard. Step 3's `rec{N}_email_sent` check was added in response. It does **not** cover two deliveries overlapping in flight, and **no other branch on this page is protected** — B2 (ACH first payment), the tax / advisor / accountant / PIP / specialist branches all remain able to double-fire. The systemic fix (ack immediately + `EdgeRuntime.waitUntil`) is **not built**. Adding any new chained side effect here means adding its own latch first; note a reused `rec{N}_number` is **not** one (#328).

> **Two sources now stamp `metadata.payment_number` (2026-08-21, v773).** The nightly sweep below is the automatic one; the **client-driven `/pay` page is the other** — `automation_CONTRACT_stripecheckout` resolves the open installment and stamps `payment_intent_data.metadata.payment_number=N`, so a client paying a failed P2–P4 from the emailed link lands in **this** branch rather than being mis-booked as payment 1. The `checkout.session.completed` MAP 1 branch self-skips such a session on its `if (pipeRow && !pipeRow.pay1_status)` guard, so the two never collide. See [contract-and-payment.md](contract-and-payment.md) Step 10⅓.
>
> **How payments 2-4 are created:** `automation_CONTRACT_chargescheduled_sweep` (PUBLIC, service-role gated) is invoked by a daily `pg_cron` job at 03:00 UTC. It scans `pipeline_map1` for due-but-unpaid quarterly payments, lists saved payment methods on the Stripe customer, and POSTs to `/v1/payment_intents` with `confirm=true off_session=true metadata.payment_number=N` and a **LOGICAL, date-less** `Idempotency-Key: chargescheduled-{client_id}-P{N}` (v612 — the old date suffix let a lost post-charge status write double-charge; gotcha #228). The resulting `payment_intent.succeeded` is what this webhook branch handles. See [contract-and-payment.md](contract-and-payment.md) Step 10½ and [05-api-action-catalog.md](../architecture/05-api-action-catalog.md#public-token-automation-public_handlers-in-routerdispatchts).

### Sub-branch B2 — ACH first-payment cleared

**Discriminant:** No `payment_number` metadata, AND `pipeRow.pay1_status === 'processing'` (i.e., this is the ACH bank-debit clearing).

**What it does:**
1. UPDATEs `pay1_status='succeeded'`.
2. **Chains** `automation_CONTRACT_invoicereceipt` for payment 1.
3. **Chains** `automation_CONTRACT_revshare` for payment 1.

### Sub-branch B3 — TAX final retainer settled *(added 2026-08-25, 3-payment plans)*

**Discriminant:** `pi.metadata.payment_kind === 'final_retainer'`, row from `client_tax_plans` by `stripe_customer_id`. Card arrives here immediately after the off-session charge; ACH days later.

**Latched on `final_retainer_confirmation_status IS NULL`** — and that single latch is all that protects a receipt PDF, a Gmail draft **and a real Connect transfer** from a redelivery (**#327**).

**What it does:**
1. Expands the PaymentIntent's payment method; derives `card_processing_fee` from **`final_retainer_amount`, NOT `retainer_amount`** — the full retainer is initial + final, so grossing against it writes a large NEGATIVE fee. The same bug existed on the initial-retainer branch in `checkout.session.completed` (which now derives its base from `initial_retainer_amount` on a 3-payment plan) and both were fixed in one change.
2. UPDATEs `final_retainer_status='succeeded'` + `final_retainer_confirmation_status='Confirmation Needed'`, and **re-states** the PI id and charge date, because on the fresh-link recovery path Stripe can deliver `payment_intent.succeeded` *before* `checkout.session.completed`.
3. **Chains** `automation_TAX_final_retainer_receipt` (which also issues a fresh amended invoice when `fee_amended_at_tax4` is set).
4. **Chains** `automation_TAX_revshare` with `payment_kind='retainer'` — the **deferred** retainer revenue share, paid on the FULL `retainer_amount`.
5. Mints the "Complete Client decision 2" bell, but only after a `'Continue - Revenue Share'` decision — matching the 2-payment condition exactly.

See [tax-fee-process.md](tax-fee-process.md) for why the revshare is deferred and which gate actually holds it (**#441**).

> **A final retainer can also arrive through Branch A.** If the off-session charge failed and the client paid through a fresh `/tax-pay` link, `checkout.session.completed` books it off `session.metadata.payment_kind === 'final_retainer'` (card → `succeeded` + chain the receipt; ACH → `processing`, chains nothing). That block deliberately does **not** set `final_retainer_confirmation_status` — this branch owns the latch.

---

## Branch C — `payment_intent.payment_failed` (late-ACH off-session, v612)

An off-session charge (a swept quarterly installment or a Tax implementation charge) paid by **ACH** returns `processing` at creation and can **bounce days later**. The old blanket rationale ("payment_intent.payment_failed skips off-session installments because the sweeps alert synchronously") is CARD-ONLY; the late ACH failure was being dropped, stranding the row in `processing` forever. v612 adds two additive branches, each keyed on a `'processing'` status guard so a card sync-decline the sweep already handled is not double-alerted (gotcha #229):

- **MAP1 installment** — `metadata.payment_number` ∈ {2,3,4}, row by `stripe_customer_id`, acts ONLY when `pay{N}_status === 'processing'`: flips it to `declined` + `notifyByRule MAP1_installment_charge_failed` + `notifyJakeFailure FAILURE_map1_installment_charge` + drafts the client `/pay` email via the shared `utils/map1-installment-failure.ts` (bell text conditional on `checkout_token`).
- **TAX implementation** — `metadata.payment_kind === 'implementation'`, acts ONLY when `implementation_charge_status === 'processing'`: flips it to `declined` + `notifyByRule TAX_impl_charge_failed` + `notifyJakeFailure FAILURE_tax_implementation_charge` (status + alerts only, no email — admin re-sends via Tax 5).
- **TAX final retainer** *(added 2026-08-25)* — `metadata.payment_kind === 'final_retainer'`, acts ONLY when `final_retainer_status === 'processing'`: flips it to `declined` + `notifyByRule TAX_final_retainer_charge_failed` + `notifyJakeFailure FAILURE_tax_final_retainer_charge`. Unlike the implementation twin the bell text is conditional on `checkout_token`, because the client's **existing `/tax-pay` link self-serves the retry** — `stripe-checkout.ts` resolves kind `final_retainer` once the status is `declined`.

`payment_kind === 'final_retainer'` also joined the `isOffSession` test at the top of this branch, so a late final-retainer failure cannot fall through to `resolveStripeFirstPaymentFailure`.

The rule keys deliberately reuse the synchronous sweep paths'. See [SESSION_REFERENCE.md](../SESSION_REFERENCE.md) "Failure-event handling" for the full failure-event roster.

---

## Tables touched (across all branches)

- **Read:** `pipeline_map1`, `pipeline_sandbox_config`, `gc_balances`, `client_tax_plans`.
- **Written:** `pipeline_map1` (status/method/dates), `gc_balances` (insert/update), `gc_transactions` (insert), `client_tax_plans` (retainer / implementation / **final-retainer** status, method, dates, card fee), `notifications` (the failure bells).

> This list has always been MAP1-centric and is still not exhaustive — the tax, advisor, accountant, PIP and specialist branches all write their own pipeline tables. Derive from `router/webhooks.ts`, not from here.

## Downstream chains

| Branch | Chains |
|---|---|
| A1 (GC) | none |
| A2 (MAP1 card) | `automation_CONTRACT_confirmationemail` (side effects only — **no client email**, status `'Skipped - Card (Receipt Only)'`) + `automation_CONTRACT_invoicereceipt` + `automation_CONTRACT_revshare` (payment 1) |
| A2 (MAP1 ACH) | `automation_CONTRACT_confirmationemail` only (client confirmation email **is** drafted) |
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
