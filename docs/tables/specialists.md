# Specialists tables

"Specialists" (also called "experts" in the schema) are the third-party domain experts that members can refer their clients to. The `experts` table is large (~30 columns) because each row holds full marketing copy for the public website widget. The onboarding workflow is its own state machine in `specialist_onboarding`.

## `experts`

The specialist roster. Most columns are display/marketing text (the "D&B" prefix = Details & Benefits — the public-facing copy).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `name` | text | not null |
| `photo_url` / `headshot_image` | text | Two image fields — likely one is hosted URL and the other a Supabase-storage object key. |
| `short_bio` / `long_bio` | text | |
| `branding` | text | |
| `details_and_benefits` | text | |
| `sort_order` | integer | default `0`, nullable. Display order. Renormalized to 1-based alphabetical position by `name` on every `save_specialist` insert. Edits do not touch this column. The `save_specialist_order` admin reorder API still exists but is overridden on the next insert. |
| `background_check` | text | |
| `D&B_strategy_expertise` | text | |
| `D&B_cutoff_date` | text | (Stored as text, not date) |
| `D&B_client_requirements` | text | |
| `D&B_investment_cost` | text | |
| `D&B_ideal_client` | text | |
| `D&B_summary_benefits` | text | |
| `D&B_getting_started` | text | |
| `D&B_professional_process` | text | |
| `D&B_competitive_advantage` | text | |
| `D&B_audit_risk_general` | text | |
| `D&B_audit_risk_history` | text | |
| `D&B_audit_risk_worst_case` | text | |
| `D&B_audit_risk_precautions` | text | |
| `D&B_revenue_share` | text | |
| `D&B_tax_risk_mindset` | text | |
| `D&B_tax_risk_notes` | text | |
| `top_of_t` | boolean | not null, default `false`. Promotion flag for "top of the table" placement. |

**Note:** Column names containing `&` (`D&B_*`) require quoting in SQL.

**Touched by:** `load_data` (returned as `data.experts`), `save_specialist`, `save_specialist_order`, `delete_specialist`, `upload_headshot`. Frontend: [SpecialistsPanel.jsx](src/components/admin/SpecialistsPanel.jsx).

---

## `vfo_ecosystem_assignments`

Many-to-many tag table — which `experts` belong to which "ecosystem" (a free-form tag, e.g., `"Estate Planning"`).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `expert_id` | bigint | fk → `experts.id` (CASCADE) |
| `ecosystem_id` | bigint | (No FK — just a numeric tag id, source is application-level) |
| `name` | text | not null. Display name of ecosystem. |

**Touched by:** `load_data` (returned as `data.ecosystems`). Joined into `ecoMap` in [AdminPortal.jsx:94](src/pages/AdminPortal.jsx).

---

## `specialist_onboarding`

