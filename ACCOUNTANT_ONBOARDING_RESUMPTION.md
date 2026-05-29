# Accountant Onboarding — Current State

**Status:** Shipped 2026-05-28 (v323 → v330 of `vfo-admin-api`, v37 of `boldsign-webhook`). End-to-end verified by the user with a full Jake Latham test row: Stage 1 (Prelim Meeting → Partnership? → Decision Undecided → email click → Yes) → Stage 2 (Send Agreement → BoldSign sign cycle → Stripe customer → payment email → `/accountant-pay` → Stripe Checkout sandbox card) → Stage 3 (Create Accountant & Send Setup Link → member 30001 created → `/member-setup` token → passcode set → `/member/login`).

**Sibling pipeline:** This is a near-clone of Advisor Onboarding with one new step (Partnership?) and a few accountant-specific differences listed below. The high-level shape and trigger graph are identical. See `ADVISOR_ONBOARDING_RESUMPTION.md` for the parallel reference.

---

## What the feature does

End-to-end pipeline that takes a candidate accountant from "we had a preliminary meeting" to "fully onboarded member with a portal login." Mirrors advisor with two structural differences:

1. **New Stage 1 step: Partnership?** — between Preliminary Meeting and Preliminary Meeting Decision. Required dropdown with two choices:
   - `'No accountant partnership'` → loads the "No Partnership" agreement; `vfo_ft_checkbox` prices at $4,000.
   - `'Accountant Partnership'` → loads the "Partnership" agreement; `vfo_ft_checkbox` prices at $2,000.

   Choice is saved by `save_accountant_partnership` (AUTH handler) onto `accountant_onboarding.accountant_partnership` + `_at`. The Stage 1 Decision buttons (Yes/Undecided/No) are visually greyed out + disabled until partnership is picked.

2. **Two `agreement_templates` rows** (one per partnership branch) discriminated by `payment_plan` column = the partnership value. `automation_ACCOUNTANT_sendagreement` reads `accountant_partnership` from the row and queries `agreement_templates WHERE pipeline='ACCOUNTANT_ONBOARDING' AND payment_plan=<partnership>`. Returns 400 if `accountant_partnership` is NULL.

Everything else maps cleanly to the advisor pattern.

---

## Stages

