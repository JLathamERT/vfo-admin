# Advisor Onboarding — Current State

**Status:** Shipped. Phases 1–6 + member-portal login setup chain + admin Automation Panel + Stage-1 Team Member Responsible step + New Model Sale team email all live in production. No active build branch; this doc is a current-state reference, not a resumption handoff.

**Last material change:** 2026-06-15 (vfo-admin-api v462) — added the Stage-1 **Team Member Responsible** step (gates the Decision; routes this onboarding's notifications to the chosen team member instead of the shared `admin` bell — see `constants/onboarding-team.ts` `teamMemberRecipient`), a new "ready to create" action-required notification fired on invoice-sent (so the team member is pinged the moment the Stage-3 Create button unlocks), the **New Model Sale** internal team email drafted on advisor create (`utils/new-model-sale-email.ts` → `email_templates` `pipeline='TEAM'`/`new_model_sale` `to_list`), and removed `[EFFECTIVE_DATE]` from the advisor agreement template (`agreement_templates.id=9` html_body + the bucket PDF — matching specialist id 12). Security: the advisor AUTH actions were added to `ADMIN_ONLY_ACTIONS` (`role-gates.ts`) so a member session can't call them. New `save_advisor_team_member` action (handler count 21→22) + ten new `advisor_onboarding` columns (see schema table). Frontend (dev-only, not yet deployed): the **NewModelSaleModal** on the Stage-3 Create button, the "Team Member Responsible" Row, the Email Templates "Team Notification" section, and a self-heal for stale `?onboarding=` deep-links after an onboarding is deleted.

**Prior material change:** 2026-05-28 — added member-portal login setup, admin Automation Panel ("Advisor Onboarding" tab), always-15th-of-month `renewal_date` rule, BoldSign address field made required, Undecided email PDF filename corrected to `Advisor_Implementation_Agreement.pdf`. Also 2026-05-28: fixed a latent bug in `actions/advisor/ceo-countersign.ts` where the BoldSign field-read parser used `s.order === 1` which never matched — every prior advisor onboarding silently wrote `selected_*=false, payment_amount=0`. Permissive multi-key signer lookup + multi-key field-id match + soft-fail with admin notification + diagnostic shape dump now ships. See SESSION_REFERENCE.md gotcha #38.

**Parallel pipeline:** Accountant Onboarding (mirror of this pipeline + new Stage 1 Partnership? step) shipped same day. See `ACCOUNTANT_ONBOARDING_RESUMPTION.md` at repo root for accountant-specific details.

---

## What the feature does

End-to-end pipeline that takes a candidate advisor from "we had a preliminary meeting" to "fully onboarded VFO member with a portal login" — no manual data entry between stages once the admin makes their decisions.

Top-level stages on the admin `AdvisorOnboarding.jsx` panel:

1. **Preliminary Meeting, Team Member & Decision** — admin records the meeting outcome, picks the **Team Member Responsible** (the internal owner — a required dropdown that gates the Decision; the Yes/Undecided/No buttons stay disabled until it is set), then picks Yes / No / Undecided. The chosen team member becomes the notification recipient for this onboarding (see "notification routing" below). Undecided drafts a Gmail to the advisor with Yes/No buttons; No drafts a decline email; Yes proceeds straight to Stage 2.
2. **PC Admin (Agreement → Payment → Invoice/Receipt)** — auto-fires the BoldSign agreement send, awaits advisor signature + CEO countersign, then auto-fires the Stripe customer + payment-link email. After payment succeeds the chain drafts the confirmation email + invoice/receipt PDFs and uploads them, then raises a "ready to create" action-required notification (dismissible:false) to the onboarding's team member — the Stage-3 Create button is now unlocked. Plan pricing is dynamic ($4,000 / $4,600 / $8,000 / $8,600) based on which plan checkboxes the advisor ticked in BoldSign.
3. **Add New Advisor** — admin clicks "Create Advisor & Send Setup Link", which opens the **NewModelSaleModal** (closer / setter / introduced-by + a member-introduction search + company name + website) and submits those fields to `automation_ADVISOR_createmember`. Backend creates the `members` + `member_plugin_settings` rows (member_number assigned by the category-relative `nextMemberNumber('advisor','New Model')` helper — see SESSION_REFERENCE gotcha #48; the old fixed ≥60100 namespace is gone), writes the sale fields back to `advisor_onboarding`, clears the "ready to create" notification, then chains the member-portal login-setup email **and** drafts the **New Model Sale** internal team email (`utils/new-model-sale-email.ts`). Advisor clicks the login link → `/member-setup` token page → picks a passcode → redirected to `/member/login` with email pre-filled. Login is created, advisor is in the portal.

Reminder cron `advisor-sweep-daily` (05:00 UTC) drives 3 reminder ladders × (48h reminder + 96h notification) on the Undecided email, BoldSign signing, and payment-link stalls, plus a 14-day implicit-No rule that auto-declines stale Undecideds.

**Notification routing.** As of v462, advisor-onboarding notifications route to the **Team Member Responsible** via `teamMemberRecipient(ob.onboarding_team_member)` (`constants/onboarding-team.ts` — maps the display name to that person's `@elitert.com` login email; falls back to the shared `admin` bell when unset/unmapped). Rerouted: the three 96h stall notifications + the "ready to create" action-required + **both** the client-clicked-**Yes** and **No** notifications. (The CEO-countersign FYI + the `Plan-checkbox read failed` diagnostic stay on `admin`.)

---

## Production state

- **Supabase project:** `ejpsprsmhpufwogbmxjv`
- **Backend:** `vfo-admin-api` edge function (LIVE v462). 22 handlers in `actions/advisor/` (added `save_advisor_team_member`). The overall action catalog is 300 as of this session (see SESSION_REFERENCE.md LIVE STATE for the authoritative total). `deno check` = 0 errors.
- **Standalone `boldsign-webhook`:** extended for advisor routing (Phase 3) and the `_stripecustomer` chain on Completed (Phase 4). Deploys MUST pass `--no-verify-jwt`.
- **Five daily pg_cron jobs:** 02:00 (MAP1 revshare), 02:30 (Tax revshare), 03:00 (chargescheduled), 04:00 (check reminder), **05:00 (advisor sweep)**. Setup file: `supabase/cron/advisor-sweep.sql`.
- **Sandbox config:** `pipeline_sandbox_config` row for `pipeline='ADVISOR_ONBOARDING'` (independent of MAP 1 / Tax / PIP sandbox flags).
- **Storage bucket:** `advisor-onboarding-agreements` (public) containing `Advisor_Implementation_Agreement.pdf` — attached to Undecided emails; graceful no-attachment fallback if missing. Regenerated 2026-06-15 without the `[EFFECTIVE_DATE]` line.
- **Frontend:** pages `AdvisorDecidePage`, `AdvisorPayPage`, `MemberSetupPage`; admin components `AdvisorOnboarding`, `AdvisorAutomationPanel`, `NewModelSaleModal`. The pre-2026-06-15 surfaces are live on gh-pages; this session's UI (Team Member Responsible Row, NewModelSaleModal, Email Templates "Team Notification" section, deleted-onboarding deep-link self-heal) is dev-only and **not yet deployed**.

---

## All 22 advisor backend handlers

Files live under `supabase/functions/vfo-admin-api/actions/advisor/`.

| Action | File | Type | Phase / Added |
|---|---|---|---|
| `load_advisor_onboardings` | `load-list.ts` | AUTH | Phase 1 |
| `load_advisor_onboarding` | `load-one.ts` | AUTH | Phase 1 |
| `create_advisor_onboarding` | `create.ts` | AUTH | Phase 1 |
| `save_advisor_prelim_meeting` | `prelim-meeting.ts` | AUTH | Phase 1 |
| `save_advisor_team_member` | `save-team-member.ts` | AUTH | 2026-06-15 — Stage-1 "Team Member Responsible"; writes `onboarding_team_member` (+`_at`); validates against `TEAM_MEMBER_NAMES` |
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
| `automation_ADVISOR_createmember` | `create-member.ts` | AUTH | Phase 5 (chains `_loginsetupemail` + drafts the New Model Sale team email after member create; accepts the NewModelSaleModal `sale_*` fields; clears the "ready to create" notification) |
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
| `member_number` | text | — | written by `automation_ADVISOR_createmember`; assigned via `nextMemberNumber('advisor','New Model')` (gotcha #48 — no fixed 60100) |
| `member_created_at` | timestamptz | — | |
| `stripe_connect_link_sent_at` | timestamptz | — | unused (Revenue Share path deferred) |
| `login_setup_token` | text | — | UUID for `/member-setup?token=…`; unique partial index where not null |
| `login_setup_token_expires_at` | timestamptz | — | 14 days from generation |
| `login_setup_email_sent_at` | timestamptz | — | idempotency guard on `_loginsetupemail` |
| `login_setup_completed_at` | timestamptz | — | set by `_submitloginsetup` after `member_logins` insert |
| `onboarding_team_member` | text | — | Stage-1 "Team Member Responsible"; the display name (one of `TEAM_MEMBER_NAMES`). Gates the Decision; routes this onboarding's notifications via `teamMemberRecipient()`. Written by `save_advisor_team_member`. |
| `onboarding_team_member_at` | timestamptz | — | set when `onboarding_team_member` is chosen |
| `sale_closer` | text | — | NewModelSaleModal field; captured at create; feeds the New Model Sale email `[CLOSER]` |
| `sale_setter` | text | — | NewModelSaleModal field → `[SETTER]` |
| `sale_introduced_by` | text | — | NewModelSaleModal field → `[INTRODUCED_BY]` |
| `sale_introduced_member_number` | text | — | NewModelSaleModal member-introduction search result (member number) |
| `sale_introduced_member_name` | text | — | NewModelSaleModal member-introduction search result (name) → `[MEMBER_INTRODUCTION]` |
| `sale_company_name` | text | — | NewModelSaleModal field → optional `[COMPANY_BULLET]` (row only rendered when filled) |
| `sale_website` | text | — | NewModelSaleModal field → optional `[WEBSITE_BULLET]` |
| `new_model_sale_email_sent_at` | timestamptz | — | single-send claim for the New Model Sale team email (atomically set then rolled back on draft failure) |

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

Plus one cross-pipeline template that the advisor flow triggers but which is **not** under `pipeline='ADVISOR_ONBOARDING'`:

| Name | Pipeline | Trigger |
|---|---|---|
| `new_model_sale` | `TEAM` | Drafted by `_createmember` (via `utils/new-model-sale-email.ts`). Sends TO the recipients in its `email_templates.to_list` jsonb column (no Cc/Bcc); editable in the Email Templates "Team Notification" section. Shared with Accountant Onboarding. |

---

## Frontend surfaces

- `src/components/admin/AdvisorOnboarding.jsx` — list view with 3 collapsible groups (In Progress / Completed / Stopped), 3-stage detail UI; Row + AutoRow use `marginLeft: 'auto'` cluster with 32px reserved date slot (no shift between Done and Not-completed states). Stage 1 now has a "Team Member Responsible" Row (`SALES_TEAM_NAMES` dropdown → `save_advisor_team_member`) that gates the Decision buttons. The Stage-3 "Create Advisor & Send Setup Link" button opens `NewModelSaleModal` instead of firing directly. Also self-heals a stale `?onboarding=` deep-link when the referenced onboarding no longer exists.
- `src/components/admin/NewModelSaleModal.jsx` — modal opened from the Stage-3 Create button (advisor + accountant). Collects closer / setter / introduced-by + a member-introduction search + company name + website, then calls `automation_ADVISOR_createmember` with the `sale_*` fields. `SALES_TEAM_NAMES` here mirrors `TEAM_MEMBER_NAMES` in the backend.
- `src/components/admin/EmailTemplatesPanel.jsx` — gained a "Team Notification" section for editing the `TEAM`/`new_model_sale` template, including its `to_list` recipients.
- `src/components/admin/AdvisorAutomationPanel.jsx` — admin Automation tab → "Advisor Onboarding" menu item. One row per `advisor_onboarding` record; 6 collapsible step blocks (Decision → Agreement → Payment → Confirmation/Invoice → Advisor Creation → Member Login Setup). Loads via `automation_load_advisor_pipelines`.
- `src/pages/AdvisorDecidePage.jsx` — `/advisor-decide?token=&decision=Yes|No` — fires `automation_ADVISOR_clientdecision`.
- `src/pages/AdvisorPayPage.jsx` — `/advisor-pay?token=` — fires `automation_ADVISOR_loadpayment` + `_stripecheckout`.
- `src/pages/MemberSetupPage.jsx` — `/member-setup?token=` — 4 states (loading / invalid / already_setup / ready form); fires `_loadloginsetup` + `_submitloginsetup`.
- `src/pages/MemberLogin.jsx` — accepts `location.state.email` prefill + green "Login created" banner when `fromSetup=true` (set by `MemberSetupPage` after successful passcode setup).

---

## Canonical docs (start here for deeper architecture context)

- `docs/architecture/03-edge-functions.md` — backend file layout, request flow, webhook routing
- `docs/architecture/05-api-action-catalog.md` — every action + R/W/chains; includes all 22 advisor handlers
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
