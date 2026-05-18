# Contract and Payment flow (MAP1)

The master flow. From "PF wants to reconfirm with the client" all the way to "VFO has been paid and member's revenue share has been transferred." Touches every integration: Stripe, BoldSign, Gmail, Google Sheets, Google Drive, Supabase Storage.

The state machine is the column values on a single `pipeline_map1` row — see [../tables/pipeline.md](../tables/pipeline.md). Each step in this flow either creates that row, advances some columns, or branches based on column values.

## Lifecycle overview

```
PIP1 reconfirm  →  PIP follow-up   →  PCADMIN          →  BoldSign        →  Payment          →  Confirmation +  →  Revenue share
                   decision            (pricing /          send agreement     (Stripe)            invoice/receipt    (Stripe Transfer
(create row)       (Yes/Undecided/     extra meeting)      (PDF + signers)                                            + Sheets read)
                    No)
```

Each arrow is implemented either as:
- A user clicking something in the admin UI (`callApi(...)`), OR
- A token-link landing page (raw fetch, no session), OR
- A webhook (Stripe / BoldSign), OR
- A server-to-server chain (admin-api → admin-api with service-role auth).

---

## Step 1 — PIP1 reconfirmation email

**Trigger:** Admin opens [ClientDetail](src/pages/ClientDetail.jsx) → MAP1 tab. The c81 task surfaces a decision dropdown. Admin picks `Yes`/`No` and a follow-up meeting date, then completes the task.

