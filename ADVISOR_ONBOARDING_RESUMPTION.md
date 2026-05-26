# Advisor Onboarding — Resumption Notes

**Branch (next session):** start a fresh worktree off `main` after Phase 4 merges. Suggested: `feature/advisor-phase-5`.
**Phase 4 worktrees (this session — to be merged):**
- Frontend: `C:\vfo-react\.claude\worktrees\advisor-phase-4\`
- Backend: `C:\vfo-edge-functions\.claude\worktrees\advisor-phase-4\`

**Last working session:** 2026-05-26 (Phase 4 complete, deployed, E2E tested both $4,000 ACH + $8,600 card paths)

---

## TL;DR — Where We Are

Multi-phase Advisor Onboarding feature, modeled on MAP 1 / Tax automation. **Phases 1–4 are functionally complete + deployed + E2E tested in sandbox.** Phases 5 and 6 plus deferred TODOs remain.

**Phase 4 (Stripe payment chain) delivered:**
- 6 new PUBLIC handlers in `actions/advisor/` (`stripe-customer`, `payment-email`, `load-payment`, `stripe-checkout`, `confirmation-email`, `invoice-receipt`)
- Stripe webhook routes by `metadata.pipeline='ADVISOR_ONBOARDING'` + `metadata.payment_kind='onboarding'`
- BoldSign Completed branch chains to `_stripecustomer` (in BOTH the embedded handler and standalone `boldsign-webhook` function)
- New `/advisor-pay` token page on the frontend mirroring `/tax-pay`
- 4 new `email_templates` rows: `ADVISOR_payment_link` (id 50), `ADVISOR_payment_confirmation|card` (51), `ADVISOR_payment_confirmation|ach` (52), `ADVISOR_invoice_receipt` (53)
- Invoice + receipt PDFs mirror MAP 1's `utils/html-templates.ts` layout (blue INVOICE / green RECEIPT headers, Engagement Details + Payment Schedule cards with `Engagement Term: 6 months` + `Renewal Review` rows, card-fee breakdown box)
- Invoice/receipt numbering shares the GLOBAL `document_numbers` counter with MAP1 + Tax: `INV-ADV{onboarding_id}-{seq:0004}` / `REC-ADV{onboarding_id}-{seq:0004}`
- Payment amount is DYNAMIC — Phase 3's `ceo-countersign.ts` reads BoldSign checkbox values (vfo_ft/pft/corporate) and computes $4,000 / $4,600 / $8,000 / $8,600
- Plan label fix: "VFO FT" / "PFT" abbreviations replaced everywhere with "VFO Fast Track" / "Partnership Fast Track"
- `setup_future_usage=off_session` set on the PaymentIntent so the card stays on file for the 6-month renewal review (no auto-renew cron yet — TBD)
- ADVISOR_undecided + ADVISOR_decline + ADVISOR_agreement_sent + ADVISOR_ceo_countersign templates unchanged from Phase 1-3

**Currently blocked on:** nothing. Ready for Phase 5 in a new worktree off `main` once Phase 4 PRs merge.

---

## What's Live in Production (Backend Deployed)

### Edge function `vfo-admin-api`
- Phases 1-4 all deployed to production (last deploy 2026-05-26)
- Verification gate: `deno check` shows exactly **7 baseline errors** (4 `existing-null` in `pipfu-decision.ts`, 3 `pipeRow null` in `router/webhooks.ts`) — preserved
- Action count: **177** (3 logins + 43 PUBLIC + 131 AUTH) — was 162 pre-feature, +15 for advisor onboarding so far
- Standalone `boldsign-webhook`: extended twice (Phase 3 for advisor routing, Phase 4 for `_stripecustomer` chain on Completed). Deploys MUST pass `--no-verify-jwt`.

### Database (Supabase project `ejpsprsmhpufwogbmxjv`)
- New table `advisor_onboarding` — full schema below
- `pipeline_sandbox_config` row for `pipeline='ADVISOR_ONBOARDING'`, `sandbox_mode=true`, `sandbox_email='jlatham@elitert.com'`
- `agreement_templates` row id=9 — `pipeline='ADVISOR_ONBOARDING'`, `service_level='Advisor'`, `payment_plan='Single'`, contains the full Advisor Onboarding Agreement HTML (user pasted in via Supabase Studio). `boldsign_template_id` NULL. `field_map` NULL.
- `email_templates` rows 46-53 (all `pipeline='ADVISOR_ONBOARDING'`):
  - 46 `ADVISOR_undecided` (Yes/No buttons) — Phase 2
  - 47 `ADVISOR_decline` — Phase 2
  - 48 `ADVISOR_agreement_sent` (BoldSign sign link) — Phase 3
  - 49 `ADVISOR_ceo_countersign` (BoldSign countersign link to Anton, with `[Selected Plans]` + `[Total Amount]` substitutions) — Phase 3
  - 50 `ADVISOR_payment_link` (Stripe Checkout link + plan list + total + `Engagement Term: 6 months`) — Phase 4
  - 51 `ADVISOR_payment_confirmation|card` — Phase 4
  - 52 `ADVISOR_payment_confirmation|ach` — Phase 4
  - 53 `ADVISOR_invoice_receipt` (PDF attachments) — Phase 4

### `advisor_onboarding` table columns added in Phase 4
- `checkout_token` (text) — `/advisor-pay` token-lookup column
- `payment_method_type` (text) — `card` / `ach`
- `card_processing_fee` (numeric)
- `acct_last4` (text)
- `engagement_term_months` (integer, default 6, NOT NULL)
- `renewal_date` (date) — computed as payment_completed_at + engagement_term_months

### `document_numbers` schema extended in Phase 4
- `client_id` made nullable
- Added `advisor_onboarding_id` (bigint, FK to advisor_onboarding.id, nullable)
- CHECK constraint: exactly one of `client_id` / `advisor_onboarding_id` non-null
- Partial index on `advisor_onboarding_id`

## What's Live in Production (Frontend Deployed)

All advisor onboarding UI was deployed at the end of the prior session (`feature/admin-nav-tabs` merge + `npm run deploy`). Phase 4 added `/advisor-pay` to that — deployed 2026-05-26.

Frontend pages live in production:
- 4-tab admin top nav (Advisors / Accountants / Specialists / Automation)
- `src/components/admin/AdvisorOnboarding.jsx` — 3-stage detail UI
- `src/components/admin/AccountantOnboarding.jsx` — placeholder
- `src/pages/AdvisorDecidePage.jsx` — `/advisor-decide` token page (Phase 2)
- `src/pages/AdvisorPayPage.jsx` — `/advisor-pay` token page (Phase 4 — mirrors `TaxPayPage.jsx`)

---

## Phase 1 (Complete + Deployed) — DB + Skeleton UI + Manual Stage 1 Save

### Backend (5 actions)
| Action | Type | File | Purpose |
|---|---|---|---|
| `load_advisor_onboardings` | AUTH | `actions/advisor/load-list.ts` | List view query |
| `load_advisor_onboarding` | AUTH | `actions/advisor/load-one.ts` | Detail view query (by id) |
| `create_advisor_onboarding` | AUTH | `actions/advisor/create.ts` | "+ New Onboarding" — inserts row with first/last/email/created_by |
| `save_advisor_prelim_meeting` | AUTH | `actions/advisor/prelim-meeting.ts` | Stage 1 dropdown save (Completed / No Show), writes `prelim_meeting_status` + `prelim_meeting_status_at` |
| `automation_ADVISOR_decision` | AUTH | `actions/advisor/decision.ts` | Stage 1 button click (Yes/Undecided/No). Phase 2 extended it to chain emails. |

### Frontend
- `src/components/admin/AdvisorOnboarding.jsx` — list view (cards), "+ New Onboarding" inline form, detail view with 3 stages
- Stage 1: dropdown (Completed/No Show) + 3 colored buttons (Yes/Undecided/No). Decision buttons are NOT gated by dropdown (user requested early)
- Stage 2: read-only auto-rows that light up green as state changes
- Stage 3: visible but dimmed; "Available once invoice/receipt sent" until `invoice_sent_at` is populated
- Every row matches MAP 1 / PFT date column style (55px right-aligned, MM/DD format)

### `advisor_onboarding` table schema (full column list with phase ownership)

| Column | Type | Default | Phase | Notes |
|---|---|---|---|---|
| `id` | bigserial PK | — | 1 | |
| `created_at` | timestamptz | now() | 1 | |
| `created_by` | text | — | 1 | session.name from create call |
| `first_name` | text NOT NULL | — | 1 | |
| `last_name` | text NOT NULL | — | 1 | |
| `email` | text | — | 1 | |
| `prelim_meeting_status` | text | — | 1 | 'Completed' \| 'No Show' |
| `prelim_meeting_status_at` | timestamptz | — | 1 | |
| `prelim_meeting_decision` | text | — | 1 | 'Yes' \| 'No' \| 'Undecided' |
| `prelim_meeting_decision_at` | timestamptz | — | 1 | |
| `decision_email_sent_at` | timestamptz | — | 2 | Undecided email drafted at |
| `decision_token` | text | — | 2 | random hex for `/advisor-decide?token=…` |
| `final_decision` | text | — | 2 | 'Yes' \| 'No' (client's Yes/No click on the Undecided email) |
| `final_decision_at` | timestamptz | — | 2 | |
| `decision_reminder_sent_at` | timestamptz | — | 6 | 48h reminder ladder |
| `decision_pf_notified_at` | timestamptz | — | 6 | 96h PF notification |
| `boldsign_document_id` | text | — | 3 | |
| `agreement_sent_at` | timestamptz | — | 3 | |
| `agreement_signed_by_advisor_at` | timestamptz | — | 3 | webhook-set |
| `agreement_signed_by_ceo_at` | timestamptz | — | 3 | webhook-set |
| `signing_reminder_sent_at` | timestamptz | — | 6 | |
| `signing_pf_notified_at` | timestamptz | — | 6 | |
| `payment_link_sent_at` | timestamptz | — | 4 | |
| `stripe_customer_id` | text | — | 4 | |
| `stripe_payment_intent_id` | text | — | 4 | |
| `payment_status` | text | — | 4 | 'pending' \| 'succeeded' \| 'failed' |
| `payment_completed_at` | timestamptz | — | 4 | |
| `payment_amount` | numeric | 4000 | 4 | fixed at $4,000 |
| `payment_reminder_sent_at` | timestamptz | — | 6 | |
| `payment_pf_notified_at` | timestamptz | — | 6 | |
| `confirmation_email_sent_at` | timestamptz | — | 4 | |
| `invoice_number` | text | — | 4 | |
| `receipt_number` | text | — | 4 | |
| `invoice_sent_at` | timestamptz | — | 4 | |
| `revenue_decision` | text | — | 5 | 'Revenue Share' \| 'Money Mapping' |
| `member_number` | text | — | 5 | when member is created |
| `member_created_at` | timestamptz | — | 5 | |
| `stripe_connect_link_sent_at` | timestamptz | — | 5 | only if revenue_decision='Revenue Share' |
| `decline_email_sent_at` | timestamptz | — | 2 | |
| `status` | text NOT NULL | 'active' | 1 | 'active' \| 'stopped' \| 'completed' |

**Indexes:** `created_at DESC`, partial on `decision_token`, partial on `stripe_customer_id`, partial on `boldsign_document_id`

---

## Phase 2 (Complete + Deployed) — No Branch + Undecided Email + Token Page

### Backend additions (2 new PUBLIC actions)
| Action | Type | File | Purpose |
|---|---|---|---|
| `automation_ADVISOR_declineemail` | PUBLIC, service-role/admin gate | `actions/advisor/decline-email.ts` | Drafts decline email; idempotent on `decline_email_sent_at` |
| `automation_ADVISOR_clientdecision` | PUBLIC, token-based | `actions/advisor/client-decision.ts` | `/advisor-decide` page calls this on Yes/No click; writes `final_decision` + `final_decision_at`, chains to `_declineemail` (No) or `_sendagreement` (Yes — added in Phase 3) |

### `decision.ts` extended
- Undecided branch: generates `decision_token`, builds Gmail draft with Yes/No buttons pointing to `https://jlathamert.github.io/vfo-portal/advisor-decide?token=…&decision=Yes|No`, drafts to sandbox email
- No branch: chains to `_declineemail` via service-role HTTP fetch
- Yes branch: Phase 3 adds chain to `_sendagreement` (originally no-op in Phase 1)