Multi-stage onboarding workflow. Stages 1..N are application-defined; each stage has its own task list (in `specialist_onboarding_progress`), meeting log, and vote tally.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `specialist_name` | text | not null |
| `specialist_email` | text | |
| `current_stage` | integer | not null, default `1`. Status field — drives which stage's UI is active. |
| `status` | text | not null, default `'active'`. Status field. |
| `background_check_type` | text | |
| `created_by` | text | |
| `created_at` / `updated_at` | timestamptz | default `now()` |
| `sif_token` | text | unique partial index. Token for the public `/specialist-sif` page; set by `automation_SPECIALIST_prelimemail` on the Stage 1 continue email (2026-06-02). |
| `sif_data` | jsonb | Submitted Specialist Information Form payload (written by `automation_SPECIALIST_submitsif`). |
| `sif_submitted_at` | timestamptz | When the SIF was submitted; drives the Stage 1 "SIF form completed" AI PC Admin step. (The SIF `sif_data` jsonb now also carries `is_tax_specialist` Yes/No + 4 tax-risk answers.) |
| **Background-check payment** (2026-06-03) | | `bg_step3_email_sent_at`, `bg_checkout_token` (uniq idx), `bg_stripe_customer_id`, `bg_payment_intent_id`, `bg_payment_status` (`pending`/`processing`/`succeeded`/`failed`), `bg_payment_method_type`, `bg_acct_last4`, `bg_card_processing_fee`, `bg_payment_completed_at`, `bg_confirmation_email_sent_at`, `bg_invoice_number`, `bg_invoice_drive_id`, `bg_receipt_number`, `bg_receipt_drive_id`, `bg_receipt_email_sent_at`. `background_check_type` ('Core'/'Max') set on payment success. |
| **Further questions** (2026-06-03) | | `further_questions_token` (uniq idx), `further_questions_requested_at`, `further_questions_resolved_at`, `further_questions_resolution` ('Proceed'/'Stop'). |
| **Reminder timer guards** (2026-06-03) | | `sif_email_sent_at` + `sif_reminder_sent_at` + `sif_pf_notified_at`; `bg_choice_reminder_sent_at` + `bg_choice_pf_notified_at`; `vote_r1_opened_at`/`vote_r1_reminder_sent_at`/`vote_r1_pf_notified_at`; `vote_r2_opened_at`/`vote_r2_reminder_sent_at`/`vote_r2_pf_notified_at`. Consumed by `automation_SPECIALIST_sweep`. |
| **Due Diligence Checklist** (2026-06-04) | | `ddc_token` (uniq idx), `ddc_data` (jsonb — text answers + file refs `{path,name,size,type}`), `ddc_email_sent_at`, `ddc_submitted_at`, `ddc_help_requested_at`, `ddc_reminder_sent_at`, `ddc_pf_notified_at`, `ddc_review_status` (`pending_review`/`approved`/`edits_requested`), `ddc_edits_reason`, `ddc_approved_at`, `ddc_edits_email_sent_at`, `ddc_review_log` (jsonb array `{type:'submitted'\|'approved'\|'denied', reason?, at}` — approve/deny paper trail, gotcha #71). Files in the **private** `specialist-dd-materials` bucket (gotcha #69). |
| **Final rev-share proposal** (2026-06-04) | | `rev_share_final_token` (uniq idx), `rev_share_final_response` ('Approved'/'Further Questions'), `rev_share_final_response_at`, `rev_share_final_text` (Tracy's edited final — the original stays in `specialist_onboarding_progress` `rev_share_prepared`, gotcha #70). |

**Status fields:** `current_stage` (auto-advances to 3 on Stage-2 exec approval; → 4 when **all three** Stage-3 items complete — Background Passed + DD Approved + rev-share finalized, via `maybeAdvanceStage3`, 2026-06-04; **Stage-4 final exec approval does NOT auto-advance to 5 yet**), `status` (`stopped` on both-Denied at either stage). Stage-4 final-approval reviewer notes + 2-round votes reuse the same `tracy_general_notes`/`tim_tax_risk_notes` progress keys (stage 4) and `specialist_onboarding_votes` (stage 4). The Stage-4 status steps (`agreement_sent`/`agreement_signed_specialist`/`agreement_signed_ceo`/`payment_link_sent`/`payment_made`/`confirmation_email_sent`/`invoice_receipt_sent`) + the completion-email idempotency markers (`<item>_complete_emailed`) are all freeform `specialist_onboarding_progress` task_keys (no columns).

**Touched by:** `load_onboardings`, `create_onboarding`, `load_onboarding`, `update_onboarding`, the Stage 1–2 automation handlers, `automation_SPECIALIST_execvote`, `_step3email`, `_bgconfirmation`, `_bgreceipt`, `_questionsrequest`/`_questionsresolve`, `_sweep`, the webhook background-check branch, and (2026-06-04) the DD Checklist + rev-share-final handlers `_loadddc`/`_saveddc`/`_ddcuploadurl`/`_submitddc`/`_ddchelp`/`_ddcapprove`/`_ddcedits`/`_ddcdownload`/`_revsharefinal`/`_revsharefinalize` (the old `_revsharedecide` was removed). Frontend: [SpecialistOnboarding.jsx](src/components/admin/SpecialistOnboarding.jsx) + [SpecialistAutomationPanel.jsx](src/components/admin/SpecialistAutomationPanel.jsx). See [../flows/specialist-onboarding.md](../flows/specialist-onboarding.md).

---

## `specialist_onboarding_progress`

Per-task progress within a stage of an onboarding.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `onboarding_id` | integer | not null. fk → `specialist_onboarding.id` (CASCADE). |
| `stage` | integer | not null |
| `task_key` | text | not null |
| `status` | text | not null, default `'pending'`. Status field. Values seen: `'pending'`, `'completed'`, `'unchecked'` (Stage 2 checklist toggle-off sentinel — treated as not-done by the frontend `getTaskStatus`; gotcha #62). |
| `completed_by` | text | |
| `completed_at` | timestamptz | |
| `notes` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `save_onboarding_progress` (incl. the Stage 2 checklist toggle; the reviewer-notes keys `tracy_general_notes`/`tim_tax_risk_notes`, whose save fires/clears the reviewer-notes notifications; and `rev_share_prepared` whose save opens exec voting — gotchas #64–#66). Also written by `automation_SPECIALIST_bgreceipt` (`bg_email_sent`/`payment_received`) and `_deniedemail` (`denied_email_sent`).

---

## `specialist_onboarding_meetings`

Meetings logged against an onboarding.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `onboarding_id` | integer | not null. fk → `specialist_onboarding.id` (CASCADE). |
| `meeting_date` | date | |
| `items_discussed` | text[] | array, default `'{}'` |
| `notes` | text | |
| `outcome` | text | |
| `created_by` | text | |
| `created_at` | timestamptz | default `now()` |
| `rev_proposal_text` | text | Per-meeting revenue-share proposal sent in the Stage 2 email (only when "Discuss revenue share (detail)" was covered that meeting). 2026-06-02. |
| `rev_proposal_token` | text | unique partial index. Token for the `/specialist-revshare-decide` Approve/Propose-edit buttons; minted by `save_onboarding_meeting` when a proposal is attached. |
| `rev_proposal_email_sent_at` | timestamptz | Stamped by `automation_SPECIALIST_stage2email` when the proposal email is drafted. |
| `rev_proposal_response` | text | `'Approved'` or `'Propose an edit'` — set by `automation_SPECIALIST_revsharedecide`. |
| `rev_proposal_response_at` | timestamptz | |
| `rev_proposal_reminder_sent_at` / `rev_proposal_pf_notified_at` | timestamptz | 2026-06-03. 48h/96h guards for the rev-share-unanswered reminder stall in `automation_SPECIALIST_sweep`. |

**Touched by:** `save_onboarding_meeting`, `automation_SPECIALIST_stage2email`, `automation_SPECIALIST_revsharedecide`, `automation_SPECIALIST_sweep`.

---

## `specialist_onboarding_votes`

Per-stage vote log. Each voter casts one vote per stage.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `onboarding_id` | integer | not null. fk → `specialist_onboarding.id` (CASCADE). |
| `stage` | integer | not null |
| `voter_name` | text | not null. Stage 2 = `'Anton Anderson'` / `'Paul Latham'`. |
| `vote` | text | not null. Stage 2 round 1: `'Approved'`/`'Further Questions'`; round 2: `'Approved'`/`'Denied'`. |
| `vote_round` | integer | not null, default `1` (2026-06-03). Distinguishes the two Stage-2 exec-approval rounds. |
| `notes` | text | |
| `voted_at` | timestamptz | default `now()` |

**Unique constraint** is now `(onboarding_id, stage, voter_name, vote_round)` (was 3-col). Stage-2 exec votes are written by `automation_SPECIALIST_execvote` (account-scoped; values redacted in `load.ts` until both vote — gotcha #64); `save_onboarding_vote` still serves stage-4 votes (defaults `vote_round=1`).

**Touched by:** `save_onboarding_vote`.
