# Edge functions

Two Supabase edge functions deployed to project `ejpsprsmhpufwogbmxjv`. Both are `Deno.serve`-style functions; both use the Supabase service-role key (so RLS is bypassed; auth is enforced application-side).

| Function | File | Live version | `verify_jwt` |
|---|---|---|---|
| `vfo-admin-api` | `C:\vfo-edge-functions\supabase\functions\vfo-admin-api\index.ts` (4964 lines, 246KB) | v194 | `false` (live registry) |
| `boldsign-webhook` | `C:\vfo-edge-functions\supabase\functions\boldsign-webhook\index.ts` (95 lines) | v23 | `false` (live registry) |

> **Discrepancy:** local `supabase/config.toml` declares `verify_jwt = true` for both, but the live registry returned `verify_jwt: false` from `list_edge_functions`. Both functions roll their own auth (admin-api via `admin_sessions` token in body; boldsign-webhook is public by design). The `config.toml` value is moot in practice.

---

## `vfo-admin-api` — overall shape

A single 4964-line `Deno.serve` handler that dispatches on `body.action`. It is **three** functions glued into one:

1. **Stripe webhook receiver** — gated by the `stripe-signature` HTTP header.
2. **BoldSign webhook receiver** — gated by `body.event?.eventType` shape.
3. **Action dispatcher** — every other request, switched on `body.action`.

### Top-of-file constants & helpers

| Symbol | Where | Purpose |
|---|---|---|
| `generateInvoiceHTML` / `generateReceiptHTML` | lines 4-141 | Inline HTML builders for invoice/receipt PDFs (used by `automation_CONTRACT_invoicereceipt`) |
| `ALLOWED_ORIGINS` | line 144 | CORS allowlist: `https://jlathamert.github.io`, `http://localhost:5173`, `http://localhost:5174`. Hardcoded — production frontend is at `https://jlathamert.github.io/vfo-portal/`. |
| `SUPERADMIN_EMAIL` | line 159 | Hardcoded `"jlatham@elitert.com"`. Drives `is_superadmin` flag in session, gates Admin Editor in [AdminPortal.jsx:205](src/pages/AdminPortal.jsx). |
| `getPfEmail()` | lines 161-168 | Hardcoded map of PF (Planning Facilitator) name → email. Three entries: Evan Anderson, Bridger Silvester, Lindsay Morris. |
| `generateToken()` | line 170 | 32-byte crypto-random hex — used for sessions, `c15_token`, `checkout_token`. |
| `json(data, status)` | line 182 | Response helper with CORS headers. |
| `hashPasscode()` | line 189 | **SHA-256, no salt** — used for `allowed_admins.passcode` and `member_logins.passcode`. (Migration `hash_passcodes_and_cleanup_sessions` introduced this.) |

### Request flow (top to bottom)

```
serve(req) ─┬─ OPTIONS  → 204 + CORS
            ├─ GET      → 200 "OK"
            ├─ stripe-signature header set → STRIPE WEBHOOK BLOCK (lines 222-441)
            ├─ body.event?.eventType set   → BOLDSIGN WEBHOOK BLOCK (lines 544-583)
            ├─ action === "admin_login" / "member_login" / "login"  (lines 454-537)
            ├─ public-token actions, NO session required:
            │     "automation_PCADMIN_finaldecision"   (line 586)
            │     "automation_CONTRACT_ceocountersign" (line 745, server-to-server)
            │     "automation_CONTRACT_stripecustomer" (line 861, server-to-server)
            │     "automation_CONTRACT_paymentemail"   (line 939, server-to-server)
            │     "automation_CONTRACT_loadpayment"    (line 1053, public token)
            │     "automation_CONTRACT_stripecheckout" (line 1086, public token)
            │     "automation_CONTRACT_stripewebhook"  (line 1156 — see note below)
            │     "automation_CONTRACT_revshare"       (line 1248, server-to-server)
            │     "automation_CONTRACT_confirmationemail" (line 1660, server-to-server)
            │     "automation_CONTRACT_invoicereceipt"  (line 1812, server-to-server)
            ├─ TOKEN AUTH GATE (line 2190) — every action below requires
            │  `body.token` to match a non-expired `admin_sessions` row
            ├─ ROLE DETECTION (line 2206) — looks up `allowed_admins.role`
            │  to determine `callerRole` ("admin" | "member") and `is_superadmin`
            ├─ ADMIN_ONLY_ACTIONS gate (line 2226) — array of ~50 action names;
            │  member callers get HTTP 403
            ├─ MEMBER_SCOPED_ACTIONS gate (line 2261) — for member callers,
            │  forces `body.member_number = callerMemberNumber`
            └─ Action dispatcher: ~110 `if (action === "X")` blocks
               (lines 2278-4959), with a final fallback at line 4962
```

