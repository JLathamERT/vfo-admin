# Tax Planning flow (client_tax_plans)

The master flow for tax planning engagements. Originally built as the **Tax Priorities** track inside VFO Holistic Planning (program_id=1); since aligned to serve the standalone **VFO Tax Planning** program (program_id=4) byte-equivalently — same handlers, same DB shape, same chains. The only intentional difference is the **Set Up phase** that program_id=4 plans see at the top (program_id=1 plans skip it because Holistic clients arrive via MAP1 instead). Parallel to [contract-and-payment.md](contract-and-payment.md) (MAP1) but operating on `client_tax_plans` rows. Touches every integration: Stripe, BoldSign, Gmail, Google Drive, Supabase Storage.

The state machine is the column values on a single `client_tax_plans` row — see [../tables/tax.md](../tables/tax.md). Each step in this flow either updates the row or branches based on column values. `client_tax_plans.program_id` is set at plan creation by `tax_start_plan` (legacy rows pre-dating the column may be NULL — treated as Holistic for label purposes).

> **Program-aware client-visible labels** (added in the Tax Planning alignment session). The invoice/receipt PDF headers + footer, Stripe Checkout line items, the Stripe off-session implementation charge description, and the BoldSign agreement title all switch between "VFO Holistic Planning" (program_id=1 or NULL legacy) and "VFO Tax Planning" (program_id=4) via the `programLabel(programId)` helper in `utils/program-label.ts`. Internal-only labels (`notifications.pipeline='TAX'`, `email_templates.pipeline='TAX'`, sandbox-config `pipeline='TAX'`) stay program-agnostic — they're keys, not display names.

> **Session-3 redesign note (2026-05-19).** Steps 13 (Tax 4 Continue/Stop) and 14 (Tax 5 implementation) below describe the **original** Phase 6/7 designs where admin clicks fire money movement directly. Both have since been **redesigned** to mirror a unified pattern: admin picks a 3-option dropdown → for the affirmative pick, the client gets an email with a back-out button + 24h grace; for Undecided, the client gets a buttons-email with a 48h reminder + 96h PF-call-the-client admin notification; for the decline pick, the engagement closes immediately. Daily sweep (`tax-revshare-sweep-daily`) drives all timers. Same pattern was also added to Tax 3 (Undecided email reminder, agreement-signing reminder, payment-link reminder). For the canonical current behavior of these steps see [TAX_BUILD_RESUME.md](C:/vfo-edge-functions/.claude/worktrees/thirsty-gould-06a64e/TAX_BUILD_RESUME.md) Phase index and [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md) entries `automation_TAX_postreviewdecision`, `automation_TAX_postreviewclientdecision`, `automation_TAX_implementdecision`, `automation_TAX_implementfinaldecision`, `automation_TAX_revshare_sweep`. Notifications now carry a `dismissible` boolean — FYI notifications have a Done button; action-required ones (Tax 3 Yes → pricing form; Tax 3 ExtraMeeting → schedule meeting) clear only when admin completes the action.

## Lifecycle overview

```
Ready for Tax 3  →  Tax 3 Decision  →  /tax-decide      →  PCADMIN pricing  →  BoldSign agreement  →  Stripe customer  →  /tax-pay  →  Stripe payment  →  Confirmation + Invoice/Receipt  →  Tax 4 Continue/Stop  →  Implementation auto-charge
   (Tax 2)         (Yes / Und / No)    (Yes / No /         (after client            (client signs,        (after both                                       (Phase 6 — admin-driven)            (Phase 7 — auto on
                                          ExtraMeeting)        picks Yes)             then CEO)             signatures)                                                                              first specialist
                                                                                                                                                                                                       implementation)
```

Each arrow is either:
- A user clicking something in the admin UI (`callApi(...)`),
- A token-link landing page (raw fetch, no session),
- A webhook (Stripe / BoldSign), or
- A server-to-server chain (admin-api → admin-api with service-role or admin-token auth).

---

## Step 0 — Set Up phase (VFO Tax Planning program_id=4 only)

**Context:** standalone VFO Tax Planning clients pay a deposit BEFORE we even know they exist (typically via a public Stripe payment link, outside our system). Admin then creates the client record and binds them to the program. This phase has 3 tasks before the Tax 1 diagnostic begins. Holistic Tax Priorities (program_id=1) clients don't see this phase — they arrive via MAP1.

| Task | status_options | What it does |
|---|---|---|
| Deposit Paid | `tax_deposit_pi` | Text input. Admin pastes the Stripe PaymentIntent ID (`pi_...`) or a Stripe dashboard URL containing it. `tax_save_deposit_pi` extracts the last `pi_...` substring (defensive against paste-over), writes it to `client_tax_plans.deposit_payment_intent_id`, and marks the task `Completed`. |
| Tax Plan Greenlight | `tax_greenlight` | Two-button task: **Go** (proceed to Tax 1) or **Stop** (refund deposit + close engagement). |
| Refund Paid | `tax_refund` | Greyed unless Greenlight = Stop. "Send refund" button fires `automation_TAX_depositrefund` which: (1) fetches the PaymentIntent from Stripe to get the amount, (2) POSTs to `/v1/refunds` with `payment_intent=<saved pi_>`, (3) writes `deposit_refund_id`/`deposit_refund_amount`/`deposit_refund_date`/`deposit_refund_status='succeeded'`, (4) drafts a Gmail confirmation to the client, (5) inserts an admin notification with the Stripe refund id. |

