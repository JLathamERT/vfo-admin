# Advisor Onboarding — Current State

**Status:** Shipped. Phases 1–6 + member-portal login setup chain + admin Automation Panel all live in production. No active build branch; this doc is a current-state reference, not a resumption handoff.

**Last material change:** 2026-05-28 — added member-portal login setup, admin Automation Panel ("Advisor Onboarding" tab), always-15th-of-month `renewal_date` rule, BoldSign address field made required, Undecided email PDF filename corrected to `Advisor_Implementation_Agreement.pdf`. Also 2026-05-28: fixed a latent bug in `actions/advisor/ceo-countersign.ts` where the BoldSign field-read parser used `s.order === 1` which never matched — every prior advisor onboarding silently wrote `selected_*=false, payment_amount=0`. Permissive multi-key signer lookup + multi-key field-id match + soft-fail with admin notification + diagnostic shape dump now ships. See SESSION_REFERENCE.md gotcha #38.

**Parallel pipeline:** Accountant Onboarding (mirror of this pipeline + new Stage 1 Partnership? step) shipped same day. See `ACCOUNTANT_ONBOARDING_RESUMPTION.md` at repo root for accountant-specific details.

---

## What the feature does

End-to-end pipeline that takes a candidate advisor from "we had a preliminary meeting" to "fully onboarded VFO member with a portal login" — no manual data entry between stages once the admin makes their decisions.

Top-level stages on the admin `AdvisorOnboarding.jsx` panel:

1. **Preliminary Meeting & Decision** — admin records the meeting outcome and picks Yes / No / Undecided. Undecided drafts a Gmail to the advisor with Yes/No buttons; No drafts a decline email; Yes proceeds straight to Stage 2.
2. **PC Admin (Agreement → Payment → Invoice/Receipt)** — auto-fires the BoldSign agreement send, awaits advisor signature + CEO countersign, then auto-fires the Stripe customer + payment-link email. After payment succeeds the chain drafts the confirmation email + invoice/receipt PDFs and uploads them. Plan pricing is dynamic ($4,000 / $4,600 / $8,000 / $8,600) based on which plan checkboxes the advisor ticked in BoldSign.
3. **Add New Advisor** — admin clicks "Create Advisor & Send Setup Link". Backend creates the `members` + `member_plugin_settings` rows (member_number ≥ 60100 namespace, kept separate from legacy 59xxx), then chains the member-portal login-setup email. Advisor clicks the link → `/member-setup` token page → picks a passcode → redirected to `/member/login` with email pre-filled. Login is created, advisor is in the portal.

Reminder cron `advisor-sweep-daily` (05:00 UTC) drives 3 reminder ladders × (48h reminder + 96h PF notification) on the Undecided email, BoldSign signing, and payment-link stalls, plus a 14-day implicit-No rule that auto-declines stale Undecideds.

---

## Production state

- **Supabase project:** `ejpsprsmhpufwogbmxjv`
- **Backend:** `vfo-admin-api` edge function. 21 handlers in `actions/advisor/` (counted as part of the 196-action total). `deno check` baseline = 7 errors (preserved).
- **Standalone `boldsign-webhook`:** extended for advisor routing (Phase 3) and the `_stripecustomer` chain on Completed (Phase 4). Deploys MUST pass `--no-verify-jwt`.
- **Five daily pg_cron jobs:** 02:00 (MAP1 revshare), 02:30 (Tax revshare), 03:00 (chargescheduled), 04:00 (check reminder), **05:00 (advisor sweep)**. Setup file: `supabase/cron/advisor-sweep.sql`.
- **Sandbox config:** `pipeline_sandbox_config` row for `pipeline='ADVISOR_ONBOARDING'` (independent of MAP 1 / Tax / PIP sandbox flags).
- **Storage bucket:** `advisor-onboarding-agreements` (public) containing `Advisor_Implementation_Agreement.pdf` — attached to Undecided emails; graceful no-attachment fallback if missing.
- **Frontend:** pages `AdvisorDecidePage`, `AdvisorPayPage`, `MemberSetupPage`; admin components `AdvisorOnboarding`, `AdvisorAutomationPanel`. All live on gh-pages.

