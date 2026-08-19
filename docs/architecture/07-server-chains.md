# 07 — Server-to-server chains

> **Canonical inventory of every server-to-server chain in `vfo-admin-api`.** Read this before adding, moving or "optimising" any handler that invokes another handler.
>
> Merged on 2026-08-14 from `SESSION_REFERENCE.md`'s "Stripe webhook chain order" + handler/cron catalog and the chain enumeration that used to be embedded in the session starter prompt. The starter now points here instead of carrying its own copy.
>
> Companions: [05-api-action-catalog.md](05-api-action-catalog.md) (every action + its file), [01-system-map.md](01-system-map.md) (crons), [flows/](../flows/) (end-to-end per pipeline), [../integrations/stripe.md](../integrations/stripe.md) (Stripe detail).

---

## THE RULE — never convert a chain to a direct function call

**NEVER convert server-to-server chain calls from HTTP fetches to direct function calls.** This is a standing non-negotiable, not a style preference.

A chain is an HTTP POST from one handler back into the same edge function:

```ts
await fetch(`${SUPABASE_URL}/functions/v1/vfo-admin-api`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}` },
  body: JSON.stringify({ action: "automation_CONTRACT_paymentemail", client_id }),
});
```

**33 files** chain this way (verified 2026-08-14). Two credential shapes, and the difference is load-bearing:

| Caller context | Credential | Notes |
|---|---|---|
| Webhook / cron / post-auth automation | `Authorization: Bearer <SERVICE_ROLE_KEY>` | Re-enters as service-role; no session |
| An AUTH handler chaining another AUTH handler | forward **`body.token`**, not just the header | Gotcha **#11** — the header alone does not carry the caller's session |

Why it must stay HTTP: the chain target re-enters through `index.ts` → `middleware/auth.ts` → `router/dispatch.ts`, so it re-runs the **auth gate, the role gates and the dispatch lookup**. A direct import call skips all three. For a `tax_planner` caller the whole chain closure must be allowlisted and guarded (**#257**); a `PUBLIC_HANDLERS` chain target bypasses the gate and must **not** be allowlisted.

Related standing rules: **never** touch the `pipeRow` null-check pattern in `router/webhooks.ts` without explicit approval; **never** edit `boldsign-webhook` without explicit approval, and deploy it with `--no-verify-jwt` (**#10**).

---

## Stripe webhook cascade — the resolution order

`router/webhooks.ts` receives Stripe and BoldSign by request shape. The Stripe handler resolves the owning row by looking `stripe_customer_id` up **in this fixed order**, taking the first hit:

1. `pipeline_map1` (MAP 1 — implicit, no `metadata.pipeline` needed)
2. `client_tax_plans` (`TAX`)
3. `advisor_onboarding` (`ADVISOR_ONBOARDING`)
4. `client_priority_tracks` (`PIP`, by `pip_stripe_customer_id`)
5. `accountant_onboarding` (`ACCOUNTANT_ONBOARDING`)
6. `specialist_onboarding` (`SPECIALIST_ONBOARDING`, by `bg_stripe_customer_id`)

It then branches on `metadata.pipeline` and `metadata.payment_kind` ∈ {`retainer`, `implementation`, `onboarding`, `purchase`, `background_check`, `license`}. **Set both on every Checkout / PaymentIntent you create** (**#13**).

Three families sit **outside** this cascade as additive blocks: the specialist **monthly licence** (routed by `lic_stripe_customer_id`), **recurring SpecRev plans** (routed by each plan's dedicated `stripe_customer_id`), and `checkout.session.expired` (routed by `session.metadata.pipeline`).

**No event-id dedupe exists.** Stripe redelivers any webhook whose 200 we were too slow to return, so every chained side effect needs its own idempotency latch — only the MAP 1 P2–P4 branch is latched today (**#327**).

### Purchase-email policy — applies to every chain below

**Card → invoice/receipt ONLY, no confirmation email. ACH → confirmation at purchase + documents at settle. Check → both at clear (exempt).** Any new payment pipeline must follow it. Gate placement differs per pipeline and is load-bearing: MAP 1 / Tax / Specialist-licence gate **inside** the confirmation handler (those handlers also own the PF bell, ERT vault copy, Tracy email or have two racing call sites); everywhere else the gate belongs at the **call site** (**#287**, **#289**).

---

## Per-pipeline chain maps

### MAP 1 (Holistic)

| Trigger | Chain |
|---|---|
| Pre-auth setup | `automation_CONTRACT_stripecustomer` → `automation_CONTRACT_paymentemail` |
| Decision (Undecided) | `automation_PIPFU_decision` → agreement / payment email branches |
| Agreement | `automation_CONTRACT_sendagreement` (4 call sites, all forward `body.token`) |
| First card payment | → `automation_CONTRACT_invoicereceipt` → `automation_CONTRACT_revshare` |
| First ACH payment | → `automation_CONTRACT_confirmationemail`; on `payment_intent.succeeded` → `_invoicereceipt` → `_revshare` |
| Quarterly P2–P4 | off-session PI (`metadata.payment_number=N`) → `payN_status` → `_invoicereceipt` → `_revshare` (**latched on `rec{N}_email_sent`**) |
| Check | `automation_CONTRACT_paidbycheck` → `automation_CONTRACT_checkcleared` → confirmation **and** invoice/receipt (policy-exempt) |

`automation_CONTRACT_revshare` **pays immediately** — the Tracy Revenue-Master cross-check was removed 2026-07-01 (**#164**), amounts come straight from the PF input form. It also transfers the 10% **strategic partner** share to `strategic_member_groups.stripe_account_id` and drafts the partner rev-share email. Share proration is **not uniform across legs** — member pays in full, strategic is gross-prorated, VFOS is the residual (**#394**); copy `contract-revshare.ts`, never re-derive.

### Tax

| Trigger | Chain |
|---|---|
| Retainer (both methods) | → `automation_TAX_confirmationemail` (card gate is **inside** it: stamps `Skipped - Card (Receipt Only)`, also raises the PF bell + copies the signed agreement to the ERT vault) + `automation_TAX_invoicereceipt` (card now / ACH on `payment_intent.succeeded`) |
| Client decision 1 (client click **only**) | `automation_TAX_postreview-client-decision` → `automation_TAX_revshare` |
| Tax 5 implementation (client click **only**) | `actions/tax/implement-final-decision.ts` → `automation_TAX_charge_implementation` → `automation_TAX_implementation-receipt` |
| Check | `automation_TAX_paidbycheck` → `automation_TAX_checkcleared` (policy-exempt) |

**No revshare chain fires on the tax payment itself.** There is **no 24h auto-lock and no auto-charge anywhere in the tax track** — both were deleted (**#264**, **#398**). `automation_TAX_charge_implementation` has exactly **ONE** runtime call site and **nothing may ever chain it from a sweep again**. `'Auto-Locked'` has zero writers system-wide and survives only on historical rows, which `actions/clients/overview-tax.ts` and `TaxPrioritiesTab` still read — do not delete the readers.

ACH retainer → off-session implementation charge is rejected by Stripe (`us_bank_account not allowed`); the handler degrades to `declined` + a fresh `/tax-pay` link (see [flows/tax-planning.md](../flows/tax-planning.md) failure mode #9).

### Advisor / Accountant onboarding

Structurally identical — the accountant pipeline is a **file-for-file clone**, so any advisor-shaped constant inside it is suspect (**#329**).

| Trigger | Chain |
|---|---|
| Pre-auth | `automation_{ADVISOR,ACCOUNTANT}_stripecustomer` → `_paymentemail` |
| Card payment | → `_invoicereceipt` **directly** |
| ACH payment | → `_confirmationemail`; on `payment_intent.succeeded` → `_invoicereceipt` **directly** |
| 14-day implicit-No (cron) | → `_declineemail` |

**The confirmation handler no longer chains the receipt downstream** — the webhook owns receipt sequencing on every path (**#289**). Both write `renewal_date` = today + 6 months. **No revshare leg on either** — VFO holds the share internally; accountants *do* now carry a `revenue_decision`, which is **not** a reason to add one (**#375**).

### PIP Meetings

Card → `automation_PIP_invoicereceipt` + `automation_PIP_revshare`, **no confirmation**. ACH → `automation_PIP_confirmationemail` at checkout, then on `payment_intent.succeeded` (gated `pi.metadata.pipeline === "PIP"`) → `_invoicereceipt` + `_revshare`. PIP's gate is at the **call site** because its confirmation handler owns nothing but the email. `automation_PIP_revshare` also **unlocks locked child meetings** (flips `pip_paid=true` on every row whose `pip_purchased_from_track_id` matches). PIP uses no BoldSign, no storage bucket and **has no cron** — stalled chains need a manual service-role re-fire.

### Specialist onboarding

- **Background check** (Stage 3): → `automation_SPECIALIST_bgconfirmation` (**ACH only**, `!isCardS` gate at the call site) + `automation_SPECIALIST_bgreceipt` (card now / ACH on `payment_intent.succeeded`). `payment_intent.payment_failed` → `bg_payment_status='failed'` + Tracy FYI.
- **Monthly licence** (Stage 4, `mode=subscription`) — three separate additive blocks, **not** the customer cascade:
  1. `checkout.session.completed` → records `lic_*` + `automation_SPECIALIST_licconfirmation` (**ACH-only gate lives INSIDE the handler** — two racing call sites chain it, and it returns without stamping so a manual resend stays possible).
  2. `invoice.paid` / `invoice.payment_succeeded` (routed by `lic_stripe_customer_id`; subscription ref via `invoice.parent.subscription_details.subscription`, **#76**) — per-invoice idempotent on `lic_last_invoice_id`. First invoice → `licconfirmation` + `automation_SPECIALIST_licinvoicereceipt` + advance Stage 4→5; recurring → invoice/receipt only. Must skip the $0 `subscription_create` stub (**#198**).
  3. `invoice.payment_failed` → `lic_payment_status='failed'` + Tracy dunning FYI.

  The licence **reuses `bg_stripe_customer_id`**; the BG cascade branch harmlessly skips a licence event because `bg_payment_status='succeeded'` by Stage 4.
- Go-live: `automation_SPECIALIST_createspecialist` copies DD-checklist files into `specialist-documents`.

### Recurring Specialist Revenue (SPECREV)

Routed by each plan's **dedicated** `stripe_customer_id` — zero collision with licence routing or the cascade.

`checkout.session.completed` (`mode=subscription`) → plan `setup_pending`→`active`, capture ACH last4 + `next_billing_date` (**#199**) → `specialist_revenue_recurring_confirmationemail` (a *setup* confirmation, unaffected by the card policy). `invoice.finalized` pre-creates the month's request row as `processing`. Invoice-paid funnels through `processSpecrevRecurringInvoicePaid` (subscription guard + atomic `claim_specrev_recurring_invoice` RPC) → `received` → chains `specialist_revenue_invoicereceipt` + `specialist_revenue_payout`. `invoice.payment_failed` → `failed` + `SPECREV_recurring_payment_failed_bell` (plan stays active; Stripe retries).

**Never re-pin `verification_method='instant'`** (**#298**) — a recurring plan can legitimately be `active` with an unverified bank; the failure surfaces at charge day.

### One-time SpecRev

`checkout.session.completed` means **SUBMITTED, not PAID** — the handler branches on the PaymentIntent's own `status` (**#370**): `requires_action` → `awaiting_verification` + template **218**; `succeeded` → `received` + invoice/receipt + payout in one breath; anything else → `processing` + the old confirmation. `payment_intent.succeeded` accepts **both** `processing` and `awaiting_verification` — a `processing`-only guard strands the new state forever (**#371**). Three terminal-failure branches (`payment_intent.canceled`, `payment_intent.payment_failed`, `checkout.session.async_payment_failed`) route through `markSpecialistRevenueFailed`, skipping rows already `received`/`failed`.

### BoldSign webhook (standalone function)

Resolves the document through a 5-table cascade: MAP 1 → tax → advisor → accountant → specialist (`lic_boldsign_document_id`). Chains `automation_{ADVISOR,ACCOUNTANT}_stripecustomer` and `_ceocountersign` on the relevant Completed / Signed events, and `automation_SPECIALIST_ceocountersign` / `_licstripecustomer`. A `Declined`/`Expired`/`Revoked` early-return branch chains `automation_AGREEMENT_declined` via service-role (**#180**).

**Column-name trap:** the doc-id column differs per pipeline — `boldsign_doc_id` (MAP 1 / Tax) vs `boldsign_document_id` / `lic_boldsign_document_id` (onboarding) (**#205**). **MAP 1 and Tax never record WHEN an agreement was signed** — bare `'Yes'` flags, `*_at` stamped only on the advisor/accountant branches; Tax's `client_signed_at`/`ceo_signed_at` columns are dead. Raised and **PARKED** (**#384**).

### Failure-event handling

`utils/notify-jake-failure.ts` routes every money-movement failure to Jake's bell **in addition** to existing Tracy/admin/PF alerts. Covered: `checkout.session.async_payment_failed`, `payment_intent.payment_failed` (incl. LATE-ACH bounces of off-session MAP 1 installments and Tax implementation charges, each guarded on `'processing'` — **#229**), `customer.subscription.updated`/`deleted`, `charge.dispute.created`/`closed`, `charge.refunded` + refund events, `transfer.reversed`, and `payment_intent.partially_funded` (bank-transfer SpecRev; received-so-far derived from `amount_remaining` because a `customer_balance` PI reports `amount_received=0` until fully funded — **#184**).

**Alert policy:** action-required + auto-clear for rev-share / licence / disputes; dismissible FYI for the rest (**#122**). Every one of these only fires if the Stripe endpoint **subscribes to the event** in both modes.

### `checkout.session.expired` — abandonment

One additive isolated block, **two SPECREV pipelines only**, branching on `session.metadata.pipeline`, each carrying the `event.livemode`-vs-row-`sandbox` guard → `SPECREV_checkout_abandoned_bell`. An expired session has **no PaymentIntent**, so routing keys must be stamped at **session** level (**#299**).

---

## Sweeps — the cron half of the chain graph

**15 `pg_cron` jobs, all active** (verified live 2026-08-14). Staggered to avoid races on the same row. All invoke `vfo-admin-api` with the service-role key.

| Time (UTC) | Job | Handler | Does |
|---|---|---|---|
| `*/5 * * * *` | `reminder-sweep-5min` | `reminders/sweep.ts` | Delivers due `personal_reminders` via a **direct** `notifications` insert — the one documented **#176** exception |
| 02:00 | `revshare-sweep-daily` | `pipeline/contract-revshare-sweep.ts` | Retries failed MAP 1 revshare + the MAP 1 3-stall reminder ladder |
| 02:30 | `tax-revshare-sweep-daily` | `tax/revshare-sweep.ts` | **Sextuple duty** — see below |
| 03:00 | `chargescheduled-sweep-daily` | `pipeline/contract-chargescheduled-sweep.ts` | Off-session MAP 1 installments — **calendar dates, weekends included** |
| 04:00 | `check-reminder-sweep-daily` | `pipeline/contract-check-reminder-sweep.ts` | 7-business-day pre-due nudges + uncleared-check bells + `sweepMigrationSetupLinks` |
| 05:00 | `advisor-sweep-daily` | `advisor/sweep.ts` | 3 stalls × 2/4 + the 14-**calendar**-day auto-decline |
| 06:00 | `accountant-sweep-daily` | `accountant/sweep.ts` | Same shape as advisor |
| 07:00 | `specialist-sweep-daily` | `onboarding/sweep.ts` | **7 stalls** × 2/4; no auto-decline |
| 08:00 | `pft-sweep-daily` | `pft/sweep.ts` | Partnership Fast Track, 3 ladders; no auto-decline |
| 09:00 | `tax-presentation-sweep-daily` | `tax/presentation-sweep.ts` | Drafts `TAX_presentation_link` — **drafts only, never auto-sends** |
| 09:30 | `regular-map4-followup-sweep-daily` | `regular/map4-followup-sweep.ts` | MAP 4 3-tier chained ladder (**#175**) |
| 10:00 | `growth-overdue-sweep-daily` | `growth/overdue-sweep.ts` | No delay offset → **early-returns on Sat/Sun UTC** |
| 10:30 | `notifications-purge-daily` | `notifications/purge-sweep.ts` | Hard-deletes READ notifications > 90 days; unread never touched |
| 11:00 | `specialist-revenue-payout-sweep-daily` | `specialist-revenue/payout-sweep.ts` | 4 passes: payout retries, one-off ladder, recurring-setup ladder, awaiting-verification backstop |
| 12:00 | `membership-sweep-daily` | `membership/sweep.ts` | **5 passes**: renewal notices → renewals → waive $0 → one combined charge per plan → auto-unsuspend |

### Reminder-ladder time unit — read before touching any tier

**Every reminder / stall ladder counts BUSINESS DAYS (Mon–Fri, UTC), not calendar days.** The mechanism is `utils/notify.ts` `businessDelayCutoffIso(days)` — a backward whole-weekday walk, with any fractional part subtracted as plain hours **AFTER** the walk. **That order is load-bearing**: reverse it and a fractional delay goes non-monotonic across a weekend, so a "4 day" PF bell fires before its "2 day" reminder (**#397**). The forward counterpart `businessDayHorizonDateOnly` serves the two **countdown** horizons (Tax 2 assess-form reminder, MAP 1 check lookahead).

`notification_rules.delay_days` was **not** renumbered — only the unit moved, so a rule row read in isolation no longer tells you which calendar it counts against; the caller does (**#396**). The calendar helper `delayCutoffIso` survives with **zero callers**, kept so a future tier can opt back in deliberately.

### What ARMS a ladder — and why a resend must not (2026-08-16, #404)

A ladder's clock is a `*_sent_at` / `*_notified_at` column stamped by the handler that sent the thing being chased. **That makes every "resend" button a live re-arm hazard**: calling the send handler again re-stamps the clock and the chase restarts from zero, silently, for a form the recipient has had all along. The nine reschedule affordances added on 2026-08-16 therefore pass an explicit **`reschedule: true`** and each ladder write sits behind `!reschedule`:

| Handler | Ladder column(s) skipped on `reschedule` | Sweep that reads them |
|---|---|---|
| `pft/meeting-email.ts` | `discovery_email_sent_at`, `discovery_pf_notified_at` (token preserved) | `pft/sweep.ts` |
| `onboarding/prelim-email.ts` | `sif_email_sent_at` | `onboarding/sweep.ts` |
| `onboarding/stage2-email.ts` | Tracy's `allDone` revenue-share bell (not a column) | — |

**Three sites deliberately DO re-arm, and the difference is the direction the delay is counted.** `tax/ready-for-tax3.ts` nulls `tax3_assess_reminder_sent_at` when the booked date genuinely moves, because that reminder **counts down to the meeting** (#359) and a moved meeting invalidates it. `regular/map4-set-meeting-date.ts` nulls all three of `map4_followup_sent_at` / `map4_reminder_sent_at` / `map4_stall_notified_at` on a genuine date change — a user-approved decision to re-draft the MAP 4 follow-up ladder against the new date. `tax/highlevel-meeting-confirm.ts` needed no change at all: it already nulls `tax4_meeting_reminder_last_sent_at` on every confirm. **Forward-counted ladders must not re-arm; backward-counted (countdown) ones must.**

### What STOPS a stall ladder — the ack refire guard (2026-08-19, v760)

Until v760 a stall ladder had **no off switch**: the 4-business-day PF bell was minted whenever the stall's own guard column said the tier had not fired, and the "Reached out?" acknowledgement (`<stall>_pf_ack_at`, #381) was written by nobody's reader. Ticking the box therefore did not stop the chase — it recorded that someone had chased, and the next nightly tick minted again over the top of it. **Every sweep that mints a stall bell now filters `.is("<stall>_pf_ack_at", null)`:**

| Sweep | Pipeline |
|---|---|
| `pipeline/contract-revshare-sweep.ts` | MAP 1 |
| `tax/revshare-sweep.ts` | TAX |
| `advisor/sweep.ts` · `accountant/sweep.ts` | advisor / accountant onboarding |
| `onboarding/sweep.ts` | specialist onboarding |
| `pft/sweep.ts` | Partnership Fast Track |
| `regular/map4-followup-sweep.ts` | Regular Priorities (MAP 4) |

So the ack is now a genuine **satisfied-on-fire guard** in the #365 sense, and the same tick also clears the step's existing unread bells (see [../flows/notifications.md](../flows/notifications.md)). **Two consequences for a sweep author.** (1) A new stall ladder must add the column, the UI checkbox **and** this guard — a column without a guard is the old inert shape and reads as done while the chase continues. (2) The guard stops a re-*mint*, not a re-*arm*: `pft/meeting-email.ts` still **nulls `discovery_pf_notified_at`** on a plain (non-`reschedule`) send, which resets the tier the guard was protecting, so the two mechanisms can still disagree on that one path. Verification is owed against the first cron run after 2026-08-19.

**Deliberate calendar survivors — owner decisions, do not "finish the job":** advisor + accountant 14-day auto-decline, the Tax 4 meeting-passed nudge, the membership 30-day renewal notice, the chargescheduled sweep, the notifications purge, personal reminders, and every token/session expiry window.

### `tax-revshare-sweep` — the six blocks

1. **Retries only** — failed tax revshare (retainer + implementation) and stranded strategic transfers. It does **not** auto-start revshare on a plan that has not reached an explicit client click.
2. Tax 4 post-review timers — 2-business-day reminder + 4-business-day PF bell on **both** the Continue and Undecided picks (shared guard columns, **#264**).
3. Tax 5 implementation timers — **four tiers, no charge among them** (**#398**). Proceed and Undecided ladders share `implementation_reminder_sent_at` / `implementation_pf_notified_at`; safe only because `implementation_decision` is single-valued.
4. Tax 3 reminder timers — 2/4 on three stalls.
5. Tax 4 meeting-date nudge — **one persistent action-required bell** per plan (`dismissible:false`), not an email, not a daily repeat. Recipients: assigned PF + allocated planner + Tracy, with a per-recipient planner link override (**#292**).
6. Tax 2 assess-form reminder — **the only rule that counts DOWN** (business days *before* `tax3_meeting_date`, via `businessDayHorizonDateOnly`). Forks to `TAX_tax3_assess_reminder|vault` for vault-assess groups, and **that chosen name must be passed to both the template lookup and `gmailDraftFetch`** or the Draft/Send toggle silently resolves against nothing (**#356**, **#400**). Stamps its guard column **only after a successful draft**.

### Admin-driven paths (no webhook involved)

Check payments (`_paidbycheck` → `_checkcleared`, MAP 1 P1–P4 and tax retainer) and the tax **deposit refund** run entirely admin-driven. The refund lives on one decision step in Tax 1 (`program_client_tasks` 116, sentinel `tax_refund`): **Proceed** writes status `'Proceed'`; **Refund** writes no status at all and fires `automation_TAX_depositrefund`, which **requires** a `reason` (400 without it) filling `[Refund Reason]` in template 181 (**#293**).

---

## Adding a new chain — checklist

1. Chain over **HTTP**, never a direct call. Forward `body.token` if the target is an AUTH handler (**#11**).
2. Name the **idempotency column** that proves the side effect already happened, and check it first — Stripe redelivers (**#327**).
3. Set `metadata.pipeline` **and** `metadata.payment_kind` on anything you create in Stripe (**#13**).
4. Decide the purchase-email gate's **placement** deliberately — call site vs inside the handler (**#287**).
5. If a `tax_planner` can reach the entry point, allowlist **and** guard the entire chain closure (**#257**).
6. Subscribe any new Stripe event on the endpoint **in both modes**, or the handler is dead code.
7. Pick the ladder's time unit explicitly — business days by default (**#396**).
8. Run the 5-pipeline smoke gate after deploy; it proves wiring only, never chain semantics.