**Handler:** `automation_PIP1_reconfirmationemail` ([admin-api:3944-4074](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — fired from [ClientTrackViewV2.jsx:85](src/components/admin/map1/ClientTrackViewV2.jsx).

**What it does:**
1. Loads `clients`, `members`, `pipeline_sandbox_config`.
2. **Inserts a new `pipeline_map1` row** with `client_id`, `client_ref`, `pf`, `c81_decision`, `c81_email_sent='No'`, `followup_meeting_date`, `sandbox`. (This is the only place that creates the pipeline row; subsequent automations all UPSERT or assume it exists.)
3. Loads `email_templates` row `(pipeline='MAP 1', template_name='PIP1_reconfirmation|Yes' or '|No')`.
4. Substitutes `[Client Name]`, `[Client First]`, `[Member Name]`, `[PF Name]`, `[Follow Up Meeting Date]` in subject + body.
5. Refreshes Gmail OAuth token, creates a Gmail draft to the client (CC member email + PF email; BCC `aanderson@elitert.com` and `platham@elitert.com`).
6. Updates `pipeline_map1.c81_email_sent='Yes'`.

**Tables read:** `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `pipeline_map1` (insert + update).
**External calls:** Google OAuth token endpoint, Gmail drafts API.
**Chains:** none.

---

## Step 2 — PIP follow-up decision

**Trigger:** Admin opens the c13 task in MAP1 tab → fills out [PIPDecisionForm](src/components/admin/map1/PIPDecisionForm.jsx) (Yes/Undecided/No, priorities, pricing).

**Handler:** `automation_PIPFU_decision` ([admin-api:4077-4338](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — fired from [PIPDecisionForm.jsx:107](src/components/admin/map1/PIPDecisionForm.jsx) AFTER a sibling `msm_save_client_task` records the c13 task as `Completed - <decision>`.

**What it does (branches by decision):**

### Decision = "Yes" (with grossServiceValue)

1. UPDATEs the existing `pipeline_map1` row (creating one if none yet via fallback at [admin-api:4087-4113](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) with all pricing fields: `c13_decision`, `current_priorities`, `parked_priorities`, `service_level`, `gross_fee`, `member_contribution`, `net_invoice`, `member_share`, `vfos_share`, `payment_plan`, `pip_meeting_count`, `extra_cc`.
2. **Chains** `automation_CONTRACT_sendagreement` — server-to-server.

### Decision = "Undecided"

1. UPDATEs `pipeline_map1` with priorities, undecided reasons, lite/core/max costs, extra_cc.
2. Generates a fresh `c15_token` (32-byte hex) and saves to row.
3. Loads `email_templates` row `'PCADMIN_followup|Undecided'`.
4. Builds HTML buttons that link to `https://jlathamert.github.io/vfo-portal/decide?token=<c15_token>&clientRef=...&decision=Yes&serviceLevel=<Lite|Core|Max>` (and a No, and an ExtraMeeting button).
5. Creates Gmail draft to client with the buttons. CC member + PF; BCC `aanderson` + `platham`.
6. Marks `c14_email_sent='Yes'`.

### Decision = "No"

1. UPDATEs `pipeline_map1` with `c13_decision='No'` and `extra_cc`.
2. Loads template `'PCADMIN_followup|No'`.
3. Same Gmail draft pattern.
4. Marks `c14_email_sent='Yes'`.

**Tables read:** `pipeline_map1`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `pipeline_map1` (insert if missing + update).
**Chains:** `automation_CONTRACT_sendagreement` (only on Yes + grossServiceValue).

---

## Step 3a — Client clicks decision button on `/decide` (Undecided path only)

**Trigger:** Client receives the email with C15 buttons, clicks one. Browser navigates to [DecidePage.jsx](src/pages/DecidePage.jsx) at `/decide?token=...&decision=...&serviceLevel=...&clientRef=...`.

**Handler:** `automation_PCADMIN_finaldecision` ([admin-api:586-742](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — fired via raw `fetch` (no session) from [DecidePage.jsx:33](src/pages/DecidePage.jsx).

**What it does:**
1. Looks up `pipeline_map1` by `c15_token`. If `c15_final_decision` is already set, returns `existing_decision` (idempotent).
2. UPDATEs `c15_final_decision`, `c15_service_level`.
3. Branches by decision:
   - **`Yes`**: inserts a `notifications` row (recipient `'admin'`, title `"<Client> chose <Service>"`, link to admin client detail). Admin must then submit the pricing form.
   - **`ExtraMeeting`**: inserts a `notifications` row asking admin to schedule the extra meeting.
   - **`No`**: loads template `'PIP1_reconfirmation|No'`, creates Gmail decline draft. No notification.

**Tables read:** `pipeline_map1`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `pipeline_map1` (c15_final_decision, c15_service_level), `notifications`.
**Chains:** none — admin still needs to submit pricing manually for Yes path.

---

## Step 3b — PCADMIN pricing (Undecided→Yes path)

**Trigger:** After client picks Yes via `/decide`, admin sees the notification, opens the client, fills out [PFPricingForm](src/components/admin/map1/PFPricingForm.jsx).

**Handler:** `automation_PCADMIN_pricing` ([admin-api:4377-4415](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — fired from [PFPricingForm.jsx:19](src/components/admin/map1/PFPricingForm.jsx).

**What it does:**
1. UPDATEs `pipeline_map1` pricing fields.
2. Marks all unread `notifications` for this `client_id` as read.
3. **Chains** `automation_CONTRACT_sendagreement`.

**Tables written:** `pipeline_map1` (pricing fields), `notifications.read=true`.
**Chains:** `automation_CONTRACT_sendagreement`.

---

## Step 3c — PCADMIN extra meeting (ExtraMeeting path)

**Trigger:** After ExtraMeeting was requested via `/decide`, admin schedules + holds the meeting, then submits [PFExtraMeetingForm](src/components/admin/map1/PFExtraMeetingForm.jsx) with the outcome.

**Handler:** `automation_PCADMIN_extrameeting` ([admin-api:4418-4566](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — fired from [PFExtraMeetingForm.jsx:21](src/components/admin/map1/PFExtraMeetingForm.jsx).

**What it does:**
- **Yes**: UPDATEs `c15_final_decision='Yes'`, `c15_via_extra_meeting=true`, all pricing fields. Marks notifications read. **Chains** `automation_CONTRACT_sendagreement`.
- **No**: UPDATEs `c15_final_decision='No'`, `c15_via_extra_meeting=true`. Loads template `'PIP1_reconfirmation|No'` and creates Gmail decline draft. Marks notifications read. No chain.

---

## Step 4 — Send agreement to BoldSign

**Trigger:** Server-to-server chain from `automation_PIPFU_decision` (Yes), `automation_PCADMIN_pricing`, or `automation_PCADMIN_extrameeting` (Yes). NOT directly user-triggered.

**Handler:** `automation_CONTRACT_sendagreement` ([admin-api:4584-4945](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

**What it does:**
1. Validates `gross_fee` is set and `c16_sent !== 'Yes'`.
2. Loads `agreement_templates` row keyed on `(service_level, payment_plan)`.
3. Renders HTML body with placeholder substitutions (client name, fees, payment dates +91/+182/+273 days).
4. POSTs to `https://api.html2pdf.app/v1/generate` to produce PDF.
5. POSTs to `https://api.boldsign.com/v1/document/send` with `EnableSigningOrder=true`, `DisableEmails=true`, two signers (client first, then CEO Anton Anderson), form fields built from `agreement_templates.field_map`. Hardcoded `BrandId=f6b2e092-73a4-438e-b786-ebd20e472732`.
6. Polls `getEmbeddedSignLink` for the client signer (5 retries × 5s waits).
7. UPDATEs `pipeline_map1`: `c16_sent='Yes'`, `boldsign_doc_id`, `c17_client_signed='No'`, `c18_ceo_signed='No'`, `c17_followup_sent_date=<today>`.
8. Loads template `'CONTRACT_agreementsent|Yes'`, substitutes `[ENGAGEMENT]` with the embedded sign link `<a>` tag.
9. Creates Gmail draft to client (`From: VFO Services <aipc@vfo-services.com>`). CC member + PF + `pipeline_map1.extra_cc` (parsed). BCC `aanderson` + `platham`.

**Tables read:** `pipeline_map1`, `clients`, `client_enrollments`, `members`, `agreement_templates`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `pipeline_map1` (c16_sent, boldsign_doc_id, c17/c18, c17_followup_sent_date).
**External calls:** html2pdf.app, BoldSign send + getEmbeddedSignLink, Google OAuth + Gmail drafts.
**Chains:** none — waits for BoldSign webhook.

---

## Step 5 — Client signs in BoldSign

**Trigger:** Client opens the Gmail draft (after admin reviews + sends), clicks the embedded sign link, signs in the BoldSign-hosted iframe.

**Handler:** `boldsign-webhook` ([standalone function](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts)) receives `event.eventType='Signed'` with the client's signer email.

**What it does:**
1. Looks up `pipeline_map1` by `boldsign_doc_id`.
2. Determines signer is NOT the CEO (email ≠ `aanderson@elitert.com`).
3. If `c17_client_signed === 'Yes'` already, idempotent skip.
4. UPDATEs `c17_client_signed='Yes'`.
5. **Chains** `automation_CONTRACT_ceocountersign` to admin-api.

**Tables written:** `pipeline_map1.c17_client_signed='Yes'`.
**Chains:** `automation_CONTRACT_ceocountersign`.

> See [boldsign-webhook.md](boldsign-webhook.md) for ambiguity around which webhook target is live (standalone vs embedded). The embedded handler does NOT chain — if it's the live URL, this flow stalls here.

---

## Step 6 — CEO countersign email

**Trigger:** Server-to-server chain from `boldsign-webhook` (standalone).

**Handler:** `automation_CONTRACT_ceocountersign` ([admin-api:745-858](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

**What it does:**
1. Validates `boldsign_doc_id` exists, `c18_ceo_signed !== 'Yes'`.
2. Polls BoldSign `getEmbeddedSignLink` for `aanderson@elitert.com` (3 retries × 2s).
3. Loads template `'CONTRACT_ceocountersign|Yes'`.
4. Substitutes `[Client Name]`, `[Service Level]`, `[Total Fee]`, `[SIGNING_LINK]`.
5. Creates Gmail draft to CEO with embedded sign link.

**Chains:** none — waits for CEO to sign.

---

## Step 7 — CEO signs in BoldSign

**Trigger:** CEO opens the Gmail draft (after admin sends), clicks the sign link, signs.

BoldSign fires `event.eventType='Signed'` with CEO email AND eventually `event.eventType='Completed'` once both signers done.

**Handlers (standalone webhook):**

- On `Signed` with CEO email → UPDATE `c18_ceo_signed='Yes'` only. No chain.
- On `Completed` → UPDATE both `c17_client_signed='Yes'` and `c18_ceo_signed='Yes'` (re-sets). **Chains** `automation_CONTRACT_stripecustomer`.

> The chain only fires on the `Completed` event, not on `Signed`-by-CEO — important behavioral detail.

---

## Step 8 — Create Stripe customer + send payment email

**Trigger:** Server-to-server chain from `boldsign-webhook` (Completed event).

**Handler:** `automation_CONTRACT_stripecustomer` ([admin-api:861-936](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

**What it does:**
1. Validates pipeline row exists. If `stripe_customer_id` already set, idempotent return.
2. POSTs to `https://api.stripe.com/v1/customers` with `email`, `name`, `metadata[client_id]`.
3. UPDATEs `pipeline_map1.stripe_customer_id`.
4. Generates 32-byte `checkout_token` (hex), UPDATEs `pipeline_map1.checkout_token`.
5. **Chains** `automation_CONTRACT_paymentemail`.

**Then:** `automation_CONTRACT_paymentemail` ([admin-api:939-1050](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):
1. Validates `checkout_token`.
2. Loads template `'CONTRACT_paymentemail|Yes'`.
3. Substitutes `[PAYMENT_LINK]` with `<a href="https://jlathamert.github.io/vfo-portal/pay?token=<checkout_token>">Complete Payment</a>`.
4. Creates Gmail draft to client.

**Tables written:** `pipeline_map1.stripe_customer_id`, `.checkout_token`.
**External calls:** Stripe customers create, Google OAuth + Gmail drafts.

---

## Step 9 — Client pays on `/pay` page

**Trigger:** Client opens the Gmail draft (after admin sends), clicks the Complete Payment button. Lands on [PayPage.jsx](src/pages/PayPage.jsx) at `/pay?token=<checkout_token>`.

**Handlers (raw fetch, no session):**

1. **`automation_CONTRACT_loadpayment`** ([admin-api:1053-1083](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — looks up `pipeline_map1` by `checkout_token`, returns `client_name`, `service_level`, `payment_amount`, `payment_x` ('1'), `payment_y` ('1' or '4').
2. Client picks ACH or Card → **`automation_CONTRACT_stripecheckout`** ([admin-api:1086-1153](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — creates Stripe Checkout Session with `customer=<stripe_customer_id>`, line item, success/cancel URLs, `payment_intent_data.metadata.client_id` and `.checkout_token`. Returns Stripe URL.
3. Client redirected to Stripe → enters payment → Stripe charges → Stripe redirects to `https://www.vfo-services.com/payment-successful/`. **Note:** the success URL leaves the SPA entirely.

**Chains:** none — waits for Stripe webhook.

---

## Step 10 — Stripe webhook fires

**Trigger:** Stripe sends `checkout.session.completed` to admin-api with `stripe-signature` header. See [stripe-webhook.md](stripe-webhook.md) for full handler dispatch.

**For MAP1 first payment** ([admin-api:290-392](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):
1. Looks up `pipeline_map1` by `stripe_customer_id`.
2. Expands the PaymentIntent to get `payment_method.type` and `last4`.
3. UPDATEs `pay1_status` ('succeeded' for card, 'processing' for ACH), `payment_method_type`, `acct_last4`, `card_processing_fee`, `pay1_date`, plus `pay2/3/4_date` for Quarterly (today + 91/182/273 days). Sets `confirmation_status='Confirmation Needed'`.
4. **Chains** `automation_CONTRACT_confirmationemail` (always).
5. **Chains** `automation_CONTRACT_invoicereceipt` for card only — ACH waits.

**For ACH first payment cleared** (subsequent `payment_intent.succeeded` with `pipeRow.pay1_status === 'processing'`):
- UPDATEs `pay1_status='succeeded'`, **chains** `automation_CONTRACT_invoicereceipt` for payment 1.

**For quarterly payment 2-4** (subsequent `payment_intent.succeeded` with `metadata.payment_number` ∈ {2,3,4}):
- UPDATEs `pay${n}_status='succeeded'`, **chains** `automation_CONTRACT_invoicereceipt` for that payment number.

> **How payments 2-4 are created:** by the daily scheduled-payment charger — see Step 10½ below.

---

## Step 10½ — Scheduled-payment charger (quarterly P2-4)

**Trigger:** daily `pg_cron` job `chargescheduled-sweep-daily` at 03:00 UTC (cron SQL: `vfo-edge-functions/supabase/cron/chargescheduled-sweep.sql`).

**Handler:** `automation_CONTRACT_chargescheduled_sweep` ([actions/pipeline/contract-chargescheduled-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-chargescheduled-sweep.ts)) — PUBLIC, service-role-gated.

**What it does:**
1. Loads `pipeline_sandbox_config` for `MAP 1` to pick live vs sandbox Stripe key.
2. Selects `pipeline_map1` rows where `pay1_status='succeeded'` AND `stripe_customer_id IS NOT NULL` AND `payment_method_type IN ('card','ach')` AND `payment_plan='Quarterly'`.
3. For each row and each N in [2, 3, 4]: emits a candidate if `payN_date <= today` AND `payN_status` is not in (`succeeded`, `processing`, `pending`, `declined`, `auth_required`).
4. For each candidate: lists saved payment methods on the Stripe customer (`GET /v1/customers/{cus}/payment_methods?type=card|us_bank_account`), picks the most recent.
5. POSTs to `/v1/payment_intents` with `confirm=true off_session=true`, `metadata.payment_number=N`, `metadata.client_id`, `metadata.checkout_token`, and `Idempotency-Key: chargescheduled-{client_id}-P{N}-{YYYY-MM-DD}`.
6. Charge amount uses the same gross-up as P1 checkout for card (`round((base + 0.30) / (1 - 0.029) * 100)` cents); ACH at base.
7. **On success** (`status: succeeded` or `processing` for ACH): the handler does NOT write to the DB — Step 10 (the `payment_intent.succeeded` webhook branch) handles status flip + invoicereceipt + revshare chains.
8. **On failure:** sets `payN_status='auth_required'` (Stripe code `authentication_required`) or `'declined'` (everything else), inserts one admin notification, drafts one Gmail email to the client with the fresh `/pay` link. Failed states are NOT retried by the sweep — recovery is client-driven via the `/pay` link, which on successful payment triggers the webhook and flips `payN_status` back to `succeeded`.

---

## Step 10⅔ — Check-payment branch (parallel to Steps 10/10½ — never both)

Some clients prefer to pay by physical check instead of using Stripe. The check branch replaces Steps 10 and 10½ entirely for those clients. The Stripe webhook + chargescheduled sweep do NOT run.

**Entry point:** in the AdminPortal Automation tab, after the `/pay` email has been sent (`checkout_token IS NOT NULL`) but before any payment has been received (`pay1_status IS NULL`), a **"Pay via check"** button appears on the row. Admin clicks it when the client tells them they'd rather mail a check.

**Handler: `automation_CONTRACT_paidbycheck`** ([actions/pipeline/contract-paidbycheck.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-paidbycheck.ts)) — admin-only.

**What it does:**
1. Validates row has `checkout_token` set and `pay1_status IS NULL`.
2. Sets `payment_method_type='check'`, `pay1_status='check_pending'`, `pay1_date=CURRENT_DATE`.
3. If `payment_plan='Quarterly'`: sets `pay2/3/4_date = today + 91/182/273 days` (same offset Stripe would use).
4. Drafts a Gmail to the client with the check mailing address (template `CONTRACT_paidbycheck|check`). Sandbox-aware (redirects to `sandbox_email` when sandbox_mode is true). Email draft is non-fatal — if Gmail fails, the DB state still reflects the check path and admin can manually email the address.

**Side effect:** the existing `automation_CONTRACT_stripecheckout` rejects with "Payment already completed" when `pay1_status` is truthy. So the `/pay` link is auto-blocked — no risk of accidental double-pay.

---

### Step 10⅔a — Admin clicks "Check cleared P{N}" once each check actually clears the bank

For each payment cycle (P1 for one-time, P1+P2+P3+P4 for quarterly), the row shows a **"Check cleared P{N}"** button when `payment_method_type='check'` AND `pay{N}_date` is set AND `pay{N}_status != 'succeeded'`.

**Handler: `automation_CONTRACT_checkcleared`** ([actions/pipeline/contract-checkcleared.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-checkcleared.ts)) — admin-only.

**What it does:**
1. Validates `payment_method_type='check'` and `pay{N}_status` is NULL or `'check_pending'`.
2. Sets `pay{N}_status='succeeded'`. For N=1 also sets `confirmation_status='Confirmation Needed'`.
3. Chains (HTTP fetch + service-role auth, refactor safety rule):
   - For N=1 only: `automation_CONTRACT_confirmationemail` (uses the new `CONTRACT_confirmationemail|check` template; `[PROCESSING_TIME]` substituted to "Your check has been received and cleared.")
   - For all N: `automation_CONTRACT_invoicereceipt` (renders "Check" on the invoice and "Via Check" on the receipt PDF; no `acct_last4`, no `card_processing_fee`)
   - For all N: `automation_CONTRACT_revshare` (same revshare path as card/ACH — no special handling for check)

---

### Step 10⅔b — Daily check-reminder sweep

**Trigger:** daily `pg_cron` job `check-reminder-sweep-daily` at 04:00 UTC (cron SQL: `vfo-edge-functions/supabase/cron/check-reminder-sweep.sql`).

**Handler:** `automation_CONTRACT_checkreminder_sweep` ([actions/pipeline/contract-check-reminder-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-check-reminder-sweep.ts)) — PUBLIC, service-role-gated.

**What it does:**
1. Loads sandbox config + the `CONTRACT_checkreminder|check` email template (returns 500 if template missing).
2. Selects `pipeline_map1` rows where `payment_method_type='check'` AND `payment_plan='Quarterly'` AND `pay1_status='succeeded'`.
3. For each row and each N in [2, 3, 4]: emits a candidate if `payN_date IN [today, today+7]` AND `payN_status != 'succeeded'` AND `payN_reminder_sent=false`.
4. For each candidate: drafts Gmail to client (`sandbox_email` redirected target when sandbox_mode is true) including the check mailing address (`12636 High Bluff Drive, Suite 400, San Diego, CA 92130`).
5. On successful draft: `pay{N}_reminder_sent=true` (so we don't re-send tomorrow). On Gmail failure: `reminder_sent` stays false, next day's cron retries.

**v1 limitation:** the reminder email is text-only — does NOT include a "pay this cycle by card/ACH" link. If a check client wants to switch to Stripe for a single cycle, admin manually issues them a fresh `/pay` link (or extends them a different option). Flagged for follow-up.

---

## Step 11 — Confirmation email

**Trigger:** Server-to-server chain from Stripe webhook handler.

**Handler:** `automation_CONTRACT_confirmationemail` ([admin-api:1660-1809](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

**What it does:**
1. Validates `confirmation_status !== 'Sent'` (idempotent).
2. Loads template `'CONTRACT_confirmationemail|card'` or `'|ach'` based on `payment_method_type`.
3. Substitutes `[Payment Amount]`, `[CARD_FEE_TEXT]`, `[PROCESSING_TIME]`.
4. Creates Gmail draft to client. CC member + PF.
5. UPDATEs `confirmation_status='Sent'`.

**Chains:** none.

---

## Step 12 — Invoice & receipt PDFs + Drive + email

**Trigger:** Server-to-server chain from Stripe webhook handler. Fires once per payment.

**Handler:** `automation_CONTRACT_invoicereceipt` ([admin-api:1812-2188](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

**What it does (per payment number):**
1. **Generate document numbers**: on payment 1, generates `INV-<client_ref>-<seq>` from `document_numbers` table count (NOT serialized — concurrency caveat). Always generates `REC-<client_ref>-<seq>`. Inserts records into `document_numbers`. Updates `pipeline_map1.invoice_number` (payment 1) and `.rec{N}_number`.
2. **Render HTML**: uses inline `generateInvoiceHTML()` and `generateReceiptHTML()` ([admin-api:4-141](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) to build branded HTML (VFO blue header, payment schedule table, amounts, contribution lines).
3. **Generate PDFs** via two POST calls to `https://api.html2pdf.app/v1/generate`.
4. **Upload to Google Drive**: finds or creates a per-client folder named `<first> <last> - <client_ref>` under `GOOGLE_DRIVE_FOLDER_ID`. Uploads both PDFs as multipart, retrieves file IDs.
5. UPDATEs `pipeline_map1.invoice_drive_id` (payment 1) and `.rec{N}_drive_id`.
6. Loads template `'CONTRACT_invoicereceipt_email|first'` or `'|subsequent'`.
7. Re-fetches the PDFs from Drive (`?alt=media`) as base64.
8. Builds **multipart MIME** Gmail draft with PDF attachments. CC member + PF + `tracy@vfo-services.com`.
9. UPDATEs `invoice_email_sent` (payment 1) and `rec{N}_email_sent=true`.

**Tables read:** `pipeline_map1`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`, `document_numbers`.
**Tables written:** `document_numbers` (insert), `pipeline_map1` (invoice_number, recN_number, drive IDs, email_sent flags).
**External calls:** html2pdf.app ×2, Google OAuth, Drive search/create/upload/download, Gmail drafts (multipart).
**Chains:** none.

---

## Step 13 — Revenue share

**Trigger (two paths, both automatic):**
1. **Push chain from Stripe webhook:** `router/webhooks.ts` chains `_revshare` immediately after `_invoicereceipt` in all three Stripe webhook chain sites (MAP1 first-card, quarterly N succeeded, ACH cleared). First attempt usually returns `pending: true` because Tracy's Revenue Master sheet isn't updated yet — silent and non-fatal.
2. **Daily sweep via `automation_CONTRACT_revshare_sweep`:** `pg_cron` runs at 02:00 UTC (see `vfo-edge-functions/supabase/cron/revshare-sweep.sql`). The sweep enumerates every `pipeline_map1` row where any `rec1-4_number` is set but `rev_paid` is not yet `Yes`/`Money Mapping`/`N/A` — and re-invokes `_revshare` for each. Includes previously-`Failed` transfers, so misconfigured Stripe Connect accounts auto-recover once fixed. No manual path.

**Handler:** `automation_CONTRACT_revshare` ([actions/pipeline/contract-revshare.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-revshare.ts)).

**What it does (per payment number):**
1. Validates `pipeline_map1.rec{N}_number` exists. **Duplicate guard:** skips only if `rev_share` is set non-`Pending` AND `rev_paid` is in `Yes`/`Money Mapping`/`N/A — No Share Due`. `Failed` and `Pending` re-attempt on next call.
2. Sets `rec{N}_rev_share='Pending'`.
3. Refreshes Google access token (covers Sheets + Gmail + Drive).
4. Reads Google Sheet `MASTER_SHEET_ID` (`Home Page!A1:I200`), finds `client_ref` in col A, extracts batch sheet ID from the col-I hyperlink. If not found: returns `pending: true, reason: "Client ref not found in Revenue Master"` and exits.
5. Reads batch sheet metadata, finds tab matching `client_ref` + 4-digit number. If none: returns `pending: true`.
6. Reads `<tab>!G7:O200`. Finds row matching receipt number AND verifies col J = expected payment AND verifies K+L+M+N+O = J. If verification fails: returns `pending: true, reason: "Tracy's numbers not yet verified"`.
7. Calculates share amount: if `members.member_share > 100`, treats as flat dollar (divided by 4 for Quarterly); else as percentage of payment.
8. On payment 1, deducts `member_contribution` from share if `member_contrib_status === 'Pending'`. Sets `member_contrib_status='Applied'`.
9. **Stripe Transfer** (if `members.revenue_decision !== 'Money Mapping'` and `shareAmount > 0` and `members.stripe_account_id`):
   - POSTs to `https://api.stripe.com/v1/transfers` with `amount`, `currency=usd`, `destination=stripe_account_id`, `description="VFO Revenue Share — <client_ref> Payment <N>"`.
   - On success: `rec{N}_rev_paid='Yes'`. On failure: `'Failed'`.
   - Money Mapping → `'Money Mapping'`. Zero share → `'N/A — No Share Due'`.
10. UPDATEs `pipeline_map1.rec{N}_rev_share='Completed - <type>'` and `.rec{N}_rev_paid`.
11. Builds inline (NOT template-based) HTML email to member with rev-share confirmation. CC PF; BCC `aanderson` + `platham`.
12. Creates Gmail draft.
13. **On payment 1 only:** also creates a "Tracy intro email" Gmail draft to `tnmiller@elitert.com` with the priorities list. Sets `c24_email_sent=true`.

**Tables read:** `pipeline_map1`, `clients`, `members`, `pipeline_sandbox_config`.
**Tables written:** `pipeline_map1` (rec{N}_rev_share, _rev_paid, _rev_email_sent, member_contrib_status, c24_email_sent).
**External calls:** Google OAuth, Sheets ×2 (master + batch), optionally Stripe transfers, Gmail drafts ×1-2.

---

## Reminder followups (unimplemented?)

These columns exist on `pipeline_map1` but **no observed code writes them**:

- `c14_followup1_sent`, `c14_followup2_sent` (PIP follow-up reminder)
- `c14_followup_sent_date`
- `c17_followup1_sent`, `c17_followup2_sent` (BoldSign sign reminder)
- `pay1_followup1_sent`, `pay1_followup2_sent` (payment reminder)
- `pay1_followup_sent_date`

The columns *are* read by [AutomationPanel.jsx:155-160, 213](src/components/admin/AutomationPanel.jsx) for display purposes. Possible interpretations:
- Reminder cron is unimplemented (columns exist for a planned feature).
- Reminders are sent externally (e.g., a Zapier or Make scenario) that updates these flags.

Confirm with user.

---

## Notification touch-points

`automation_PCADMIN_finaldecision` is the **only** automation that inserts a `notifications` row. It does so for:
- Decision = Yes (with chosen service level): "X chose Y"
- Decision = ExtraMeeting: "X requested extra meeting"

Two follow-up actions clear all unread notifications for a client_id:
- `automation_PCADMIN_pricing` (when admin completes pricing)
- `automation_PCADMIN_extrameeting` (when admin records extra-meeting outcome)

See [notifications.md](notifications.md).

---

## Cumulative state machine

The `pipeline_map1` row evolves through these column writes, in order:

| Step | Columns written |
|---|---|
| 1 | `client_id`, `client_ref`, `pf`, `c81_decision`, `c81_email_sent`, `followup_meeting_date`, `sandbox` |
| 2 | `c13_decision`, `current_priorities`, `parked_priorities`, pricing fields (Yes), undecided fields, `extra_cc`, `c14_email_sent`, `c15_token` |
| 3a | `c15_final_decision`, `c15_service_level` |
| 3b/3c | pricing fields, `c15_via_extra_meeting` |
| 4 | `c16_sent`, `boldsign_doc_id`, `c17_client_signed`, `c18_ceo_signed` (initial 'No'/'No'), `c17_followup_sent_date` |
| 5/7 | `c17_client_signed`, `c18_ceo_signed` (advanced via webhook) |
| 8 | `stripe_customer_id`, `checkout_token` |
| 10 | `pay1_status`, `payment_method_type`, `acct_last4`, `card_processing_fee`, `pay1_date`, `pay2-4_date`, `confirmation_status` |
| 11 | `confirmation_status='Sent'` |
| 12 | `invoice_number`, `rec{N}_number`, `invoice_drive_id`, `rec{N}_drive_id`, `invoice_email_sent`, `rec{N}_email_sent` |
| 13 | `rec{N}_rev_share`, `rec{N}_rev_paid`, `rec{N}_rev_email_sent`, `member_contrib_status`, `c24_email_sent` |

`AutomationPanel.getCurrentStage()` ([component code](src/components/admin/AutomationPanel.jsx)) infers the current stage from these column values via cascading checks — see [02-frontend-shell.md](../architecture/02-frontend-shell.md#what-automationpanel-shows).

---

## Failure modes

1. **PIP1 row created but Gmail draft fails** → row exists with `c81_email_sent='No'` indefinitely. No retry. Admin must investigate.
2. **`automation_CONTRACT_sendagreement` fails** → `c16_sent` not flipped, but the chain that called it (e.g., `automation_PIPFU_decision`) already completed and marked the c13 task done. No retry.
3. **BoldSign embedded sign-link polling exhausted** (5 retries) → handler still completes (sets `c16_sent='Yes'`) but Gmail draft has `[ENGAGEMENT — signing link unavailable]` placeholder text in red. Visible failure.
4. **Wrong BoldSign webhook URL** → `c17/c18` flip but no chain. CEO countersign + payment email never get created. Stalls until manual intervention.
5. **`document_numbers` race** → two concurrent `_invoicereceipt` calls could allocate the same number. Not protected by DB unique constraint or transaction.
6. **Drive folder name change** → if client is renamed, prior PDFs orphan in the old folder.
7. **Sheets verification stuck** → `_revshare` returns `pending: true`. The daily `_revshare_sweep` cron auto-retries every 24h until Tracy's sheet matches.
8. **Stripe Transfer fails** → `rec{N}_rev_paid='Failed'`. Member email + Tracy email are **NOT** drafted on Failed (gated on `rev_paid === "Yes"` at [contract-revshare.ts:347](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-revshare.ts)). The daily sweep auto-retries Failed transfers, so once the Stripe Connect account is fixed (typically a missing `transfers` capability) the next sweep run completes the flow.
9. **Idempotency**: the rev-share duplicate guard skips only when `rev_paid` is in `Yes`/`Money Mapping`/`N/A — No Share Due` — `Pending` and `Failed` retry on next call. Other handlers check single columns: `c16_sent === 'Yes'`, `confirmation_status === 'Sent'`. The dual `Signed` + `Completed` BoldSign events are explicitly idempotent. Stripe webhook checks `pay1_status` empty.

## Cross-references

- Pipeline column dictionary: [../tables/pipeline.md](../tables/pipeline.md)
- BoldSign webhook detail: [boldsign-webhook.md](boldsign-webhook.md)
- Stripe webhook detail: [stripe-webhook.md](stripe-webhook.md)
- Stripe API + revenue share: [../integrations/stripe.md](../integrations/stripe.md)
- BoldSign API: [../integrations/boldsign.md](../integrations/boldsign.md)
- Gmail/Sheets/Drive: [../integrations/gmail.md](../integrations/gmail.md), [../integrations/google-sheets.md](../integrations/google-sheets.md), [../integrations/google-drive.md](../integrations/google-drive.md)
- Frontend touch-points table: [../architecture/06-orchestration-files.md#where-each-automation_-action-is-triggered-from-the-frontend](../architecture/06-orchestration-files.md)