---

## All 21 advisor backend handlers

Files live under `supabase/functions/vfo-admin-api/actions/advisor/`.

| Action | File | Type | Phase / Added |
|---|---|---|---|
| `load_advisor_onboardings` | `load-list.ts` | AUTH | Phase 1 |
| `load_advisor_onboarding` | `load-one.ts` | AUTH | Phase 1 |
| `create_advisor_onboarding` | `create.ts` | AUTH | Phase 1 |
| `save_advisor_prelim_meeting` | `prelim-meeting.ts` | AUTH | Phase 1 |
| `automation_ADVISOR_decision` | `decision.ts` | AUTH | Phase 1 (Undecided branch fetches `Advisor_Implementation_Agreement.pdf` from Storage and attaches via multipart/mixed) |
| `automation_ADVISOR_declineemail` | `decline-email.ts` | PUBLIC | Phase 2 |
| `automation_ADVISOR_clientdecision` | `client-decision.ts` | PUBLIC (token) | Phase 2 |
| `automation_ADVISOR_sendagreement` | `send-agreement.ts` | PUBLIC | Phase 3 (`advisor_address` field is `isRequired: true`) |
| `automation_ADVISOR_ceocountersign` | `ceo-countersign.ts` | PUBLIC | Phase 3 (reads BoldSign checkboxes → computes `payment_amount`) |
| `automation_ADVISOR_stripecustomer` | `stripe-customer.ts` | PUBLIC | Phase 4 |
| `automation_ADVISOR_paymentemail` | `payment-email.ts` | PUBLIC | Phase 4 |
| `automation_ADVISOR_loadpayment` | `load-payment.ts` | PUBLIC (token) | Phase 4 |
| `automation_ADVISOR_stripecheckout` | `stripe-checkout.ts` | PUBLIC (token) | Phase 4 |
| `automation_ADVISOR_confirmationemail` | `confirmation-email.ts` | PUBLIC | Phase 4 |
| `automation_ADVISOR_invoicereceipt` | `invoice-receipt.ts` | PUBLIC | Phase 4 |
| `automation_ADVISOR_createmember` | `create-member.ts` | AUTH | Phase 5 (chains `_loginsetupemail` after member create) |
| `automation_ADVISOR_sweep` | `sweep.ts` | PUBLIC (service-role) | Phase 6 |
| `automation_ADVISOR_loginsetupemail` | `login-setup-email.ts` | PUBLIC | 2026-05-28 |
| `automation_ADVISOR_loadloginsetup` | `load-login-setup.ts` | PUBLIC (token) | 2026-05-28 |
| `automation_ADVISOR_submitloginsetup` | `submit-login-setup.ts` | PUBLIC (token) | 2026-05-28 |
| `automation_load_advisor_pipelines` | `automation-load-pipelines.ts` | AUTH (admin) | 2026-05-28 — feeds the admin Automation Panel |

**Stripe webhook routing:** the embedded handler in `router/webhooks.ts` resolves advisor onboarding rows by `stripe_customer_id` after MAP1 and Tax misses, branching on `metadata.pipeline='ADVISOR_ONBOARDING'` + `metadata.payment_kind='onboarding'`. On payment success it writes `payment_completed_at` + `renewal_date` via `computeAdvisorRenewalDate(today, engagement_term_months)` — always-15th-of-month rounded up, never less than the term. Then chains `automation_ADVISOR_confirmationemail` (which chains `_invoicereceipt`).

---

## `advisor_onboarding` table schema (authoritative)