**Handlers:** [`tax_save_deposit_pi`](../../supabase/functions/vfo-admin-api/actions/tax/save-deposit-pi.ts), [`automation_TAX_depositrefund`](../../supabase/functions/vfo-admin-api/actions/tax/deposit-refund.ts) — both AUTH (admin-only).

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`(pipeline=`TAX`).
**Tables written:** `client_tax_plans`(deposit_payment_intent_id, deposit_refund_*, deposit_refund_email_sent), `client_tax_progress` (Deposit Paid + Refund Paid status), `notifications`.
**External calls:** Stripe `GET /v1/payment_intents/<id>`, Stripe `POST /v1/refunds`, Gmail drafts API.

> **Greenlight = Go path is the normal lifecycle entry point** — flow continues to Step 1 below. The Setup phase is informational once Greenlight is set.

---

## Step 1 — Tax 3 Confirmation Email

**Trigger:** Admin clicks the `Tax 3 Confirmation Email` task (renamed from "Ready for Tax 3?") in Tax 2 phase ([TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx)). **3-button** decision (cloned from the MAP 1 PIP confirmation pattern): **Send email (with date)** → opens date/time/timezone inputs (`confirm_date`); **Send email – date not confirmed** (`confirm_no_date`); **No – Declined email** (`declined`) → opens the inline red-dashed `[DECLINE_REASON]` textarea, then Send.

**Handler:** [`automation_TAX_readyfortax3`](../../supabase/functions/vfo-admin-api/actions/tax/ready-for-tax3.ts) — AUTH handler.

**What it does:**
1. Validates `client_tax_plans` row exists (created earlier by `tax_start_plan`). (No longer hard-blocks on `ready_for_tax3_email_sent='Yes'` — re-sends are allowed.)
2. Loads `clients`, `members`, `pipeline_sandbox_config` (pipeline='TAX').
3. UPDATEs plan: `ready_for_tax3_decision`=`Yes` (confirm_*) / `No` (declined), `ready_for_tax3_email_sent='No'` initially, `sandbox`.
4. Loads `email_templates` row — `confirm_date`/`confirm_no_date` → `TAX_readyfortax3|Yes`; `declined` → `TAX_readyfortax3|No`.
5. Substitutes `[Client Name]`, `[Client First]`, `[Member Name]`, `[PF Name]`, plus **`[CLOSING]`** ("on \<date\> at \<time\> \<tz\>" / "in due course") on the Yes template and `[DECLINE_REASON]` on the No template.
6. Creates Gmail draft to client (CC member + PF; BCC `aanderson@elitert.com` + `platham@elitert.com`).
7. Flips `ready_for_tax3_email_sent='Yes'`.

**Tables read:** `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans` (update).
**External calls:** Google OAuth, Gmail drafts API.
**Chains:** none.

---

## Step 2 — Tax 3 — "Client tax planning decision"

**Trigger:** Admin opens the `Client tax planning decision` task in Tax 3 phase → fills `TaxDecisionForm` ([TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx)) → submits. The form submits in 2 API calls back-to-back: `tax_save_task` (writes the progress row with status `Completed - <decision>`) then `automation_TAX_decision`.

**Handler:** [`automation_TAX_decision`](../../supabase/functions/vfo-admin-api/actions/tax/decision.ts) — AUTH handler. Takes `tax_plan_id`, `decision` (Yes/Undecided/No), `form_data` (JSON).

> **Member signing & paying on behalf** (added this session, mirrors MAP 1 PIP-Follow-Up). The `TaxDecisionForm` carries a Yes/No "is the member signing & paying on the client's behalf?" question. When Yes, `automation_TAX_decision` writes `client_tax_plans.member_paying_on_behalf=true` (default false), and the flag **carries through Tax 3 → Tax 4 → Tax 5**. When true, every downstream email flips **To member / Cc client**, uses the **member email-template variant** (template_name + the suffix ` (member signing/paying on clients behalf)` — 22 member rows, `email_templates` ids 126–147), the **member is the BoldSign signer 1 and the Stripe customer/payer**, and invoice/receipt **"Bill To" = member**. 14 tax handlers branch on the flag: decision, send-agreement, stripe-customer, payment-email, confirmation-email, invoice-receipt, paidbycheck, final-decision, extra-meeting, postreview-decision, refund, implement-decision, implementation-receipt, charge-implementation; plus `revshare-sweep.ts` `sendReminderEmailUnified` (all 5 reminder types flip to the member template). **NOT changed:** `ceo-countersign` (always Anton), `revshare` (pays the member their share regardless of who paid), and the Setup-phase `deposit-refund` (the deposit predates the Tax 3 decision → always client-paid).

**What it does (branches by decision):**

### Decision = `Yes`

1. UPDATEs plan with pricing fields: `tax_decision`, `risk_mindset`, `retainer_amount`, `implementation_amount`, `total_fee`, `split_type`, `member_share`, `vfos_share`, `presentation_link`, `meeting_notes`, `extra_cc`, `sandbox`.
2. **Chains** `automation_TAX_sendagreement` — server-to-server via HTTP fetch + **admin auth token forwarded in body.token** (critical — see Step 4 chain auth note).

### Decision = `Undecided`

1. UPDATEs plan with: `tax_decision='Undecided'`, `potential_tax_savings`, `initial_retainer_quoted`, `tax_token` (32-byte hex generated if not already present), `presentation_link`, `meeting_notes`, `extra_cc`, `sandbox`.
2. Fetches the static **Tax Planning Engagement Agreement PDF** from Supabase Storage public URL `https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/tax-agreements/tax-planning.pdf` (no auth required). When `member_paying_on_behalf=true` it instead uses the member-paid variant `tax-agreements/tax-planning-member.pdf` (not yet uploaded by the user → code falls back to `tax-planning.pdf` if missing).
3. Loads `email_templates` row `'TAX_decision_undecided'`.
4. Builds `[BUTTONS]` HTML — 3 buttons (Yes / No / Extra Meeting) pointing to `https://jlathamert.github.io/vfo-portal/tax-decide?token=<tax_token>&decision=<choice>`. Same green/red/blue styling as MAP1's `[BUTTONS]`.
5. Substitutes `[Client Name]`, `[Client First]`, `[Meeting Attendees]` (= "[PF Name] and [Member Name]"), `[Member Name]`, `[PF Name]`, `[TAX_SAVINGS]`, `[INITIAL_RETAINER]`, `[BUTTONS]`, `[PRESENTATION_LINK]`.
6. Builds **multipart MIME** Gmail draft to client with the PDF attached as `Tax-Planning-Engagement-Agreement.pdf`.
   - MIME headers built without empty-string CC/BCC lines (see "MIME-empty-line bug" gotcha).
7. Flips `tax_decision_email_sent='Yes'` AND writes `tax_decision_email_sent_at=now()`. Both columns must be set together — the boolean-flag is the idempotency guard, the timestamp is the base for the 48h reminder + 96h PF-notification timers driven by `tax-revshare-sweep-daily`.

### Decision = `No`

1. UPDATEs plan with `tax_decision='No'`, `presentation_link`, `meeting_notes`, `extra_cc`, `sandbox`.
2. Loads template `'TAX_decision_decline'`.
3. Substitutes `[Client Name]`, `[Client First]`, `[Meeting Attendees]` (= "[PF Name] and [Member Name]"), `[Member Name]`, `[PF Name]`, `[PRESENTATION_LINK]` (clickable anchor, or "(no link provided)").
4. Creates Gmail draft to client.
5. Flips `tax_decision_email_sent='Yes'`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans`.
**External calls:** Supabase Storage public-URL fetch (Undecided only — PDF), Gmail drafts.
**Chains:** `automation_TAX_sendagreement` (Yes only).

> **Chain auth gotcha:** the chain forwards `body.token` (the admin session token from frontend `callApi`) in the chain body, NOT just the Authorization header. The frontend's `callApi` sends `Authorization: Bearer <SUPABASE_ANON_KEY>` and the admin session token in body.token — the auth gate reads token from the body. Forgetting this returns 401 from the chained handler.

---

## Step 3a — Client clicks decision button on `/tax-decide` (Undecided path only)

**Trigger:** Client receives the email, clicks one of the 3 buttons. Browser navigates to [TaxDecidePage.jsx](src/pages/TaxDecidePage.jsx) at `/tax-decide?token=<tax_token>&decision=Yes|No|ExtraMeeting`.

**Handler:** [`automation_TAX_finaldecision`](../../supabase/functions/vfo-admin-api/actions/tax/final-decision.ts) — PUBLIC handler (pre-auth), called via raw fetch from `/tax-decide`.

**What it does:**
1. Looks up plan by `tax_token`. If `tax_final_decision` already set, returns `existing_decision` (idempotent).
2. UPDATEs `tax_final_decision`.
3. Branches:
   - **`Yes`**: inserts `notifications` row (recipient='admin', pipeline='TAX', title `"X chose to proceed with tax planning"`, link to admin client detail). Admin must then complete pricing form.
   - **`ExtraMeeting`**: inserts `notifications` row (`"X requested extra meeting (tax)"`).
   - **`No`**: loads template `'TAX_decision_decline'`, drafts Gmail decline email to client. No notification.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans` (tax_final_decision), `notifications` (Yes/ExtraMeeting).
