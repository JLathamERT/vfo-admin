# Tables — Member Membership Fees

> Added 2026-07-13 (`20260713090000_member_payment_plans` + follow-ups `…110000`, `…120000`,
> `…140000`). Both tables RLS deny-all (anon probe `*/0`). All access via the service-role edge
> function. Flow: [flows/membership-fees.md](../flows/membership-fees.md).

## member_payment_plans

One row per member membership plan. Partial unique index `member_payment_plans_one_live_idx`
on `(member_number) WHERE status <> 'canceled'` — one live plan per member
(`terminated` also counts as live for the index; the app filters `not in (canceled, terminated)`
when checking, so terminate → create-new works).

| Column | Notes |
|---|---|
| `member_number` / `member_name` | member ref + display snapshot |
| `category` | `'advisor'` \| `'accountant'` — which Accounting panel owns it |
| `advisor_model` | snapshot; `'New Model'` = card fee applies, anything else = Legacy (no fee) |
| `frequency` | `'monthly'` \| `'annual'` |
| `annual_amount` / `credit_note` / `credit_note_memo` / `net_annual` | terms; credit is FIRST-YEAR only |
| `per_pull_amount` | whole-dollar charge per pull (round half up), computed at plan-save |
| `charge_day` | 1–15, locked at first payment (annual plans store 15) |
| `start_date` | date of first payment (provisional = creation date until they pay) |
| `renewal_date` | always a 15th; derived at first payment (pay days 1–14: last 15th strictly before pay+12mo; day 15 & after-the-15th: the 15th exactly 12mo out — gotcha #235) or admin-entered for transfers; advanced +12mo at each renewal |
| `auto_renew` | default true |
| `transfer` | mid-year move from the old billing (bills only until the entered renewal) |
| `status` | `setup_pending` → `active` → `canceled` \| `terminated` |
| `stripe_customer_id` / `default_payment_method_id` / `payment_method_type` / `acct_last4` | charge rails (`ach`/`card`) |
| `setup_token` / `setup_email_sent_at` | the /membership-pay link (doubles as the update-method link once active) |
| `next_year_amount` / `next_year_credit_note` | admin-editable renewal terms, consumed + cleared by the renewal pass |
| `termination_fee` / `terminated_at` | set by `membership_terminate` |
| `sandbox` | Stripe mode the customer was created in (key selection follows this, not the live toggle) |

## member_payment_schedule

The expected-payment ledger — one row per pull, generated at first payment (year 1) and by the
renewal pass (later years). Unique `(plan_id, due_date)` **WHERE kind='membership'** (partial
index `member_payment_schedule_plan_due_membership_key`, migration `20260717190000` — a
termination fee legitimately shares its date with a same-day membership row; gotcha #239);
sweep index `(status, due_date)`.

| Column | Notes |
|---|---|
| `plan_id` (FK cascade) / `member_number` | |
| `due_date` / `period_label` | e.g. `2026-08-13` / `August 2026` (annual: `Membership year 2026–2027`) |
| `amount_due` / `credit_applied` | whole dollars; $0 rows = credit-covered, waived when due |
| `kind` | `'membership'` \| `'termination_fee'` |
| `status` | `scheduled` → `processing`/`paid` \| `missed`/`declined` (arrears — swept into the next combined charge) \| `waived` \| `canceled` |
| `stripe_payment_intent_id` | a combined catch-up charge stamps the SAME PI on every row it covered |
| `paid_at` / `payment_method_type` / `acct_last4` / `failure_reason` | |
| `reminder_sent_at` | guard so the failed-payment email drafts once per missed row |

## Related config

- `pipeline_sandbox_config` row `MEMBER_MEMBERSHIP` (SANDBOX as of 2026-07-13).
- `email_templates` pipeline `MEMBER_MEMBERSHIP_FEES`: `MEMBERSHIP_setup_link`,
  `MEMBERSHIP_transfer_setup_link`, `MEMBERSHIP_payment_failed` (all Draft mode).
- `notification_rules` key `MEMBERSHIP_charge_failed` (area "Membership Fees").
- pg_cron jobid 16 `membership-sweep-daily` @12:00 UTC.
