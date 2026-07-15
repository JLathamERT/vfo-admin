# Tax tables

Tax engagements run alongside (and downstream of) the regular member-program. A `client_tax_plans` row represents the engagement; specialists are attached via `client_tax_specialists`; per-task progress is tracked in `client_tax_progress`.

## `client_tax_plans`

State machine for the tax-planning engagement. **84 columns total** (4 original + 51 added via migration `20260518000000_tax_phase0_schema.sql` + 14 split column families + 6 deposit-refund columns added in the Tax Planning alignment session + 4 member-pays columns: `member_paying_on_behalf`, `tax4_meeting_time`, `tax4_meeting_timezone`, `tax4_meeting_confirm_email_sent_at` + 4 added in the presentation-step session: `member_presentation_link`, `presentation_send_date`, `presentation_scheduled_at`, `presentation_email_sent_at` + 1 Phase D admin card-update column: `default_payment_method_id`). Parallel to `pipeline_map1` for MAP1; see [tax-planning flow](../flows/tax-planning.md) for end-to-end usage.

> **Program-aware**: rows are tagged with `program_id` so the same handlers serve both Holistic Planning's Tax Priorities track (program_id=1) and the standalone VFO Tax Planning program (program_id=4). Client-visible labels (invoice/receipt headers, Stripe line items, BoldSign agreement title) switch between "VFO Holistic Planning" and "VFO Tax Planning" via the `programLabel(programId)` helper in `utils/program-label.ts`.

### Original / scope
| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | not null. fk → `clients.id` (CASCADE). |
| `status` | text | not null, default `'live'`. Plan status (live / stopped). |
| `created_at` | timestamptz | not null, default `now()`. |
| `program_id` | integer | fk → `programs.id`. Distinguishes Holistic Planning (1) vs standalone Tax Planning (4). NULL on rows pre-dating migration. |
| `atp_name` | text | Advanced Tax Planner allocated (Tim Gacsy / Steven Cox per task option). |
| `sandbox` | boolean | default false. Snapshot of sandbox_mode at row creation. |
| `extra_cc` | text | Comma-separated extra CC emails captured from `TaxDecisionForm`. |

### Tax 2 — Ready for Tax 3 email
| Column | Type | Notes |
|---|---|---|
| `ready_for_tax3_decision` | text | `Yes` / `No` |
| `ready_for_tax3_email_sent` | text | `Yes` once Gmail draft succeeds. Idempotency guard. |

### Tax 3 — Decision form + Undecided sub-flow
| Column | Type | Notes |
|---|---|---|
| `tax_decision` | text | `Yes` / `Undecided` / `No` (admin-submitted decision). |
| `risk_mindset` | text | `Yes — Risk N — …` from form's `taxRiskMindset`. |
| `retainer_amount` | numeric | First 50% — admin-entered. |
| `implementation_amount` | numeric | Second 50% — admin-entered. May differ from retainer (not enforced 50/50). |
| `total_fee` | numeric | Auto-computed retainer + implementation. |
| `discount_applied` | numeric | **Display-only** (added 2026-07-14). Diron Insley (member 59073) clients only — server-gated in `decision.ts`/`pricing.ts`/`extra-meeting.ts` against `clients.member_number` = `constants/tax-discount.ts DISCOUNT_MEMBER_NUMBER`. When > 0 the invoice PDF shows gross Tax Planning Fee (retainer + implementation + discount), the discount in red, Net Payable, and a small-print footnote; the retainer invoice/receipt + implementation receipt emails get a small-print footnote. Does NOT affect charged amounts, receipts, agreement, or revshare. NULL = no discount. |
| `split_type` | text | `1/3 Member, 2/3 VFOS` / `50/50` / `Custom`. |
| `member_share` | numeric | Dollar amount of member's revshare. |
| `vfos_share` | numeric | Dollar amount of VFOS's cut. |
| `potential_tax_savings` | numeric | Undecided branch only — from form's `potentialTaxSavings`. |
| `initial_retainer_quoted` | numeric | Undecided branch only — quoted in meeting. |
| `presentation_link` | text | Optional link from the **Tax 3 "Client tax planning decision"** form. Used as `[PRESENTATION_LINK]` in Undecided + decline + agreement emails (`decision.ts`/`pricing.ts`/`extra-meeting.ts`/`final-decision.ts`/`send-agreement.ts`). **Distinct from `member_presentation_link`** (the Tax 2 step) — do not conflate. |
| `meeting_notes` | text | Optional notes from form. |
| `tax_token` | text | 32-byte hex. Used by `/tax-decide?token=<>` for the Undecided client-decision page. Indexed. |
| `tax_final_decision` | text | `Yes` / `No` / `ExtraMeeting` — set by `automation_TAX_finaldecision` from the `/tax-decide` page. |
| `tax_via_extra_meeting` | boolean | default false. True if Yes came through Extra Meeting outcome branch. |
| `tax_decision_email_sent` | text | `Yes` once Undecided/decline Gmail draft succeeds. Idempotency guard. |
| `member_paying_on_behalf` | boolean | default false. Set from the Yes/No "member signing & paying on the client's behalf?" question on the Tax 3 `TaxDecisionForm`; mirrors MAP 1 PIP-Follow-Up. Carries through Tax 3 → Tax 4 → Tax 5. When true, 14 tax handlers flip emails To member / Cc client, use the member `email_templates` variant (suffix ` (member signing/paying on clients behalf)`, ids 126–147), make the member the BoldSign signer 1 + Stripe payer, and set invoice/receipt "Bill To" = member. `send-agreement.ts` loads `agreement_templates` id 20 (`payer_type='member'`). |

