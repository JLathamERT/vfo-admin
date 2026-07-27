# Documents & templates tables

Three small tables, each underpinning multiple pieces of automation across pipelines.

## `agreement_templates`

BoldSign template configuration per (service_level × payment_plan × pipeline). Used by `automation_CONTRACT_sendagreement` AND the parallel send-agreement handlers for tax, advisor, and accountant.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `service_level` | text | not null. e.g., `Lite` / `Core` / `Max` for MAP1; `Advisor` for advisor onboarding; `Accountant` for accountant onboarding. |
| `payment_plan` | text | not null. e.g., `OneTime` / `Quarterly` for MAP1; `Single` for advisor; `'No accountant partnership'` / `'Accountant Partnership'` for accountant (acts as the partnership-branch discriminator). |
| `title` | text | not null. Template display name. |
| `html_body` | text | not null. HTML template with placeholder tokens (substituted before PDF render). `[ACCOUNTANT_NAME]`, `[ACCOUNTANT_EMAIL]` for accountant agreements; analogous for the other pipelines. The `[EFFECTIVE_DATE]` token was removed (2026-06-15) from the advisor (id 9) and accountant (ids 10/11) `html_body` rows — and the rendered bucket PDFs regenerated — so those agreements no longer carry an effective-date line. |
| `boldsign_template_id` | text | nullable. Vestigial in the current send flow — the handler renders `html_body` to PDF via html2pdf.app and uploads to BoldSign directly. Currently NULL on accountant rows; the handler does not require it. |
| `field_map` | jsonb | not null. Maps placeholder keys → BoldSign field coordinates `{p, x, y, w, h}` per field. Accountant field keys: `vfo_ft_checkbox`, `corporate_checkbox`, `accountant_signature`, `accountant_print_name`, `accountant_date`, `accountant_address`, `ert_signature`, `ert_date`. (No `pft_checkbox` — dropped from accountant flow.) |
| `active` | boolean | default `true` |
| `pipeline` | text | not null. Pipeline discriminator added 2026-05-22 when Tax Planning was branched. Values: `'MAP 1'` (implicit), `'TAX'`, `'ADVISOR_ONBOARDING'`, `'ACCOUNTANT_ONBOARDING'` (two rows per pipeline for accountant — one per partnership branch). |
| `payer_type` | text | default `'client'`. Values `'client'` \| `'member'`. Distinguishes the standard client agreement from the member-paid-on-behalf variant (see `pipeline_map1.member_paying_on_behalf`). |
| `created_at` | timestamptz | default `now()` |

**Constraints:** the UNIQUE constraint was widened from `(pipeline, service_level, payment_plan)` to `(pipeline, service_level, payment_plan, payer_type)`.

**Rows:** 6 MAP 1 rows (ids 14–19) are `payer_type='member'` (Lite/Core/Max × Quarterly/1-Time, with BoldSign template ids + field_maps); existing rows were backfilled to `payer_type='client'`. The **TAX** pipeline also now has a `payer_type='member'` row (**id 20** — service_level `Tax Planning`, payment_plan `Single`, BoldSign template `3e575f15-...`) alongside the client row (id 8). The member HTML carries a `<!--MC-->...<!--/MC-->` member-contribution block that `actions/tax/send-agreement.ts` strips at render so the PDF matches the member field_map coordinates; the handler filters `.eq("payer_type", memberPays ? "member" : "client")` (required now that two TAX rows exist).

**Touched by:** `automation_CONTRACT_sendagreement`, `automation_TAX_sendagreement`, `automation_ADVISOR_sendagreement`, `automation_ACCOUNTANT_sendagreement`.

---

## `email_templates`

