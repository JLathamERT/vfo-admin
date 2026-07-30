# Tax tables

Tax engagements run alongside (and downstream of) the regular member-program. A `client_tax_plans` row represents the engagement; specialists are attached via `client_tax_specialists`; per-task progress is tracked in `client_tax_progress`.

## `client_tax_plans`

State machine for the tax-planning engagement. **85 columns total** (4 original + 51 added via migration `20260518000000_tax_phase0_schema.sql` + 14 split column families + 6 deposit-refund columns added in the Tax Planning alignment session + 4 member-pays columns: `member_paying_on_behalf`, `tax4_meeting_time`, `tax4_meeting_timezone`, `tax4_meeting_confirm_email_sent_at` + 4 added in the presentation-step session: `member_presentation_link`, `presentation_send_date`, `presentation_scheduled_at`, `presentation_email_sent_at` + 1 Phase D admin card-update column: `default_payment_method_id` + 8 tax-planner columns added 2026-07-21: `tax_planner_id`, `tax_planner_share`, `{retainer,implementation}_planner_paid`/`_completed_at`/`_email_sent_at` + 3 assess-form columns added 2026-07-22: `assess_form`, `assess_form_submitted_at`, `assess_form_submitted_by` + 1 added 2026-07-30: `additional_info_responses`). Parallel to `pipeline_map1` for MAP1; see [tax-planning flow](../flows/tax-planning.md) for end-to-end usage.

> **Program-aware**: rows are tagged with `program_id` so the same handlers serve both Holistic Planning's Tax Priorities track (program_id=1) and the standalone VFO Tax Planning program (program_id=4). Client-visible labels (invoice/receipt headers, Stripe line items, BoldSign agreement title) switch between "VFO Holistic Planning" and "VFO Tax Planning" via the `programLabel(programId)` helper in `utils/program-label.ts`.

