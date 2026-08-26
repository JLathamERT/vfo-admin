# Tax fee process — the revised (2026-08-25) pricing, amendment and 3-payment flow

> **Scope.** This doc covers how a tax engagement's FEE is set, split, collected and amended. The surrounding pipeline — meetings, the agreement send, the specialist phases, the bells — is [flows/tax-planning.md](tax-planning.md), and every step reference below points there. Read this one whenever you touch an amount.
>
> **The switch is `client_tax_plans.fee_process_version`.** `NULL` = the legacy process. **Nothing about a legacy plan ever changes**, no revised-process validation applies to it, and both amend steps read as not-applicable on it. `'2026-08-25'` = the revised process described here. New versions get ADDED to `KNOWN_FEE_PROCESS_VERSIONS` in `constants/tax-fee-process.ts`, never substituted for this one.
>
> Shipped 2026-08-25 (`vfo-admin-api` v782 → v787). Gotchas **#438**–**#443**.

---

## The one-input rule

Under the legacy process an admin typed the retainer and the implementation fee separately, and the total was whatever they happened to sum to. Under the revised process there is **ONE input — the total fee** — and every payable amount is derived from it **server-side**, in `deriveFeeSplit()`:

| Total fee | Shape | Retainer | Implementation |
|---|---|---|---|
| `0 < total ≤ $30,000` | **2 payments** | `total / 2` | `total / 2` |
| `$30,000 < total ≤ $60,000` | **3 payments** | `total / 2`, collected as **initial `$15,000` flat** + **final `total/2 − 15000`** | `total / 2` |

