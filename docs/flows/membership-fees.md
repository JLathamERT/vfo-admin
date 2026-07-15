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
- **Renewal is always a 15th**: the last 15th strictly before first-payment + 12 months
  (pay Jul 8 → renews Jun 15 next year; Jul 19 → Jul 15). 12 pulls per membership year.
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
   **waive** due $0 rows, **charges** (one off-session PI per plan = due + missed rows; row-set
   idempotency keys; failure → missed/email/suspend/bell), **auto-unsuspend** caught-up members.
   Off-session PI settlement also has a generic webhook block (`payment_intent.succeeded/_failed`
   routed by membership metadata) covering ACH pulls + termination fees.
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
- Off-session pull fails → sweep marks the newly-due row `missed`, drafts the friendly email once
  per row (`reminder_sent_at` guard), suspends, bells. No auto-retry of the failing method — the
  catch-up rides next month's charge; the member fixes the method via their link.
- Termination fee declines → plan still terminates; the `termination_fee` row sits `declined`.
- The sweep skips plans without a saved method (nothing to charge yet).

## NOT built yet (next work)

- Membership invoice/receipt PDFs (never requested); per-row itemization of the card gross-up
  (the charge is grossed up; the ledger shows face value).
- Go-live steps: frontend deploy (ships `/membership-pay` — REQUIRED before real setup links go
  out), flip `MEMBER_MEMBERSHIP` sandbox→live, confirm the LIVE Stripe endpoint subscribes
  `checkout.session.completed` + `async_payment_succeeded/_failed` + `payment_intent.succeeded/_failed`,
  flip the three templates Draft→Send, verify `advisor_model` tags on fee-paying members.