### Original / scope
| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | not null. fk → `clients.id` (CASCADE). |
| `status` | text | not null, default `'live'`. Plan status (live / stopped). |
| `created_at` | timestamptz | not null, default `now()`. |
| `program_id` | integer | fk → `programs.id`. Distinguishes Holistic Planning (1) vs standalone Tax Planning (4). NULL on rows pre-dating migration. |
| `atp_name` | text | Advanced Tax Planner allocated — legacy free-text (Tim Gacsy / Steven Cox per the old task option). **Superseded 2026-07-21 by the `tax_planner_id` fk** (the allocation step is now a dropdown of `tax_planners`); kept for historical rows. |
| `sandbox` | boolean | default false. Snapshot of sandbox_mode at row creation. |
| `extra_cc` | text | Comma-separated extra CC emails captured from `TaxDecisionForm` (read via `utils/extra-cc.ts extraCcList()`, which also tolerates legacy JSON-array strings — gotcha #244). |

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
| `split_type` | text | `1/3 Member, 2/3 VFOS` / `50/50` / `Custom` (legacy 2-way) — and, since 2026-07-21, the 3-way preset `1/3 Member, 1/3 Tax Planner, 1/3 VFOS`. `TaxDecisionForm`/`TaxPricingForm` now offer the 3-way preset + a Custom mode where all three boxes are editable and must sum to `total_fee` (1-cent tolerance). Strategic-member tax splits (`src/lib/strategicSplits.js`, `programType='tax'`) add a 4th Strategic Partner leg. |
| `member_share` | numeric | Dollar amount of member's revshare (of the TOTAL — proportional per installment, gotcha #252). |
| `vfos_share` | numeric | Dollar amount of VFOS's cut. |
| `tax_planner_id` | bigint | **2026-07-21.** fk → `tax_planners.id`. The Advanced Tax Planner allocated to the plan (set/cleared by the `tax_allocate_planner` action from the "Allocate to Advanced Tax Planner" step; supersedes the free-text `atp_name`). Gates the Yes-path (decision/pricing/extra-meeting return 400 without it). **Also the group-rights key for the Tax Planner portal (2026-07-22):** a `tax_planner` caller may view/edit any plan whose `tax_planner_id` is a planner sharing their `tax_planners.member_type` (Tax Planning Group) — enforced by `denyIfNotPlannerPlan`/`denyIfNotPlannerClient` in `utils/tax-planner-ownership.ts` (gotcha #257). |
| `tax_planner_share` | numeric | **2026-07-21.** Dollar amount of the Tax Planner leg (of the TOTAL). Paid proportionally per installment to the planner's GROUP Connect account by `utils/tax-planner-payout.ts` (gotcha #253). The Payment Continuation backfill (`migration_backfill_tax`, 2026-07-24) also writes it — the operator enters the per-IMPLEMENTATION split and the tool SCALES it to dollars-of-total for storage (`scale = totalForSplit/implAmt`), storing NULL (not 0) when blank so the sweep's `.not(...,is,null)` filter never enumerates a no-op row (gotcha #277). |
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
| `legacy_source` | text | **Migration marker.** `'old-system'` on rows written by the Payment Continuation tool (`migration_backfill_tax`). This is the signature the v612 collision guard trusts: a backfill update against a row NOT signed `'old-system'` returns HTTP 409 unless `force:true` (gotcha #230). Dedupe is by `client_id`+`program_id`. |
| `legacy_migrated_at` | timestamptz | **Migration marker.** Set when the row was hand-migrated by the tool. |
| `retainer_payment_intent_id` | text | For Phase 6 refund operation. |
| `retainer_status` | text | `succeeded` / `processing` (ACH) / `check_pending`. NULL = not yet paid. |
| `retainer_date` | date | Date paid (or date check path was started). |
| `retainer_confirmation_status` | text | `Confirmation Needed` on payment → `Sent` after the confirmation email (ACH / check), OR **`Skipped - Card (Receipt Only)`** for a card retainer — since 2026-07-26 a card gets the invoice/receipt and no confirmation. The skip value is terminal-equivalent to `Sent` for the handler's idempotency guard (a replayed webhook must not re-raise the PF bell) but leaves `retainer_confirmation_email_sent_at` NULL so a manual resend stays possible. Constant: `constants/confirmation-status.ts CONFIRMATION_CARD_SKIP` (edge) / `src/lib/confirmationStatus.js` (react). |

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

### Tax Planner payout (3rd split leg — added 2026-07-21)
Written by `utils/tax-planner-payout.ts transferPlannerShare` — the tax planner leg of the 3-way split, paid to the planner's **Tax Planning Group** Connect account (`tax_planners.member_type` → `tax_planning_groups.name` → `stripe_account_id`). Proportional per installment (`tax_planner_share / total_fee × payment`). Independent of the member's revenue decision — the planner's own governs (though `revenue_decision` is retired; see `tax_planners`). Gotcha #253.

| Column | Type | Notes |
|---|---|---|
| `retainer_planner_paid` | text | `Yes` (transferred) / `Money Mapping` / `N/A — No Share Due` / `Failed` (no group / group missing / group has no Stripe account / transfer errored → `FAILURE_tax_planner_share` bell + sweep retry). **The Payment Continuation backfill PRE-SETTLES this to `N/A — No Share Due` (+ `retainer_planner_completed_at`)** because the retainer was collected on the old system — otherwise a NULL planner leg + settled member leg + receipt + an allocated planner is exactly the sweep's stranded-leg rescue signature (#265) and would pay the planner a cut of that old-system retainer once a planner is allocated (gotcha #277). |
| `retainer_planner_completed_at` | timestamptz | Set on a terminal-success status (`Yes`/`Money Mapping`/`N/A`). |
| `retainer_planner_email_sent_at` | timestamptz | Guard for the `TAX_planner_revshare\|retainer` confirmation email (id 198, Draft) to the planner's own email. |
| `implementation_planner_paid` | text | Same statuses as retainer, for the implementation installment. **Plus `Awaiting Planner Allocation`** (2026-07-25, gotcha #284) — a share is due but no planner is allocated, so the money is held in the VFO balance and an action-required `TAX_planner_share_withheld` bell is raised. Deliberately NON-terminal: `tax_allocate_planner` releases it immediately on allocation, and the daily sweep's planner-retry query accepts it as a backstop. Can appear on the retainer leg too in principle, though in practice the retainer resolves before a planner matters. |
| `implementation_planner_completed_at` | timestamptz | Terminal-success stamp. |
| `implementation_planner_email_sent_at` | timestamptz | Guard for `TAX_planner_revshare\|implementation` (id 199, Draft). |

### Tax 2 — Assess-form step (added 2026-07-22; structured presentation-details form as of 2026-07-29, v677)
Backs the **"Assess tax planning opportunities (and enter presentation details)"** form-step (task ids 89 program 1 / 123 program 4, RENAMED from "Assess tax planning opportunities"; trigger `status_options==='assess_form'` OR the exact renamed task name — sentinel-first, #254 pattern; the swap on 89/123 is applied live). "Enter Details" → the structured form (Fee + strategy list + computed Summary table) → `tax_save_assess_form` → then `saveTask 'Completed'`. Written ONLY by `tax_save_assess_form` (AUTH, ADMIN_ONLY + TAX_PLANNER allowlist, `denyIfNotPlannerPlan` guard); NO chains / emails / notifications. Migration `20260722120000_client_tax_plans_assess_form.sql`. Full validation + shape rules: gotcha #306.

| Column | Type | Notes |
|---|---|---|
| `assess_form` | jsonb | The submitted presentation details — ONLY `{ fee, strategies:[{ name, invest_y1, invest_y2, gross_y1, gross_y2 }] }` (dollars, 2 dp; every field required on a kept row). Derived numbers (per-strategy totals, section totals, all of Net = Gross − Investment) are computed at render, NEVER stored — a consumer must compute them and must also handle the legacy `{question_1}` shape on pre-2026-07-29 rows (#306). |
| `assess_form_submitted_at` | timestamptz | Stamped on submit; drives the green "Submitted" pill + the read-only chevron-expand view (no re-edit). |
| `assess_form_submitted_by` | text | Session email of the submitter. |

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
| `tax4_meeting_date` | date | Admin-recorded date for the Tax Plan Review (Tax 4) high-level meeting. Set via `automation_TAX_highlevelmeeting_confirm` from the **"High Level Meeting Confirmation Email"** task at the top of the Tax 4 phase (`program_client_tasks` ids 153/154, status_options `tax_hlm_confirm`, `task_order=0`). (Replaced the old `automation_TAX_save_meeting_date` date-picker.) Once `tax4_meeting_date < today` AND `post_review_decision IS NULL`, the daily `tax-revshare-sweep-daily` cron raises ONE persistent action-required in-app notification ("Client decision 1 needed — <client>", rule `TAX_tax4_decision_needed`) to the client's **assigned PF + the plan's allocated tax planner + Tracy** (`tnmiller@elitert.com`, always present) — no longer a daily Gmail, and no longer to departed Tim Gacsy (2026-07-27, gotcha #291). The planner's row is link-overridden into the planner portal (gotcha #292). |
| `tax4_meeting_time` | text | Optional meeting time captured by the High Level Meeting Confirmation Email handler. |
| `tax4_meeting_timezone` | text | Optional meeting timezone captured by the same handler. |
| `tax_returns_requested_at` | timestamptz | Set by `automation_TAX_request_returns` when the "Request Tax Returns" email is drafted (VFO Tax Planning / program 4 step). Drives the "Request email sent" AI PC Admin sub-step. |
| `tax_returns_received_at` | timestamptz | Set by `actions/vault/upload-notify.ts` when a program-4 client uploads their returns. Drives the "Tax returns received" sub-step (green) + the `TAX_returns_received` bell. |
| `additional_info_requested_at` | timestamptz | Set by `automation_TAX_request_additional_info` when the "Request additional information" email is drafted (Tax 1 - Diagnostic, PROGRAM-AGNOSTIC — Holistic program 1 AND VFO Tax Planning program 4). Drives the "Request email sent" AI PC Admin sub-step. A resend re-stamps it and clears `additional_info_received_at`. Added in migration `20260723120000`. |
| `additional_info_received_at` | timestamptz | **Written by TWO paths, and that is the point (#308):** `actions/vault/upload-notify.ts` on ANY client upload, **and** `actions/vault/tax-text-submit.ts` on a written explanation submitted from `/tax-upload`. Either one completes the step. ALWAYS-overwritten on the newest plan with `additional_info_requested_at NOT NULL` (re-greens on every response; NO `program_id` gate, unlike `tax_returns_received_at`). Drives the "Additional information received" sub-step (green) + fires `TAX_additional_info_received` (Tracy/Tray) and `TAX_planner_additional_info_uploaded` (allocated planner). Added in migration `20260723120000`. |
| `additional_info_responses` | jsonb | **Added 2026-07-30, migration `20260730110000_tax_additional_info_response.sql`.** An **APPENDED array** of `{ text, at }` — the client's WRITTEN answers to a "Request additional information", submitted from the public `/tax-upload` page via `vault_tax_text_submit` (PUBLIC, token-gated on `clients.tax_upload_token`, text capped 5000 chars, 400s when no plan has an outstanding request). **Never overwritten** — one outstanding request can draw several clarifications and the planner needs all of them; the admin UI's "Client explanation" chip lists them newest-first. Every write also stamps `additional_info_received_at`, so there is exactly ONE notion of "received" across the upload and text paths. NULL on every plan that predates the column or has only ever been answered with a file. **The ADMIN's own request free text (`[REQUESTED_INFO]`) is NOT stored anywhere** — it exists only in the sent Gmail draft. Gotcha #308. |
| `tax4_meeting_confirm_email_sent_at` | timestamptz | When the client High Level Meeting Confirmation Email (`TAX_highlevelmeeting_confirm\|Yes`, id 148) was drafted. |
| `tax4_meeting_reminder_last_sent_at` | timestamptz | Guard for the once-per-plan in-app "Client decision 1 needed" notification (sweep sets it once; the confirm handler nulls it so the reminder fires fresh after a new meeting date is set). |
| `tax4_planner_nudge_sent_at` | timestamptz | **NEW 2026-07-22** (migration `20260722130000`). One-shot guard for the day-after-meeting PLANNER bell `TAX_planner_post_meeting` ("Confirm detailed tax plan presentation completion and client decision 1"), fired by `revshare-sweep.ts` when `tax4_meeting_date < today` + a planner is set + NOT(presentation done AND `post_review_decision` set). |
| `post_review_decision` | text | Admin's pick: `Continue - Revenue Share` / `Undecided` / `Stop - Refund`. |
| `post_review_decision_token` | text | 32-byte hex for `/tax-postreview-decide?token=`. Indexed. Generated on Continue + Undecided. |
| `post_review_decision_email_sent_at` | timestamptz | When client email was drafted — sweep base for the 48h reminder / 96h PF ladder (as of 2026-07-22 BOTH the Continue and Undecided picks use it; the Continue 24h auto-lock is REMOVED, gotcha #264). |
| `post_review_client_decision` | text | Client's click on the email button: `Proceed` (Undecided→Proceed → fires revshare) / `Confirmed` (Continue-email green "Continue now" click → fires revshare) / `Refund` (fires refund). **`Auto-Locked` is NO LONGER written by Tax 4 as of 2026-07-22 (gotcha #264)** — Continue is now click-only; the value survives only as historical data + the Tax 5 implementation twin. |
| `post_review_reminder_sent_at` | timestamptz | 48h reminder timestamp — shared by BOTH the Undecided AND (as of 2026-07-22) the Continue reminder ladder (safe: mutually exclusive per plan). |
| `post_review_pf_notified_at` | timestamptz | 96h PF notification timestamp — shared by BOTH the Undecided AND (as of 2026-07-22) the Continue-stalled bell. |
| `refund_status` | text | `succeeded` / `failed`. Set by `automation_TAX_refund` (PUBLIC, accepts service-role bearer OR admin session token). |
| `refund_id` | text | Stripe refund object id. |
| `refund_amount` | numeric | What was actually refunded (BASE amount only — no card-fee gross-up). |
| `refund_date` | date | |
| `refund_email_sent` | boolean | default false. |

### Set Up phase — Deposit, and the Green/Red Light decision
Tax Planning (program_id=4) starts with a **Set Up** phase containing exactly ONE task: **Deposit Paid** (`tax_deposit_pi`, `program_client_tasks` 114 — captures the Stripe PI). The go/no-go on that deposit is a **separate single decision step at the END of Tax 1 - Diagnostic**: "Tax Plan Green/Red Light - Refund $500 Deposit if unable to proceed based on the information provided" (`program_client_tasks` **116**, sentinel `status_options='tax_refund'`, `phase_id=26`, `task_order=8`). **Proceed** stores progress status exactly `'Proceed'`; **Refund** stores no progress status at all and instead fires `automation_TAX_depositrefund` (reason REQUIRED), which populates the `deposit_refund_*` columns below — those columns alone carry the refunded/closed state. Restructured 2026-07-27: the old two-task pair (`tax_greenlight` id 115 "Tax Plan Greenlight" Go/Stop + "Refund Paid") was collapsed into this one step and task 115 was DELETED. See gotcha #293. Holistic Tax Priorities (program_id=1) doesn't render Set Up (those clients arrive via MAP1 instead), but the same columns work for either program if populated.

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

**Touched by:** `tax_load_plans`, `tax_start_plan` (accepts `program_id`; on a Holistic plan ALSO seeds one `client_tax_progress` row for "Client risk profile complete" from the client's MAP 1 risk answer — gotcha #261), `tax_save_deposit_pi`, `automation_TAX_readyfortax3`, `automation_TAX_decision`, `automation_TAX_finaldecision`, `automation_TAX_pricing`, `automation_TAX_extrameeting`, `automation_TAX_sendagreement`, `automation_TAX_ceocountersign`, `automation_TAX_stripecustomer`, `automation_TAX_paymentemail`, `automation_TAX_loadpayment`, `automation_TAX_stripecheckout`, `automation_TAX_confirmationemail`, `automation_TAX_invoicereceipt`, `automation_TAX_paidbycheck`, `automation_TAX_checkcleared`, `automation_TAX_postreviewdecision`, `automation_TAX_postreviewclientdecision`, `automation_TAX_refund`, `automation_TAX_revshare`, `automation_TAX_revshare_sweep`, `automation_TAX_implementdecision`, `automation_TAX_implementfinaldecision`, `automation_TAX_charge_implementation`, `automation_TAX_implementation_receipt`, `automation_TAX_highlevelmeeting_confirm`, `automation_TAX_save_meeting_date` (orphaned), `automation_TAX_depositrefund`, `automation_load_tax_plans`, Stripe webhook (`maybeHandleStripeWebhook`), BoldSign webhook (`maybeHandleBoldSignWebhook` + standalone `boldsign-webhook` function). Frontend: [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx), [TaxAutomationPanel.jsx](src/components/admin/TaxAutomationPanel.jsx), [TaxDecidePage.jsx](src/pages/TaxDecidePage.jsx), [TaxPayPage.jsx](src/pages/TaxPayPage.jsx), [TaxPostReviewDecidePage.jsx](src/pages/TaxPostReviewDecidePage.jsx), [TaxImplementDecidePage.jsx](src/pages/TaxImplementDecidePage.jsx).

---

## `client_tax_specialists`

Many-to-many between a tax plan and the `experts` working on it.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `tax_plan_id` | integer | not null. fk → `client_tax_plans.id` (CASCADE). |
| `expert_id` | bigint | **NULLABLE** as of migration `20260729210000_tax_specialist_other_option.sql` — fk → `experts.id` (NO ACTION). **A NULL `expert_id` IS the "Other #N (See notes)" allocation** (#305): it points at no `experts` row, so it can never reach a showroom or the public widget. |
| `specialist_name` | text | not null. Snapshot of name (so display survives expert renames). Server-controlled `Other #N (See notes)` on the NULL-expert path, numbered max+1 per plan. |
| `status` | text | not null, default `'live'`. **DEAD COLUMN — nothing in either repo has ever written it**, so every row reads `'live'` and the `'stopped'` branch is unreachable. It used to drive the allocation pill, which therefore always said "Live". **As of 2026-07-30 the pill instead derives from the per-specialist "Confirm ready for implementation" answer** (`localProgress[`${confirmReadyTask.id}_${spec.id}`]?.status`, `status_options = "Yes\|Undecided\|No"` on `program_client_tasks` 102/135): no answer / task missing → **Pending Decision**, `Yes` → **Ready** (green `#1b9254`), `Undecided` → **Undecided** (amber `#e06717`), `No` → **Not Proceeding** (red `#e74c3c`). The inert `status==='stopped'` branch is preserved at highest priority in case anything ever writes it; the Move-to-Implementation bypass writes no progress row and so renders the Pending Decision default. |
| `created_at` | timestamptz | not null, default `now()`. |

**Touched by:** `tax_load_specialists`, `tax_add_specialist`, `tax_remove_specialist` (which deletes the specialist's `client_tax_progress` rows FIRST — the FK is ON DELETE SET NULL and NULL there means PLAN-LEVEL, see #305).

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

---

## `tax_planners` (added 2026-07-21)

Admin-managed person-type — the "Advanced Tax Planner" attached to tax engagements. Mirrors `experts` (Specialists): admin CRUD + a private document vault + Stripe Connect. As of 2026-07-22 a row also has a **portal login** (`tax_planner_logins`, the 5th portal / 6th login type — see [../architecture/04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md)); every ADMIN surface remains service-role via the edge fn. RLS deny-all in the creating migration (`20260721100000_tax_planners.sql`; gotcha #141).

**As of 2026-07-27 the table holds TWO person-types, split by `planner_role`.** A **Team Member** logs into the SAME portal with the same capabilities, restrictions, allowlist and group-scope guards as a Tax Planner, but can **never be allocated to a tax plan** — and that single block is the *entire* reason a team member receives no planner notifications and no planner payout (both key off `client_tax_plans.tax_planner_id`). Gotcha #294.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk (identity). |
| `first_name` / `last_name` | text | not null. |
| `email` | text | Optional. Recipient of the planner rev-share confirmation emails. |
| `status` | text | not null, default `'Active'`. The allocation dropdown lists Active planners. |
| `revenue_decision` | text | not null, default `'Revenue Share'`. **Retired** — wiped to '' and dropped from the planner UI; the GROUP model governs payout. Kept for schema stability. |
| `planner_role` | text | **NEW 2026-07-27** (`20260727120000_tax_planner_roles.sql`). not null, default `'Tax Planner'`; CHECK `tax_planners_planner_role_check` = `'Tax Planner' \| 'Team Member'`. **A `'Team Member'` can never be allocated** — `tax_allocate_planner` 400s (the single server-side choke point), and the admin allocation dropdown, the KPI allocation leaderboard and the portal's `group` roster all filter the role out. `save_tax_planner` sanitizes it and preserves the stored value when an edit omits it. Legacy rows read as `'Tax Planner'` via the default. Labelled **"Member Type"** in the admin UI. Gotcha #294. |
| `member_type` | text | The planner's **Tax Planning Group** / **partnership** name — must match `tax_planning_groups.name`; the payout destination AND the portal group-scope both resolve through it. Nullable for a Tax Planner (an unassigned planner cannot be paid → `Failed` + Jake alert) but **REQUIRED for a Team Member** (`save_tax_planner` 400s `"Team members require a partnership"` — with no partnership their portal would show nothing). Semantics deliberately UNCHANGED by the 2026-07-27 role split; labelled **"Partnership"** in the admin UI (do not confuse it with the "Member Type" label, which is `planner_role`). Added in `20260721120000`. |
| `certifications` | jsonb | not null, default `'[]'`. Multi-add certifications, shown as a name suffix. **Hidden in the UI for a Team Member** (existing data untouched). Added in `20260721130000`. |
| `headshot_image` / `bio` / `notes` | text | Profile fields. |
| `website_url` | text | **RETIRED 2026-07-27 — dead column.** Removed from the planner Edit form, the profile view and the `save_tax_planner` write whitelist for BOTH roles. The column and its stored values are retained, but nothing reads or writes them any more; a future writer must be re-added to the whitelist. |
| `stripe_account_id` | text | **Vestigial** — the payout goes to the GROUP account, not the planner's own. |
| `join_date` / `leave_date` | date | |
| `created_at` | timestamptz | not null, default `now()`. |

**Private bucket:** `tax-planner-documents` (namespaced by `tax_planners.id`). **Touched by:** `tax_planners_load`, `save_tax_planner`, `delete_tax_planner`, `tax_planner_payments_load`, `tax_planner_vault_{list,upload_url,download,delete}`, `tax_allocate_planner`, `tax_planner_portal_clients`, `utils/tax-planner-payout.ts`, `utils/tax-planner-ownership.ts`.

---

## `tax_planning_groups` (added 2026-07-21)

The "companies" that receive the Tax Planner Share via a group-level Stripe Connect account. Exact mirror of `strategic_member_groups`. RLS deny-all in the creating migration (`20260721120000_tax_planning_groups.sql`).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk (identity). |
| `name` | text | not null. Case-insensitive UNIQUE (`tax_planning_groups_name_lower_key`) → friendly 23505 dup message. A group name is a `tax_planners.member_type` option; RENAME cascades planners' `member_type`; DELETE is guarded when any planner references it. |
| `stripe_account_id` | text | The GROUP Connect account the planner share transfers to (resolved via `tax_planners.member_type` → this row). |
| `contact_email` | text | Used by the group Stripe-Connect setup-email flow. |
| `created_by` | text | |
| `created_at` | timestamptz | not null, default `now()`. |

**Touched by:** `save_tax_planning_group`, `delete_tax_planning_group`, `tax_planning_group_stripe_connect_request`, `utils/tax-planner-payout.ts` (destination resolution).

---

## `tax_planner_logins` (added 2026-07-22)

The **5th `*_logins` table** — per-planner portal credentials for the NEW Tax Planner portal (5th portal / 6th login type). Whereas the 2026-07-21 build gave planners NO login (admin-only), a planner can now sign in at `/tax-planner`. RLS enabled, **deny-all** (no policies → service-role only; all access via the edge fn). The caller role `'tax_planner'` is fenced to `TAX_PLANNER_ALLOWED_ACTIONS` + per-handler group-scope guards (gotcha #257). Shares the `admin_sessions` token table with the other four login types. Migration `20260722100000_tax_planner_logins.sql` (anon probe → `Content-Range: */0`). See [auth.md](auth.md) + [../architecture/04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | identity pk. |
| `name` | text | |
| `email` | text | not null. **Unique index on `lower(email)`.** |
| `tax_planner_id` | bigint | not null. **Unique.** fk → `tax_planners.id` ON DELETE CASCADE (one login per planner). |
| `passcode_hash` | text | not null. Salted PBKDF2-HMAC-SHA256. |
| `created_at` | timestamptz | default `now()`. |

**Touched by:** written by `submit_login_setup` (`login_type='tax_planner'`, keyed on `tax_planner_id`) + `tax_planner_update_login` (self-service); read by `tax_planner_login`. NOTE: the `login_setup_tokens` `login_type` CHECK constraint was widened to admit `'tax_planner'` (migration `20260722110000` — without it, planner token creation 500s; gotcha #258).