- **`$60,000` is a hard cap** and `total` must be `> 0`. Enforced in `deriveFeeSplit()`, in `automation_TAX_amend_fee`, and separately on the assess form's *"VFO Services Tax Planning Fee"* field (frontend **and** backend, in lockstep — #306).
- **Arithmetic runs in whole cents.** `retainer = round(total/2)`, `implementation = total − retainer`, so `retainer + implementation === total` and `initial + final === retainer` to the cent, always.
- **`retainer_amount` stays the FULL 50% retainer in both shapes.** The 3-payment shape changes only *how* that retainer is collected. This is what lets every pre-existing invoice, receipt and revenue-share calculation keep working untouched — and it is why **any new code that reads `retainer_amount` as "one payment that moved" is wrong on a 3-payment plan** (#440).
- The form may not send amounts. `parseFeeTotal()` refuses a request carrying `retainerPayment` / `implementationFee` instead of `totalFee`, with a message naming the mistake.

## Where the version is stamped

`buildFeeColumns()` writes `fee_process_version = '2026-08-25'` **only when `retainer_status IS NULL`** — i.e. only while no retainer money has landed. A plan that already holds retainer money can never change process, in either direction. The stamp happens at the "client is going ahead" writes: the **Tax 3 decision** ([tax-planning.md Step 2](tax-planning.md)), the **deferred pricing** path (Step 3b) and the **extra-meeting** path (Step 3c).

A row carrying fee data with no version stamp is a legacy row (`isLegacyFeeRow()`), and `buildFeeColumns()` reproduces the exact pre-2026-08-25 write for it.

## Columns

All on `client_tax_plans`, all nullable, added by migration `20260825120000_tax_fee_process_v2026_08_25.sql`. Full notes in [tables/tax.md](../tables/tax.md).

| Group | Columns |
|---|---|
| Process switch | `fee_process_version`, `projected_total_fee` (the total quoted at an *Undecided* decision — **not a payable amount**) |
| The split | `initial_retainer_amount`, `final_retainer_amount` |
| Final-retainer money | `final_retainer_status`, `final_retainer_payment_intent_id`, `final_retainer_charge_date`, `final_retainer_confirmation_status` |
| Final-retainer documents | `final_retainer_receipt_number`, `final_retainer_receipt_drive_id`, `final_retainer_receipt_status`, `final_retainer_receipt_email_sent_at`, `final_retainer_invoice_number`, `final_retainer_invoice_drive_id` |
| Re-issued implementation invoice | `implementation_invoice_number`, `implementation_invoice_drive_id` |
| Amendment stamps | `fee_amended_at_tax4`, `fee_amended_at_tax5` |

New audit table **`client_tax_fee_amendments`** (RLS + deny-all policy in the same migration, #141). One row per amendment. **Audit only** — `client_tax_plans` carries the live amounts and nothing reads this table to make a money decision.

## The predicate — read this before writing any 3-payment branch

```ts
isThreePaymentPlan(plan) === isNewFeeProcess(plan) && plan.final_retainer_amount != null
```

**Keyed on FINAL, never on initial.** A Tax 4 amendment to `≤ $30,000` converts a 3-payment plan back to 2 payments by **nulling `final_retainer_amount` while KEEPING `initial_retainer_amount`** — the kept value is both the record that $15,000 was collected as an initial retainer and the marker that lets a later above-threshold amendment convert *back*. Both columns are written together at pricing, so on every non-converted row the two tests are identical and a predicate keyed on `initial` passes all normal testing and then misclassifies exactly the converted plans. See **#440**.

The predicate exists in **three** places that must move in lockstep: `constants/tax-fee-process.ts` and both frontend mirrors (`taxShared.jsx`, `TaxPrioritiesTab.jsx`). Same cross-repo coupling class as the step machine (#339).

---

## The money chain

### 3-payment plan

```
Tax 3 decision (total > $30k)      -> fee_process_version stamped, initial + final written
Agreement (row 23 / 24, 4 pages)   -> client signs; client_signed_at stamped
Initial retainer  $15,000          -> /tax-pay -> checkout.session.completed
                                      card fee derived from initial_retainer_amount (NOT retainer_amount)
                                      invoice (3 lines) + receipt, "initial retainer" wording
[ Tax 4 - "Amend fee" step ]       -> optional; re-prices before Client decision 1 goes out
Client decision 1 email            -> |3pay template variants, [FINAL_RETAINER] + [AMENDMENT_PARAGRAPH]
Client clicks the GREEN button     -> confirmation email drafted
                                   -> automation_TAX_charge_final_retainer  (off-session, saved method)
payment_intent.succeeded
  payment_kind = final_retainer    -> automation_TAX_final_retainer_receipt (+ fresh invoice if amended at Tax 4)
                                   -> automation_TAX_revshare payment_kind=retainer  <- ON THE FULL RETAINER
                                   -> "Complete Client decision 2" bell
[ Tax 5b - "Amend implementation fee" step ]
Client decision 2 email            -> [AMENDMENT_PARAGRAPH] (Tax 5 amendments only)
Client clicks Proceed              -> automation_TAX_charge_implementation (unchanged, #398)
```

### 2-payment plan

Identical to the legacy chain: the retainer is fully collected at the retainer step, so the client's green click on Client decision 1 releases the retainer revenue share **immediately**, exactly as before. The revised process adds only the derived amounts, the `[RETAINER_LABEL]` wording (which resolves to plain *"retainer"* here), the two amend steps and the new `TAX_postreview_confirmed` confirmation email.

### The deferred retainer revenue share — the load-bearing part

On a 3-payment plan the retainer is only **half** collected at the green click, so the retainer revshare is **deferred** to the webhook that confirms the final retainer. It then fires **once, on the FULL `retainer_amount`** (initial + final) with `payment_kind='retainer'`, and `actions/tax/revshare.ts` needed **no change** — it already takes its payment amount from `retainer_amount`.

**What holds it until then is one gate, and it is not the obvious one.** The sweep's *candidate* precondition is `retainer_receipt_number`, and that is stamped at the **INITIAL** payment — so the sweep sees the plan as a candidate the entire time it is waiting. The only thing preventing an early partial payout is that the legs stay **NULL** and the sweep is retry-only (it acts on `"Pending"`, not on NULL). **Never pre-stamp those legs.** See **#441** and **#377**.

### Idempotency and races

- The client's green click writes `post_review_client_decision` **conditionally** (`.is(..., null)`) and counts the affected rows. A double-tap or an email client pre-fetching the link both pass the read-time check; only the request that actually TRANSITIONS the row drafts the confirmation email and starts the charge. The loser returns `{ ok: true, existing_decision, message: "Decision already recorded" }`.
- The webhook's final-retainer block is latched on **`final_retainer_confirmation_status IS NULL`**. Stripe redelivers any webhook whose 200 it did not get in time and the router has **no event-id dedupe** (#327), so a receipt PDF, a Gmail draft and a **real Connect transfer** all hang off that single latch.
- `automation_TAX_charge_final_retainer` has **exactly ONE call site** — the client's own green click — mirroring the implementation charge's rule (#398). **Nothing may ever chain it from a sweep.**
- The refund guard on `/tax-postreview-decide` is widened: a `processing` or `succeeded` final retainer refuses the Refund button with the same `window_expired` flag the rev-share guard uses, because the refund path only ever knew how to reverse the initial payment.

### ACH

The final retainer follows the implementation charge's ACH shape exactly: the off-session charge writes `processing`, and a **late bounce** arrives as `payment_intent.payment_failed` with `metadata.payment_kind='final_retainer'`. That branch marks the charge `declined`, fires `TAX_final_retainer_charge_failed` **and** `FAILURE_tax_final_retainer_charge`, and points at the client's existing `/tax-pay` link, which `stripe-checkout.ts` now resolves to the final retainer when the status is declined. `payment_kind='final_retainer'` also joined the `isOffSession` test so a late failure does not fall through to the first-payment resolver.

A final retainer paid through a **fresh `/tax-pay` link** is booked in `checkout.session.completed` off `session.metadata.payment_kind` (card → `succeeded` + chain the receipt; ACH → `processing`, chains nothing, settled later by `payment_intent.succeeded`). That block deliberately does **not** set `final_retainer_confirmation_status` — the `payment_intent.succeeded` branch owns the latch.

### Cancelling the remaining tax payments *(2026-08-26, v789 — CODE-ONLY)*

The superadmin **"Cancel all remaining payments"** button on the admin client Payments tab closes the tax side too: `payments_cancel_remaining` writes the literal **`'cancelled'`** onto `final_retainer_status` and/or `implementation_charge_status`, plus the audit stamps `final_retainer_cancelled_at` / `implementation_cancelled_at`. No Stripe call, no email, no bell, and **no rev-share column is touched** — an uncollected payment has no payout leg to settle (#377). Mechanism, allowlist and the MAP 1 half: [contract-and-payment.md](contract-and-payment.md) Step 10¾.

**Which two slots, and why exactly those.** The handler re-evaluates `normalize.ts buildTaxRows`' own predicates rather than assuming them, so **what the tab shows is what the button closes**: the **final retainer** only when `retainer_status` is set AND `isThreePaymentPlan(plan)` — the SAME shared predicate imported from `constants/tax-fee-process.ts`, never re-derived, so the two can never drift (**#440**) — and the **implementation** either when it already carries a charge status or when it renders as the *"Awaiting client decision"* row (`retainer_status` set, `implementation_amount > 0`, no succeeded refund). A NULL final retainer on a 2-payment or legacy plan displays nothing and is not cancelled; nor is an implementation on a refunded plan. **The initial retainer is never cancellable** — it is the engagement's opening payment, the same reasoning that excludes MAP 1's pay 1. Note also that `client_tax_plans` has **no `updated_at` column** (unlike `pipeline_map1`): adding one to that update 400s the whole write.

**What refuses afterwards.** `automation_TAX_charge_final_retainer` and `automation_TAX_charge_implementation` each return **400 BEFORE any Stripe call** (*"…was cancelled by VFO — it can no longer be charged"*, `cancelled: true`) — an error, not a silent ok, because a caller that got that far believes a charge is due. The implementation guard sits deliberately ahead of that handler's fresh-`/tax-pay`-link fallback, which would otherwise email the client a link to pay money we have written off. On the public page, `load-payment.ts` and `stripe-checkout.ts` carry the **same branch in the same position** — before either recovery branch decides a kind — so a client holding an old failure-recovery link gets an honest *"This payment was cancelled by VFO — nothing further is due"* instead of the generic *"Payment already completed"*, and on a plan where the **other** leg is still in a failure state the old link cannot quietly bill that leg instead. **Those two files must agree on what a token means or the page and the checkout diverge.** `card-update-shared.ts` also drops the plan from the card-update list, and the Payments tab shows a red **Cancelled** chip with `hasCharge=false` on the implementation rev-share preview (the split figures stay as the quoted preview they always were).

**⚠️ None of this has been exercised live.** The 2026-08-26 testing covered the MAP 1 side only — **both tax cancels, every refusal branch and the `/tax-pay` closed state are code-only.**

---

## The two amend steps

Two admin-only steps, both driven by `automation_TAX_amend_fee` (AUTH, in `ADMIN_ONLY_ACTIONS`, deliberately **absent from `TAX_PLANNER_ALLOWED_ACTIONS`** — re-pricing a signed engagement moves the final retainer, the implementation charge and every revenue-share leg, so a planner caller 403s).

| Step | `program_client_tasks.name` | `status_options` | Position |
|---|---|---|---|
| Tax 4 | `Amend fee` | `tax_amend_fee` | between *Detailed tax plan presentation* and *Client decision 1* |
| Tax 5b | `Amend implementation fee` | `tax_amend_fee_tax5` | before *Implementation decision* |

The two names are **deliberately different**. A step row is resolved by NAME, so one shared name would make the Tax 5 gate pass the moment the Tax 4 step was answered. The strings live once, in `constants/tax-fee-process.ts` (`AMEND_FEE_TASK_NAME`, `AMEND_IMPLEMENTATION_FEE_TASK_NAME`); changing either silently disarms a gate.

**Two request shapes.** `{ tax_plan_id, stage, keep: true }` writes **nothing** and short-circuits **before** the state guards — the step must stay answerable even on a plan where an actual change would now be refused. `{ tax_plan_id, stage, new_total }` re-derives everything.

**What cannot be amended:**

- **Tax 4** needs the initial retainer `succeeded` and Client decision 1 **not yet sent** (that email quotes the amended figures to the client). A `processing`/`succeeded` final retainer freezes it.
- **Tax 5** needs Client decision 2 **not yet recorded**, and on a 3-payment plan the **final** retainer settled — at Tax 5 the whole retainer side is closed, so only the implementation fee may still move. A `processing`/`succeeded` implementation charge freezes it.
- A legacy plan 400s outright.

**How the movement lands.** With the retainer side settled, the whole change goes onto the implementation fee. The one exception is a Tax 4 amendment on a plan whose initial retainer was collected, where the 50:50 split is re-held against the new total and the already-paid initial is subtracted out of the retainer half. `retainer_amount` is rewritten alongside `final_retainer_amount` — leaving it stale would pay the member/planner/partner legs on the pre-amendment retainer.

**Revenue-share re-scaling.** Every leg is a **dollar amount of the total engagement** (#252), so all of them scale by `new_total / old_total`, rounded to the cent, with the **residual absorbed by `vfos_share`** (VFO Services is the residual party, #394). It deliberately does **not** force the sum to the new total when the old legs did not already sum to the old total — otherwise an amendment would invent money onto the VFOS leg of a partially-priced plan. Nothing scales when the old total is zero/unknown or no leg carries a value. `strategic_partner_share` is a text column and is written back as text.

**The step reads done from EITHER of two sources** — its own `client_tax_progress` row, or the `fee_amended_at_*` stamp. The stamp is kept as an independent proof so a lost `save-task` after a *successful* amendment does not leave the step reading outstanding while the money has already moved. The frontend's `isTaskStatused` uses the same two-source rule (#339).

**The UI confirms before committing.** The house convention is that a step dropdown completes on select; here that would finalise a price on a stray click, so "keep the fee as it is" confirms first, and the answer stays editable until the downstream decision is recorded. See **#442**.

### Conversion, and why it is reversible

A Tax 4 amendment to `≤ $30,000` **converts a 3-payment plan to 2 payments**: `final_retainer_amount` is nulled, `initial_retainer_amount` is kept, the $15,000 already paid becomes the whole retainer and the reduction lands entirely on the implementation fee. Every surface flips to the 2-payment shape at once, because they all read `isThreePaymentPlan`. A later amendment back **above** $30,000 converts it back. Both directions stay available until Client decision 1 goes out.

Guards: a conversion refuses a total at or below the initial retainer already paid; a stay-3-payment amendment refuses anything that would leave a final retainer of `$0.00` or less.

The audit row records `new_final_retainer` as **null** on a conversion (the final retainer ceased to exist), and carries the old value forward only on the branches that never touch the column.

---

## Documents

**Agreements.** `agreement_templates` rows **8** and **20** gained the addendum paragraph; **NEW rows 23 (`Client Paying - 3 Payments`) and 24 (`Member Paying - 3 Payments`)** split the retainer line into `[INITIAL_RETAINER]` and `[FINAL_RETAINER]` lines. The addendum grows the document to 4 pages, so **all four rows' `field_map` signature fields moved from page 3 to page 4** — a body edit and its page fix are one statement, never two. Coordinates were sourced by placing fields visually in BoldSign and reading them back via the throwaway `boldsign-template-fields` edge function. See **#439** and [integrations/boldsign.md](../integrations/boldsign.md).

Four static review PDFs live in the public `tax-agreements` bucket: `tax-planning.pdf`, `tax-planning-member.pdf`, and the new `tax-planning-3pay.pdf` / `tax-planning-member-3pay.pdf`. The **Undecided quote email attaches the `-3pay` PDF on a quote above $30,000**, with a fallback chain to the 2-payment PDF.

**`client_signed_at` now has writers.** `actions/tax/ceo-countersign.ts` (the client signature is what triggers that chain) and `actions/tax/stripe-customer.ts` as the belt for a BoldSign `Completed` that skipped the intermediate event. Both stamp once only, behind `.is("client_signed_at", null)`, because the amendment paragraphs quote that date back to the client. **`boldsign-webhook` is UNTOUCHED (still v40)** — which is why this needed no approval and why #384 stays parked for `ceo_signed_at` and the whole MAP 1 side.

**Invoices and receipts.** The invoice renderer was extracted to `utils/tax-invoice-html.ts` and is now shared. A 3-payment plan's invoice carries three lines. A **fresh invoice** is issued when an amendment is not yet reflected on any invoice:

- at the **final retainer**, when `fee_amended_at_tax4` is set;
- at the **implementation payment**, when `fee_amended_at_tax5` is set **OR** (`fee_amended_at_tax4` is set **AND** `final_retainer_invoice_number` is null — i.e. the final-retainer step never issued one).

**Deliberate non-behaviour:** declining implementation after a Tax 4 amendment issues **no** corrected invoice. Declining ends the engagement with only the retainer collected, so the amended schedule will never be billed and an invoice for payments that will not happen would document a fiction. Commented at the code site in `implement-final-decision.ts`.

## Emails and tokens

Eleven new `email_templates` rows (**233–243**), all `send_mode=false`, plus token substitutions on existing rows. The system-wide `send_mode=true` count is unchanged at **eleven** (#325).

| Token | Substituted by | Resolves to |
|---|---|---|
| `[RETAINER_LABEL]` | `invoice-receipt`, `confirmation-email`, `payment-email`, `send-agreement`, `paidbycheck` | `"initial retainer"` on a 3-payment plan, `"retainer"` on every 2-payment and legacy plan. **16 rows.** |
| `[FINAL_RETAINER]` | `postreview-decision.ts` | the already-formatted amount **including the `$`** |
| `[AMENDMENT_PARAGRAPH]` | `postreview-decision.ts` (Tax 4), `implement-decision.ts` (Tax 5) | the sentence plus its own trailing `<br><br>`, or **the empty string**. Substituted **unconditionally on every shape, legacy included**, purely to prevent a token leak. The Tax 4 / Tax 5 split is deliberate: a Tax 4 amendment does not re-announce itself at Client decision 2. |
| `[LATER_PAYMENTS]` | `payment-email.ts` | *"the final retainer and the implementation fee"* (3-pay) / *"the implementation fee"* |
| `[ATTACHED_DOCS]` | `implementation-receipt.ts` | *"invoice and receipt"* when the amended fresh invoice rides along, else *"receipt"* |

**Deploy order is binding for all of them:** the handler substitution ships FIRST, then the template SQL. The reverse order prints a raw `[TOKEN]` into a client's email. Every money-bearing substitution uses a replacer **function**, never a replacement string — see **#438**.

New client-facing email on the green click: `TAX_postreview_confirmed` and `TAX_postreview_confirmed|3pay`, each with a member-paying twin. Drafted **before** the money chain so the client's inbox explains the pull that is about to happen, and wrapped so a missing template or a Gmail hiccup can never fail a decision the client has already made.

Two new `notification_rules`: `TAX_final_retainer_charge_failed` and `FAILURE_tax_final_retainer_charge`. Their list columns are **jsonb, not `text[]`** (#443).

## Display

- **Client Payments tab** — a 3-payment retainer renders as **two grouped rows** (*"Retainer payment 1 of 2"* / *"2 of 2"*) sharing a `subGroup`, drawn as one indented block with a tie bar. Same-day rows tie-break on the payment sequence so the initial always precedes the final. **The revenue-share preview sits on the FINAL row**, because that is where the transfers actually fire; the initial row shows no preview at all. Rows without a `subGroup` — everything else in the system — render exactly as before.
- **Accounting → Tax Planning revenue tab** pairs the two rows the same way, with the shares on the Final row.
- **Step machine** (`utils/tax-plan-steps.ts` + its FE mirrors) marks both amend steps `applicable: false` on a legacy plan, exactly like the steps a skipped ROI meeting removes — so a legacy plan's completeness, `next_action` and warnings are untouched.

## What this did NOT change

- **Legacy plans.** No column, no validation, no step, no email.
- **`boldsign-webhook`** — untouched, still v40.
- **`actions/tax/revshare.ts`** — the deferred call needed no handler change.
- **`automation_TAX_charge_implementation`** — the single-call-site rule (#398) is unchanged; the final retainer copies it rather than modifying it.

## Cross-references

[flows/tax-planning.md](tax-planning.md) · [flows/stripe-webhook.md](stripe-webhook.md) · [architecture/07-server-chains.md](../architecture/07-server-chains.md) · [architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md) · [tables/tax.md](../tables/tax.md) · [integrations/boldsign.md](../integrations/boldsign.md) · [NOTIFICATION_AUDIT.md](../NOTIFICATION_AUDIT.md) · gotchas **#438**–**#443**, plus **#252**, **#327**, **#339**, **#377**, **#394**, **#398**