Editable subject/body for outbound automation emails. Pipeline-scoped.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `pipeline` | text | not null. Pipeline key (e.g., `"map1"`). |
| `template_name` | text | not null. Template key (e.g., `"final_decision"`, `"payment_email"`, `"ceo_countersign"`). |
| `subject` | text | |
| `body` | text | HTML body with placeholder tokens. |
| `to_list` | jsonb | nullable. **Added 2026-06-15; generalized 2026-07-03.** The email's To config — an array mixing raw emails and UPPERCASE role tokens (`CLIENT`, `MEMBER`, `ASSIGNED_PF`, `SPECIALIST`, `ADVISOR`, `ACCOUNTANT`, `TEAM_MEMBER`, `TEAM`, `RECIPIENT`), resolved per-send by `utils/email-recipients.ts resolveTemplateRecipients()`. Same token support applies to `cc_list`/`bcc_list`. Seeded for all rows by migration `email_templates_recipient_seeds`; edited as chips in the Email Templates tab; `automation_save_email_template` sanitizes (emails validated, known tokens kept). Empty/unresolvable To falls back to the handler's built-in target. |
| `active` | boolean | default `true` |
| `send_mode` | boolean | not null, default `false`. **Added 2026-07-03** (migration `email_templates_send_mode`). The per-template **Draft/Send toggle**: `false` = the email is only created as a Gmail draft (original behavior); `true` = the draft is auto-sent via Gmail `drafts.send` right after creation (`utils/email-delivery.ts`). Edited per-email or per-section ("All draft / All send") in the Email Templates tab; `automation_save_email_template` accepts `send_mode` and a bulk `{ ids: [...], send_mode }` form. See gotcha #181. |
| `created_at` | timestamptz | default `now()` |

