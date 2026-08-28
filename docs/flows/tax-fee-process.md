# Tax fee process — the revised (2026-08-25) pricing, amendment and 3-payment flow

> **Scope.** This doc covers how a tax engagement's FEE is set, split, collected and amended. The surrounding pipeline — meetings, the agreement send, the specialist phases, the bells — is [flows/tax-planning.md](tax-planning.md), and every step reference below points there. Read this one whenever you touch an amount.
>
> **The switch is `client_tax_plans.fee_process_version`.** `NULL` = the legacy process. **Nothing about a legacy plan ever changes**, no revised-process validation applies to it, and both amend steps read as not-applicable on it. `'2026-08-25'` = the revised process described here. New versions get ADDED to `KNOWN_FEE_PROCESS_VERSIONS` in `constants/tax-fee-process.ts`, never substituted for this one.
>
> Shipped 2026-08-25 (`vfo-admin-api` v782 → v787). Gotchas **#438**–**#443**. Extended 2026-08-26 — the custom initial retainer, the three-handler select fix (v791) and the per-payment card-fee columns (v792, code-only): gotchas **#448**–**#450**.

---

## The one-input rule

Under the legacy process an admin typed the retainer and the implementation fee separately, and the total was whatever they happened to sum to. Under the revised process there is **ONE input — the total fee** — and every payable amount is derived from it **server-side**, in `deriveFeeSplit()`:

| Total fee | Shape | Retainer | Implementation |
|---|---|---|---|
| `0 < total ≤ $30,000` | **2 payments** | `total / 2` | `total / 2` |
| `$30,000 < total ≤ $60,000` | **3 payments** | `total / 2`, collected as **initial `$15,000` flat** + **final `total/2 − 15000`** — the initial is overridable on an allowlisted client, see *The custom initial retainer* below | `total / 2` |