### Email templates (live)
**`ADVISOR_undecided`** (id 46) — user-approved final body:
```
Dear [Advisor First],

Thank you for attending your recent Preliminary Meeting with VFO Services.

At that meeting we discussed the opportunity for you to become a member.
I understand that you are undecided as to whether to move forward with advisor onboarding.

Please click one of the buttons below to confirm your decision.

[BUTTONS]

If you have any questions, please don't hesitate to reach out.
```
Subject: `VFO Services - Advisor Onboarding decision - [Advisor Name]`

**`ADVISOR_decline`** (id 47) — user-approved final body:
```
Dear [Advisor First],

Thank you for attending your recent Preliminary Meeting with VFO Services

I understand that you have decided not to move forward with advisor onboarding at this time. Nevertheless, I hope that you found the conversation valuable.

Should you ever wish to reconsider, please do not hesitate to reach out.
```
Subject: `VFO Services - Advisor Onboarding - [Advisor Name]`

### Frontend
- `src/pages/AdvisorDecidePage.jsx` — new token page, mirrors `TaxDecidePage.jsx` styling
- `src/App.jsx` — added route `/advisor-decide`
- Stage 2 Undecided UI matches MAP 1 pattern: generic "Decision email sent" + "Client response received" rows, then an indented sub-block with a left-border and a prominent colored pill ("Yes — proceeding" green or "No — declined" red), then sub-rows under the pill

