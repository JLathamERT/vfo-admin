# Member Membership Fees — end-to-end flow

> Built 2026-07-13 (`claude/member-membership-fees`, backend v585–v591). Advisor + accountant
> members pay their annual membership through the portal: admin sets terms, the member pays
> their first payment at a public link, and a daily sweep runs every charge after that.
> Admin surface: **Accounting → Members → Advisor Membership Fees / Accountant Membership Fees**
> (`src/components/admin/MembershipFeesPanel.jsx`, superadmin-gated in JSX; actions also under
> `TAB_ACTIONS.accounting`). Sandbox: `pipeline_sandbox_config` row `MEMBER_MEMBERSHIP`
> (badge on both panels — **SANDBOX as of 2026-07-13**). Gotchas #215–#217.

## Business rules (user-confirmed)

- **Terms**: annual membership value + optional FIRST-YEAR credit note; paid monthly or annually.
  Every charge is a **whole dollar** (round half up — $8,000/12 → $667; small yearly drift accepted).
- **First payment happens at the setup link** (`/membership-pay?token=`). Card or ACH.
  **Card fee**: Legacy Model members pay face value on both rails (no fee — this system only);
  New Model members' card payments gross up 2.9% + $0.30 (decided by the plan's `advisor_model`
  snapshot; untagged members = Legacy). Corporate/untagged members are always advisors.
- **Charge day** = the day of the first payment when it's the 1st–15th (pay the 8th → the 8th
  forever). Paying after the 15th skips the next month, then bills the 1st (pay Jul 19 → Sep 1…).