- **`$60,000` is a hard cap** and `total` must be `> 0`. Enforced in `deriveFeeSplit()`, in `automation_TAX_amend_fee`, and separately on the assess form's *"VFO Services Tax Planning Fee"* field (frontend **and** backend, in lockstep — #306).
- **Arithmetic runs in whole cents.** `retainer = round(total/2)`, `implementation = total − retainer`, so `retainer + implementation === total` and `initial + final === retainer` to the cent, always.
- **`retainer_amount` stays the FULL 50% retainer in both shapes.** The 3-payment shape changes only *how* that retainer is collected. This is what lets every pre-existing invoice, receipt and revenue-share calculation keep working untouched — and it is why **any new code that reads `retainer_amount` as "one payment that moved" is wrong on a 3-payment plan** (#440).
- **The `$15,000` initial is a DEFAULT, not a law.** One allowlisted client may quote a different initial retainer at the Tax 3 decision; only the initial/final boundary *inside* the retainer half moves. See the next section.
- The form may not send amounts. `parseFeeTotal()` refuses a request carrying `retainerPayment` / `implementationFee` instead of `totalFee`, with a message naming the mistake.

## The custom initial retainer

`CUSTOM_SPLIT_CLIENT_IDS: number[] = [105, 62]` in `constants/tax-fee-process.ts` is a list of **`clients.id`** values allowed to override the initial retainer. **105 is Chris Colby (59481-002)** — the real client this exists for. **62 is the standing sandbox-forced Test Client** (member 59524, #251), kept on the list so the path stays click-testable.

**It moves exactly ONE boundary.** The 50:50 retainer/implementation split of the total is **unaffected** — `total_fee`, `retainer_amount` and `implementation_amount` come out identical to what the flat schedule would have written. Only where the retainer half is cut into initial and final moves.

- `deriveFeeSplit(total, customInitial?)` takes the override in **DOLLARS** as a second argument, replacing `INITIAL_RETAINER_FLAT`. It **throws** unless the total is a 3-payment total (`CUSTOM_INITIAL_NOT_THREE_PAYMENT_MESSAGE`) and unless `0 < customInitial < retainerHalf` (`CUSTOM_INITIAL_RANGE_MESSAGE`). A non-numeric value is **REFUSED, never silently dropped back to the flat amount**. Omitted/undefined — the only shape every pre-existing caller sends — is byte-identical to the previous behaviour.
- `parseFeeTotal(fd, opts?: FeeParseOptions)` reads `fd.customInitialRetainer` and returns `{ error: CUSTOM_INITIAL_NOT_ALLOWED_MESSAGE }` — *"Custom split is not enabled for this client"* — unless `opts.allowCustomInitial` is true. `buildFeeColumns(plan, fd, opts?)` passes the options straight through.
- **`actions/tax/decision.ts` (Tax 3, decision `Yes`) is the ONLY caller that passes the opt-in**, computed as `CUSTOM_SPLIT_CLIENT_IDS.includes(plan.client_id)`. `actions/tax/pricing.ts`, `actions/tax/extra-meeting.ts` and the **Undecided** branch of `decision.ts` deliberately pass **no** opts, so a `customInitialRetainer` reaching any of them is refused by the default. **The Undecided quote therefore still quotes the flat `$15,000`** — deliberate, and unchanged.
- **Frontend mirror** in `src/components/admin/tax/TaxPrioritiesTab.jsx`: same constant, same validation, returning `null` where the server throws (that file's invalid convention). The **"Allow custom split"** pill renders only when the client is allowlisted **AND** the typed total is already 3-payment, and the `customInitialRetainer` payload key is **absent** unless the toggle is on and the value valid. The two lists must move in lockstep — the same cross-repo coupling class as the predicate (#339). **This is unrelated to `splitType === 'Custom'` in the same form**, which is the REVENUE split between member / tax planner / VFOS. The two "custom"s live in the same form and mean entirely different things.

**Nothing downstream needed changing, and that is the point worth keeping.** The agreement, the invoices, the receipts, the card-fee maths, the Payments tab, the Accounting tab and **both** amend steps all read the STORED `initial_retainer_amount` / `final_retainer_amount` columns rather than re-deriving from the flat constant. `actions/tax/amend-fee.ts` in particular reads the ROW's `initial_retainer_amount` in every arm, so a custom initial survives a Tax 4 amendment, the `≤ $30,000` conversion, the conversion back and Tax 5 — and the *"Total must be more than …"* floor is **`2 ×` the row's initial**, which for Chris is **$16,663.00** rather than the usual $30,000. `isThreePaymentPlan` is untouched: it keys on `final_retainer_amount`, which a custom initial never affects.

**Verified live end to end** on Test Client 62 with a $46,038 total and a custom initial of $8,331.50 → final $14,687.50 / implementation $23,019: the agreement rendered all three figures, the initial was paid by card with the fee derived from $8,331.50, both amend directions, the `≤ $30,000` conversion and back, and Client decision 1 through to **both** revenue-share transfers completing on the FULL retainer.

## Where the version is stamped

`buildFeeColumns()` writes `fee_process_version = '2026-08-25'` **only when `retainer_status IS NULL`** — i.e. only while no retainer money has landed. A plan that already holds retainer money can never change process, in either direction. The stamp happens at the "client is going ahead" writes: the **Tax 3 decision** ([tax-planning.md Step 2](tax-planning.md)), the **deferred pricing** path (Step 3b) and the **extra-meeting** path (Step 3c).

A row carrying fee data with no version stamp is a legacy row (`isLegacyFeeRow()`), and `buildFeeColumns()` reproduces the exact pre-2026-08-25 write for it.

## Columns

All on `client_tax_plans`, all nullable, added by migration `20260825120000_tax_fee_process_v2026_08_25.sql` except the last group, which names its own. Full notes in [tables/tax.md](../tables/tax.md).

| Group | Columns |
|---|---|
| Process switch | `fee_process_version`, `projected_total_fee` (the total quoted at an *Undecided* decision — **not a payable amount**) |
| The split | `initial_retainer_amount`, `final_retainer_amount` |
| Final-retainer money | `final_retainer_status`, `final_retainer_payment_intent_id`, `final_retainer_charge_date`, `final_retainer_confirmation_status` |
| Final-retainer documents | `final_retainer_receipt_number`, `final_retainer_receipt_drive_id`, `final_retainer_receipt_status`, `final_retainer_receipt_email_sent_at`, `final_retainer_invoice_number`, `final_retainer_invoice_drive_id` |
| Re-issued implementation invoice | `implementation_invoice_number`, `implementation_invoice_drive_id` |
| Amendment stamps | `fee_amended_at_tax4`, `fee_amended_at_tax5` |
| Per-payment card fees *(migration `20260826170000_tax_per_payment_card_fees.sql`, not the 2026-08-25 one)* | `final_retainer_card_fee`, `implementation_card_fee` — alongside the pre-existing `card_processing_fee`, which now means the FIRST retainer payment alone |

New audit table **`client_tax_fee_amendments`** (RLS + deny-all policy in the same migration, #141). One row per amendment. **Audit only** — `client_tax_plans` carries the live amounts and nothing reads this table to make a money decision.

## The predicate — read this before writing any 3-payment branch

```ts
isThreePaymentPlan(plan) === isNewFeeProcess(plan) && plan.final_retainer_amount != null
```

**Keyed on FINAL, never on initial.** A Tax 4 amendment to `≤ $30,000` converts a 3-payment plan back to 2 payments by **nulling `final_retainer_amount` while KEEPING `initial_retainer_amount`** — the kept value is both the record of what was collected as an initial retainer and the marker that lets a later above-threshold amendment convert *back*. Both columns are written together at pricing, so on every non-converted row the two tests are identical and a predicate keyed on `initial` passes all normal testing and then misclassifies exactly the converted plans. See **#440**.

**Every explicit-select caller must carry `final_retainer_amount` — and `fee_process_version` with it.** The predicate reads `false` on a row where the column simply was not selected, and nothing errors: a handler that lists its columns by name and forgets one treats **every** 3-payment plan as a 2-payment plan, permanently and silently. Three handlers shipped on 2026-08-25 exactly that way — `confirmation-email.ts`, `payment-email.ts` and `paidbycheck.ts` — so the confirmation bell quoted the wrong amount, the payment email resolved `[RETAINER_LABEL]` and `[LATER_PAYMENTS]` to their 2-payment wording, and a check-paying client was asked for the **FULL** retainer instead of the initial. Fixed in v791. There is no compile-time protection here; the select list is the enforcement. See **#448**.

The predicate exists in **three** places that must move in lockstep: `constants/tax-fee-process.ts` and both frontend mirrors (`taxShared.jsx`, `TaxPrioritiesTab.jsx`). Same cross-repo coupling class as the step machine (#339).

---

## The money chain

### 3-payment plan

```
Tax 3 decision (total > $30k)      -> fee_process_version stamped, initial + final written
Agreement (row 23 / 24, 4 pages)   -> client signs; client_signed_at stamped
Initial retainer  $15k or custom   -> /tax-pay -> checkout.session.completed
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

### Card processing fees — one column per payment *(2026-08-26, v792 — CODE-ONLY)*

`client_tax_plans.card_processing_fee` was a **single** column that all three tax charges wrote, each overwriting the last. Proven live: an $8,331.50 initial retainer stamped **$249.14**, then the $11,668.50 final retainer replaced it with **$348.80** — the initial payment's fee no longer existed on the row. Already-rendered PDFs are static and unaffected, but any re-render of an earlier payment's document would print a later payment's fee, and the receipt handlers had grown *"pass `0` instead"* workarounds around the ambiguity. Migration `20260826170000_tax_per_payment_card_fees.sql` gives each payment its own nullable `numeric` column and pins the ownership of all three with SQL column comments:

| Column | The payment it describes |
|---|---|
| `card_processing_fee` | the **FIRST retainer payment ONLY** — the whole retainer on a 2-payment or legacy plan, the initial retainer on a 3-payment plan. **Meaning unchanged, never renamed, never backfilled**; every existing writer and reader keeps it. |
| `final_retainer_card_fee` | the **final retainer** payment. 3-payment shape only — always NULL on 2-payment and legacy plans. |
| `implementation_card_fee` | the **implementation** charge. Every plan shape, legacy included. |

**Writers:** the `router/webhooks.ts` `payment_intent.succeeded` final-retainer and implementation branches now write their own columns instead of the shared one. **Readers:** `final-retainer-receipt.ts` and `implementation-receipt.ts` read theirs; `confirmation-email.ts` branches on `isImpl` (and `implementation_card_fee` was added to its explicit select); `invoice-receipt.ts` correctly keeps `card_processing_fee`.

**Both re-issued invoices now pass `plan.card_processing_fee` where they previously passed a hard-coded `0`.** `utils/tax-invoice-html.ts` renders its card-fee row **exclusively against the FIRST retainer payment** (*"Total Charged for Initial Retainer"* / *"… for Retainer"*, amount = initial + fee), so the `0` was a workaround for the shared column rather than a semantic requirement — passing the real fee restores parity with the invoice the client originally received. Each payment's own fee still appears broken out in full on its own receipt.

**NO backfill, deliberately.** Production exposure was verified zero: no plan carried `fee_process_version`, `final_retainer_amount` or `final_retainer_status`, so no final-retainer or implementation charge has ever run under the revised process. Both new columns start NULL, which reads as *"this payment was not paid by card"* everywhere they are consumed. Adding nullable columns to an existing table changes no RLS policy.

**Two honest caveats.**

- The `checkout.session.completed` fresh-`/tax-pay`-link final-retainer branch writes **no** card fee at all and never did (pre-existing). A card-paid fresh-link final retainer whose `payment_intent.succeeded` never lands therefore leaves `final_retainer_card_fee` NULL.
- **`payment_method_type` on the same table is STILL a single shared column** across all three payments. A re-issued invoice for a plan whose payments used different methods reads the LATEST method and can drop the initial retainer's card-fee disclosure. Knowingly unfixed.

**⚠️ CODE-ONLY as of writing.** The migration is applied to production, but `vfo-admin-api` v792 is not deployed and **neither new column has ever been written or read by a real payment.** The lesson — one column per occurrence, the moment a second occurrence exists — is **#450**.

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

**An amendment and Stripe's idempotency key can collide.** `charge-final-retainer.ts` keys its PaymentIntent `tax-finalret-<plan.id>-<payment-method suffix>-<UTC date>` and `charge-implementation.ts` keys its own the same way (`tax-impl-…`); `revshare.ts` keys each transfer `revshare-tax-<plan.id>-<payment_kind>` with no date at all. **None of those keys carries an AMOUNT** — they were built to make a genuine retry of the *same* charge safe (#15, #228). An amendment changes the amount without changing any key component, so a re-priced charge attempted inside the same key window is not a fresh request as far as Stripe is concerned. See **#449** before adding an amend-then-recharge path.

**The step reads done from EITHER of two sources** — its own `client_tax_progress` row, or the `fee_amended_at_*` stamp. The stamp is kept as an independent proof so a lost `save-task` after a *successful* amendment does not leave the step reading outstanding while the money has already moved. The frontend's `isTaskStatused` uses the same two-source rule (#339).

**The UI confirms before committing.** The house convention is that a step dropdown completes on select; here that would finalise a price on a stray click, so "keep the fee as it is" confirms first, and the answer stays editable until the downstream decision is recorded. See **#442**.

### Conversion, and why it is reversible

A Tax 4 amendment to `≤ $30,000` **converts a 3-payment plan to 2 payments**: `final_retainer_amount` is nulled, `initial_retainer_amount` is kept, the initial retainer already paid — flat or custom — becomes the whole retainer, and the reduction lands entirely on the implementation fee. Every surface flips to the 2-payment shape at once, because they all read `isThreePaymentPlan`. A later amendment back **above** $30,000 converts it back. Both directions stay available until Client decision 1 goes out.

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

**`[RETAINER_LABEL]` and `[LATER_PAYMENTS]` are LIVE in `email_templates` today.** Rows **22** and **131** (the `/tax-pay` payment email and its member-paying twin) carry **both**; `[RETAINER_LABEL]` is also live on **23 / 24 / 30** and their member twins (confirmation) and on **29 / 133** (paid-by-check). In-file comments in `payment-email.ts`, `confirmation-email.ts` and `paidbycheck.ts` still claiming *"no-op on today's bodies"* were stale and were corrected in v791. Read the deploy-order rule below as the rule for the NEXT token, not as a description of these two — and note that a live `[RETAINER_LABEL]` is exactly why the missing `final_retainer_amount` select in those three handlers (#448) reached a client's inbox rather than staying invisible.

**Deploy order is binding for all of them:** the handler substitution ships FIRST, then the template SQL. The reverse order prints a raw `[TOKEN]` into a client's email. Every money-bearing substitution uses a replacer **function**, never a replacement string — see **#438**.

New client-facing email on the green click: `TAX_postreview_confirmed` and `TAX_postreview_confirmed|3pay`, each with a member-paying twin. Drafted **before** the money chain so the client's inbox explains the pull that is about to happen, and wrapped so a missing template or a Gmail hiccup can never fail a decision the client has already made.

**Every plan shape gets it, legacy included *(2026-08-28)*.** The original `isNewFeeProcess(plan)` gate around the draft was removed: a legacy green click was recording the decision and firing the revenue share while sending the client no acknowledgement at all. A legacy row can never carry `final_retainer_amount`, so `isThreePaymentPlan()` is false and it resolves to the plain `TAX_postreview_confirmed` (row 239) or its member twin (row 240) — the 2-payment wording, which describes a fully-collected retainer moving into the Education phase and is exactly the legacy truth. No column, no validation, no step and no money behaviour reaches legacy from this change.

Two new `notification_rules`: `TAX_final_retainer_charge_failed` and `FAILURE_tax_final_retainer_charge`. Their list columns are **jsonb, not `text[]`** (#443).

## Display

- **Client Payments tab** — a 3-payment retainer renders as **two grouped rows** (*"Retainer payment 1 of 2"* / *"2 of 2"*) sharing a `subGroup`, drawn as one indented block with a tie bar. Same-day rows tie-break on the payment sequence so the initial always precedes the final. **The revenue-share preview sits on the FINAL row**, because that is where the transfers actually fire; the initial row shows no preview at all. Rows without a `subGroup` — everything else in the system — render exactly as before.
- **Accounting → Tax Planning revenue tab** pairs the two rows the same way, with the shares on the Final row.
- **Step machine** (`utils/tax-plan-steps.ts` + its FE mirrors) marks both amend steps `applicable: false` on a legacy plan, exactly like the steps a skipped ROI meeting removes — so a legacy plan's completeness, `next_action` and warnings are untouched.

## The ROI deck mirrors this process *(2026-08-27, template v6 / v795)*

**Anything that changes the numbers on this page changes the client-facing ROI deck too.** `actions/tax/generate-presentation.ts` **imports `THREE_PAYMENT_THRESHOLD` and `INITIAL_RETAINER_FLAT` from `constants/tax-fee-process.ts`** rather than re-typing them, so the deck and the money can never disagree about where 2 payments become 3. Template v6 tokenised every fee label and amount on slides 24 / 27 / 28 and carries a third fee row the handler either fills (3-payment) or deletes (2-payment).

Three things a future change to this process must know:

- **Move `THREE_PAYMENT_THRESHOLD` or `INITIAL_RETAINER_FLAT` and the deck follows automatically** — that is the point of the import. Do not add a second copy anywhere.
- **The deck reads the ASSESS FEE, never a column.** It is generated on *"Tax 2 - Deeper Dive"*, upstream of every write on this page — `fee_process_version`, `initial_retainer_amount` and `final_retainer_amount` are all stamped at the Tax 3 decision, so at generation time `isThreePaymentPlan()` would answer false on every plan.
- **The deck always quotes the FLAT $15,000 initial retainer.** [The custom initial retainer](#the-custom-initial-retainer) is deliberately **not** wired into it (user decision, 2026-08-27): an allowlisted client's deck shows the standard figure, and they see their real numbers on the agreement and the invoice. If that ever needs to change, the deck must first gain a way to know the custom quote exists — which today it does not, because the quote is taken downstream of it.

Detail: [flows/tax-planning.md](tax-planning.md) → *"THE FEE MODE"*, and `scripts/roi-presentation/README.md` in the EDGE repo.

## What this did NOT change

- **Legacy plans.** No column, no validation, no step. **One email as of 2026-08-28:** the `TAX_postreview_confirmed` acknowledgement now drafts on a legacy green click too (see above) — it is the 2-payment wording, and nothing else about a legacy plan changes.
- **`boldsign-webhook`** — untouched, still v40.
- **`actions/tax/revshare.ts`** — the deferred call needed no handler change.
- **`automation_TAX_charge_implementation`** — the single-call-site rule (#398) is unchanged; the final retainer copies it rather than modifying it.
- **The 50:50 retainer/implementation split.** The custom initial retainer moves the initial/final boundary inside the retainer half and nothing else — `total_fee`, `retainer_amount`, `implementation_amount`, `isThreePaymentPlan` and every revenue-share leg are identical to what the flat schedule writes.
- **`card_processing_fee`.** Not renamed, not backfilled, not re-pointed — it still means the first retainer payment's fee, which is what it always held before a second charge started overwriting it.

## Cross-references

[flows/tax-planning.md](tax-planning.md) · [flows/stripe-webhook.md](stripe-webhook.md) · [architecture/07-server-chains.md](../architecture/07-server-chains.md) · [architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md) · [tables/tax.md](../tables/tax.md) · [integrations/boldsign.md](../integrations/boldsign.md) · [NOTIFICATION_AUDIT.md](../NOTIFICATION_AUDIT.md) · gotchas **#438**–**#443** and **#448**–**#450**, plus **#251**, **#252**, **#327**, **#339**, **#377**, **#394**, **#398**