### Status pill (Stage 1 decision)
- Yes → green pill `#27ae60`
- Undecided → orange pill `#f39c12`
- No → red pill `#e74c3c`

---

## Phase 3 (Functionally Complete — Deployed — BUT timing UX issue)

### Backend additions (2 new actions, both AUTH-style server-to-server chains)
| Action | Type | File | Purpose |
|---|---|---|---|
| `automation_ADVISOR_sendagreement` | PUBLIC | `actions/advisor/send-agreement.ts` | Renders HTML→PDF via html2pdf.app, sends to BoldSign with anchor-based field placement, fetches embedded sign link for signer 1 (advisor), drafts Gmail with link |
| `automation_ADVISOR_ceocountersign` | PUBLIC | `actions/advisor/ceo-countersign.ts` | Fetches embedded sign link for signer 2 (CEO Anton), drafts Gmail with countersign link |

### Chains added in Phase 3
- `decision.ts` Yes branch → `_sendagreement`
- `client-decision.ts` Yes branch → `_sendagreement`
- BoldSign webhook fallback (in `router/webhooks.ts`): if doc isn't found in `pipeline_map1` AND not in `client_tax_plans`, falls back to `advisor_onboarding`. Handles "Signed" + "Completed" events:
  - Signed by advisor (signer 1) → writes `agreement_signed_by_advisor_at`, chains to `_ceocountersign`
  - Signed by CEO (signer 2 — matched by email `aanderson@elitert.com`) → writes `agreement_signed_by_ceo_at`
  - Completed event → writes both