### Agreement (BoldSign)
| Column | Type | Notes |
|---|---|---|
| `agreement_sent` | text | `Yes` flag (mirror MAP1's `c16_sent`). |
| `boldsign_doc_id` | text | BoldSign document UUID. Indexed. |
| `client_signed` | text | `No` on send, `Yes` on BoldSign Signed webhook. |
| `ceo_signed` | text | `No` on send, `Yes` on BoldSign Signed (CEO) or Completed webhook. |
| `signed_followup_sent_date` | date | Set on send for future reminder logic. |

### Retainer payment (first 50%)
| Column | Type | Notes |
|---|---|---|
| `stripe_customer_id` | text | Indexed. New per tax plan (not reused from MAP1). |
| `checkout_token` | text | 32-byte hex for `/tax-pay?token=<>`. Indexed. |
| `payment_method_type` | text | `card` / `ach` / `check`. |
| `acct_last4` | text | Display only. |
| `card_processing_fee` | numeric | Card gross-up actually charged, computed from Stripe's `amount_received - retainer_amount`. |
| `card_fee_waived` | boolean | **2026-07-15.** Payment-continuation setup-link clients pay no card fee — `automation_TAX_charge-implementation` charges base even on card. ONLY writer: `migration_backfill_tax` (`stripe_mode='setup_link'`). |
| `retainer_payment_intent_id` | text | For Phase 6 refund operation. |
| `retainer_status` | text | `succeeded` / `processing` (ACH) / `check_pending`. NULL = not yet paid. |
| `retainer_date` | date | Date paid (or date check path was started). |
| `retainer_confirmation_status` | text | `Confirmation Needed` on payment, `Sent` after confirmation email. |

### Retainer invoice + receipt
| Column | Type | Notes |
|---|---|---|
| `retainer_invoice_number` | text | INV-`<client_ref>`-`<seq>` |
| `retainer_receipt_number` | text | REC-`<client_ref>`-`<seq>` |
| `retainer_invoice_drive_id` | text | Google Drive file id. |
| `retainer_receipt_drive_id` | text | Google Drive file id. |
| `retainer_invoice_email_sent` | boolean | default false. Idempotency on `automation_TAX_invoicereceipt`. |
| `retainer_receipt_status` | text | `Sent` after email draft. (Mirror new `recN_status='Sent'` pattern from MAP1.) |

### Retainer revenue share
| Column | Type | Notes |
|---|---|---|
| `retainer_rev_share` | text | `Pending` / `Completed - <type>`. |
| `retainer_rev_paid` | text | `Yes` / `Failed` / `Money Mapping` / `N/A — No Share Due`. |
| `retainer_rev_email_sent` | boolean | default false. |
| `member_contrib_status` | text | `Pending` / `Applied` (mirror MAP1 pattern). |
| `tracy_intro_email_sent` | boolean | default false. Optional Tracy intro email parallel to MAP1's `c24_email_sent`. |

### Tax 3 — reminder timers (Phase post-Tax-5 polish)
The Tax 3 cascade is gated by client action at 3 different points (Undecided email click, agreement signing, payment). Each has a 48h reminder + 96h PF-notification timer driven by `tax-revshare-sweep-daily` cron.

| Column | Type | Notes |
|---|---|---|
| `tax_decision_email_sent_at` | timestamptz | When the Undecided email was drafted. Sweep base for 48h/96h. |
| `tax_decision_reminder_sent_at` | timestamptz | When the 48h reminder Gmail draft was created. Idempotency for sweep. |
| `tax_decision_pf_notified_at` | timestamptz | When the 96h admin notification was inserted. |
| `signed_reminder_sent_at` | timestamptz | 48h post-`signed_followup_sent_date` reminder. |
| `signed_pf_notified_at` | timestamptz | 96h post-`signed_followup_sent_date` PF notification. |
| `payment_email_sent_at` | timestamptz | When the `/tax-pay` email was drafted (used as sweep base). |
| `payment_reminder_sent_at` | timestamptz | 48h reminder timestamp. |
| `payment_pf_notified_at` | timestamptz | 96h PF notification timestamp. |

### Tax 2 — Send presentation link to member (scheduled, BUILT)
The **"Send presentation link to member before meeting"** step (`program_client_tasks` ids 168 prog 1 / 169 prog 4, `status_options='tax_presentation_link'`, in the **Tax 2 - Deeper Dive** phase right after "Tax 3 Confirmation Email", `task_order=3`). Admin pastes a link + picks a send date (`automation_TAX_presentation_schedule`, AUTH); the `tax-presentation-sweep-daily` cron (09:00 UTC, `automation_TAX_presentation_sweep`, PUBLIC/service-role) drafts the `TAX_presentation_link` email (id 151; **To member, Cc assigned PF**; greeting `[Member First]`; `[PRESENTATION_LINK]` → "View the presentation" button) on the chosen date. **Drafts only — no auto-send.**

| Column | Type | Notes |
|---|---|---|
| `member_presentation_link` | text | The presentation URL the admin pastes in the step. Its OWN column — separate from the Tax 3 `presentation_link` so the two never clobber each other. |
| `presentation_send_date` | date | The date the cron should draft the member email. Sweep matches `<= today` (catches a missed run). Also the step's completion signal in `TaxPrioritiesTab.jsx`. |
| `presentation_scheduled_at` | timestamptz | When the admin scheduled it (audit). |
| `presentation_email_sent_at` | timestamptz | Stamped when the sweep drafts the email; its NULL-ness is the sweep's not-yet-sent guard. |

### Tax 4 — Continue / Stop + refund (Phase 6 — BUILT) + post-review client-email redesign
The Tax 4 flow no longer fires money movement on admin click. Admin picks a 3-option dropdown (Continue - Revenue Share / Undecided / Stop - Refund); for Continue + Undecided, a client email goes out with timer-based fallback.

| Column | Type | Notes |
|---|---|---|
| `tax4_meeting_date` | date | Admin-recorded date for the Tax Plan Review (Tax 4) high-level meeting. Set via `automation_TAX_highlevelmeeting_confirm` from the **"High Level Meeting Confirmation Email"** task at the top of the Tax 4 phase (`program_client_tasks` ids 153/154, status_options `tax_hlm_confirm`, `task_order=0`). (Replaced the old `automation_TAX_save_meeting_date` date-picker.) Once `tax4_meeting_date < today` AND `post_review_decision IS NULL`, the daily `tax-revshare-sweep-daily` cron raises ONE persistent action-required in-app notification ("Client decision 1 needed — <client>") to Tim (`tgacsy@elitert.com`) + Tracy (`tnmiller@elitert.com`) — no longer a daily Gmail. |
| `tax4_meeting_time` | text | Optional meeting time captured by the High Level Meeting Confirmation Email handler. |
| `tax4_meeting_timezone` | text | Optional meeting timezone captured by the same handler. |
| `tax_returns_requested_at` | timestamptz | Set by `automation_TAX_request_returns` when the "Request Tax Returns" email is drafted (VFO Tax Planning / program 4 step). Drives the "Request email sent" AI PC Admin sub-step. |
| `tax_returns_received_at` | timestamptz | Set by `actions/vault/upload-notify.ts` when a program-4 client uploads their returns. Drives the "Tax returns received" sub-step (green) + the `TAX_returns_received` bell. |
| `tax4_meeting_confirm_email_sent_at` | timestamptz | When the client High Level Meeting Confirmation Email (`TAX_highlevelmeeting_confirm\|Yes`, id 148) was drafted. |
| `tax4_meeting_reminder_last_sent_at` | timestamptz | Guard for the once-per-plan in-app "Client decision 1 needed" notification (sweep sets it once; the confirm handler nulls it so the reminder fires fresh after a new meeting date is set). |
| `post_review_decision` | text | Admin's pick: `Continue - Revenue Share` / `Undecided` / `Stop - Refund`. |
| `post_review_decision_token` | text | 32-byte hex for `/tax-postreview-decide?token=`. Indexed. Generated on Continue + Undecided. |
| `post_review_decision_email_sent_at` | timestamptz | When client email was drafted — sweep base for 24h (Continue lock-in) / 48h (Undecided reminder) / 96h (Undecided PF). |
| `post_review_client_decision` | text | Client's click on the email button: `Proceed` (Undecided→Proceed → fires revshare) / `Confirmed` (Continue-email green "Continue now" click → fires revshare immediately, skipping the 24h grace) / `Refund` (fires refund) / `Auto-Locked` (sweep-set after 24h Continue grace expires with no client click). |
| `post_review_reminder_sent_at` | timestamptz | Undecided 48h reminder timestamp. |
| `post_review_pf_notified_at` | timestamptz | Undecided 96h PF notification timestamp. |
| `refund_status` | text | `succeeded` / `failed`. Set by `automation_TAX_refund` (PUBLIC, accepts service-role bearer OR admin session token). |
| `refund_id` | text | Stripe refund object id. |
| `refund_amount` | numeric | What was actually refunded (BASE amount only — no card-fee gross-up). |
| `refund_date` | date | |
| `refund_email_sent` | boolean | default false. |

### Setup phase — Deposit + refund
Tax Planning (program_id=4) starts with a Setup phase containing 3 tasks: **Deposit Paid** (captures Stripe PI), **Tax Plan Greenlight** (Go / Stop), **Refund Paid** (active only when Greenlight = Stop, fires Stripe refund). Holistic Tax Priorities (program_id=1) doesn't render Setup (those clients arrive via MAP1 instead), but the same columns work for either program if populated.

| Column | Type | Notes |
|---|---|---|
| `deposit_payment_intent_id` | text | Admin-pasted Stripe PaymentIntent ID (`pi_...`) captured on the Deposit Paid task before our system knows the client exists. Save handler extracts the last `pi_...` substring defensively against paste-over. |
| `deposit_refund_id` | text | Stripe refund object id (`re_...`) from `automation_TAX_depositrefund`. |
| `deposit_refund_amount` | text | Full PI amount refunded, fetched from Stripe (NOT admin-typed). |
| `deposit_refund_date` | date | Set on successful refund. |
| `deposit_refund_status` | text | `succeeded` / `failed`. |
| `deposit_refund_email_sent` | boolean | default false. Idempotency on confirmation Gmail draft to client. |

### Tax 5 — Implementation flow (Phase 7 — BUILT) + client-email redesign
Tax 5b "Implementation decision" mirrors Tax 4's 3-option pattern: Proceed picks DON'T charge immediately — they send a 24h grace email with a Decline button; Undecided sends 2 buttons + 48h/96h reminders; Not Implementing sends decline email only, no money movement.

| Column | Type | Notes |
|---|---|---|
| `implementation_decision` | text | Admin's Tax 5b pick: `Proceed` / `Undecided` / `Not Implementing`. |
| `implementation_token` | text | 32-byte hex for `/tax-implement-decide?token=`. Indexed. Generated on Proceed + Undecided. |
| `implementation_decision_email_sent` | text | Stores the decision name (`Proceed`/`Undecided`/`Not Implementing`) once the matching email is drafted. Per-decision idempotency so admin re-picks re-send the right email. |
| `implementation_decision_email_sent_at` | timestamptz | When email was drafted — sweep base for 24h Proceed lock-in / 48h Undecided reminder / 96h Undecided PF. |
| `implementation_final_decision` | text | Client's click result: `Proceed` (Undecided→Proceed → fires off-session charge directly) / `Confirmed` (Proceed-email green "Proceed now" click → fires off-session charge immediately, skipping the 24h grace) / `Decline` (drafts decline email, no charge) / `Auto-Locked` (sweep at 24h on Proceed pick with no client click, fires charge). |
| `implementation_reminder_sent_at` | timestamptz | Undecided 48h reminder timestamp. |
| `implementation_pf_notified_at` | timestamptz | Undecided 96h PF notification timestamp. |
| `implementation_charge_status` | text | `succeeded` / `processing` / `declined` / `auth_required` / `manual_required` (no PI on retainer, e.g. check). |
| `implementation_payment_intent_id` | text | Off-session PaymentIntent created by `automation_TAX_charge_implementation`. |
| `default_payment_method_id` | text | **Phase D (admin card-update).** Stripe PM id the implementation off-session charge prefers when set by the admin-initiated payment-method change (`/update-card` page, see `card_update_tokens` in [pipeline.md](pipeline.md)). |
| `implementation_charge_date` | date | |
| `implementation_confirmation_status` | text | Webhook writes `Confirmation Needed` purely as the **idempotency marker** for the implementation-succeeded block. Since 2026-07-15 no confirmation email is sent for implementation charges, so it never advances to `Sent` (pre-change rows may hold `Sent`); the admin UI no longer displays it. |
| `implementation_receipt_number` | text | REC-`<ref>`-`<seq>`. Receipt-only — no invoice for implementation (single retainer invoice covers the engagement). |
| `implementation_receipt_drive_id` | text | Drive file id of the receipt PDF. |
| `implementation_receipt_status` | text | `Sent`. |
| `implementation_rev_share` | text | `Pending` / `Completed - <type>`. Same shape as retainer revshare. |
| `implementation_rev_paid` | text | `Yes` / `Failed` / `Money Mapping` / `N/A — No Share Due`. Picked up by daily sweep alongside retainer revshare. |
| `implementation_rev_email_sent` | boolean | default false. |
| `implementation_announcement_email_sent` | boolean | default false. **Currently unused — wrap-up email was dropped in the Tax 5 client-email redesign.** Kept for future. |
| `implementing_specialist_id` | integer | fk → `client_tax_specialists.id`. **Currently unused — implementation is decided at the phase level, not per-specialist, in the new design.** |

### Indexes
- `idx_client_tax_plans_tax_token` ON `tax_token`
- `idx_client_tax_plans_checkout_token` ON `checkout_token`
- `idx_client_tax_plans_stripe_customer` ON `stripe_customer_id`
- `idx_client_tax_plans_boldsign_doc` ON `boldsign_doc_id`
- `idx_client_tax_plans_client_program` ON `(client_id, program_id)`
- `idx_client_tax_plans_implementation_token` ON `implementation_token`
- `idx_client_tax_plans_post_review_token` ON `post_review_decision_token`

**Touched by:** `tax_load_plans`, `tax_start_plan` (now accepts `program_id`), `tax_save_deposit_pi`, `automation_TAX_readyfortax3`, `automation_TAX_decision`, `automation_TAX_finaldecision`, `automation_TAX_pricing`, `automation_TAX_extrameeting`, `automation_TAX_sendagreement`, `automation_TAX_ceocountersign`, `automation_TAX_stripecustomer`, `automation_TAX_paymentemail`, `automation_TAX_loadpayment`, `automation_TAX_stripecheckout`, `automation_TAX_confirmationemail`, `automation_TAX_invoicereceipt`, `automation_TAX_paidbycheck`, `automation_TAX_checkcleared`, `automation_TAX_postreviewdecision`, `automation_TAX_postreviewclientdecision`, `automation_TAX_refund`, `automation_TAX_revshare`, `automation_TAX_revshare_sweep`, `automation_TAX_implementdecision`, `automation_TAX_implementfinaldecision`, `automation_TAX_charge_implementation`, `automation_TAX_implementation_receipt`, `automation_TAX_highlevelmeeting_confirm`, `automation_TAX_save_meeting_date` (orphaned), `automation_TAX_depositrefund`, `automation_load_tax_plans`, Stripe webhook (`maybeHandleStripeWebhook`), BoldSign webhook (`maybeHandleBoldSignWebhook` + standalone `boldsign-webhook` function). Frontend: [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx), [TaxAutomationPanel.jsx](src/components/admin/TaxAutomationPanel.jsx), [TaxDecidePage.jsx](src/pages/TaxDecidePage.jsx), [TaxPayPage.jsx](src/pages/TaxPayPage.jsx), [TaxPostReviewDecidePage.jsx](src/pages/TaxPostReviewDecidePage.jsx), [TaxImplementDecidePage.jsx](src/pages/TaxImplementDecidePage.jsx).

---

## `client_tax_specialists`

Many-to-many between a tax plan and the `experts` working on it.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `tax_plan_id` | integer | not null. fk → `client_tax_plans.id` (CASCADE). |
| `expert_id` | bigint | not null. fk → `experts.id` (NO ACTION). |
| `specialist_name` | text | not null. Snapshot of name (so display survives expert renames). |
| `status` | text | not null, default `'live'`. Status field. |
| `created_at` | timestamptz | not null, default `now()`. |

**Touched by:** `tax_load_specialists`, `tax_add_specialist`.

---

## `client_tax_progress`

Per-task progress within a tax plan, scoped to a specialist.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `tax_plan_id` | integer | not null. fk → `client_tax_plans.id` (CASCADE). |
| `tax_specialist_id` | integer | fk → `client_tax_specialists.id` (SET NULL). |
| `task_id` | integer | not null. fk → `program_client_tasks.id` (NO ACTION). |
| `status` | text | Status field. |
| `completed_date` | date | |
| `completed_by` | text | |
| `notes` | text | |

**Touched by:** `tax_load_progress`, `tax_save_task`.