**Chains:** none — admin still needs to submit pricing / extrameeting outcome manually.

---

## Step 3b — PCADMIN pricing (Undecided → Yes path)

**Trigger:** After client picks Yes via `/tax-decide`, admin sees the notification, opens the client, in the AI PC Admin task (Tax 3) a pricing form auto-appears. Admin fills retainer/implementation/total/split/member/VFOS shares + risk mindset, submits.

**Handler:** [`automation_TAX_pricing`](../../supabase/functions/vfo-admin-api/actions/tax/pricing.ts) — AUTH handler.

**What it does:**
1. Validates `tax_final_decision='Yes'` AND `agreement_sent !== 'Yes'`.
2. Marks all unread admin notifications for this client as read (pipeline='TAX').
3. UPDATEs plan pricing fields.
4. **Chains** `automation_TAX_sendagreement` (admin token forwarded in body.token).

**Tables read:** `client_tax_plans`.
**Tables written:** `client_tax_plans`, `notifications.read=true`.
**Chains:** `automation_TAX_sendagreement`.

---

## Step 3c — PCADMIN extra meeting (Undecided → ExtraMeeting path)

**Trigger:** After client picks ExtraMeeting via `/tax-decide`, admin schedules + holds the meeting (manual), then in AI PC Admin task clicks **Yes — proceed with pricing** (opens pricing form) or **No — decline**.

**Handler:** [`automation_TAX_extrameeting`](../../supabase/functions/vfo-admin-api/actions/tax/extra-meeting.ts) — AUTH handler. Takes `outcome` (Yes/No) and `form_data` if Yes.

**What it does:**
- **Yes outcome:** UPDATEs `tax_via_extra_meeting=true` + all pricing fields. Clears unread notifications. **Chains** `automation_TAX_sendagreement`.
- **No outcome:** UPDATEs `tax_via_extra_meeting=true`, `tax_final_decision='No'` (overrides 'ExtraMeeting'). Drafts decline email (reuses `TAX_decision_decline` template). No chain.

**Tables written:** `client_tax_plans`, `notifications.read=true`.
**Chains:** `automation_TAX_sendagreement` (Yes only).

---

## Step 4 — Send agreement to BoldSign

**Trigger:** Server-to-server chain from `automation_TAX_decision` (Yes), `automation_TAX_pricing`, or `automation_TAX_extrameeting` (Yes outcome). NOT directly user-triggered.

**Handler:** [`automation_TAX_sendagreement`](../../supabase/functions/vfo-admin-api/actions/tax/send-agreement.ts) — AUTH handler.

**What it does:**
1. Validates `retainer_amount` is set and `agreement_sent !== 'Yes'`.
2. Loads `agreement_templates` row `(pipeline='TAX', service_level='Tax Planning', payment_plan='Single', active=true)` **plus `.eq("payer_type", memberPays ? "member" : "client")`** — REQUIRED now that two TAX rows exist (client id 8 + member id 20). The member row (id 20, BoldSign template `3e575f15-...`) has a `<!--MC-->...<!--/MC-->` member-contribution block that `send-agreement.ts` **strips at render** so the PDF matches the member field_map coordinates (captured from the stripped PDF). When `member_paying_on_behalf=true`, the **member is BoldSign signer 1** (CEO Anton still signer 2).
3. Renders HTML body with placeholder substitutions: `[CLIENT_NAME]`, `[CLIENT_EMAIL]`, `[TAX_RISK_MINDSET]`, `[TOTAL_FEE]`, `[RETAINER_PAYMENT]`, `[IMPLEMENTATION_FEE]`.
4. POSTs to `https://api.html2pdf.app/v1/generate` to produce PDF.
5. POSTs to `https://api.boldsign.com/v1/document/send` with `EnableSigningOrder=true`, `DisableEmails=true`, two signers (client first, CEO Anton second). Hardcoded `BrandId=f6b2e092-73a4-438e-b786-ebd20e472732`. Form fields built from `agreement_templates.field_map` (7 fields: addr+phone on page 1, ceoSig+ceoDate+clientSig+printName+clientDate on page 3 — coordinates user-supplied).
6. Polls `getEmbeddedSignLink` for client signer (5 retries × 5s).
7. UPDATEs plan: `agreement_sent='Yes'`, `boldsign_doc_id`, `client_signed='No'`, `ceo_signed='No'`, `signed_followup_sent_date=<today>`.
8. Loads template `'TAX_agreementsent|Yes'`, substitutes `[ENGAGEMENT]` with embedded sign-link `<a>` tag.
9. Creates Gmail draft to client (`From: VFO Services <aipc@vfo-services.com>`). CC member + PF + parsed `extra_cc`. BCC `aanderson` + `platham`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `agreement_templates`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans` (agreement_sent, boldsign_doc_id, client_signed, ceo_signed, signed_followup_sent_date).
**External calls:** html2pdf.app, BoldSign send + getEmbeddedSignLink, Google OAuth + Gmail drafts.
**Chains:** none — waits for BoldSign webhook.

> **Sandbox config gotcha:** sendagreement reads `pipeline_sandbox_config` for `pipeline='TAX'`. **Without a TAX row, it defaults to live mode** and creates the BoldSign doc in the live BoldSign account where webhooks aren't configured (MAP1's webhooks live on the sandbox account). Result: doc creates, signing works, BUT webhooks never fire. Fix is `INSERT INTO pipeline_sandbox_config ('TAX', sandbox_mode=true, sandbox_email='jlatham@elitert.com', ...)` matching MAP1's sandbox row.

---

## Step 5 — Client signs in BoldSign

**Trigger:** Client opens the Gmail draft (after admin reviews + sends), clicks the embedded sign link, signs in the BoldSign-hosted iframe.

**Handlers:** Both webhook surfaces have tax routing — `boldsign-webhook` standalone function AND `vfo-admin-api/router/webhooks.ts:maybeHandleBoldSignWebhook` (embedded). The standalone is the live URL per BoldSign sandbox dashboard config: `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/boldsign-webhook`. Either handler works — both have tax routing.

**Both handlers:**
1. Receive `event.eventType='Signed'` with the client's signer info.
2. Try `pipeline_map1` lookup first (existing MAP1 logic untouched).
3. If MAP1 miss, fall back to `client_tax_plans` lookup by `boldsign_doc_id`.
4. If `client_signed === 'Yes'` already, idempotent skip.
5. UPDATEs `client_signed='Yes'`.
6. **Chains** `automation_TAX_ceocountersign` via service-role auth.

**Tables written:** `client_tax_plans.client_signed='Yes'`.
**Chains:** `automation_TAX_ceocountersign`.

> **JWT-verification gotcha:** `boldsign-webhook` MUST be deployed with `--no-verify-jwt` flag, AND `config.toml` must have `verify_jwt = false` for `[functions.boldsign-webhook]`. Without these BoldSign gets 401 silently. The CLI deploy default ENABLES JWT verification — easy regression.

---

## Step 6 — CEO countersign email

**Trigger:** Server-to-server chain from BoldSign webhook (after client signed).

**Handler:** [`automation_TAX_ceocountersign`](../../supabase/functions/vfo-admin-api/actions/tax/ceo-countersign.ts) — PUBLIC handler (service-role auth from webhook).

**What it does:**
1. Validates `boldsign_doc_id` exists, `ceo_signed !== 'Yes'`.
2. Polls BoldSign `getEmbeddedSignLink` for `aanderson@elitert.com` (3 retries × 2s).
3. Loads template `'TAX_ceocountersign|Yes'`.
4. Substitutes `[Client Name]`, `[Total Fee]`, `[SIGNING_LINK]`.
5. Creates Gmail draft to CEO with embedded sign link.

**Chains:** none — waits for CEO to sign.

---

## Step 7 — CEO signs in BoldSign

**Trigger:** CEO opens the Gmail draft (after admin sends), clicks the sign link, signs.

BoldSign fires `event.eventType='Signed'` with CEO email AND eventually `event.eventType='Completed'` once both signers are done.

**Handlers (both webhook surfaces):**
- On `Signed` with CEO email → UPDATE `ceo_signed='Yes'`. No chain (single-signed event).
- On `Completed` → UPDATE both `client_signed='Yes'` and `ceo_signed='Yes'` (idempotent re-set). **Chains** `automation_TAX_stripecustomer`.

> **Sandbox email collision:** in sandbox mode, both client + CEO BoldSign signers get the same `sandbox_email` (override). The webhook's `signerEmail === ceoEmail` check fails (both look like the client). Doesn't matter because the `Completed` event sets both flags + fires the chain regardless.

---

## Step 8 — Create Stripe customer + send payment email

**Trigger:** Server-to-server chain from BoldSign webhook (Completed event).

**Handler:** [`automation_TAX_stripecustomer`](../../supabase/functions/vfo-admin-api/actions/tax/stripe-customer.ts) — PUBLIC handler (service-role from webhook).

**What it does:**
1. Validates plan exists. If `stripe_customer_id` already set, idempotent return.
2. POSTs to `https://api.stripe.com/v1/customers` with `email`, `name`, `metadata[tax_plan_id]`, `metadata[client_id]`, `metadata[pipeline]='TAX'`.
3. UPDATEs `client_tax_plans.stripe_customer_id`.
4. Generates 32-byte `checkout_token` (hex), UPDATEs `client_tax_plans.checkout_token`.
5. **Chains** `automation_TAX_paymentemail`.

