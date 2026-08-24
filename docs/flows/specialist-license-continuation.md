# Specialist License Fee Continuation flow

Moves an **existing, already-live specialist** — one paying the $99/mo license fee on the legacy system — onto a portal-native **ACH-only $99/mo Stripe subscription** charged on an admin-chosen day of the month. It is NOT onboarding: the specialist is already in the directory, already has an `experts` row, and never touches Stages 1–5.

> **2026-08-24 (v780 / v781, branch `claude/vfo-session-setup-dbeb30`):** built by re-pointing the never-used **License Fee Continuation** engine (shipped 2026-06-30, zero live runs) at the **SpecRev recurring ACH setup** pattern. Backend deployed; **frontend deploy still owed** — until it lands, production `/specialist-pay` renders the OLD page (with card options) on a continuation link, so **no real sends before the FE deploy**.

- **Pipeline label:** `SPECIALIST_LICENSE_CONTINUATION` — used by `email_templates.pipeline` for the three continuation templates ONLY. Stripe metadata, `notifications.pipeline` and `pipeline_sandbox_config` still read **`SPECIALIST_ONBOARDING`**, because the money and bell chains are the onboarding licence engine's. *(Two pipeline labels in one flow is deliberate; see "Traps" below.)*
- **State table:** `specialist_onboarding` rows with **`license_continuation = true`** — a minimal row (no stage tracker, no votes, no meetings), `current_stage=4`, `status='active'`, plus the `lic_*` columns and the new **`lic_charge_day`** (integer 1–15, migration `20260824210000_specialist_license_continuation_charge_day.sql`). See [tables/specialists.md](../tables/specialists.md).
- **Entry point:** AdminPortal → **Accounting → VFO Specialist License Fees** → the **"Setup Monthly License Fees"** button. *(Before 2026-08-24 this lived as a "License Fee Continuation" subtab on the specialist Profile; that subtab and `SpecialistLicenseContinuationTab.jsx` were DELETED — the Accounting button replaces it.)*
- **Gate:** both actions are **AUTH + `TAB_ACTIONS.accounting`**, with the in-handler superadmin checks REMOVED — full parity with `specialist_revenue_recurring_create` (the 2026-08-07 / #338 decision). The accounting grant is the whole boundary.
- **Emails are Gmail DRAFTS** — all three templates are `send_mode=false`.

## The two actions

| Action | File | Auth | Does |
|---|---|---|---|
| `specialist_license_continuation_load` | `actions/specialist-license/continuation-load.ts` | AUTH + `TAB_ACTIONS.accounting` | Current license state for one expert: link/subscription stamps, `charge_day`, and a computed **`already_active`** — true when ANY non-canceled subscription exists on ANY of the expert's onboarding rows. That is the exact condition `_start` 409s on, so the form can warn before the click. |
| `specialist_license_continuation_start` | `actions/specialist-license/continuation-start.ts` | AUTH + `TAB_ACTIONS.accounting` | Requires `expert_id` + **`charge_day` (integer 1–15, else 400)**. Find-or-create the continuation row, stamp `lic_charge_day` on **both** insert and reuse, ensure the Stripe customer + `lic_checkout_token`, draft `SPECIALIST_lic_continuation_request`. Re-runnable = Resend. |

**Two guards inside `_start` that are easy to get wrong:**

1. **Double-enroll (409).** It scans **every** `specialist_onboarding` row for the expert (not just the latest) for a non-canceled `lic_subscription_id`. Under a deferred anchor a subscription exists with **no payment yet**, so `lic_payment_status` cannot be the test — any recorded subscription blocks, except one the webhook marked `canceled`. The "not canceled" test is done **in JS, not PostgREST**: `.neq("lic_payment_status","canceled")` drops NULL statuses, which is exactly the deferred row you must catch.
2. **Row reuse is restricted to `license_continuation = true` rows.** A real onboarding row is never borrowed. `lic_charge_day`, the ACH-only checkout branch, the Tracy/stage-advance guards and the sweep's tier 7b all key on that flag, so continuation billing only ever rides a row that carries it.

## The public payment page

`/specialist-pay?token=<lic_checkout_token>&kind=license` — the same page and the same two handlers as onboarding, branching on `license_continuation`:

- **`license-load-payment.ts`** — a continuation row's response gains `continuation`, `ach_only`, `charge_day`, `charge_day_ordinal` and `first_charge_note`, plus a guard that refuses a link whose subscription is already set. **The onboarding response is byte-identical** — extra keys on the continuation branch only.
- **`SpecialistPayPage.jsx`** — a continuation link renders **ACH only** (the card block is not rendered at all), shows the charge-day copy, and its security note is worded to NOT claim "nothing is charged", because the catch-up shape does collect at setup. Onboarding rendering is unchanged.

## The two first-charge shapes (`license-checkout.ts` → `continuationCheckout()`)

Card is refused with a 400. Amount is a flat **9900** (no gross-up — ACH has no fee to gross up). The memo is `VFO Specialist - <Name> - Monthly license fee`. The shape is decided **at session-creation time** from `lic_charge_day` vs now:

| | **DEFERRED** — this month's charge day is still ≥2h away | **CATCH-UP** — this month's charge day has gone by |
|---|---|---|
| Line items | one recurring $99 | recurring $99 **+ a one-time $99** "First month license fee (charged today)" |
| Subscription param | `subscription_data[billing_cycle_anchor]` = this month's occurrence, `proration_behavior=none` | `subscription_data[trial_end]` = **next** month's occurrence |
| Charged at checkout | **nothing** — mandate only | **$99**, the current month |
| Recurring starts | that anchor date | next month's charge day |
| `metadata.first_charge` | `deferred` | `catch_up` |

**Why `trial_end` and not a second anchor on the catch-up branch.** With a future `billing_cycle_anchor` and proration off, a one-time line item is **held and invoiced at the anchor** — a month late. Under a trial, Checkout invoices one-time line items **immediately at completion** and the recurring $99 starts at `trial_end`. This is the "setup fee + trial" construct; the cost is that Stripe's hosted page shows its own trial/free wording, which cannot be removed (mitigated with `custom_text[submit][message]`, accepted by the user). See **#435**.

**Why the catch-up branch exists at all** — user requirement: the month of setup always gets charged, so a missed charge day never silently skips a month.

**Date bounding** (identical to the SpecRev recurring setup): Stripe needs the target still in the future at Checkout *completion*, and an anchor may not exceed creation + 1 month. Preferred time is 17:00 UTC (1pm ET); if next month's 17:00 overshoots the limit by hours, step down to 04:05 UTC, then 00:05 UTC, then hard-clamp. The session carries `expires_at` = now + 1h so the 2h buffer always holds.

**Deliberately NOT set:** `payment_method_options[us_bank_account][verification_method]=instant`. This mirrors the SpecRev recurring setup (**#298**) — a subscription can go active on an unverified bank and the failure surfaces at charge day.

## Webhook (`router/webhooks.ts`)

Routing is unchanged — the licence chain is keyed on `lic_stripe_customer_id`. Three continuation-aware changes:

1. **`checkout.session.completed`, licence block.** A **deferred** continuation setup records **`lic_payment_status='scheduled'`** and the progress `task_key='payment_setup'` — *not* `processing`/`payment_made`, because nothing was charged. Classification reads **`metadata.first_charge` first**; Stripe's `payment_status='no_payment_required'` is only a fallback for a session minted before that stamp existed. Catch-up keeps `processing`. The chain body to `licconfirmation` carries `first_charge` + `next_charge_at`.
2. **`processSpecialistLicenseInvoicePaid`.** `license_continuation` joined the select, and the **Stage 4→5 advance is gated `!license_continuation`** — a continuation row is an already-live specialist and must never walk the onboarding stages.
3. **NEW: the $0-invoice guard at the top of that processor** (`amount_due`/`total` must be > 0), mirroring the SpecRev guard. This **restores #198**, which `07-server-chains.md` had documented as required for two months while the licence processor had no such code — a pre-existing latent bug affecting **onboarding too**: a $0 `subscription_create` stub would have claimed the invoice id and minted a false $99 receipt + ledger row. The invoice object is threaded through all three call sites; no new fetches. See **#436**.

## Emails

All three are `pipeline = 'SPECIALIST_LICENSE_CONTINUATION'`, `send_mode = false` (draft), recipients `to` SPECIALIST / `cc` Tracy / `bcc` Anton + Paul.

| id | template | Sent by | Tokens |
|---|---|---|---|
| 171 | `SPECIALIST_lic_continuation_request` | `continuation-start.ts` (**REWRITTEN 2026-08-24** with user-approved copy; subject *"Set up your monthly VFO Specialist License payment — VFO Services"*) | `[First Name]`, `[Charge Day]`, `[PAYMENT_LINK]` |
| 231 | `SPECIALIST_lic_continuation_confirmation` | `license-confirmation-email.ts`, continuation rows only | `[FIRST_PAYMENT_SENTENCE]` — rendered dynamically for deferred vs catch-up |
| 232 | `SPECIALIST_lic_continuation_reminder` | sweep tier 7b | `[FIRST_NAME]`, `[SPECIALIST_NAME]`, `[CHARGE_DAY]` (ordinal), `[BUTTONS]` |

`license-confirmation-email.ts` **tolerates a missing template without stamping**, so a send skipped for a missing row fires once the row exists.

## Sweep tier 7b (`onboarding/sweep.ts`, cron `specialist-sweep-daily` 07:00 UTC)

A new tier beside tier 7, running on exactly the rows tier 7 excludes. **Tier 7 is unchanged.**

- **2 business days** after `lic_payment_link_sent_at` → drafts `SPECIALIST_lic_continuation_reminder` (with the pay button + the ordinal charge day). **4 business days** → the Tracy bell *"<Name> hasn't moved their license fee onto the portal"*.
- **Reuses tier 7's rule keys** `SPECIALIST_stall_licpayment_email` / `_bell` — **no new `notification_rules` rows** — and tier 7's guard columns `lic_payment_reminder_sent_at` / `lic_payment_pf_notified_at` / `lic_payment_pf_ack_at`.
- **"Done" is `lic_subscription_id IS NOT NULL`, not a payment.** A deferred setup completes with no money moved, so a payment-based predicate would chase a specialist who already finished.
- The reminder **stamps only on a successful draft**; a missing template logs and skips without stamping. `sendReminder()` gained an optional `pipeline` argument for this (it defaults to `SPECIALIST_ONBOARDING`, so every other tier is untouched).

## The two Tracy first-invoice bells

`license-invoice-receipt.ts` gates the two first-invoice action bells — *Send invite to VFO Skool* and *Create the VFO Specialist* — on **`&& !ob.license_continuation`**. Both are go-live tasks for a NEW specialist; a continuation specialist is already live, so the bells must not fire. Verified DB-side on the live catch-up test: zero bells.

## Accounting UI

The License area now renders through the **same `AccountingCombinedPanel` wrapper SpecRev uses**, with three pills:

| Pill | Component | Notes |
|---|---|---|
| **VFO Specialist License Fees** | `SpecialistLicensePanel.jsx` | The "Setup Monthly License Fees" gradient toggle + inline `LicenseSetupForm` (expert picker from AdminPortal's `allExperts`, 1st–15th ordinal charge-day select, fixed *$99.00 · ACH* display). Monthly table columns **SPECIALIST · DATE · AMOUNT · STATUS**, chip flush right, one money column, *"Payment received"* chip only. The amber already-enrolled note keys on the loader's `already_active`, with an `/already/i` message match as fallback (`callApi` discards the HTTP status, so the 409 is invisible to the FE). |
| **License Reconciliation** | **NEW** `SpecialistLicenseReconciliationPanel.jsx` | Client-side all-time per-specialist aggregate: payment count, total collected, most recent. **No year filter by design** (a licence is a flat monthly fee, not an engagement) and **no member-# column** — `expert_id` is a raw DB id, not a member number. |
| **Outstanding Payment Links** | **NEW** `SpecialistLicenseOutstandingPanel.jsx` | Reuses `OutstandingLinksPanel`'s exported internals. `LicenseLinkCard` reads *"Link sent &lt;date&gt; · charge day &lt;ordinal&gt;"*, $99.00 per month, expandable detail incl. payment method. **Read-only — no resend button.** |

Fed by **`specialist_license_payments_load`**, whose response gained a **`pending[]`** array: continuation rows with a link sent that are not succeeded/canceled, each with a `state` of `setup_pending` / `scheduled` / `processing` / `failed`. **Unknown values (e.g. `past_due`) pass through raw** rather than being coerced. The existing cleared-payments shape is unchanged.

State chips: **Setup pending** `#0095ff` · **Awaiting first payment** `#0095ff` · **Payment processing** `#e06717` · **Past due** `#ef4444` · **Payment failed** `#ef4444`.

## Traps

- **`scheduled` is a NEW value in the `lic_payment_status` vocabulary** (subscription exists, zero money moved). The column is bare `text` with no CHECK, so nothing announces where the enumerations are — every reader that enumerates it must handle it. See **#437** (and the #431/#433 family).
- **Two pipeline labels in one flow.** Templates are `SPECIALIST_LICENSE_CONTINUATION`; Stripe metadata, bells and the sandbox toggle stay `SPECIALIST_ONBOARDING`. Look up a continuation *email* under the former and everything else under the latter — a `(pipeline, template_name)` mismatch here looks exactly like a deliberately-Draft row (**#356**).
- **Rollout is not code.** Tracy must cancel each specialist's **legacy** license billing from their first portal month, or they pay twice (the #361 exposure). Out of scope for the handlers; there is no automated check.

## Cross-references

- Onboarding licence engine this reuses: [specialist-onboarding.md](specialist-onboarding.md) (Stage 4 sign/pay/recurring-license)
- Chains + webhook + sweep table: [../architecture/07-server-chains.md](../architecture/07-server-chains.md)
- Columns: [../tables/specialists.md](../tables/specialists.md) · Actions: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