### Key cross-cutting concerns

#### Stripe webhook (lines 222-441)

Triggered by presence of `stripe-signature` header. Verifies HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`, with a 5-minute timestamp tolerance.

Handles two event types:

- **`checkout.session.completed`** — handles two cases via metadata:
  1. **GC credit purchase** (line 270-288): metadata has `member_number` and `credits`. Increments `gc_balances`, inserts `gc_transactions` row.
  2. **MAP1 first payment** (line 290-392): looks up `pipeline_map1` row by `stripe_customer_id`. Expands `payment_intent` to extract `payment_method.type` (card vs us_bank_account) and `last4`. Sets `pay1_status` to `"succeeded"` (card) or `"processing"` (ACH). Computes `card_processing_fee` from `amount_received` vs `net_invoice / payment_count`. Writes quarterly schedule (`pay2/3/4_date` = +91/182/273 days).
     - **Chains:** `automation_CONTRACT_confirmationemail` (always), `automation_CONTRACT_invoicereceipt` (card only — ACH waits for `payment_intent.succeeded`).

- **`payment_intent.succeeded`** (line 394-438) — two cases:
  1. Quarterly subsequent payment (metadata `payment_number` is 2-4): sets `payN_status='succeeded'`, chains `automation_CONTRACT_invoicereceipt` for that payment number.
  2. ACH first-payment cleared (`pay1_status === "processing"`): flips to `"succeeded"`, chains `automation_CONTRACT_invoicereceipt` for payment 1.

#### BoldSign webhook (lines 544-583)

Triggered by `body.event.eventType` shape. Looks up `pipeline_map1` row by `boldsign_doc_id`.

- `eventType === "Completed"` → set both `c17_client_signed='Yes'` and `c18_ceo_signed='Yes'`.
- `eventType === "Signed"` with signer email matching CEO (`aanderson@elitert.com`, hardcoded) → set `c18_ceo_signed='Yes'`.
- `eventType === "Signed"` with any other signer → set `c17_client_signed='Yes'`.

> **Important:** This handler **does not chain** to any downstream action. The standalone `boldsign-webhook` function (below) does. It is unclear which one is the live BoldSign webhook target — the chained behavior only fires if BoldSign is calling the standalone function.

#### Token auth gate (line 2190)

Below this line, every action does:

1. Reads `body.token`. Returns 401 if missing.
2. Looks up `admin_sessions` row by token. Returns 401 if missing or `expires_at` is past (and deletes the expired row).
3. Detects role via `allowed_admins` row (admin) or falls back to `member` and looks up `member_logins.member_number`.

#### Admin-only and member-scoped action gates

`ADMIN_ONLY_ACTIONS` (line 2226) is a hardcoded array of ~50 action names. Member callers get 403 on any of these. **Note:** the list does not include every mutation action — e.g. `add_client_note`, `update_client_note`, `delete_client_note`, `gc_redeem`, and the entire `automation_PCADMIN_finaldecision` path (which is public-token anyway). Members can call these; whether that's intentional is undocumented.

`MEMBER_SCOPED_ACTIONS` (line 2261) is ~17 action names where the caller's `body.member_number` is *forcibly overwritten* with their own — preventing cross-tenant reads.

### Hardcoded constants worth knowing

| Value | Where | Purpose |
|---|---|---|
| `aanderson@elitert.com` | lines 568, 658, 725, 782, 912, 1590, 4270, 4511, 4725, 4912 | CEO signer + BCC on all automation emails |
| `platham@elitert.com` | lines 658, 1590, 4270, 4511, 4912 | BCC on automation emails |
| `tnmiller@elitert.com` | line 1626 | "Tracy" — recipient of `automation_CONTRACT_revshare` intro email on payment 1 |
| `tracy@vfo-services.com` | line 2104 | CC on `automation_CONTRACT_invoicereceipt` (separate address from above) |
| `aipc@vfo-services.com` | line 4916 | `From:` on `automation_CONTRACT_sendagreement` Gmail draft |
| `https://jlathamert.github.io/vfo-portal/pay?token=...` | line 980, 1119, 4237 | Pay-page redirect URL |
| `https://www.vfo-services.com/payment-successful/` | line 1120 | Stripe Checkout success URL |
| `MASTER_SHEET_ID = "1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0"` | line 1324 | Revenue Master Google Sheet — read by `automation_CONTRACT_revshare` |
| `BrandId = "f6b2e092-73a4-438e-b786-ebd20e472732"` | line 4765 | BoldSign brand for `automation_CONTRACT_sendagreement` |