**Then:** [`automation_TAX_paymentemail`](../../supabase/functions/vfo-admin-api/actions/tax/payment-email.ts):
1. Loads template `'TAX_paymentemail|Yes'`.
2. Substitutes `[PAYMENT_LINK]` with `<a href="https://jlathamert.github.io/vfo-portal/tax-pay?token=<checkout_token>">Complete Payment</a>`.
3. Creates Gmail draft to client (To: client only — no CC/BCC, matching MAP1).

**Tables written:** `client_tax_plans.stripe_customer_id`, `.checkout_token`.
**External calls:** Stripe customers create, Google OAuth + Gmail drafts.

> **Stripe customer is per-tax-plan, NOT reused from MAP1.** Even if the same client has an existing `pipeline_map1.stripe_customer_id`, tax creates a fresh customer. Design choice — keeps tax payment isolated from MAP1.

---

## Step 9 — Client pays on `/tax-pay` page

**Trigger:** Client opens the Gmail draft (after admin sends), clicks Complete Payment button. Lands on [TaxPayPage.jsx](src/pages/TaxPayPage.jsx) at `/tax-pay?token=<checkout_token>`.

**Handlers (raw fetch, no session):**

1. [`automation_TAX_loadpayment`](../../supabase/functions/vfo-admin-api/actions/tax/load-payment.ts) — looks up plan by `checkout_token`, returns `client_name`, `pipeline='TAX'`, `payment_label='Tax Planning Retainer'`, `payment_amount=retainer_amount`, `payment_x='1'`, `payment_y='1'`.
2. Client picks ACH or Card → [`automation_TAX_stripecheckout`](../../supabase/functions/vfo-admin-api/actions/tax/stripe-checkout.ts) creates Stripe Checkout Session with `customer=<stripe_customer_id>`, single line item, `metadata.tax_plan_id`, `metadata.client_id`, `metadata.checkout_token`, `metadata.pipeline='TAX'`. **Two branches by plan state**:
   - **Retainer (initial):** `retainer_status` IS NULL → amount=`retainer_amount`, product name "Retainer", `metadata.payment_kind='retainer'`, includes `payment_intent_data[setup_future_usage]=off_session` so the card is saved for the later off-session implementation charge.
   - **Implementation retry:** `retainer_status='succeeded'` AND `implementation_charge_status IN (declined, auth_required, manual_required)` → amount=`implementation_amount`, product name "Implementation Fee", `metadata.payment_kind='implementation'`, **no** `setup_future_usage`. Same `/tax-pay` page + same `checkout_token`, but the page's loadpayment + this handler both branch on plan state. Used by the Phase 7 charge-implementation failure-recovery flow (saved-card off-session charge failed → fresh checkout_token regenerated → client gets a new `/tax-pay` Gmail draft).
   - Any other resolved state → `"Payment already completed"` 400 error.

   Returns Stripe URL.
3. Client redirected to Stripe → enters payment → Stripe charges → Stripe redirects to `https://www.vfo-services.com/payment-successful/` (leaves SPA).

**Chains:** none — waits for Stripe webhook.

---

## Step 10 — Stripe webhook fires

**Trigger:** Stripe sends `checkout.session.completed` to admin-api with `stripe-signature` header. See [stripe-webhook.md](stripe-webhook.md) for full dispatch.