1. **Preliminary Meeting & Partnership? & Decision** — admin records the meeting outcome, picks the partnership, then picks Yes / No / Undecided. Undecided drafts a Gmail to the accountant with Yes/No buttons; No drafts a decline email; Yes proceeds straight to Stage 2.
2. **PC Admin (Agreement → Payment → Invoice/Receipt)** — auto-fires the BoldSign agreement send (loads the matching partnership template), awaits accountant signature + CEO countersign, then auto-fires the Stripe customer + payment-link email. After payment succeeds the chain drafts the confirmation email + invoice/receipt PDFs (`INV-ACC{onboarding_id}-{seq:0004}` / `REC-ACC{onboarding_id}-{seq:0004}`). **Pricing**: `vfo_ft_checkbox` = $4,000 (No partnership) or $2,000 (Accountant Partnership), required; `corporate_checkbox` = +$600 optional add-on either way. Total: $2,000 / $2,600 / $4,000 / $4,600.
3. **Add New Accountant** — admin clicks "Create Accountant & Send Setup Link". Backend creates the `members` + `member_plugin_settings` rows with member_number assigned by the category-relative `nextMemberNumber('accountant','New Model')` helper (see SESSION_REFERENCE gotcha #48 — the old `[30000,90000)` / `[90000,∞)` ranges + accountants-only filter are gone, replaced by the durable `member_category='accountant'` tag). `members.advisor_model='New Model'` (always, for onboarding-created); **no `revenue_decision`** (accountants don't have one). Then chains the member-portal login-setup email. Accountant clicks the link → `/member-setup` token page → picks a passcode → redirected to `/member/login` with email pre-filled.

Reminder cron `accountant-sweep-daily` (06:00 UTC) drives 3 reminder ladders × (48h reminder + 96h PF notification) on the Undecided email, BoldSign signing, and payment-link stalls, plus a 14-day implicit-No rule that auto-declines stale Undecideds. Mirrors advisor's `automation_ADVISOR_sweep` pattern exactly.

---

## Differences from advisor (one-line list)

- New Stage 1 step "Partnership?" with required dropdown.
- Two `agreement_templates` rows (one per partnership) instead of one.
- `vfo_ft_checkbox` is a standalone required checkbox (no FormGroups validation); `pft_checkbox` dropped entirely.
- Pricing: $4k or $2k for `vfo_ft` + $600 optional for `corporate` — partnership choice gates which baseline applies.
- `automation_ACCOUNTANT_createmember` does NOT write `revenue_decision` on the inserted `members` row.
- Member number assigned by `nextMemberNumber('accountant', <model>)` keyed on the durable `member_category='accountant'` tag (gotcha #48). The old `[30000,90000)` / `[90000,∞)` ranges + accountants-only filter are gone; baselines (accountant/New=30000, accountant/Legacy=90000) live in `member_number_baselines`.
- `document_numbers` got a new `accountant_onboarding_id` FK column (the existing `advisor_onboarding_id` doesn't cover accountants).
- `MemberProfile` in admin Accountants → Accountant Search hides Revenue Decision via `hiddenFields={['revenue_decision']}` prop on the new shared `MemberDirectoryView`.
- `MemberSetupPage.jsx` falls through advisor → accountant token lookup so one shared `/member-setup` page handles both pipelines.
- BoldSign cascade extended: standalone webhook + embedded handler in `vfo-admin-api/router/webhooks.ts` both grew an accountant fallback after advisor miss.
- Stripe cascade extended: 5-level (MAP1 → Tax → Advisor → PIP → Accountant). Accountant branch routes by `metadata.pipeline='ACCOUNTANT_ONBOARDING'` + `metadata.payment_kind='onboarding'`.
- Same BoldSign field-read parser fix applied to `actions/accountant/ceo-countersign.ts` (the advisor latent bug was cloned, then both got fixed in the same deploy).
- RLS now enabled on both `advisor_onboarding` and `accountant_onboarding` (service-role only).

---

## Outstanding / known boundaries

- **`accountant-onboarding-agreements` Storage bucket is empty.** Stage 2 Undecided email gracefully sends without a PDF attachment. Drop `Accountant_Implementation_Agreement.pdf` in when ready.
- **Both `agreement_templates` rows currently hold the same placeholder HTML body** that was cloned from the advisor template with words swapped. User pasted real HTML for one partnership branch during 2026-05-28 testing; the other branch is still placeholder. Real legal text needs to land on both rows before going live.
- **`boldsign_template_id` is NULL** on both accountant rows. The `send-agreement` handler renders `html_body` to PDF and uploads to BoldSign directly, so the template_id isn't required, but a future flow that wires to a real BoldSign template would need it populated.

---

## Key file references

- Backend: `vfo-edge-functions/supabase/functions/vfo-admin-api/actions/accountant/*.ts` (21 files)
- Dispatch: `router/dispatch.ts` (14 PUBLIC + 8 AUTH entries for `automation_ACCOUNTANT_*` + `save_accountant_*` + `create_accountant_onboarding` + `load_accountant_onboarding{,s}` + `automation_load_accountant_pipelines`)
- Webhook routing: `router/webhooks.ts` (accountant cascade after PIP fallthrough); standalone `boldsign-webhook/index.ts` (accountant fallback after advisor miss)
- Cron: `supabase/cron/accountant-sweep.sql` (installed live 2026-05-28)
- Frontend: `src/components/admin/AccountantOnboarding.jsx`, `AccountantAutomationPanel.jsx`, `pages/Accountant{Decide,Pay}Page.jsx`, `pages/MemberSetupPage.jsx` (multi-pipeline fallthrough)
- DB: `accountant_onboarding` (53 cols, cloned from advisor with `agreement_signed_by_advisor_at` → `_by_accountant_at` rename + new `accountant_partnership` + `_at`), `members.accountant_onboarding_id` FK, `agreement_templates` (2 rows pipeline='ACCOUNTANT_ONBOARDING'), `email_templates` (12 rows), `pipeline_sandbox_config` (1 row), `document_numbers.accountant_onboarding_id` FK
- Storage: `accountant-onboarding-agreements` bucket (public, empty)