### Possibly dead code

- **`automation_CONTRACT_stripewebhook`** (line 1156): triggered by `body.object === "event"` (line 540 sets `body.action` to this when seen). But the *actual* Stripe webhook is the `stripe-signature` block at line 222 — which always fires first. The line-1156 handler appears reachable only via a manual POST that forges `{object:"event"}` without setting the signature header; effectively dead in production. Worth flagging in flows doc.
- **Embedded BoldSign webhook handler** (line 544-583): does the database write but skips the downstream chain that the standalone `boldsign-webhook` function performs. Unclear which is the live webhook target.
- **Debug fetch** (line 2170): `automation_CONTRACT_invoicereceipt` fetches a hardcoded draft ID `"r-8771745882155742140"` to inspect message structure — looks like leftover dev debugging.

### Storage buckets referenced

- `headshots` (line 2387) — `upload_headshot`. Migration `lock_down_headshots_storage` indicates RLS-locked.
- `member-vault` (line 2654) — `vault_list`, `vault_upload`, `vault_delete`.

---

## `boldsign-webhook` — overall shape

A 95-line `Deno.serve` that handles BoldSign webhook POSTs.

```
POST → parse body → look up pipeline_map1 by boldsign_doc_id
  ├─ event.eventType === "Completed":
  │     UPDATE pipeline_map1 SET c17_client_signed='Yes', c18_ceo_signed='Yes'
  │     CHAIN: POST /vfo-admin-api action=automation_CONTRACT_stripecustomer
  └─ event.eventType === "Signed":
        ├─ signer == CEO (aanderson@elitert.com — hardcoded line 64):
        │     UPDATE pipeline_map1 SET c18_ceo_signed='Yes'
        └─ else (client):
              if c17_client_signed already 'Yes' → idempotent skip
              else UPDATE c17_client_signed='Yes'
                   CHAIN: POST /vfo-admin-api action=automation_CONTRACT_ceocountersign
```

The two functions write to identical columns. The standalone version is the only one that chains downstream (creating the Stripe customer + sending the CEO countersign email). If both are configured as BoldSign webhook targets, the second invocation would idempotent-skip but still chain; if only the embedded handler is configured, the chains never fire and `automation_CONTRACT_ceocountersign` / `_stripecustomer` would have to be invoked manually.

---

## How frontend talks to the edge function

[src/lib/api.js](src/lib/api.js) is the single client:

```js
const EDGE_URL = 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'
const ANON_KEY = '<hardcoded anon JWT>'

callApi(action, payload) →
  POST EDGE_URL
    headers: { Authorization: Bearer <ANON_KEY>, Content-Type: application/json }
    body:    { action, token: sessionStorage.vfo_session.token, ...payload }
  retry ×3 with 2s delay
  on 401: clearSession() + redirect to /vfo-portal/
```

The `Authorization: Bearer <ANON_KEY>` header satisfies Supabase's gateway-level requirement (since `verify_jwt: false` per registry, but the platform may still inspect it). The actual auth is the `token` field in the body, validated against `admin_sessions`.

Server-to-server chains (admin-api → admin-api) use `Authorization: Bearer <SERVICE_ROLE_KEY>` instead, and **do not** include the user's session token — they bypass the per-action auth gate by being routed before line 2190 (the public-action handlers). This is why `automation_CONTRACT_stripecustomer`, `_ceocountersign`, `_paymentemail`, `_revshare`, `_confirmationemail`, `_invoicereceipt` all sit *above* the auth gate in the file.

---

## Cross-references

- Action catalog with full table-touch + chain map: [05-api-action-catalog.md](05-api-action-catalog.md)
- Pipeline column dictionary: [../tables/pipeline.md](../tables/pipeline.md)
- Auth tables: [../tables/auth.md](../tables/auth.md)
- Integration deep-dives: [../integrations/](../integrations/) (forthcoming Phase D)
- End-to-end contract flow: [../flows/contract-and-payment.md](../flows/contract-and-payment.md) (forthcoming Phase E)