**Tax retainer payment** ([webhooks.ts](../../supabase/functions/vfo-admin-api/router/webhooks.ts) — extension AFTER MAP1's logic):
1. Looks up `pipeline_map1` by `stripe_customer_id` (MAP1 logic).
2. If MAP1 miss, looks up `client_tax_plans` by `stripe_customer_id`.
3. Expands the PaymentIntent to get `payment_method.type` and `last4`.
4. UPDATEs `retainer_status` (`succeeded` for card, `processing` for ACH), `payment_method_type`, `acct_last4`, `card_processing_fee`, `retainer_date`, `retainer_payment_intent_id`. Sets `retainer_confirmation_status='Confirmation Needed'`.
5. **Chains** `automation_TAX_confirmationemail` always.
6. **Chains** `automation_TAX_invoicereceipt` for card only — ACH waits.

**For ACH retainer cleared** (subsequent `payment_intent.succeeded` with `metadata.payment_kind='retainer'` and `retainer_status='processing'`):
- UPDATEs `retainer_status='succeeded'`, **chains** `automation_TAX_invoicereceipt`.

> **No revshare chain on Stripe webhook for tax.** Tax retainer revshare is gated by the Tax 4 Continue path — admin records `post_review_decision='Continue - Revenue Share'`, then revshare fires when either (a) client clicks the green "Continue now" button in the post-review email (`post_review_client_decision='Confirmed'`), or (b) the 24h grace expires and the sweep auto-locks (`post_review_client_decision='Auto-Locked'`). MAP1 auto-chains revshare on payment; tax does not.

---

## Step 10⅔ — Check-payment branch (parallel to Step 10)

Some clients prefer to pay by physical check. Admin uses the **Tax Automation Panel** (Automation tab → "Holistic Planning - Tax Planning") to manage this:

### "Pay via check" button

Visible when `checkout_token IS NOT NULL` AND `retainer_status IS NULL`.

**Handler:** [`automation_TAX_paidbycheck`](../../supabase/functions/vfo-admin-api/actions/tax/paidbycheck.ts) — admin-only.

**What it does:**
1. Sets `payment_method_type='check'`, `retainer_status='check_pending'`, `retainer_date=CURRENT_DATE`.
2. Drafts a Gmail to the client with the check mailing address (template `TAX_paidbycheck|check`). Mailing address: `12636 High Bluff Drive, Suite 400, San Diego, CA 92130`. Sandbox-aware. Non-fatal — if Gmail fails, DB state still reflects check path.

**Side effect:** the `automation_TAX_stripecheckout` rejects "Payment already completed" when `retainer_status` is truthy. `/tax-pay` link is auto-blocked.

### "Mark check cleared" button

Visible when `payment_method_type='check'` AND `retainer_status='check_pending'`.

**Handler:** [`automation_TAX_checkcleared`](../../supabase/functions/vfo-admin-api/actions/tax/checkcleared.ts) — admin-only.

**What it does:**
1. Sets `retainer_status='succeeded'`, `retainer_confirmation_status='Confirmation Needed'`.
2. **Chains** `automation_TAX_confirmationemail` (uses `TAX_confirmationemail|check` template — `[PROCESSING_TIME]` substituted to "Your check has been received and cleared.")
3. **Chains** `automation_TAX_invoicereceipt`.
4. No revshare chain — handled by Phase 6 admin button.

---

## Step 11 — Confirmation email

**Trigger:** Server-to-server chain from Stripe webhook OR `automation_TAX_checkcleared`.

**Handler:** [`automation_TAX_confirmationemail`](../../supabase/functions/vfo-admin-api/actions/tax/confirmation-email.ts) — PUBLIC handler.

**What it does:**
1. Validates `retainer_confirmation_status !== 'Sent'` (idempotent).
2. Loads template `'TAX_confirmationemail|card'`, `'|ach'`, or `'|check'` based on `payment_method_type`.
3. Substitutes `[Client Name]`, `[Client First]`, `[Payment Amount]`, `[CARD_FEE_TEXT]` (card only — `<br><br>A card processing fee of $X.XX (2.9% + $0.30) was applied. Total amount charged: $Y.YY.`; empty for ACH/check), `[PROCESSING_TIME]` (card: "processed immediately...", ACH: "2-4 business days...", check: "Your check has been received and cleared.").
4. Creates Gmail draft to client (no CC/BCC — same as MAP1's confirmation email pattern).
5. UPDATEs `retainer_confirmation_status='Sent'`.

**Chains:** none.

---

## Step 12 — Invoice & receipt PDFs + Drive + email

**Trigger:** Server-to-server chain from Stripe webhook (card immediately; ACH after `payment_intent.succeeded`) OR `automation_TAX_checkcleared`.

**Handler:** [`automation_TAX_invoicereceipt`](../../supabase/functions/vfo-admin-api/actions/tax/invoice-receipt.ts) — PUBLIC handler.

**What it does:**
1. **Idempotent** on `retainer_receipt_status='Sent'`.
2. **Generates document numbers** from `document_numbers` table count. `INV-<client_ref>-<seq>` and `REC-<client_ref>-<seq>`. Updates `retainer_invoice_number` and `retainer_receipt_number` on the plan. (Same not-serialized concurrency caveat as MAP1.)
3. **Renders HTML** via inline `generateTaxInvoiceHTML()` and `generateTaxReceiptHTML()` (defined in [invoice-receipt.ts](../../supabase/functions/vfo-admin-api/actions/tax/invoice-receipt.ts) itself, not extracted to utils).
   - **Invoice** shows: VFO Tax Planning header, client info, engagement details (service: "Tax Planning Engagement", payment method), payment schedule table with TWO rows: Retainer (50% — paid today, ✓ Paid) + Implementation Fee (50% — Scheduled, due on first specialist implementation). For card, an extra "Total Charged for Retainer" row including card processing fee, with the ✓ Paid badge moved there (not on the base retainer row — single Paid badge per fee group).
   - **Receipt** shows: green header, payment received line, payment details (invoice ref, service, payment method, date), amount received card, card fee breakdown if applicable, note about implementation fee being charged separately.
4. **Generates PDFs** via two POST calls to `https://api.html2pdf.app/v1/generate`.
5. **Uploads to Google Drive**: finds or creates a per-client folder named `<first> <last> - <client_ref>` under `GOOGLE_DRIVE_FOLDER_ID`. Uploads both PDFs as multipart, retrieves file IDs.
6. UPDATEs `retainer_invoice_drive_id` and `retainer_receipt_drive_id`.
7. Loads template `'TAX_invoicereceipt_email|retainer'`.
8. Re-fetches the PDFs from Drive (`?alt=media`) as base64.
9. Builds **multipart MIME** Gmail draft with both PDFs attached. CC member + PF + `tracy@vfo-services.com`. **Critical: CC/BCC lines only pushed if non-empty — empty strings in the headers array breaks Gmail parsing (first empty line is the body separator).**
10. UPDATEs `retainer_invoice_email_sent=true`, `retainer_receipt_status='Sent'`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`, `document_numbers`.
**Tables written:** `document_numbers` (insert), `client_tax_plans` (numbers + drive IDs + email_sent + receipt_status).
**External calls:** html2pdf.app ×2, Google OAuth, Drive search/create/upload/download, Gmail drafts (multipart).
**Chains:** none — Phase 6 (revshare/refund) is admin-button-driven.

---

## Step 12½ — Tax 4 High Level Meeting Confirmation Email + in-app reminder to Tim & Tracy

**Trigger:** Admin opens the **"High Level Meeting Confirmation Email"** task at the top of the `Tax 4 - Tax Plan Review` phase (replaces the old "Date Scheduled for High Level Meeting" date-picker task). The task lives in `program_client_tasks` ids **153 + 154** (both tax programs — Holistic Planning phase 21 + standalone Tax Planning phase 29) with `task_order=0` (above `Detailed tax plan presentation`); `status_options` is now `tax_hlm_confirm` (was `tax_meeting_date`). The task renders a single green **"Send email (with date)"** button plus date (required) / time / timezone pickers.

**Handler:** [`automation_TAX_highlevelmeeting_confirm`](../../supabase/functions/vfo-admin-api/actions/tax/highlevel-meeting-confirm.ts) — AUTH admin-only (registered in `router/dispatch.ts`). Takes `tax_plan_id` + `meeting_date` (required) + optional `meeting_time` / `meeting_timezone`.

**What it does:**
1. Loads the new template `TAX_highlevelmeeting_confirm|Yes` (id 148, **CLIENT-ONLY** — no member variant; body references "our Advanced Tax Planner, Tim Gacsy").
2. Drafts a Gmail confirmation to the client.
3. Records `client_tax_plans.tax4_meeting_date` + new columns `tax4_meeting_time` / `tax4_meeting_timezone` + `tax4_meeting_confirm_email_sent_at`.
4. **Nulls `tax4_meeting_reminder_last_sent_at`** so the in-app reminder (below) fires fresh.

> The old `automation_TAX_save_meeting_date` handler is now orphaned (its frontend caller was removed) but still registered. The template `TAX_meeting_nudge|Yes` is an unused orphan left in the DB.

**In-app reminder (replaced the old daily Gmail-to-Tim nudge):** the `tax-revshare-sweep-daily` cron (02:30 UTC) now raises **ONE persistent action-required in-app notification** (`dismissible:false`) — title `Client decision 1 needed — <client>` — to BOTH **tgacsy@elitert.com** (Tim) and **tnmiller@elitert.com** (Tracy), when `tax4_meeting_date < today` AND `post_review_decision IS NULL`. Fired once per plan, guarded by `tax4_meeting_reminder_last_sent_at`. (The old `sendMeetingNudgeEmail` function that drafted a daily Gmail to Tim CC Tracy is **DELETED**.)

**Cleared by:** `actions/tax/postreview-decision.ts` clears both notifications (`.ilike("title","Client decision 1 needed%")`) when any Tax 4 `Client decision 1` is recorded.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`(`TAX_highlevelmeeting_confirm\|Yes`).
**Tables written:** `client_tax_plans` (`tax4_meeting_date`, `tax4_meeting_time`, `tax4_meeting_timezone`, `tax4_meeting_confirm_email_sent_at`, `tax4_meeting_reminder_last_sent_at` nulled via handler; reminder timestamp set via sweep), `notifications` (sweep insert; postreview-decision clear).
**External calls:** Google OAuth + Gmail drafts API.
**Chains:** none. Tim/Tracy click the Tax 4 `Client decision 1` dropdown (which clears the notification) to advance to Step 13.

> **Audit-date UX**: all tax-tab task date inputs were converted to read-only `Mar 15, 2026`-style small text spans during the earlier redesign. The completed_date still auto-populates from `tax_save_task` on first save; the inline back-date input was removed.

> **Login redirect bonus**: as part of this work, `AdminLogin.jsx` now reads a `?next=` query param post-login and navigates there instead of `/admin`. `ClientDetail.jsx` and `AdminPortal.jsx` set `?next=` when bouncing unauthenticated users to login. So clicking the email link from a fresh browser session → login → land directly on the client Tax tab (no manual navigation needed).

---

## Step 13 — Tax 4 Continue/Undecided/Stop

**Trigger:** After Tax Plan Review meeting (Tax 4 phase, manual), admin picks one of the 3-option `Client decision 1` values. Picks `automation_TAX_postreviewdecision` which sends the appropriate client email:

- **`Continue - Revenue Share`** → drafts client email with **two buttons**: green "Continue now" (skip the 24h wait → immediate revshare, writes `post_review_client_decision='Confirmed'`) + red "Refund my retainer" (fires refund chain). If 24h passes with no click → sweep auto-locks (`post_review_client_decision='Auto-Locked'`) and fires revshare.
- **`Undecided`** → drafts client email with green "Proceed with planning" + red "Refund my retainer". 48h sweep reminder + 96h PF notification if neither clicked. Client Proceed click writes `post_review_client_decision='Proceed'` and fires revshare; client Refund click fires refund.
- **`Stop - Refund`** → no client email; immediately chains `automation_TAX_refund` server-to-server. Engagement closes.

Revshare + refund handler details follow below. The `tax-revshare-sweep-daily` cron (02:30 UTC) drives the 24h Continue auto-lock + 48h/96h Undecided timers.

### Revenue Share path

**Handler:** [`automation_TAX_revshare`](../../supabase/functions/vfo-admin-api/actions/tax/revshare.ts) — PUBLIC handler. Takes `tax_plan_id` + `payment_kind` (`'retainer'` | `'implementation'`). Mirrors MAP1's `automation_CONTRACT_revshare` with column-family branching by `payment_kind`.

**Frontend:** Tax 4 `Client decision 1` Continue button at [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx) `saveTask` → `callApi('automation_TAX_revshare', { tax_plan_id, payment_kind: 'retainer' })` → derived-status write to `Revenue share for initial 50%` subtask progress row (`Completed - Revenue Share` | `Completed - Money Mapping` | `Completed - N/A` | `Failed` | `Pending`).

**What it does:**
1. Validates plan + receipt number exists, idempotent skip if `rev_paid` already resolved (`Yes`/`Money Mapping`/`N/A — No Share Due`).
2. Sets `[revShareKey]='Pending'` upfront.
3. Reads Tracy's Revenue Master sheet (`1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0`, Home Page A1:I200), finds client_ref in col A, extracts batch sheet hyperlink from col I.
4. Walks batch sheet tabs, picks one whose name contains `client_ref` + a 4-digit year + NOT "account".
5. Reads tab G7:O200, looks for row where col I = receipt number AND col J within $0.01 of expected payment AND K+L+M+N+O sums to col J. Side-scans for "Member Contribution" row in col G.
6. On no batch sheet / no tab / no matching row → returns `{ pending: true, reason: "..." }`. Daily sweep retries (Phase 6c).
7. On verified: computes `shareAmount` from `member_share` (>100 = flat dollar split in half across retainer/implementation; ≤100 = % of current payment). Applies member contribution on retainer only (`member_contrib_status='Applied'`).
8. If `member.revenue_decision==='Money Mapping'` → no transfer, `rev_paid='Money Mapping'`.
9. Else if `shareAmount > 0` AND `member.stripe_account_id` set → Stripe POST `/v1/transfers` with `amount`, `currency=usd`, `destination=stripe_account_id`, `description='VFO Revenue Share — <ref> Tax <Retainer|Implementation>'`.
10. On Stripe success → `rev_paid='Yes'`; on Stripe error → `rev_paid='Failed'`, no email, sweep retries.
11. On `Yes` or `Money Mapping`: drafts Gmail to member (CC: PF email; BCC: aanderson + platham; sandbox redirects To: jlatham@elitert.com). Subject `VFO Services - Revenue Share Confirmation - <member>: <client> (<ref>) - Tax <Retainer Fee | Implementation Fee>`. Body shows payment details, green "received" badge, remaining implementation line (retainer only) or "final payment" line (implementation), blue rev-share box. Sets `[revEmailKey]=true`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, Tracy's Master sheet, client batch sheet.
**Tables written:** `client_tax_plans.retainer_rev_share` / `.implementation_rev_share`, `.retainer_rev_paid` / `.implementation_rev_paid`, `.retainer_rev_email_sent` / `.implementation_rev_email_sent`, `member_contrib_status='Applied'` (retainer only).
**External calls:** Google Sheets read ×2, Stripe POST /v1/transfers, Gmail drafts.

> **Adaptations from MAP1:**
> - Single handler with `payment_kind` param vs MAP1's `payment_number` (1-4)
> - No quarterly schedule block (tax has 2 payments max — replaced with single "implementation pending" line on retainer email)
> - No Tracy intro email (`c24_email_sent` equivalent skipped — Tracy already CC'd on `automation_TAX_invoicereceipt`)
> - `member_share` flat-dollar values split in half across retainer/implementation rather than quartered

> **Gotcha:** `members.stripe_account_id` must point to a Connect account with `transfers` capability ACTIVE. Failed transfers return `rev_paid='Failed'`; the actual Stripe error body is logged via `console.error` but NOT surfaced by `get_logs` MCP — diagnose via `dashboard.stripe.com/test/events`. Fix is to update the member row; no handler change needed.

### Refund path

**Handler:** [`automation_TAX_refund`](../../supabase/functions/vfo-admin-api/actions/tax/refund.ts) — AUTH admin-only handler (`ADMIN_ONLY_ACTIONS`).

**Frontend:** Tax 4 `Stop - Refund` button at [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx) — `window.confirm()` guard → `saveTask` decision1 row → `callApi('automation_TAX_refund', { tax_plan_id })` → derived-status write to `Refund initial 50%` subtask (`'Completed - Refunded'`). Alerts surface error / email-failure / idempotent skip.

**What it does:**
1. Loads `client_tax_plans` row by `tax_plan_id`. Idempotent skip if `refund_status='succeeded'` → returns existing `refund_id`.
2. **Hard guard #1**: if `retainer_payment_intent_id IS NULL` → 400. Message branches on `payment_method_type==='check'` (check payments must be refunded manually via finance — no Stripe PI to refund against).
3. **Hard guard #2**: if `retainer_rev_paid='Yes'` → 400 with "Revenue share already paid to member — refunding now would leak funds. Reverse the Stripe Connect transfer first, clear retainer_rev_paid, then re-try."
4. Validates `retainer_amount > 0`. Reads `pipeline_sandbox_config.pipeline='TAX'` to pick Stripe key.
5. POSTs to `https://api.stripe.com/v1/refunds` with `payment_intent=retainer_payment_intent_id`, `amount=retainer_amount * 100` (BASE only — no card-fee gross-up), `reason=requested_by_customer`, `metadata[tax_plan_id]`, `metadata[client_id]`, `metadata[pipeline]='TAX'`, `metadata[refund_kind]='retainer_full'`.
6. On Stripe failure → updates `refund_status='failed'`, returns 502 with `stripe_error_code` + error message. No email, no other state change.
7. On Stripe success → UPDATEs plan: `refund_status='succeeded'`, `refund_id=<re_…>`, `refund_amount=<base>`, `refund_date=CURRENT_DATE`, `post_review_decision='Stop - Refund'`.
8. Drafts Gmail to client (template `TAX_refund_email|Yes`). Substitutions: `[Client Name]`, `[Client First]`, `[Payment Amount]` (BASE retainer formatted as `$X,XXX.XX`). Recipients: To: client (sandbox redirects); CC: none; BCC: aanderson+platham (sandbox drops). Sets `refund_email_sent=true`. Non-fatal on email error — returns `email_drafted=false` with reason but DB refund state stays succeeded.

**Tables read:** `client_tax_plans`, `clients`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans`(refund_status, refund_id, refund_amount, refund_date, refund_email_sent, post_review_decision).
**External calls:** Stripe POST /v1/refunds, Google OAuth + Gmail drafts.
**Chains:** none.

> **Card-fee design:** Client absorbs the Stripe processing fee on a refund. The retainer charge was `retainer_amount + card_processing_fee`; the refund is only `retainer_amount`. This is intentional per the engagement guarantee.

> **Guard ordering matters:** Check-guard fires first, then rev-paid guard. If both apply (check payment AND rev_paid='Yes' which shouldn't happen in practice), check error is the surfaced one. Update guard order if business rules change.

### Sweep extension

**Handler:** [`automation_TAX_revshare_sweep`](../../supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) — PUBLIC handler with service-role auth required (`Bearer SUPABASE_SERVICE_ROLE_KEY` in Authorization header; non-service-role → 401).

**Cron:** Daily pg_cron job `tax-revshare-sweep-daily` at **02:30 UTC** — between MAP1's `revshare-sweep-daily` (02:00) and `chargescheduled-sweep-daily` (03:00) to avoid races on shared rows. Install script at [supabase/cron/tax-revshare-sweep.sql](../../supabase/cron/tax-revshare-sweep.sql). Uses the `sb_secret_*` API key (NOT the legacy `eyJ` JWT — per gotcha #1).

**What it does:**
1. Validates Authorization header matches `SUPABASE_SERVICE_ROLE_KEY` (401 otherwise).
2. Enumerates `client_tax_plans` for both `retainer_*` and `implementation_*` payment kinds (Phase 7 future-proof — implementation_* rows currently never match since Phase 7 hasn't shipped).
3. Candidate = receipt_number IS NOT NULL AND (`rev_share='Pending'` OR `rev_paid='Failed'`). **Retry-only**: plans where revshare was never started are NOT picked up — they must wait for their natural trigger (Tax 4 Continue 24h auto-lock OR Undecided→Proceed/Confirmed client click) to set `Pending` first. This gate was added to prevent revshare from auto-firing on a paid plan as soon as Tracy's sheet was populated, bypassing the Tax 4 admin decision entirely.
4. For each candidate: POSTs to `automation_TAX_revshare` with `tax_plan_id` + `payment_kind` + service-role auth. Logs the fire reason (`still-pending` / `retry-failed`).
5. Returns `{ ok: true, swept: <count>, fired: [...candidates with results...] }`.

**Tables read:** `client_tax_plans` (filtered by receipt_number presence + rev_paid not resolved).
**Tables written:** none directly (downstream `automation_TAX_revshare` writes plan state).
**External calls:** internal HTTP fetch to admin-api per candidate.
**Chains:** `automation_TAX_revshare` per candidate.

> **Idempotency:** if all rows resolved → `swept: 0`, no candidates enumerated, no downstream calls. Verified: re-running the sweep with a Completed plan returns `{ok:true, swept:0, fired:[]}` (no Stripe / Sheets / Gmail traffic).

> **Notification program-context fix (this session).** All 12 tax notification `link`s now append `&program=${plan.program_id}` (in final-decision, postreview-client-decision, implement-final-decision, charge-implementation, deposit-refund, and revshare-sweep — 3 PF notifications + the meeting-nudge clientLink). Reason: a client enrolled in BOTH VFO Holistic (program 1) and VFO Tax Planning (program 4) previously opened their DEFAULT enrollment (Holistic) on `?tab=tax` instead of the program the notification was about. `src/pages/ClientDetail.jsx` now reads `?program=` from the URL and passes `program_id` to `msm_load_client_home`; `actions/msm/load-client-home.ts` accepts a `program_id` param and resolves the matching enrollment (via `client_enrollments` ⋈ `member_enrollments`) before falling back to `clients.enrollment_id`. MAP1/PFT/Advisor/Accountant notifications are unaffected (single default program).

---

## Step 14 — Implementation flow (Tax 5b — BUILT)

Mirrors Tax 4's 3-option pattern. Admin picks `implementation_decision` on the Tax 5 Post Allocation phase:
- **Proceed** → drafts client email with **two buttons**: green "Proceed now" (skip the 24h wait → immediate charge, writes `implementation_final_decision='Confirmed'`) + red "Decline implementation" (no charge ever). If 24h passes with no click → sweep auto-locks (`implementation_final_decision='Auto-Locked'`) and fires the charge.
- **Undecided** → drafts client email with green "Proceed with implementation" + red "Decline implementation". 48h sweep reminder + 96h PF notification if neither clicked.
- **Not Implementing** → drafts immediate decline email. Engagement closes; no charge ever.

**Charge handler:** `automation_TAX_charge_implementation` — off-session charge against saved payment method.
- Charge amount: `implementation_amount` (may differ from retainer per design — separate columns).
- Stripe PaymentIntent with `confirm=true off_session=true`, `metadata.payment_kind='implementation'`, `metadata.tax_plan_id`, `Idempotency-Key: tax-impl-{tax_plan_id}-{retainer_pi_last8}-{YYYY-MM-DD}` (PI suffix included so DB-reset retries don't collide with Stripe's idempotency cache).
- Card amount uses same gross-up as retainer for card; ACH at base.
- Idempotent on `implementation_charge_status` — if already set, skip.
- Failure → `implementation_charge_status='declined'` or `'auth_required'` + admin notification + Gmail asking client to use a fresh `/tax-pay` link (see Failure mode #9 below for the ACH-retainer special case).

**Webhook chain on charge success** → `automation_TAX_confirmationemail` (`payment_kind='implementation'`, single `|implementation` template) + `automation_TAX_implementation_receipt` (REC PDF + Gmail draft, no invoice — design decision). Implementation revshare is picked up by the next `tax-revshare-sweep-daily` tick once `implementation_receipt_number` is set.

**Failure mode for zero implementations:** if client picks Decline OR Not Implementing, no charge ever fires. No automatic refund — client absorbs the retainer cost (different rule from the Tax 4 Stop-Refund branch).

> **Template wording fix (this session, 3 LIVE client templates):** `TAX_implementdecision|Undecided` + `TAX_postreview|Undecided` dropped the false "within 48 hours" deadline (the Undecided paths have no auto-lock — only the 24h Proceed/Continue paths do); `TAX_implementdecision|Reminder` dropped a vestigial "if you can no longer find the original email" line.

---

## Failure modes

1. **Ready-for-Tax-3 Gmail fails** → plan exists with `ready_for_tax3_email_sent='No'` indefinitely. No retry.
2. **`automation_TAX_sendagreement` fails** → `agreement_sent` not flipped, but the chain caller already returned success. No retry — admin must investigate.
3. **BoldSign sign-link polling exhausted** (5 retries) → handler still completes (`agreement_sent='Yes'`) but the Gmail body has `[ENGAGEMENT — signing link unavailable]` placeholder text in red. Visible failure.
4. **Wrong BoldSign webhook URL config** → flags don't flip. CEO countersign + Stripe customer chains never fire. The webhook URL must be `boldsign-webhook` (standalone), AND the function must have `verify_jwt=false` to accept BoldSign's POST without an auth header.
5. **`pipeline_sandbox_config` missing TAX row** → handlers default to live mode. BoldSign docs created in the wrong account where webhooks aren't configured. **Required fix** during setup.
6. **`document_numbers` race** → two concurrent invoicereceipt calls could allocate the same INV/REC number. Not protected by DB constraint. Same caveat as MAP1.
7. **Drive folder name change** → if client renamed, prior PDFs orphan in old folder.
8. **Idempotency**: `agreement_sent === 'Yes'` blocks re-send. `retainer_confirmation_status === 'Sent'` blocks re-send. `retainer_receipt_status === 'Sent'` blocks re-fire. `tax_final_decision` set blocks re-flip on `/tax-decide`. `ready_for_tax3_email_sent === 'Yes'`, `tax_decision_email_sent === 'Yes'` block re-fires.
9. **ACH retainer → implementation auto-charge fails (Stripe restriction)**. If the client paid the retainer via ACH (`payment_method_type='ach'`), Stripe will reject the off-session implementation `POST /v1/payment_intents` with `"The PaymentMethod provided (us_bank_account) is not allowed for this PaymentIntent"`. This happens at both the Tax 5 client-Proceed click and the 24h sweep auto-lock paths. The `automation_TAX_charge_implementation` handler degrades gracefully: sets `implementation_charge_status='declined'`, regenerates a fresh `checkout_token` so the existing `/tax-pay` link route can serve the implementation re-pay (the page + `automation_TAX_stripecheckout` already branch on `retainer_status='succeeded' AND implementation_charge_status IN (declined, auth_required, manual_required)` to charge the implementation amount with `metadata.payment_kind='implementation'` instead of the retainer), inserts an admin notification with the Stripe error text + the new token, and drafts a client Gmail with the fresh `/tax-pay` link. **The client manually re-pays via /tax-pay** (typically with a card, not ACH again) — same page, different branch, same downstream Stripe webhook routing. No automated retry; the admin notification is the trigger to email the client. (Verified end-to-end in 2026-05-20 testing.)

---

## Tax Automation Panel (admin UI)

[TaxAutomationPanel.jsx](src/components/admin/TaxAutomationPanel.jsx) — structural mirror of [AutomationPanel.jsx](src/components/admin/AutomationPanel.jsx) for MAP1. Same table-with-click-to-expand pattern. Each plan row expands to a **12-Step vertical timeline** showing every decision and detail captured along the way (Ready for Tax 3, Tax 3 Decision, Final Decision, Contract, Payment, Confirmation, Invoice & Receipt, Tax 4 Continue/Stop, Retainer Revenue Share, Implementation Fee, Implementation Revenue Share, Wrap-up Announcement). Pay-via-check / Mark-cleared buttons live in the Payment step.

Accessible from admin portal → Automation dropdown → "Holistic Planning - Tax Planning" (alongside "Holistic Planning - MAP 1").

Backed by [`automation_load_tax_plans`](../../supabase/functions/vfo-admin-api/actions/tax/load-automation-list.ts) — admin-only — returns all tax plans joined with client + member info.

Sandbox toggle uses `save_sandbox_config` with `pipeline='TAX'` parameter (extended from MAP1-only to accept any pipeline).

---

## Cross-references

- Tax-plans column dictionary: [../tables/tax.md](../tables/tax.md)
- MAP1 contract+payment flow (parallel structure): [contract-and-payment.md](contract-and-payment.md)
- BoldSign webhook detail: [boldsign-webhook.md](boldsign-webhook.md)
- Stripe webhook detail: [stripe-webhook.md](stripe-webhook.md)
- API action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
- Stripe + revshare: [../integrations/stripe.md](../integrations/stripe.md)
- BoldSign: [../integrations/boldsign.md](../integrations/boldsign.md)
- Gmail/Sheets/Drive: [../integrations/gmail.md](../integrations/gmail.md), [../integrations/google-sheets.md](../integrations/google-sheets.md), [../integrations/google-drive.md](../integrations/google-drive.md)