### Signer configuration (BoldSign)
- Signer 1: Advisor — order=1, fields: `advisor_address` (Textbox), `vfo_ft_checkbox` (Checkbox), `pft_checkbox` (Checkbox), `corporate_checkbox` (Checkbox), `advisor_signature` (Signature, required), `advisor_print_name` (Textbox, required), `advisor_date` (DateSigned, required)
- Signer 2: Anton Anderson — email `aanderson@elitert.com`, order=2, fields: `ert_signature` (Signature, required), `ert_date` (DateSigned, required)
- `EnableSigningOrder=true` → CEO can't sign until advisor finishes
- `DisableEmails=true` → BoldSign's own emails suppressed (we draft via Gmail)
- BrandId: `f6b2e092-73a4-438e-b786-ebd20e472732` (same as MAP 1)
- Anchor-based: each formField has `anchorString` (e.g. `{{advisor_signature}}`) + `bounds: {x:0, y:0, w, h}` + `pageNumber: 1`. BoldSign scans PDF text to find the anchor location.

### Email templates (live)
**`ADVISOR_agreement_sent`** (id 48) — user-approved final body. Sent to advisor with `[SIGNING_LINK]` substitution:
```
Dear [Advisor First],

Thank you for confirming your interest in joining Elite Resource Team.

Your Advisor Onboarding Agreement is ready for your review and signature. Please [SIGNING_LINK] to open the document.

Once you have signed, Anton Anderson will countersign and you'll receive your payment link.

If you have any questions, please don't hesitate to reach out.
```
Subject: `VFO Services - Your Advisor Onboarding Agreement - [Advisor Name]`

**`ADVISOR_ceo_countersign`** (id 49) — user-approved final body. Sent to Anton with `[SIGNING_LINK]` substitution:
```
Hi Anton,

[Advisor Name] has signed their Advisor Onboarding Agreement.

Please [SIGNING_LINK] to countersign.

Once countersigned, the advisor will automatically be sent their payment link.
```
Subject: `VFO Services - Countersign needed: [Advisor Name] Advisor Onboarding Agreement`

### Frontend
Stage 2 Yes path renders 7 auto-rows (matching MAP 1 PC Admin pattern):
1. Agreement sent
2. Agreement signed by advisor
3. Agreement signed by CEO
4. Payment link sent
5. Payment made
6. Confirmation email sent
7. Invoice/receipt sent

