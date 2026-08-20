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
  price_data.product_data.name: "<amount> Growth Credits - (<member_number>) <Member Name>"
  quantity: 1
payment_intent_data.description: <same memo as the product name>
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

**Handler:** `gc_load_services` ([MemberGCMarketplace.jsx:40](src/components/member/MemberGCMarketplace.jsx) → [actions/gc/load-services.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/gc/load-services.ts)). Reads all `gc_services` rows.

The payload splits by caller role. A **member** gets the active services with `allocated_admin_email` and `scheduling_link` stripped — the allocation is internal routing and the scheduling link reaches them in the confirmation email instead. An **admin** additionally gets `allocated_admin_name` resolved per service (email → `allowed_admins.name`) and a top-level `admins: [{name, email}]` list for the allocation dropdown.

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

Then two best-effort side effects, each in its own `try/catch` — neither may fail the redemption, since the credits are already spent:

6. **Bell** — `notifyByRule('GC_credits_spent')`. If the service has an `allocated_admin_email`, the bell goes to THAT person ("<Member> has redeemed Growth Credits for <Service>"). Only an unallocated service falls back to the historical routing: the member's assigned MSM, or the whole MSM team with an "assign an MSM" prompt if they have none. The rule's `ASSIGNED_MSM` dynamic token name is retained in all three branches because the `notification_rules` row still refers to it — under allocation it simply carries the allocated team member's address.
7. **Confirmation email** — [utils/gc-redemption-email.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/gc-redemption-email.ts) drafts pipeline `GROWTH_CREDITS` / template `GC_redemption_confirmation` to the member, CC the allocated team member (`TEAM_MEMBER` role token). Draft mode by default (`send_mode = false`) and sandbox-aware via `pipeline_sandbox_config` for `GROWTH_CREDITS`. Tokens: `[Member Name]`, `[Member First]`, `[Service Name]`, `[Credits Spent]` (singular / plural / "0 Growth Credits (free of charge)"), `[Team Member Name]` (falls back to "Our team" when unallocated, which also drops the CC), and `[MEETING_LINK_TEXT]` (the service's `scheduling_link` as a sentence + anchor, empty when there is no link or no allocation).

### Step 3 — Admin processes redemption

**Handler:** `gc_update_redemption({redemption_id, status})` ([admin-api:2769-2789](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). UPDATEs `gc_redemptions.status`. Status values are application-defined (e.g., `'pending'`, `'fulfilled'`, `'rejected'`) — not DB-constrained.

If a redemption is rejected, there's **no automatic refund** of credits — would require a separate `gc_add_credits` call.

## Flow C — Admin manual credit adjustment

**Handler:** `gc_add_credits({member_number, amount, description})` ([MembersPanel.jsx:628](src/components/admin/MembersPanel.jsx) → [admin-api:2749-2767](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Updates `gc_balances` and inserts a `gc_transactions` row of `type='added'` (or similar — exact value set in admin-api code). Used to manually credit (or, with negative `amount`, debit) a member's balance.

In `ADMIN_ONLY_ACTIONS`. Member callers cannot.

## Flow D — Service catalog management

**Handler:** `gc_manage_service({service_id?, name, credit_cost, description?, category?, active?, allocated_admin_email?, scheduling_link?})` ([actions/gc/manage-service.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/gc/manage-service.ts)). Flat fields, not a `{mode, service}` envelope. Insert or update on `gc_services`. `name` is required and `credit_cost` must be a finite number `>= 0` (0 is a legitimate cost — "Website Exploratory Meeting" is free).

**Delete branch:** `{service_id, mode: 'delete'}`. Runs before the name/cost validation (a delete carries neither), and requires only `service_id`. `gc_redemptions.service_id` is `ON DELETE NO ACTION`, so a service anyone has ever redeemed cannot be deleted — the handler catches Postgres `23503` and returns **400** "This service has redemption history — set it Inactive instead." Redemptions are never cascaded or deleted. The panel surfaces that message through its existing flash.

Also accepts the two allocation fields, on both insert and update: `allocated_admin_email` and `scheduling_link`. Both are trimmed, an empty string becomes `null`, and a non-null `allocated_admin_email` is rejected with a 400 unless it matches a row in `allowed_admins` — a typo here would silently orphan every redemption of the service. Edited in Automation & Config → Growth Credits ([GrowthCreditsPanel.jsx](src/components/admin/GrowthCreditsPanel.jsx)); the caller always sends the current values alongside whatever it is changing, so saving one field never wipes the others.

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
