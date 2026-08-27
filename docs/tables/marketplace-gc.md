# Gift-Credit (GC) marketplace tables

A points-style marketplace where members earn / buy credits and redeem them against `gc_services`. Credits are integer-only; balances and per-tx amounts are integers (no money type — represents credits, not currency).

## `gc_services`

Catalog of redeemable services.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `name` | text | not null |
| `description` | text | |
| `credit_cost` | integer | not null |
| `category` | text | |
| `active` | boolean | default `true`. Status field. |
| `allocated_admin_email` | text | The team member who handles this service. Validated against `allowed_admins.email` in `gc_manage_service`. When set it receives the `GC_credits_spent` bell and is CC'd on the redemption confirmation email; when null the bell falls back to the member's assigned MSM. Stripped from the member payload by `gc_load_services`. |
| `scheduling_link` | text | Booking URL offered to the member in the redemption confirmation email (only when `allocated_admin_email` is also set). Stripped from the member payload. |
| `billing_interval` | text | not null, default `'one_time'`, CHECK `one_time \| monthly \| yearly` (2026-08-27). The default is what makes every pre-existing row, and the whole one-time path, unchanged. A `monthly`/`yearly` service opens a `gc_subscriptions` row on redemption and is then charged by `automation_GC_recurring_sweep`. Edited as **Frequency** in the Growth Credits panel; validated again in `gc_manage_service` (400 on anything else). NOT stripped from the member payload — the marketplace renders `credits / month`. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `gc_load_services`, `gc_manage_service`, `gc_redeem` (reads `billing_interval`), `automation_GC_recurring_sweep` (re-reads the row every night — the sweep charges the CURRENT `credit_cost`, so a price change applies from the next renewal). Frontend: [MemberGCMarketplace.jsx:40](src/components/member/MemberGCMarketplace.jsx), [GrowthCreditsPanel.jsx](src/components/admin/GrowthCreditsPanel.jsx) (allocation editor), [GrowthCreditsRedemptionsPage.jsx](src/components/admin/GrowthCreditsRedemptionsPage.jsx) (read-only menu, under its "Menu" sub-tab).

A row can be hard-deleted via `gc_manage_service` `mode: 'delete'`, but only while it has no `gc_redemptions` history — the FK is `NO ACTION`. Retiring a service that has been redeemed means `active = false`.

---

## `gc_balances`

Current credit balance per member. PK is `member_number`. FK references `member_plugin_settings.plugin_member_number` (CASCADE).

| Column | Type | Notes |
|---|---|---|
| `member_number` | text | pk. fk → `member_plugin_settings.plugin_member_number` (CASCADE). |
| `balance` | integer | default `0` |

**Touched by:** `gc_load_balance`, `gc_redeem`, `gc_add_credits`, `gc_create_checkout` (post-payment).

---

## `gc_transactions`

Append-only credit ledger. `balance_after` is captured per-tx so audits don't need to recompute.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | not null. fk → `member_plugin_settings.plugin_member_number` (CASCADE). |
| `type` | text | not null. Application-defined (e.g., `'add'`, `'redeem'`, `'purchase'`). |
| `amount` | integer | not null. Signed (positive = credit, negative = debit). |
| `balance_after` | integer | not null. Snapshot of `gc_balances.balance` after this tx. |
| `description` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `gc_load_transactions`, `gc_redeem`, `gc_add_credits`, `gc_create_checkout` (after Stripe webhook confirms payment).

---

## `gc_redemptions`

Pending/completed redemption requests linking a member to a `gc_services` row.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | not null. fk → `member_plugin_settings.plugin_member_number` (CASCADE). |
| `service_id` | integer | not null. fk → `gc_services.id` (NO ACTION). |
| `credits` | integer | not null. Snapshot of `gc_services.credit_cost` at redemption time. |
| `status` | text | default `'pending'`. Status field. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `gc_load_redemptions`, `gc_load_all_redemptions`, `gc_redeem`, `gc_update_redemption`.

**Renewals of a recurring service deliberately file NO row here** — charge 2..n is not a new request for the fulfilment queue to work, so `gc_transactions` is the entire audit trail from the second charge on. The corollary the code relies on: a *pending* (therefore rejectable) redemption of a recurring service is always the **initial** one.

---

## `gc_subscriptions`

One live recurring service per member (2026-08-27, migration `20260827150000_gc_recurring_services.sql`). **RLS enabled + deny-all policy in the same migration** (#141); all access is via the service-role edge function.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk, generated always as identity |
| `member_number` | text | not null. fk → `member_plugin_settings.plugin_member_number` (**CASCADE**) — mirrors `gc_balances` / `gc_redemptions`. |
| `service_id` | integer | not null. fk → `gc_services.id` (**NO ACTION**) — mirrors `gc_redemptions.service_id`, so a service anyone has ever subscribed to cannot be deleted and history keeps resolving. |
| `status` | text | not null, default `'active'`, CHECK `active \| on_hold \| cancelled`. **A real CHECK, unlike the bare-`text` status columns #431/#444 warn about.** |
| `next_charge_date` | date | not null. **Deliberately NOT advanced while `on_hold`** — a funded hold charges once at the next sweep and is re-anchored one full period from THAT day, so missed periods never stack (#456). |
| `last_charged_at` | timestamptz | Set at redemption (the first period) and on every successful renewal. |
| `on_hold_notified_at` | timestamptz | One out-of-credits email per hold episode: stamped when the row goes `on_hold`, cleared by the charge that releases it. The sweep's `.is(…, null)` filter on the hold UPDATE is the dedupe. |
| `created_at` | timestamptz | not null, default `now()` |
| `cancelled_at` | timestamptz | Stamped by all three cancel routes (member, admin-on-behalf, redemption rejection). |

**Indexes:** `(status, next_charge_date)` for the sweep's candidate query; `(member_number)` for the portal + cancel handler.

**Touched by:** `gc_redeem` (insert, and the duplicate-subscription refusal), `gc_load_subscriptions`, `gc_cancel_subscription`, `gc_update_redemption` (reject → cancel), `automation_GC_recurring_sweep`.

No unique constraint enforces one live subscription per (member, service) — `gc_redeem`'s `active`/`on_hold` lookup is the guard, and the sweep's optimistic `next_charge_date` claim is what makes a double charge impossible if one ever slipped through.

---

## Stripe checkout flow for buying credits

`gc_create_checkout` ([vfo-admin-api/index.ts:2806](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):
1. Frontend ([MemberGCMarketplace.jsx:47](src/components/member/MemberGCMarketplace.jsx)) calls with `{member_number, amount, price}`.
2. Edge function creates a Stripe Checkout Session using `STRIPE_SECRET_KEY` (live only — sandbox not used in this path), passing `metadata: {member_number, credits: amount}` on the session.
3. Returns the Checkout URL; client redirects to Stripe.
4. After payment, Stripe sends `checkout.session.completed` to the signature-gated webhook in `vfo-admin-api/index.ts:222`. Lines 270-288 disambiguate the GC case by checking `session.metadata.member_number` + `session.metadata.credits`, then update `gc_balances` and insert a `gc_transactions` row of type `'purchased'`.
5. Same Stripe webhook also handles MAP1 payments (which are disambiguated by lacking those metadata fields and instead matching `session.customer` against `pipeline_map1.stripe_customer_id`). The two flows share the webhook URL; metadata routing is the only thing distinguishing them.