This table is not documented in `docs/tables/` — this is the only source-of-truth schema record.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | bigserial PK | — | |
| `created_at` | timestamptz | now() | |
| `created_by` | text | — | session.name from `create_advisor_onboarding` |
| `first_name` | text NOT NULL | — | |
| `last_name` | text NOT NULL | — | |
| `email` | text | — | |
| `status` | text NOT NULL | 'active' | `'active' | 'stopped' | 'completed'` |
| `prelim_meeting_status` | text | — | `'Completed' | 'No Show'` |
| `prelim_meeting_status_at` | timestamptz | — | |
| `prelim_meeting_decision` | text | — | `'Yes' | 'No' | 'Undecided'` |
| `prelim_meeting_decision_at` | timestamptz | — | |
| `decision_email_sent_at` | timestamptz | — | Undecided email drafted at |
| `decision_token` | text | — | random hex for `/advisor-decide?token=…` |
| `final_decision` | text | — | `'Yes' | 'No' | 'Auto-Declined'` (client click or 14-day rule) |
| `final_decision_at` | timestamptz | — | |
| `decline_email_sent_at` | timestamptz | — | |
| `decision_reminder_sent_at` | timestamptz | — | 48h reminder idempotency |
| `decision_pf_notified_at` | timestamptz | — | 96h PF notification idempotency |
| `boldsign_document_id` | text | — | |
| `agreement_sent_at` | timestamptz | — | |
| `agreement_signed_by_advisor_at` | timestamptz | — | webhook-set |
| `agreement_signed_by_ceo_at` | timestamptz | — | webhook-set |
| `signing_reminder_sent_at` | timestamptz | — | |
| `signing_pf_notified_at` | timestamptz | — | |
| `selected_vfo_ft` | boolean | — | BoldSign checkbox readback (Phase 3 countersign) |
| `selected_pft` | boolean | — | BoldSign checkbox readback |
| `selected_corporate` | boolean | — | BoldSign checkbox readback |
| `payment_amount` | numeric NOT NULL | 4000 | Overwritten in Phase 3 countersign based on plan picks: $4,000 / $4,600 / $8,000 / $8,600 |
| `engagement_term_months` | integer NOT NULL | 6 | |
| `stripe_customer_id` | text | — | |
| `stripe_payment_intent_id` | text | — | |
| `checkout_token` | text | — | `/advisor-pay` token-lookup column |
| `payment_link_sent_at` | timestamptz | — | |
| `payment_status` | text | — | `'pending' | 'processing' | 'succeeded' | 'failed'` |
| `payment_method_type` | text | — | `'card' | 'ach'` |
| `acct_last4` | text | — | |
| `card_processing_fee` | numeric | — | |
| `payment_completed_at` | timestamptz | — | |
| `payment_reminder_sent_at` | timestamptz | — | |
| `payment_pf_notified_at` | timestamptz | — | |
| `renewal_date` | date | — | Computed by `computeAdvisorRenewalDate` (always 15th, never < `engagement_term_months`) |
| `confirmation_email_sent_at` | timestamptz | — | |
| `invoice_number` | text | — | `INV-ADV{onboarding_id}-{seq:0004}` from shared global `document_numbers` counter |
| `receipt_number` | text | — | `REC-ADV{onboarding_id}-{seq:0004}` |
| `invoice_sent_at` | timestamptz | — | |
| `revenue_decision` | text | — | `'Money Mapping'` (Money Mapping is the only path now — `'Revenue Share'` deferred) |
| `member_number` | text | — | written by `automation_ADVISOR_createmember`; ≥ 60100 |
| `member_created_at` | timestamptz | — | |
| `stripe_connect_link_sent_at` | timestamptz | — | unused (Revenue Share path deferred) |
| `login_setup_token` | text | — | UUID for `/member-setup?token=…`; unique partial index where not null |
| `login_setup_token_expires_at` | timestamptz | — | 14 days from generation |
| `login_setup_email_sent_at` | timestamptz | — | idempotency guard on `_loginsetupemail` |
| `login_setup_completed_at` | timestamptz | — | set by `_submitloginsetup` after `member_logins` insert |

**Indexes:** `created_at DESC`, partial on `decision_token`, partial on `stripe_customer_id`, partial on `boldsign_document_id`, partial unique on `login_setup_token`.