(Rows 4-7 are Phase 4 wiring; the frontend already reads from the columns so they'll light up automatically once Phase 4 lands.)

### Agreement template (live, id=9)
Created by user via Supabase Studio. Pipeline `ADVISOR_ONBOARDING`. Service level `Advisor`. Payment plan `Single`. Substitution variables in the HTML:
- `[ADVISOR_NAME]` — built from `first_name + ' ' + last_name`
- `[ADVISOR_EMAIL]` — from `email` column
- `[EFFECTIVE_DATE]` — today's date in MM/DD/YYYY format, substituted at send time

BoldSign anchor tags in the HTML:
- `{{advisor_address}}`
- `{{vfo_ft_checkbox}}` — "must pick at least one of vfo_ft or pft, can pick both"
- `{{pft_checkbox}}`
- `{{corporate_checkbox}}` — "separate and optional"
- `{{advisor_signature}}`
- `{{advisor_print_name}}`
- `{{advisor_date}}`
- `{{ert_signature}}`
- `{{ert_date}}`

All wrapped in `<span class="tag-hidden">{{…}}</span>` (1pt white) for invisibility.

### ⚠️ Phase 3 — The Open Issue

**Symptom:** When admin clicks Yes, the chain to `_sendagreement` succeeds but the embedded sign link takes **30-45 seconds** to come back from BoldSign. Until then, the Gmail draft body shows `[signing link unavailable]`. Eventually the link is fetched (after retry loop with 5s backoff × 8 attempts), but it's slow enough that users say "I don't see an agreement" before checking again.

**Root cause:** Anchor-based field placement (`anchorString` in formFields). BoldSign processes the document asynchronously after `/v1/document/send` returns — it has to scan PDF text for each anchor before fields exist. `getEmbeddedSignLink` polling returns empty `signLink` until processing is done. MAP 1 / Tax don't hit this because their `field_map` is populated with explicit coordinates → BoldSign skips text scanning → link is ready in <1s.

**Tried:** Increased retry window from 5×4s to 8×5s — works but is intrinsically slow.

**Tried:** Hit BoldSign `GET /v1/document/properties?documentId=…` after the doc is created to try to read back BoldSign's resolved anchor coordinates → BoldSign returned the **input** bounds (all `x:0, y:0`), not the resolved positions. So we cannot programmatically recover BoldSign's anchor-resolution output.

**Three options pending user choice — STILL OPEN:**

| | Option | Effort | Result |
|---|---|---|---|
| **B** | Render PDF locally + use a Deno PDF library to extract `{{anchor}}` text positions → populate `field_map` programmatically. Switch handler from anchor-based to coordinate-based (matching MAP 1). | ~45 min new code + tuning | Instant after, fully automatic |
| **D** | Manually open the test PDF in BoldSign sandbox, eyeball coordinates of each field, write `field_map` JSON by hand. | ~15 min once | Instant after, but coords drift if HTML edited |
| **A** | Keep anchor mode + 30-45s delay | 0 effort | Functional, just slow |

**User was about to pick when they paused.** When resumed, ask "B, D, or A?"

### Other Phase 3 things to know
- The current `send-agreement.ts` has **diagnostic code** still in it (`link_attempts` and `debug_doc_properties` in the response JSON). Should be cleaned up before final commit / production.
- BoldSign test docs accumulated in sandbox during testing — orphaned but harmless.
- Sign link retry attempts: 8 with 5s backoff = up to 40s wait. Currently this lets us get the link back ~95% of the time.

---

## Phase 4 (Complete + Deployed 2026-05-26) — Stripe Payment Chain (dynamic $4,000-$8,600)

### Delivered
- Trigger: after CEO countersigns (BoldSign webhook "Completed" event) → chain to `_stripecustomer` (in BOTH the embedded handler in `router/webhooks.ts` AND the standalone `boldsign-webhook` function)
- Amount: DYNAMIC, read from `advisor_onboarding.payment_amount` — populated in Phase 3's `ceo-countersign.ts` based on BoldSign checkbox values: vfo_ft=$4000, pft=$4000, corporate=+$600 (additive). Possible totals: $4,000 / $4,600 / $8,000 / $8,600.
- Same Stripe account as MAP 1 / Tax ("VFO Services Sandbox") — uses the 4 existing env vars.
- Sandbox-aware (respects the `ADVISOR_ONBOARDING` row in `pipeline_sandbox_config`)
- Stripe metadata convention: `metadata.pipeline='ADVISOR_ONBOARDING'`, `metadata.payment_kind='onboarding'`, plus `onboarding_id`, `checkout_token`, `payment_method_type`
- `setup_future_usage=off_session` on the PaymentIntent so the card is saved for 6-month renewal review (renewal logic itself is TBD — no auto-renew cron)

### Spec — was

### Backend handlers to add (4 new PUBLIC actions)
| Action | File (to create) | Purpose |
|---|---|---|
| `automation_ADVISOR_stripecustomer` | `actions/advisor/stripe-customer.ts` | Creates Stripe Customer, chains to `_paymentemail` |
| `automation_ADVISOR_paymentemail` | `actions/advisor/payment-email.ts` | Creates Stripe Checkout Session for $4,000, drafts Gmail with `/advisor-pay?token=...` style link |
| `automation_ADVISOR_confirmationemail` | `actions/advisor/confirmation-email.ts` | After Stripe payment success, drafts "Payment received" email |
| `automation_ADVISOR_invoicereceipt` | `actions/advisor/invoice-receipt.ts` | Generates PDF invoice + receipt, drafts Gmail with PDF attachment |

### Webhook changes
- Stripe webhook (`router/webhooks.ts`): add advisor branch with `metadata.pipeline='ADVISOR'` routing
- Sequence on `payment_intent.succeeded`: writes `payment_status='succeeded'`, `payment_completed_at`, `stripe_payment_intent_id` → chains `_confirmationemail` → `_invoicereceipt`
- BoldSign webhook: extend the "Completed" event handler in the advisor branch to chain `_stripecustomer` after writing `agreement_signed_by_ceo_at`

### Email templates needed (draft + approve)
- `ADVISOR_payment_link` (to advisor, with Stripe Checkout link)
- `ADVISOR_payment_confirmation` (after payment success)
- `ADVISOR_invoice_receipt` (with PDF attached)

### Stripe Checkout / PaymentIntent
- One-time charge, not recurring
- Use existing `payment_intents` flow (matching MAP 1 first-payment pattern) OR Stripe Checkout Session (simpler)
- Product name: "VFO Advisor Onboarding"
- Receipt PDF format: mirror MAP 1's PDF layout with product label "VFO Advisor Onboarding"

### Front-end
- New token page: `src/pages/AdvisorPayPage.jsx` (mirroring `TaxPayPage.jsx` or `PayPage.jsx`)
- Route in `App.jsx`: `/advisor-pay`
- Stage 2 rows 4-7 will auto-light from existing UI as columns flip

---

## Phase 5 (Not Started) — Stage 3 Add Advisor + Stripe Connect

### Spec
- Stage 3 always visible, button **disabled until `invoice_sent_at` is set**
- UI: Revenue Decision selector (Revenue Share / Money Mapping radio or dropdown) — REQUIRED before button enables
- "Create Advisor" button only enables once Revenue Decision is picked
- Click button → backend creates new member via existing `add_member_full` (member_type='Implementation', elite_status='Active', member_number auto-generated next-integer, name/email from advisor_onboarding row)
- **If Revenue Decision = 'Revenue Share'**: an additional auto-row appears in Stage 3 showing "Stripe Connect link sent". Backend additionally chains `_stripeconnect` to generate a Stripe Connect onboarding link and email it to the advisor at their normal email (not a separate payouts email).
- If Revenue Decision = 'Money Mapping': no Connect link, just member creation.

### Backend handlers to add
| Action | Type | File | Purpose |
|---|---|---|---|
| `automation_ADVISOR_createmember` | AUTH | `actions/advisor/create-member.ts` | Stage 3 button — calls existing add-member logic, writes `member_number`, `member_created_at`, `revenue_decision`; chains to `_stripeconnect` if RS |
| `automation_ADVISOR_stripeconnect` | PUBLIC, service-role | `actions/advisor/stripe-connect.ts` | Creates Stripe Connect account link, drafts Gmail with onboarding URL |

### Stripe Connect
- Creates a new Stripe Connect account (Express) for the new member
- Returns an onboarding URL
- The new member's `stripe_account_id` populated on the `members` table (via existing flow)

### Frontend
Stage 3 UI work: replace the current "Phase 5 will wire this up" placeholder text in `AdvisorOnboarding.jsx` with the Revenue Decision selector + Create Advisor button.

---

## Phase 6 (Not Started) — Reminder Ladder Cron

### Spec
- New cron `advisor-sweep-daily` at **05:00 UTC** (off-time from the four existing crons at 02:00, 02:30, 03:00, 04:00 UTC)
- Three stalls × (48h reminder + 96h PF notification) = 6 query branches
- Stall 1: Undecided email — timer base `decision_email_sent_at`, idempotency `decision_reminder_sent_at` (48h) + `decision_pf_notified_at` (96h)
- Stall 2: Agreement signing — timer base `agreement_sent_at`, idempotency `signing_reminder_sent_at` + `signing_pf_notified_at`
- Stall 3: Payment — timer base `payment_link_sent_at`, idempotency `payment_reminder_sent_at` + `payment_pf_notified_at`
- 48h tier: drafts a reminder Gmail; 96h tier: inserts admin notification with `pipeline='ADVISOR_ONBOARDING'`, link `/admin/advisor-onboarding/<id>`

### Backend
| Action | Type | File | Purpose |
|---|---|---|---|
| `automation_ADVISOR_sweep` | PUBLIC, service-role auth | `actions/advisor/sweep.ts` | Cron-fired daily |

### Cron SQL
New file `supabase/cron/advisor-sweep.sql` (parallel to the 4 existing). One-time apply via Supabase MCP `execute_sql`. Uses `pg_cron` + `pg_net`. Authorization header: the newer `sb_secret_xxx` key, not the legacy `eyJ` JWT (per memory).

### Email templates needed
- `ADVISOR_undecided_reminder`
- `ADVISOR_signing_reminder`
- `ADVISOR_payment_reminder`

---

## Outstanding TODOs (deferred from earlier sessions)

1. **Attach Implementation Agreement PDF to the `ADVISOR_undecided` email.** The body now says "We have attached the Implementation Agreement for your review" but the handler currently drafts a plain HTML email with no attachment. To wire: upload a static PDF (export of the agreement_templates id=9 HTML) to a new public Supabase Storage bucket (e.g. `advisor-onboarding-agreements/implementation-agreement.pdf`), then extend `decision.ts` Undecided branch to fetch the PDF and add it as a multipart/mixed attachment — mirror the Tax Undecided pattern in `actions/tax/decision.ts` (~lines 130-140 of that file). Update agreement PDF in bucket whenever the contract text changes.
2. **14-day implicit-no rule for Undecided.** New copy reads: "If we don't hear from you within 14 days, we will assume that you do not wish to proceed." To enforce: extend the `advisor-sweep-daily` cron (Phase 6) with a new branch — at 14 days after `decision_email_sent_at` with no `final_decision`, auto-set `final_decision='Auto-Declined'` (or similar) and chain to `_declineemail`. Insert admin notification. Don't override an explicit click.
3. ~~Checkbox-group enforcement~~ — **RESOLVED 2026-05-26.** BoldSign's `FormGroups` parameter requires .NET model-binding dot-notation in multipart form-data (NOT JSON-stringified). Working format in `send-agreement.ts`:
   ```
   FormGroups[0].GroupNames      = "plan_type"
   FormGroups[0].GroupValidation = "Minimum"
   FormGroups[0].MinimumCount    = "1"
   ```
   Each grouped checkbox formField has `groupName: "plan_type"` (camelCase, inside the Signers JSON). BoldSign signing UI now blocks submit until at least one of vfo_ft/pft is checked. Verified end-to-end.
4. **Phase 3 send-agreement coordinates are placeholders.** Currently `field_map` on agreement_templates id=9 has rough-guess x/y/page values. Once the agreement HTML is finalized, render one test doc, eyeball the field positions in the BoldSign signing page, and tighten the coordinates.

---

## Open Decisions Log

- ✅ Stage 1 dropdown gate on decision buttons: **removed** (user said "lets remove that requirement")
- ✅ Decision buttons style: green/orange/red colored pills when picked
- ✅ Stage 2 Undecided sub-decision visibility: match MAP 1's pattern (left-border indented sub-block with prominent colored pill)
- ✅ Email template content (4 templates): user-edited and approved
- ✅ Sandbox: enabled by default for `ADVISOR_ONBOARDING`, all emails route to `jlatham@elitert.com`
- ✅ EFFECTIVE_DATE format: `MM/DD/YYYY`
- ✅ Anton = CEO; matches MAP 1 "CEO" wording in UI labels (Stage 2 row label is "Agreement signed by CEO")
- ✅ Invoice/receipt PDF: same layout as MAP 1, product label "VFO Advisor Onboarding"
- ✅ Stage 3 visibility: always visible, disabled until `invoice_sent_at` is set
- ✅ `notifications.pipeline` value: `'ADVISOR_ONBOARDING'` (verbose)
- ✅ Member number: same next-integer algo as Add Advisor
- ✅ Stripe / BoldSign placeholders: OK to use until real ones provided
- ❌ **Phase 3 BoldSign timing issue: B / D / A — NOT YET PICKED**

---

## Test Fixture

There's one test onboarding in the DB for Jake Latham:
- `advisor_onboarding.id = 1`
- `first_name='Jake'`, `last_name='Latham'`, `email='jake.latham11@icloud.com'`
- Multiple resets done during testing; full state-reset SQL (preserves the row, clears all phase 1-4 state) for future testing:
  ```sql
  DELETE FROM document_numbers WHERE advisor_onboarding_id = 1;

  UPDATE advisor_onboarding SET
    prelim_meeting_decision = NULL, prelim_meeting_decision_at = NULL,
    decision_email_sent_at = NULL, decision_token = NULL,
    final_decision = NULL, final_decision_at = NULL, decline_email_sent_at = NULL,
    decision_reminder_sent_at = NULL, decision_pf_notified_at = NULL,
    boldsign_document_id = NULL, agreement_sent_at = NULL,
    agreement_signed_by_advisor_at = NULL, agreement_signed_by_ceo_at = NULL,
    signing_reminder_sent_at = NULL, signing_pf_notified_at = NULL,
    selected_vfo_ft = NULL, selected_pft = NULL, selected_corporate = NULL,
    payment_amount = 4000,
    payment_link_sent_at = NULL, stripe_customer_id = NULL, stripe_payment_intent_id = NULL,
    payment_status = NULL, payment_completed_at = NULL,
    confirmation_email_sent_at = NULL, invoice_number = NULL, receipt_number = NULL,
    invoice_sent_at = NULL, payment_method_type = NULL, card_processing_fee = NULL,
    checkout_token = NULL, acct_last4 = NULL, renewal_date = NULL,
    payment_reminder_sent_at = NULL, payment_pf_notified_at = NULL,
    prelim_meeting_status = 'Completed',
    prelim_meeting_status_at = now()
  WHERE id = 1;
  ```

---

## How to Resume in a New Session

If returning to **this same chat**, full conversation context is intact — just continue.

If a new chat is needed, paste this in:
> *"I'm resuming a multi-phase Advisor Onboarding feature build on branch `feature/admin-nav-tabs`. Worktrees: `C:\vfo-react\.claude\worktrees\admin-nav-tabs` and `C:\vfo-edge-functions\.claude\worktrees\admin-nav-tabs`. Read the full resumption doc at `C:\vfo-react\.claude\worktrees\admin-nav-tabs\ADVISOR_ONBOARDING_RESUMPTION.md` for everything we've done, what's deployed, and what's pending. We're blocked picking between options B / D / A for the Phase 3 BoldSign sign-link timing issue (see the doc's open-decisions section)."*

### To restart dev server
```powershell
cd C:\vfo-react\.claude\worktrees\admin-nav-tabs; npm run dev
```
Dev URL: `http://localhost:5174/vfo-portal/` (or 5173 if that one's free)

### To verify backend is still deployed
```powershell
'{"action":"load_advisor_onboardings","token":"dummy"}' | Out-File tmp.json -Encoding ascii -NoNewline
curl.exe -s -w '|HTTP %{http_code}' -X POST 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api' -H 'Content-Type: application/json' --data-binary "@tmp.json"
Remove-Item tmp.json
```
Should return `401 Unauthorized` (auth gate hit, action exists). If `400 Unknown action`, deploy is stale.

### Verification gate (backend)
```powershell
cd C:\vfo-edge-functions\.claude\worktrees\admin-nav-tabs
& "C:\Users\jakel_fjetgbx\.deno\bin\deno.exe" check supabase/functions/vfo-admin-api/index.ts 2>&1 | Select-String "Found"
# Expect: "Found 7 errors." (baseline preserved)
```

```powershell
$logins = (Select-String -Path supabase/functions/vfo-admin-api/index.ts -Pattern '^\s*if \(action === ' -AllMatches).Matches.Count
$dispatch = (Select-String -Path supabase/functions/vfo-admin-api/router/dispatch.ts -Pattern '^\s*"([a-zA-Z0-9_]+)":\s*\(c\)' -AllMatches).Matches.Count
"action count: $($logins + $dispatch) (must be 171 for current state)"
```

---

## Diff Summary Since `main`

### Backend (`vfo-edge-functions/.claude/worktrees/admin-nav-tabs`)
New files:
- `supabase/functions/vfo-admin-api/actions/advisor/load-list.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/load-one.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/create.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/prelim-meeting.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/decision.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/decline-email.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/client-decision.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/send-agreement.ts`
- `supabase/functions/vfo-admin-api/actions/advisor/ceo-countersign.ts`

Modified:
- `supabase/functions/vfo-admin-api/router/dispatch.ts` (9 new imports + 9 new dispatch entries)
- `supabase/functions/vfo-admin-api/router/webhooks.ts` (advisor branch added to BoldSign webhook)

### Frontend (`vfo-react/.claude/worktrees/admin-nav-tabs`)
New files:
- `src/components/admin/AdvisorOnboarding.jsx` (full rewrite from placeholder)
- `src/components/admin/AccountantOnboarding.jsx` (placeholder)
- `src/pages/AdvisorDecidePage.jsx`

Modified:
- `src/pages/AdminPortal.jsx` (4-tab nav restructure)
- `src/pages/AdminLogin.jsx` (sessionStorage cleanup)
- `src/components/admin/MembersPanel.jsx` (Advisors/Accountants split + AccountantsPanel shell)
- `src/App.jsx` (added `/advisor-decide` route + import)

---

## Caveats / Gotchas to Remember

1. **`send-agreement.ts` has diagnostic code still in it** (`link_attempts`, `debug_doc_properties` fields in response, extended retry to 8×5s). Clean up before merging to main.
2. **Frontend not deployed.** The whole branch's UI lives only in dev. Production frontend still has the Phase 0 placeholder. Running prod-side flows (admin clicking Yes in real life) **won't work** until frontend ships.
3. **Backend IS deployed.** So if you invoke advisor actions via curl, they work.
4. **Token URL in advisor emails hardcodes the prod host** (`https://jlathamert.github.io/vfo-portal/advisor-decide`). When testing in dev, manually rewrite the host to `localhost:5174` in the Gmail draft body.
5. **Sandbox routes all emails to `jlatham@elitert.com`**. CEO countersign email also goes there in sandbox. Don't be confused by both emails landing in the same inbox.
6. **BoldSign anchor mode is intrinsically slower than coordinate mode** — this is the open Phase 3 issue. Don't expect a "tweak the retry timing" fix to work; it's structural.
7. **BoldSign template id 9 has no `boldsign_template_id`** — we use direct-send mode with HTML + anchors, not the template flow. Don't try to add a `templateId` to the BoldSign request.
8. **`pipeline_sandbox_config` row id 3 (ADVISOR_ONBOARDING) is `sandbox_mode=true`**. To go live for advisor testing in production with real BoldSign/Stripe, flip `sandbox_mode=false`.
9. **All 4 BoldSign test documents** created during Phase 3 testing exist in BoldSign sandbox — orphaned, no cleanup needed.
10. **The dev server runs on port 5174** (5173 was taken by an earlier session). Standard `npm run dev` will pick the next available port if 5174 is taken too.