**TAX member-pays + meeting templates:** 22 member-variant rows (**ids 126–147**) were added, each = an existing TAX client template name + the suffix ` (member signing/paying on clients behalf)` — selected when `client_tax_plans.member_paying_on_behalf=true`. Plus **`TAX_highlevelmeeting_confirm|Yes`** (**id 148**, CLIENT-ONLY — no member variant; the body's planner name is the `[Planner Name]` token, de-hardcoded from "Tim Gacsy" 2026-07-22) used by `automation_TAX_highlevelmeeting_confirm`. The old `TAX_meeting_nudge|Yes` (id 42) and `TAX_implementation_announce|Yes` (id 28) orphan rows were DELETED 2026-07-03 at Jake's direction — no code referenced either (the daily nudge email was replaced by an in-app notification; the implementation announcement was never wired up).

**Hardcoded-email ports (2026-07-04, migration `email_templates_hardcoded_ports`):** 11 rows covering the formerly hardcoded emails — `CONTRACT_member_revshare|first/subsequent` + `CONTRACT_installment_charge_failed` (MAP 1), `TAX_member_revshare|retainer/implementation` + `TAX_implementation_charge_failed` + `TAX_deposit_refund` (TAX), `PIP_member_revshare` (PIP), `specialist_connect_setup` (new pipeline `SPECIALIST_PAYOUT`), `strategic_partner_revshare` + `strategic_group_connect_setup` (new pipeline `STRATEGIC`). Bodies are verbatim ports with block placeholders (`[SCHEDULE_BLOCK]`, `[REVSHARE_BLOCK]`, `[STATUS_BADGE]`, `[PAY_BUTTON]`, `[SETUP_LINK]`, …) that the handlers fill per-send. Supersedes gotcha #163.

**New Model Sale team template (2026-06-15):** one row **id 155**, `pipeline='TEAM'` / `template_name='new_model_sale'` — the only `TEAM`-pipeline row and the only consumer of the `to_list` column. It's an internal notification drafted by `utils/new-model-sale-email.ts` (fired from `automation_ADVISOR_createmember` / `automation_ACCOUNTANT_createmember` as the final onboarding step), addressed `To` the `to_list` team members. Body placeholders are filled from the `advisor_onboarding`/`accountant_onboarding` row (member name/number/email, agreement name, selected plans, payment plan, invoice number, plus the `sale_closer`/`sale_setter`/`sale_introduced_by`/`sale_company_name`/`sale_website` sale-attribution fields). In sandbox the draft goes only to the pipeline's `sandbox_email`.

**Card-update template (Phase D):** one row **id 156**, `pipeline='PAYMENTS'` / `template_name='card_update'` — the only `PAYMENTS`-pipeline row. The admin-initiated payment-method-change email; placeholders `[First Name]` / `[UPDATE_LINK]` (the `/update-card?token=…` link backed by `card_update_tokens`, see [pipeline.md](pipeline.md)).

**Touched by:** `automation_load_email_templates`, `automation_save_email_template`, plus every `automation_*` handler that sends a Gmail draft (it pulls subject/body from this table). Frontend: [EmailTemplatesPanel.jsx](src/components/admin/EmailTemplatesPanel.jsx).

---

## `document_numbers`

Append-only sequence ledger. Each row reserves a number-of-type for a client/advisor/accountant, used as the source of truth for `pipeline_map1.invoice_number`, `pipeline_map1.rec1..rec4_number`, `advisor_onboarding.invoice_number`, `accountant_onboarding.invoice_number`, etc. — so that numbers are unique and stable even across retries.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `type` | text | not null. e.g., `'invoice'`, `'receipt'`. |
| `number` | text | not null, **UNIQUE**. The formatted number. MAP1: `INV-{clientRef}-{seq:0004}` / `REC-{clientRef}-{seq:0004}`. Tax (retainer + implementation): `INV-{clientRef}-{seq:0004}` / `REC-{clientRef}-{seq:0004}`. Advisor: `INV-ADV{onboarding_id}-{seq}` / `REC-ADV{onboarding_id}-{seq}`. Accountant: `INV-ACC{id}-{seq}` / `REC-ACC{id}-{seq}`. PIP: `INV-PIP-{clientRef}-{seq}` / `REC-PIP-{clientRef}-{seq}`. Specialist bg: `INV-SPEC-{id}-{seq}` / `REC-SPEC-{id}-{seq}`. Specialist license: `INV-SPECLIC-{id}-{seq}` / `REC-SPECLIC-{id}-{seq}`. The starting `seq` is a **global** count of that type for invoices (and the onboarding/PIP receipts), but **per-owner** for MAP 1 + Tax *receipts*. |
| `client_id` | integer | nullable. Soft reference to `clients.id`. Used by MAP1, Tax, and PIP rows. |
| `advisor_onboarding_id` | bigint | nullable FK → `advisor_onboarding(id)` `ON DELETE SET NULL`. Used by advisor invoice/receipt rows. |
| `accountant_onboarding_id` | bigint | nullable FK → `accountant_onboarding(id)` `ON DELETE SET NULL`. Used by accountant invoice/receipt rows. |
| `specialist_onboarding_id` | bigint | nullable FK → `specialist_onboarding(id)` `ON DELETE SET NULL`. Used by specialist background-check (`INV/REC-SPEC`) + monthly-license (`INV/REC-SPECLIC`) rows. |
| `created_at` | timestamptz | default `now()` |

**Constraints + allocation (collision-safe since 2026-06-09):**
- `UNIQUE(number)`.
- `document_numbers_exactly_one_owner` CHECK requires **exactly one** of {`client_id`, `advisor_onboarding_id`, `accountant_onboarding_id`, `specialist_onboarding_id`} non-null. Widened by migration `document_numbers_widen_owner_check` — the OLD CHECK only allowed client/advisor, so **every accountant/specialist insert silently failed** (the seq was computed but never recorded → numbers could be re-used). When inserting, stamp exactly one owner FK.
- All allocation goes through **`utils/doc-numbers.ts` `allocateDocNumber()`** which bumps the seq and retries until the UNIQUE insert succeeds — fixing the old `count → build → insert-once → ignore-error` pattern that silently stalled the counter and reused a number on collision (gotcha #92). Don't revert to insert-once.

**Touched by (all via `allocateDocNumber`):** `automation_CONTRACT_invoicereceipt`, `automation_TAX_invoicereceipt`, `automation_TAX_implementation_receipt`, `automation_ADVISOR_invoicereceipt`, `automation_ACCOUNTANT_invoicereceipt`, `automation_PIP_invoicereceipt`, `automation_SPECIALIST_bgreceipt`, `automation_SPECIALIST_licinvoicereceipt`.