---

## Email templates (12 total, all `pipeline='ADVISOR_ONBOARDING'`)

| Name | Trigger |
|---|---|
| `ADVISOR_undecided` | Stage 1 Undecided pick → Gmail with Yes/No buttons + PDF attachment |
| `ADVISOR_undecided_reminder` | 48h sweep, Undecided stall |
| `ADVISOR_decline` | Stage 1 No pick OR 14-day auto-decline |
| `ADVISOR_agreement_sent` | Stage 2 BoldSign sent confirmation |
| `ADVISOR_signing_reminder` | 48h sweep, signing stall |
| `ADVISOR_ceo_countersign` | Advisor signed → email to Pat/CEO to countersign |
| `ADVISOR_payment_link` | Stage 3 after countersign → payment link to advisor |
| `ADVISOR_payment_reminder` | 48h sweep, payment stall |
| `ADVISOR_payment_confirmation\|card` | Stripe webhook, card success |
| `ADVISOR_payment_confirmation\|ach` | Stripe webhook, ACH success |
| `ADVISOR_invoice_receipt` | Chained from confirmation; INV + REC PDFs attached |
| `ADVISOR_login_setup` | Chained from `_createmember`; `/member-setup` setup link |

---

## Frontend surfaces

- `src/components/admin/AdvisorOnboarding.jsx` — list view with 3 collapsible groups (In Progress / Completed / Stopped), 3-stage detail UI; Row + AutoRow use `marginLeft: 'auto'` cluster with 32px reserved date slot (no shift between Done and Not-completed states).
- `src/components/admin/AdvisorAutomationPanel.jsx` — admin Automation tab → "Advisor Onboarding" menu item. One row per `advisor_onboarding` record; 6 collapsible step blocks (Decision → Agreement → Payment → Confirmation/Invoice → Advisor Creation → Member Login Setup). Loads via `automation_load_advisor_pipelines`.
- `src/pages/AdvisorDecidePage.jsx` — `/advisor-decide?token=&decision=Yes|No` — fires `automation_ADVISOR_clientdecision`.
- `src/pages/AdvisorPayPage.jsx` — `/advisor-pay?token=` — fires `automation_ADVISOR_loadpayment` + `_stripecheckout`.
- `src/pages/MemberSetupPage.jsx` — `/member-setup?token=` — 4 states (loading / invalid / already_setup / ready form); fires `_loadloginsetup` + `_submitloginsetup`.
- `src/pages/MemberLogin.jsx` — accepts `location.state.email` prefill + green "Login created" banner when `fromSetup=true` (set by `MemberSetupPage` after successful passcode setup).

---

## Canonical docs (start here for deeper architecture context)

- `docs/architecture/03-edge-functions.md` — backend file layout, request flow, webhook routing
- `docs/architecture/05-api-action-catalog.md` — every action + R/W/chains; includes all 21 advisor handlers
- `docs/architecture/02-frontend-shell.md` — routes + admin components
- `docs/integrations/supabase.md` — `advisor-onboarding-agreements` bucket entry
- `docs/integrations/boldsign.md` — BoldSign webhook routing (resolves by table lookup on `boldsign_document_id`)
- `docs/flows/stripe-webhook.md` — Stripe webhook routing tree
- `docs/flows/boldsign-webhook.md` — BoldSign webhook routing tree

---

## Known follow-ups / deferred items

- **Revenue Share path is unbuilt.** All onboarding-created advisors are Money Mapping by default. The `stripe_connect_link_sent_at` column exists but no handler writes it.
- **No auto-renewal cron.** `renewal_date` is displayed on the invoice/receipt as a reminder; no automation triggers off it at 6 months. Manual outreach at that point.
- **`docs/tables/advisor_onboarding.md` does not exist.** This file's schema table is the only source.
- **`agreement_templates.id=9` `title` still says "(Placeholder)"** — coords are final; the title is cosmetic but worth cleaning up.