- **Renewal is always a 15th**: pay days 1–14 → the last 15th strictly before
  first-payment + 12 months (pay Jul 8 → renews Jun 15 next year); pay day 15 **or**
  after the 15th → the 15th exactly 12 months out (pay Jul 15 → Jul 15; Jul 19 → Jul 15).
  12 pulls per membership year. (Day-15 rule changed 2026-07-17 — the old "strictly before"
  formula made a day-15 payer's 12th pull EQUAL the renewal date, permanently blocking the
  renewal guard; gotcha #235.)
  Auto-renews at the full annual value — or at admin-set **next-year terms**
  (`next_year_amount` − `next_year_credit_note`, editable on any active plan, consumed at renewal) —
  unless auto-renew is toggled off.
- **Transfers** (members moving off the old billing mid-year): keep their existing renewal 15th
  (admin inputs it); pay their next month at the link; bill only the charge dates before renewal
  (credit spreads across those remaining pulls). **Annual transfers** pay nothing now — the link is
  save-method-only; the first charge is the full annual at renewal. Fully-credited $0 plans are
  also save-only ($0 rows show "Covered by credit" and are waived when due).
- **Missed payment**: row → `missed` (red), member gets the friendly `MEMBERSHIP_payment_failed`
  email (no suspension mention — fix your method at the link; next month doubles to catch up),
  `members.suspended` flips on automatically (auto-clears when caught up; login NOT blocked),
  admin gets the `MEMBERSHIP_charge_failed` bell. The catch-up is automatic: the next due month
  and ALL arrears go out as ONE combined off-session charge.
- **Termination**: "Terminate member" (replaces cancel on active plans) → admin enters a fee →
  charged to the saved method immediately (whole dollars; New Model card gross-up), remaining
  scheduled rows voided, plan `terminated`. $0 fee just terminates. A failed fee charge still
  terminates and leaves a `declined` termination row visible for follow-up.
- **Update payment method**: an active plan's same `/membership-pay` link becomes a save-only
  "Update Your Payment Method" page (the failed-email button target).

## Flow

1. **Plan creation** — `membership_plan_save` (`actions/membership/plan-save.ts`): validates,
   snapshots member name/model, computes the whole-dollar `per_pull_amount`, stores transfer
   renewal (must be a 15th). NO schedule yet — the ledger depends on the day they actually pay.
   Editable while `setup_pending`; a live plan only offers next-year terms / auto-renew / terminate.
2. **Setup link** — `membership_send_setup_link`: find-or-create Stripe customer (mode-matched via
   `plan.sandbox`), mints `setup_token`, drafts `MEMBERSHIP_setup_link` or
   `MEMBERSHIP_transfer_setup_link` (pipeline `MEMBER_MEMBERSHIP_FEES`, Draft/Send toggle).
   Since 2026-07-15 the Set Up Payments form auto-chains this client-side right after a
   successful CREATE (`plan_save` returns `plan_id`; an email failure never rolls back the
   plan — it surfaces as an amber notice pointing at the card's "Send setup link" resend
   button, which remains the retry path; edits don't auto-send).
3. **/membership-pay** (`src/pages/MembershipPayPage.jsx`, PUBLIC token) — `membership_setup_load`
   + `membership_setup_checkout`: mode=payment Checkout charging the first pull with
   `setup_future_usage=off_session` (save-only variants use mode=setup). Metadata on session AND
   intent: `pipeline=MEMBER_MEMBERSHIP`, `payment_kind`, `plan_id` (gotcha #216).
4. **Webhook activation** (`router/webhooks.ts` isolated blocks → `actions/membership/activate.ts`):
   on `checkout.session.completed` saves the PM as the customer/plan default and generates the
   year's ledger — row 1 = the link payment (card `paid`, ACH `processing` until
   `checkout.session.async_payment_succeeded`/`_failed`), locks `charge_day` + `renewal_date`.
   Already-active plans only refresh the method fields (the update-method path).
5. **Daily sweep** — `automation_MEMBERSHIP_sweep` (PUBLIC service-role, cron jobid 16 @12:00 UTC,
   `supabase/cron/membership-sweep.sql`), four passes in order: **renewals** (generate the next
   year at next-year terms, advance `renewal_date` +12 months, guard = any row on/after renewal),
   **waive** due $0 rows, **charges** (one off-session PI per plan = due + missed rows;
   LOGICAL/date-less sorted row-set idempotency keys `membership-pull-<plan>-<rowids>`, gotcha
   #228 class; a charge that succeeds but whose ledger write fails alerts Jake loudly; sync
   card decline → missed/email/suspend/bell), **auto-unsuspend** caught-up members.
   Off-session PI settlement has a webhook block (`payment_intent.succeeded/_failed` routed by
   membership metadata) covering ACH pulls + termination fees — and since v617 the
   `payment_intent.payment_failed` branch mirrors the sweep's failure arm for late ACH bounces
   of monthly pulls (suspend + bell + email via the shared
   `utils/membership-payment-failure.ts` helper; gotcha #236).
6. **Reconciliation UI** — the Members section renders the ledger per member (green paid rows with
   payment id + method, red missed with the Stripe decline reason, waived, per-membership-year
   selector once renewals accumulate, totals row). Outstanding lists overdue/missed by member,
   with a per-row "Send reminder email" button (`membership_send_reminder`, added Phase 4
   2026-07-15) that re-sends the failed-payment email on demand for the member's full arrears.

## Data

`member_payment_plans` + `member_payment_schedule` — see [tables/membership-fees.md](../tables/membership-fees.md).

## Failure modes

- ACH first payment bounces → `checkout.session.async_payment_failed` → row 1 `declined`; the plan
  stays active and the next sweep's combined charge picks the amount up (same catch-up path).
  Deliberately flip-only today — no bell/email on the FIRST-payment bounce (audit finding M1).
- Off-session pull fails **synchronously (card)** → sweep marks the newly-due row `missed`,
  drafts the friendly email once per row (`reminder_sent_at` guard), suspends, bells.
- Off-session pull bounces **late (ACH)** → `payment_intent.payment_failed` flips the charge's
  rows `declined` AND (v617) suspends + bells + drafts the same email via the shared helper —
  previously this path was totally silent (gotcha #236). No auto-retry of the failing method
  either way — the catch-up rides next month's charge; the member fixes the method via their link.
- The failed-payment email's `[Failed Amount]` token = the failed charge's total (may span
  months); `[Amount]` = the regular per-pull ("your usual"). Different tokens — keep both.
- Charge succeeds but the ledger write fails → Jake gets a "charge SUCCEEDED / write FAILED"
  bell (the date-less idempotency key protects the next-night re-select within Stripe's window).
- Any activation DB failure after the member completed checkout (guard count / ledger insert /
  plan update / method refresh), or a payment method that couldn't be read back from Stripe →
  Jake bell (`activate.ts` + the webhook block; Stripe returned 200 and will not retry).
- Termination fee declines → plan still terminates; the `termination_fee` row sits `declined`
  (no bell — audit finding M4, visible only in the grid/Outstanding + the admin's response toast).
- The sweep skips plans without a saved method (nothing to charge yet); an ACTIVE plan missing
  its method is alerted at activation time (see above) rather than nightly.

## NOT built yet (next work)

- Membership invoice/receipt PDFs (never requested); per-row itemization of the card gross-up
  (the charge is grossed up; the ledger shows face value).
- From the 2026-07-17 audit, known-and-accepted for now: membership charges are absent from the
  global Payments page (H4); first-payment ACH bounce is flip-only (M1); no `event.livemode` vs
  `plan.sandbox` guard in the webhook blocks (M2); `members.suspended` is shared with the admin's
  manual toggle so the sweep's auto-(un)suspend can collide with it (M3); termination-fee bounce
  has no bell (M4); combined-pull charges aren't grouped/gross-up-explained in the ledger UI;
  Outstanding lists overdue-but-`scheduled` members whose "Send reminder" then errors.
- **Go-live steps** (order matters — the flip trap is #1: every charge site reads the plan's
  snapshotted `sandbox`, so an ACTIVE plan set up under sandbox keeps charging the SANDBOX
  account forever after the flip, green-but-fake):
  1. Frontend deploy (ships `/membership-pay` — REQUIRED before real setup links go out).
  2. BEFORE flipping, inventory `member_payment_plans` where `sandbox=true`: `active` ones must
     be terminated/canceled and recreated live (no re-stamp path exists); `setup_pending` ones
     self-heal only when "Send setup link" is re-clicked AFTER the flip (old emailed links stay
     sandbox-stamped — resend them).
  3. Flip `MEMBER_MEMBERSHIP` sandbox→live.
  4. Subscribe the EXACT event names on the LIVE endpoint: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
     `payment_intent.succeeded`, `payment_intent.payment_failed` (NOT "payment_intent.failed").
  5. Flip the three `MEMBER_MEMBERSHIP_FEES` templates Draft→Send (standing directive 2026-07-17:
     nothing flips in the short term).
  6. Verify `advisor_model` tags on fee-paying members (card gross-up depends on the snapshot).
  7. Smoke one real setup link end-to-end and confirm the customer/charge lands in the LIVE
     Stripe dashboard.
