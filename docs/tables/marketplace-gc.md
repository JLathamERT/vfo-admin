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

**Touched by:** `gc_load_services`, `gc_manage_service`, `gc_redeem` (reads `billing_interval`), `automation_GC_recurring_sweep` (re-reads the row every night — the sweep charges the CURRENT `credit_cost`, so a price change applies from the next renewal). Frontend: [GCMarketplaceViews.jsx](src/components/shared/GCMarketplaceViews.jsx) (the shared Services view mounted by `MemberGCMarketplace.jsx` and the admin per-member tab), [GrowthCreditsPanel.jsx](src/components/admin/GrowthCreditsPanel.jsx) (allocation editor), [GrowthCreditsRedemptionsPage.jsx](src/components/admin/GrowthCreditsRedemptionsPage.jsx) (read-only menu, under its "Menu" sub-tab).

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

`gc_create_checkout` ([actions/gc/create-checkout.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/gc/create-checkout.ts)):
0. **Four fixed packages, priced server-side** in that file's `GC_PACKAGES` map — **1 / `$100`, 10 / `$950`, 20 / `$1,800`, 50 / `$4,000`** (0 / 5 / 10 / 20% off the `$100`-per-credit headline; the 50-credit package was added 2026-09-01). The client-sent `amount` must be one of those keys; **any client-sent price is ignored** (#210). The frontend lists in `MemberGCMarketplace.jsx` and `GrowthCreditsPanel.jsx` mirror them **for display only**.
1. Frontend ([MemberGCMarketplace.jsx](src/components/member/MemberGCMarketplace.jsx), a 4-column comparison table) calls with `{member_number, amount, payment_method}`.
2. **`payment_method` must be `'ach'` or `'card'`.** ACH charges the flat package price; **card grosses it up so Stripe's 2.9% + $0.30 nets to the flat price** (`round((price + 0.30) / (1 - 0.029) * 100)` cents — the same formula as `tax/stripe-checkout.ts`), with the gross-up carried as `metadata.card_processing_fee`. `payment_method_types[]` is `card` or `us_bank_account`; the ACH session sets `verification_method = instant`.
3. **The Stripe key follows the sandbox flag** — `getStripeKey(isSandbox)`, with `isSandbox` read from the **`GROWTH_CREDITS`** row of `pipeline_sandbox_config`. *(An earlier version of this doc said `STRIPE_SECRET_KEY` only, no sandbox path. That is stale.)* The session carries `metadata: {member_number, credits, pipeline: 'GROWTH_CREDITS'}`.
4. **Return URLs derive from the request `Origin`** when it is in `ALLOWED_ORIGINS`, else `https://vfoportal.com`: `success_url = <base>/member?gc_success=1&m=<payment_method>`, `cancel_url = <base>/member`. Local dev therefore returns to localhost.
5. Returns the Checkout URL; client redirects to Stripe.
6. After payment, Stripe hits the signature-gated webhook — `maybeHandleStripeWebhook()` in [router/webhooks.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/router/webhooks.ts). The GC case is disambiguated by **`session.metadata.pipeline === "GROWTH_CREDITS"`** and fulfilled by the shared `fulfillGrowthCredits()` helper in the same file, which updates `gc_balances` and inserts a `gc_transactions` row of type `'purchased'`. It is called from **two** events so card and ACH cannot drift: `checkout.session.completed` **only when `payment_status === "paid"`** (card — an ACH session completes as `processing`), and `checkout.session.async_payment_succeeded` (ACH, on settlement). A `stripe_session_id` lookup makes it idempotent against Stripe's at-least-once retries.
7. Same Stripe webhook also handles MAP 1 payments, in a **separate `checkout.session.completed` branch** that matches `session.customer` against `pipeline_map1.stripe_customer_id` rather than reading metadata. The two flows share the webhook URL; what distinguishes them is the GC branch's `metadata.pipeline` check versus MAP 1's customer lookup.
