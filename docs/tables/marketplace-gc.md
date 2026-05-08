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
| `created_at` | timestamptz | default `now()` |

**Touched by:** `gc_load_services`, `gc_manage_service`. Frontend: [MemberGCMarketplace.jsx:40](src/components/member/MemberGCMarketplace.jsx).

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

---

## Stripe checkout flow for buying credits

`gc_create_checkout` ([vfo-admin-api/index.ts:2806](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):
1. Frontend ([MemberGCMarketplace.jsx:47](src/components/member/MemberGCMarketplace.jsx)) calls with `{member_number, amount, price}`.
2. Edge function creates a Stripe Checkout Session using `STRIPE_SECRET_KEY` (live only — sandbox not used in this path), passing `metadata: {member_number, credits: amount}` on the session.
3. Returns the Checkout URL; client redirects to Stripe.
4. After payment, Stripe sends `checkout.session.completed` to the signature-gated webhook in `vfo-admin-api/index.ts:222`. Lines 270-288 disambiguate the GC case by checking `session.metadata.member_number` + `session.metadata.credits`, then update `gc_balances` and insert a `gc_transactions` row of type `'purchased'`.
5. Same Stripe webhook also handles MAP1 payments (which are disambiguated by lacking those metadata fields and instead matching `session.customer` against `pipeline_map1.stripe_customer_id`). The two flows share the webhook URL; metadata routing is the only thing distinguishing them.
