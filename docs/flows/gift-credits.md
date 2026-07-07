# Gift Credits (GC) marketplace flow

A points-economy where members buy "Growth Credits" via Stripe and redeem them against a service catalog. The Stripe purchase → credit-balance update is handled in the same Stripe webhook that handles MAP1 payments — disambiguated by Checkout Session metadata.

## Trigger

Member opens [MemberPortal](src/pages/MemberPortal.jsx) → GC Marketplace tab → mounts [MemberGCMarketplace.jsx](src/components/member/MemberGCMarketplace.jsx).

## Flow A — Buying credits

### Step 1 — Initiate Stripe Checkout

**Handler:** `gc_create_checkout({member_number, amount, price})` ([MemberGCMarketplace.jsx:47](src/components/member/MemberGCMarketplace.jsx) → [admin-api:2806-2837](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Creates a Stripe Checkout Session:

```
mode: payment
success_url: https://vfoportal.com/?gc_success=1
cancel_url:  https://vfoportal.com/
line_items[0]:
  price_data.currency: usd
  price_data.unit_amount: <price * 100>
  price_data.product_data.name: "<amount> Growth Credits"
  quantity: 1
metadata.member_number: <member_number>
metadata.credits: <amount>
```

Returns the Checkout URL. Frontend redirects via `window.location.href`.

> **Note:** uses `STRIPE_SECRET_KEY` only — no sandbox path. GC purchases always go through live Stripe.

### Step 2 — Client pays on Stripe-hosted page

External to this codebase. Stripe redirects back to `success_url` after payment.

### Step 3 — Stripe webhook fulfills the purchase

**Handler:** Stripe webhook block at [admin-api:270-288](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) (gated by `stripe-signature` header).

On `event.type === "checkout.session.completed"` with `session.metadata.member_number` and `metadata.credits` set:
1. Reads existing `gc_balances.balance` (or 0).
2. UPSERTs `gc_balances` with `balance = current + credits`.
3. INSERTs `gc_transactions` row: `type='purchased'`, `amount=<credits>`, `balance_after=<new>`, `description="<credits> credits purchased via Stripe"`.

See [stripe-webhook.md](stripe-webhook.md#sub-branch-a1--gc-credit-purchase) for full handler detail.

**Tables written:** `gc_balances` (insert/update), `gc_transactions` (insert).
**Chains:** none.

## Flow B — Redeeming credits

### Step 1 — Browse services

**Handler:** `gc_load_services` ([MemberGCMarketplace.jsx:40](src/components/member/MemberGCMarketplace.jsx) → [admin-api:2660-2669](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Reads all `gc_services` rows.

### Step 2 — Initiate redemption

**Handler:** `gc_redeem({member_number, service_id})` ([MemberGCMarketplace.jsx:55](src/components/member/MemberGCMarketplace.jsx) → [admin-api:2723-2747](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Roughly:
1. Reads `gc_services` for `credit_cost`.
2. Reads `gc_balances` for current balance. Returns error if insufficient.
3. INSERTs `gc_redemptions` row with `status='pending'`, `credits=<credit_cost>`.
4. UPDATEs `gc_balances.balance` -= credit_cost.
5. INSERTs `gc_transactions` row: `type='redeemed'`, `amount=-credits`, `balance_after=<new>`.

**Tables read:** `gc_services`, `gc_balances`.
**Tables written:** `gc_redemptions`, `gc_balances`, `gc_transactions`.

### Step 3 — Admin processes redemption

**Handler:** `gc_update_redemption({redemption_id, status})` ([admin-api:2769-2789](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). UPDATEs `gc_redemptions.status`. Status values are application-defined (e.g., `'pending'`, `'fulfilled'`, `'rejected'`) — not DB-constrained.

If a redemption is rejected, there's **no automatic refund** of credits — would require a separate `gc_add_credits` call.

## Flow C — Admin manual credit adjustment

**Handler:** `gc_add_credits({member_number, amount, description})` ([MembersPanel.jsx:628](src/components/admin/MembersPanel.jsx) → [admin-api:2749-2767](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Updates `gc_balances` and inserts a `gc_transactions` row of `type='added'` (or similar — exact value set in admin-api code). Used to manually credit (or, with negative `amount`, debit) a member's balance.

In `ADMIN_ONLY_ACTIONS`. Member callers cannot.

## Flow D — Service catalog management

**Handler:** `gc_manage_service({mode, service})` ([admin-api:2791-2804](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Insert / update / delete on `gc_services`.

Admin-only.

## Tables touched (composite)

- **Read:** `gc_services`, `gc_balances`, `gc_transactions`, `gc_redemptions`.
- **Written:** `gc_balances` (upsert), `gc_transactions` (insert), `gc_redemptions` (insert/update), `gc_services` (insert/update/delete).

## Downstream chains

- Stripe purchase → Stripe webhook is the only chain trigger. The webhook is not chained to anything else (no email, no notification).

## Frontend touch-points

- [MemberGCMarketplace.jsx](src/components/member/MemberGCMarketplace.jsx) — member view. Calls `gc_load_balance`, `gc_load_transactions`, `gc_load_services`, `gc_create_checkout`, `gc_redeem`.
- [MembersPanel.jsx:615-628](src/components/admin/MembersPanel.jsx) — admin view per-member. Calls `gc_load_balance`, `gc_load_transactions`, `gc_load_redemptions`, `gc_add_credits`.

## Auth

- `gc_redeem` and `gc_add_credits` are NOT in `ADMIN_ONLY_ACTIONS`. `gc_create_checkout` IS in the admin-only list ([admin-api:2235](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

> **Inconsistency:** `gc_create_checkout` is admin-only but the frontend [MemberGCMarketplace.jsx:47](src/components/member/MemberGCMarketplace.jsx) calls it from a member-mounted component. **A member calling `gc_create_checkout` would currently get HTTP 403.** This means either:
> 1. The frontend has a broken purchase flow for members (admin-only error visible only at runtime), OR
> 2. The component is admin-mounted-only (but it's imported into MemberPortal at line 7 with `gc` tab routing)
>
> Worth investigating in actual runtime behavior. Flagged.

## Failure modes

1. **Purchase race** — between Step 2 (Stripe redirect) and Step 3 (webhook fulfillment), the member's balance reflects the old amount. The window is short but observable.
2. **Webhook idempotency** — Stripe's at-least-once delivery means a duplicate `checkout.session.completed` could double-credit. The handler does NOT check for prior fulfillment of the same `session.id`. Worth flagging.
3. **`gc_redeem` race** — the balance check + decrement are not in a DB transaction. Two concurrent redemptions could oversell. Probably benign at low volume.
4. **Rejected redemption with no refund** — admin must manually `gc_add_credits` to refund.

## Open questions

1. The admin-only gate on `gc_create_checkout` — see Auth note.
2. Webhook idempotency — confirm if Stripe's "delivery_attempt" header is being checked anywhere (it isn't in observed code).

## Cross-references

- Marketplace tables: [../tables/marketplace-gc.md](../tables/marketplace-gc.md)
- Stripe webhook handler detail: [stripe-webhook.md](stripe-webhook.md#sub-branch-a1--gc-credit-purchase)
- Stripe API: [../integrations/stripe.md](../integrations/stripe.md)
