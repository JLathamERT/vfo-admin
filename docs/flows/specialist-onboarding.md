# Specialist onboarding flow

A multi-stage workflow for vetting a new specialist (third-party expert). Five stages: 1 Preliminary Meeting, 2 Detail Meetings, 3 Due Diligence, 4 Contract & Details, 5 Going Live. Each stage has a task checklist, meeting log, and exec-vote tally on the onboarding row + child tables.

> **2026-06-02:** Stages **1–2 automated** (template emails, SIF form page, per-meeting rev-share proposal, notifications).
> **2026-06-03 (v374):** added **Stage 2 account-scoped exec voting** (2 rounds), **reviewer notes** (Tracy + Tim), **decline-on-deny**, the full **Stage 3 background-check payment chain** (Stripe ACH/Card $350/$950, confirmation + invoice/receipt PDFs, Drive archival, Further Questions flow, auto-advance to Stage 3), the **Specialist Automation Panel**, and a **reminder sweep** (`specialist-sweep-daily` 07:00 UTC). Stages 4–5 remained a manual checklist. Specialist pipeline is in **sandbox** (`pipeline_sandbox_config` SPECIALIST_ONBOARDING `sandbox_mode=true`) — flip to live before real payments.
> **2026-06-04 (v394, branch `claude/epic-robinson-b8609d`, DEPLOYED + frontend live but NOT committed):** **DDC form rework** (sectioned, per-question cards, file/text/both inputs, tax-only Compliance section, nothing required), **3 Stage-3 completion emails** (`SPECIALIST_bg_passed` 89 / `SPECIALIST_ddc_approved` 87 [now written] / `SPECIALIST_revshare_complete` 90 via shared `utils/specialist-stage3-emails.ts`), the **all-three Stage-3→4 gate** (`maybeAdvanceStage3`), and **Stage 4 final executive approval matching Stage 2** (reviewer notes → 2-round voting → View details). **Frontend is now deployed** (whole Specialist UI live).
> **2026-06-05 (v404 / boldsign-webhook v39, branch `claude/keen-stonebraker-cacda8`, backend DEPLOYED, ⚠️ frontend NOT deployed, NOT committed):** **Stage-4 sign / pay / recurring-license flow built.** Both-exec-Approved auto-sends the agreement via BoldSign (`[PROPOSED_REVENUE_SHARE]` filled from `rev_share_final_text` || the Stage-2 `rev_share_prepared` notes) → CEO countersign → **$99/mo Stripe SUBSCRIPTION** (`/specialist-pay?kind=license`) → confirmation → invoice/receipt → **Stage 4→5**, recurring monthly thereafter. 8 new handlers, 20 new `specialist_onboarding` columns, `boldsign-webhook` specialist branch, 3 `webhooks.ts` subscription blocks, reminder sweep extended to 7 stalls, Stage-2 reviewer-notes reworked (rev-share→notes→vote, always-visible, Tracy "submit proposal" action). See the **Stage 4** section below.

- **Pipeline label:** `SPECIALIST_ONBOARDING` (`email_templates.pipeline`, `agreement_templates.pipeline`, `notifications.pipeline`, `pipeline_sandbox_config.pipeline`).
- **State tables:** `specialist_onboarding` (main; `current_stage` 1–5, `status`, `background_check_type`, `sif_token`/`sif_data`/`sif_submitted_at`, the `bg_*` background-check payment cols, `further_questions_*`, and the reminder timer-guard cols — see [tables/specialists.md](../tables/specialists.md)), `specialist_onboarding_progress` (task checklist + `tracy_general_notes`/`tim_tax_risk_notes`/`rev_share_prepared` notes), `specialist_onboarding_meetings` (Stage 2 meetings + per-meeting rev-share proposal cols + reminder guards), `specialist_onboarding_votes` (now keyed `(onboarding_id, stage, voter_name, vote_round)`).
- **Exec voters / admin logins:** Anton Anderson (`aanderson@elitert.com`), Paul Latham (`platham@elitert.com`); reviewer notes to Tracy Miller (`tnmiller@elitert.com`) + Tim Gacsy (`tgacsy@elitert.com`). All four are `allowed_admins` rows (gotchas #60, #67).
- **Trigger:** AdminPortal → Specialists dropdown → Onboarding → `components/admin/SpecialistOnboarding.jsx`.
- **All automated emails are Gmail DRAFTS** (match advisor/tax). Storage: public bucket `specialist-onboarding-assets`.

## Manual tracker handlers (`actions/onboarding/`)

| Action | File | Notes |
|---|---|---|
| `load_onboardings` | `load-list.ts` | All rows, newest first |
| `create_onboarding` | `create.ts` | New row, `current_stage=1`, `status='active'` |
| `load_onboarding` | `load.ts` | Row + progress + meetings + votes (`select('*')` → includes new sif/rev cols) |
| `save_onboarding_progress` | `save-progress.ts` | Upsert `(onboarding_id, stage, task_key)`; **empty status defaults to `'completed'`** (see gotcha #62) |
| `save_onboarding_meeting` | `save-meeting.ts` | Append-only meeting insert; now also accepts `rev_proposal_text` → mints `rev_proposal_token` |
| `save_onboarding_vote` | `save-vote.ts` | Upsert `(onboarding_id, stage, voter_name, vote_round)`. **No longer used (2026-06-04)** — Stage-2 AND Stage-4 exec votes both go through `automation_SPECIALIST_execvote` now. |
| `update_onboarding` | `update.ts` | Advances `current_stage` / sets `status` / `background_check_type`. No auto-advance. |

All of the above are `ADMIN_ONLY_ACTIONS`.

## Automation handlers (`actions/onboarding/`)

| Action | Auth | Trigger | Does |
|---|---|---|---|
| `automation_SPECIALIST_prelimemail` | AUTH | Stage 1 decision buttons | `continue`/`continue_no_date` → drafts `SPECIALIST_yes` (process image + SIF button + 2 static PDF attachments + closing); mints `sif_token`; stamps `sif_email_sent_at`. `stop` → `SPECIALIST_no`. |
| `automation_SPECIALIST_stage2email` | AUTH | Stage 2 "Still interested — Send email" | Drafts `SPECIALIST_step2_progress` (Completed/Remaining lists + process image + date closing); "all areas complete" closing when nothing remains. (Per-meeting rev-share proposal removed 2026-06-04.) |
| `automation_SPECIALIST_loadsif` | PUBLIC | `/specialist-sif` load | By `sif_token` → prefill + existing `sif_data` |
| `automation_SPECIALIST_submitsif` | PUBLIC | `/specialist-sif` submit | Saves `sif_data` (incl. the tax-specialist Q + 4 tax-risk answers) + `sif_submitted_at`; notifies Tracy (FYI) |
| `automation_SPECIALIST_revsharefinal` | PUBLIC (token) | `/specialist-revshare-final?token=&decision=Approved\|Questions` | Specialist's response to the Exhibit A proposal in the Step 3 email → `rev_share_final_*`; Approved → Tracy FYI, Further Questions → non-dismissible Tracy action notif |
| `automation_SPECIALIST_revsharefinalize` | AUTH (admin) | Stage 3 Confirm/Edit rev-share buttons | Confirm → `rev_share_finalized` notes `'kept'`; Edit → edited text to `rev_share_final_text` (preserves original `rev_share_prepared`, gotcha #70) + `'edited'`; clears Tracy's action notif |
| `automation_SPECIALIST_loadddc` | PUBLIC (token) | `/specialist-ddc` load | By `ddc_token` → prefill + `ddc_data` + `ddc_review_status`/`ddc_edits_reason` + is-tax flag |
| `automation_SPECIALIST_saveddc` | PUBLIC (token) | `/specialist-ddc` autosave | Saves whole `ddc_data` (text + file refs); no submit stamp |
| `automation_SPECIALIST_ddcuploadurl` | PUBLIC (token) | `/specialist-ddc` file pick | Mints a signed UPLOAD url into the private bucket `specialist-dd-materials` (gotcha #69) |
| `automation_SPECIALIST_submitddc` | PUBLIC (token) | `/specialist-ddc` "Submit for review" | `ddc_submitted_at` + `ddc_review_status='pending_review'`; appends `ddc_review_log` `{submitted}`; Tracy FYI |
| `automation_SPECIALIST_ddchelp` | PUBLIC (token) | `/specialist-ddc-help` | `ddc_help_requested_at`; non-dismissible Tracy action notif (clears on "Help received" → `save-progress` `ddc_help_resolved`) |
| `automation_SPECIALIST_ddcapprove` | AUTH (admin) | Stage 3 "DD Checklist Approved" | `ddc_review_status='approved'`; appends `ddc_review_log` `{approved}`; drafts `SPECIALIST_ddc_approved` (now written — reports the other Stage-3 items via the completion-email helper); calls `maybeAdvanceStage3` |
| `automation_SPECIALIST_ddcedits` | AUTH (admin) | Stage 3 "Denied" (+ reason) | Drafts `SPECIALIST_ddc_edits` (reason + resubmit link); `ddc_review_status='edits_requested'`, clears `ddc_submitted_at`; appends `ddc_review_log` `{denied,reason}` |
| `automation_SPECIALIST_ddcdownload` | AUTH (admin) | Stage 3 "View progress" file link | Mints a 300s signed DOWNLOAD url for one DD file (path prefix-checked, gotcha #69) |
| `automation_SPECIALIST_execvote` | AUTH (admin) | Stage 2 **and Stage 4** exec approval buttons | **Stage-aware (`body.stage`).** Caster derived from session; round 1 Approved/Further-Questions, round 2 Approved/Denied. Stage 2 both-Approved → chain `step3email` + advance Stage 3; **Stage 4 both-Approved → auto-chain `automation_SPECIALIST_sendagreement`** (backgrounded via `EdgeRuntime.waitUntil`); both-Denied → `deniedemail` + stop; split → reset + re-vote notif; fires "vote completed" FYI. (Reveal for stages 2 & 4 in `load.ts`, gotcha #64.) |
| `automation_SPECIALIST_deniedemail` | PUBLIC (svc-role/admin) | Chained on both-Denied | Drafts `SPECIALIST_denied` (idempotent on `denied_email_sent`) |
| `automation_SPECIALIST_step3email` | PUBLIC (svc-role/admin) | Chained on both-Approved | Creates Stripe customer + `bg_checkout_token` + `further_questions_token`; drafts `SPECIALIST_step3` (Core/Max/Questions buttons); advances `current_stage` to 3 |
| `automation_SPECIALIST_bgloadpayment` | PUBLIC (token) | `/specialist-pay` load | Returns name + Core/Max type + amount ($350/$950) |
| `automation_SPECIALIST_bgcheckout` | PUBLIC (token) | `/specialist-pay` ACH/Card pick | Stripe Checkout one-time, metadata `pipeline=SPECIALIST_ONBOARDING`/`payment_kind=background_check`/`bg_type` |
| `automation_SPECIALIST_bgconfirmation` | PUBLIC (svc-role) | Webhook at payment time (both methods) | Drafts `SPECIALIST_bg_confirmation\|card`/`\|ach` (MAP1 wording) |
| `automation_SPECIALIST_bgreceipt` | PUBLIC (svc-role) | Webhook on clearance (card now / ACH on settle) | Invoice+receipt PDFs → Drive `VFO Specialist Onboarding/<Name> - Specialist`; **mints `ddc_token` + `rev_share_final_token` + stamps `ddc_email_sent_at`**; drafts the full `SPECIALIST_bg_receipt` (DD Checklist + Request-Help buttons, process image, Exhibit A proposal + Happy/Further-Questions buttons) w/ both PDFs attached; marks paid; Tracy FYI; sets Checkr/Scherzer label |
| `automation_SPECIALIST_questionsrequest` | PUBLIC (token) | `/specialist-questions` | Records request + non-dismissible Tracy notif |
| `automation_SPECIALIST_questionsresolve` | AUTH (admin) | Tracy's Proceed/Stop buttons | Proceed → `SPECIALIST_step3_proceed`; Stop → `SPECIALIST_no` + stop; clears Tracy's notif |
| `automation_load_specialist_pipelines` | AUTH (admin) | Automation tab loader | All rows + votes + meetings + final-proposal + sandbox config |
| `automation_SPECIALIST_sweep` | PUBLIC (svc-role) | cron `specialist-sweep-daily` 07:00 UTC | 48h reminder / 96h Tracy FYI for **7 stalls** (gotcha #66) |
| `automation_SPECIALIST_sendagreement` | PUBLIC (svc-role/admin gate) | Auto-chained from `exec-vote` on Stage-4 both-approved | Renders agreement HTML→PDF (`[PROPOSED_REVENUE_SHARE]` filled), coordinate-based BoldSign send (signer 1 specialist, 2 Anton), drafts `SPECIALIST_agreement_sent`; idempotent on `agreement_sent_at` |
| `automation_SPECIALIST_ceocountersign` | PUBLIC (svc-role/admin) | BoldSign webhook (specialist signed) | Fetches Anton's embedded countersign link, drafts `SPECIALIST_ceo_countersign` |
| `automation_SPECIALIST_licstripecustomer` | PUBLIC (svc-role) | BoldSign webhook (Completed) | Reuses `bg_stripe_customer_id`, mints `lic_checkout_token`, chains `licpaymentemail` |
| `automation_SPECIALIST_licpaymentemail` | PUBLIC (svc-role) | Chained from `licstripecustomer` | Drafts `SPECIALIST_lic_payment` w/ `/specialist-pay?kind=license`; marks `payment_link_sent` |
| `automation_SPECIALIST_licloadpayment` | PUBLIC (token) | `/specialist-pay?kind=license` load | Returns name + $99/mo |
| `automation_SPECIALIST_liccheckout` | PUBLIC (token) | `/specialist-pay?kind=license` ACH/Card pick | Stripe Checkout **`mode=subscription`** $99/mo (card grossed-up / ACH flat), metadata `payment_kind=license` |
| `automation_SPECIALIST_licconfirmation` | PUBLIC (svc-role) | Webhook at license payment time (both methods) | Drafts `SPECIALIST_lic_confirmation\|card`/`\|ach` |
| `automation_SPECIALIST_licinvoicereceipt` | PUBLIC (svc-role) | Webhook on each `invoice.paid` | `INV-SPECLIC`/`REC-SPECLIC` PDFs → Drive; drafts `SPECIALIST_lic_invoicereceipt` (body **TBC**) w/ both attached |

## Stage 1 — Preliminary Meeting

Admin picks (MAP1-style row, "Sending…" lock): **Continue — Send email (with date)** (date + time + US-timezone picker), **Continue — date not yet arranged**, or **Stop — Send email**.
- Continue → `SPECIALIST_yes` draft + `sif_token`. The **AI PC Admin** sub-section shows *Email sent… (SIF form, rev share examples, template agreement attached)* + *SIF form completed by potential specialist* (green + expandable to all SIF answers once `sif_submitted_at` set).
- Specialist clicks **Complete the SIF Form** → `/specialist-sif?token=<sif_token>` (all fields required except Company Name, Website URL, and the two "if applicable" fields) → submit → `sif_data` + Tracy notified.
- Stop → `SPECIALIST_no` decline draft, no AI PC Admin block.

## Stage 2 — Detail Meetings

- 9-item checklist; ticking is **toggleable** until the meeting is logged (`'unchecked'` sentinel, gotcha #62).
- **Revenue Share Proposal** sits in Stage 2, before "Initial executive approval." The **final** proposal box (manual entry, "Submit final revenue share proposal") is what Anton & Paul vote on; shows a **▶ View proposal / ▼ Hide proposal** toggle after submit.
- **"Discuss revenue share (detail)"** is now just a **plain checklist item** (the per-meeting proposal textarea + email Approve/Propose-edit buttons + per-meeting "AI PC Admin" block were **removed 2026-06-04** — the specialist's rev-share sign-off moved to the Step 3 receipt email).
- **"Still interested — Send email"** logs the meeting then drafts the Stage 2 email (save-meeting first, then stage2email with `meeting_id` — gotcha #63). Buttons collapse to a single "Still interested" (no date/no-date) when the current checks complete ALL items.
- **Stop — Send email** logs a stopped meeting + fires `SPECIALIST_no`. Once stopped the live remaining-items checklist is read-only.
- **SIF tax branch:** the SIF form's last question is "Are you a Tax Specialist?" Yes/No. Yes reveals 4 required tax-risk questions (general risks / history / worst-case / precautions), all stored in `sif_data`. Tax specialists additionally require **Tim's** tax-risk notes below.

## Stage 2 — Reviewer notes → Executive approval (2-round voting)

1. **Final revenue share proposal** submitted (the box, → `rev_share_prepared`). On submit, fires non-dismissible action notifications: **Tracy** (general notes, always) + **Tim** (tax-risk notes, only if tax specialist). They clear when the notes save.
2. **Initial executive approval opens** once final proposal + Tracy's notes + (Tim's notes, if tax) are all done → non-dismissible "vote needed" to Anton + Paul, and `vote_r1_opened_at` is stamped.
3. **Round 1:** each exec clicks **Approved** or **Further Questions**. A vote's value is **private until both vote** (server-side redaction in `load.ts`, gotcha #64) — others see "Voted — awaiting". A **View details ▼** dropdown bundles SIF answers + final proposal + Tracy/Tim notes.
4. **Outcomes:** both **Approved** → auto-draft `SPECIALIST_step3` + advance to Stage 3. Any **Further Questions** → **round 2** opens (`vote_r2_opened_at`) with **Approved / Denied** + "second decision needed" notif. Round 2 both **Approved** → Stage 3; both **Denied** → `SPECIALIST_denied` decline + `status='stopped'`; **split** → round-2 votes reset + "re-vote" notif. On either round completing, an "Executive voting completed" FYI goes to Anton + Paul + Tracy.

## Stage 3 — Due Diligence: payment → DD checklist review → final rev-share

The Stage 3 admin tracker (`SpecialistOnboarding.jsx`) has a payment lead-in, then **Background Check**, **Due Diligence Checklist**, and **Final Revenue Share Proposal** sections, plus a **"Stage 3 progress"** rollup (green/grey/red bullets). **Gate (2026-06-04): Stage 3 → Stage 4 requires ALL THREE — background-check Passed AND DD checklist Approved AND rev-share finalized** (`maybeAdvanceStage3`; the backend owns the advance and is called from every completion handler). Each of the three completions also drafts a **completion email** to the specialist (see "Stage 3 — completion emails" below). The old "Step 3 complete, moving to Step 4" auto-step was removed.

**Payment lead-in:**
- **`SPECIALIST_step3` email** (auto-sent on exec approval) has **Core $350** / **Max $950** / **I Have Further Questions** buttons.
- **Core/Max** → `/specialist-pay?token=<bg_checkout_token>&type=core|max` → ACH-or-Card picker → Stripe one-time. **Card:** `bgconfirmation` + `bgreceipt` fire immediately. **ACH:** confirmation at authorization, **receipt on clearance** (2–4 days, via `payment_intent.succeeded`).
- **I Have Further Questions** → `/specialist-questions` → non-dismissible Tracy notif → admin **"Answer the specialist's background check questions"** bullet (stays as a paper trail) with **Questions answered** (re-send `SPECIALIST_step3_proceed`) / **Stop** (`SPECIALIST_no` + stop).
- Payment failure (`payment_intent.payment_failed`, ACH-settle only) → `bg_payment_status='failed'` + Tracy FYI.

**Receipt email** (`SPECIALIST_bg_receipt`, fired on clearance) now carries the **DD Checklist** + **Request Help** buttons, the process image, and the **revenue-share proposal (Exhibit A)** with **Happy** / **Further Questions** buttons. `bg-receipt.ts` mints `ddc_token` + `rev_share_final_token`.

**Background Check section:** admin **Mark as sent** (Core→Checkr / Max→Scherzer) → **Passed** / **Failed** (Failed stops the onboarding).

**Due Diligence Checklist (review loop):**
- Specialist fills the **public DDC form** `/specialist-ddc?token=<ddc_token>` (`SpecialistDdcPage.jsx`, reworked 2026-06-04): four sections (Materials / Credentials & Experience / **Compliance & Risk — only shown to tax specialists** / Client Experience), each question in its own card. Input types: **file-only** (headshot, licenses, E&O, PLR, TOL, independent legal DD), **text-only** (bio), **file+text** (case studies, disciplinary history, audit support, exit strategies, sample materials). PLR/TOL/legal-DD are 3 separate fields under a "Provide one or more of the following:" subheading. Files go to the **private `specialist-dd-materials`** bucket via signed upload URLs (gotcha #69). **Nothing is required** (Tracy denies + re-sends if incomplete). **Save progress + resume** (token stays valid), then **Submit for review**.
- **Request Help** → `/specialist-ddc-help` → non-dismissible Tracy notif → admin "Help received" bullet.
- Admin reviews via the **"View answers"** expander (regrouped 2026-06-04 to mirror the form's sections + question order; all text answers + signed-URL file downloads via `ddcdownload`), then **Approved** (→ `SPECIALIST_ddc_approved`, now written; calls `maybeAdvanceStage3`) or **Denied** (reason → `SPECIALIST_ddc_edits` email w/ resubmit link, clears `ddc_submitted_at`). Loops until approved; every round is a **paper-trail** bullet (`ddc_review_log`, gotcha #71).

**Final Revenue Share Proposal section:** an automated step records the specialist's email response (Happy / Further Questions). Happy → done (drafts `SPECIALIST_revshare_complete`). Further Questions → Tracy **Confirm** (locks as-is) or **Edit** (edited text → `rev_share_final_text`, original `rev_share_prepared` preserved — gotcha #70); both also draft `SPECIALIST_revshare_complete` and call `maybeAdvanceStage3`. "View final proposal" only appears once finalized; Stage 2's "View proposal" shows Original + Edited.

## Stage 3 — completion emails (2026-06-04)

When each of the three Stage-3 items completes, the specialist gets a confirmation email via the shared helper `utils/specialist-stage3-emails.ts` → `sendStage3CompletionEmail`: **`SPECIALIST_bg_passed`** (id 89, on "Passed"), **`SPECIALIST_ddc_approved`** (id 87, on "DD Checklist Approved"), **`SPECIALIST_revshare_complete`** (id 90, on Happy / Confirm / Edit). Each email shows a **blue "Step 3 progress" card** listing all three items (green done-pill Passed/Complete/Finalized, orange Pending) plus either a "we have everything … bring your case forward for executive approval" line (all done) or a "we'll be in touch as the remaining items are completed" line. Idempotent per item via `<item>_complete_emailed` stage-3 progress markers.

## Stage 4 — Contract & Details: final executive approval (2026-06-04)

On entering Stage 4 (the all-three gate met), `maybeAdvanceStage3` fires non-dismissible **reviewer-notes reminders** to Tracy (always) + Tim (tax specialists only). The Stage 4 admin section then mirrors Stage 2 exactly:
1. **Reviewer notes** — Tracy (general, always) + Tim (tax risk, tax specialists), saved as stage-4 `tracy_general_notes` / `tim_tax_risk_notes`; their reminders clear on save.
2. **Final executive approval** — the same account-scoped 2-round voting via `automation_SPECIALIST_execvote` with `stage=4` (values redacted in `load.ts` until both vote that round). A **"View details"** dropdown shows the background check (Passed + Core/Max), the submitted DD checklist (text + file downloads), and the final revenue share proposal.
   The "View details" dropdown also shows **Tracy's + Tim's reviewer notes** (Tim only when tax).
3. **Outcomes:** both-Denied → `SPECIALIST_denied` + `status='stopped'`; **both-Approved auto-sends the Specialist Onboarding Agreement** — no button (see the sign/pay flow below).

### Stage 4 sign / pay / recurring-license (2026-06-05)

Both-exec-Approved → `exec-vote.ts` `applyApproval(4)` chains `automation_SPECIALIST_sendagreement` (**backgrounded via `EdgeRuntime.waitUntil`** so the voting click returns fast; idempotent on `agreement_sent_at`). Chain:
1. **`agreement-send.ts`** — fills `agreement_templates` id=12 HTML (`[PROPOSED_REVENUE_SHARE]` ← `rev_share_final_text` || the Stage-2 `rev_share_prepared` notes; also `[SPECIALIST_NAME]`/`[SPECIALIST_EMAIL]`), renders HTML→PDF (html2pdf), sends **coordinate-based BoldSign** (field_map: `specialist_address` p1; `specialist_signature`/`print_name`/`date` + `ert_signature`/`date` p7; signer 1 specialist, 2 Anton; BrandId per-account, gotcha #79), drafts `SPECIALIST_agreement_sent`, stamps `agreement_sent_at` + `agreement_sent` progress.
2. **`boldsign-webhook` specialist branch** (keyed `lic_boldsign_document_id`): specialist signed → `agreement_signed_by_specialist_at` + chain **`agreement-ceo-countersign.ts`** (drafts `SPECIALIST_ceo_countersign` w/ Anton's embedded link); Completed → `agreement_signed_by_ceo_at` + chain **`license-stripe-customer.ts`** (reuses `bg_stripe_customer_id` as `lic_stripe_customer_id`, mints `lic_checkout_token`, chains **`license-payment-email.ts`** → `SPECIALIST_lic_payment` w/ `/specialist-pay?token=&kind=license`).
3. **`/specialist-pay?kind=license`** → `license-load-payment.ts` (returns $99/mo) + `license-checkout.ts` (**Stripe Checkout `mode=subscription`**, monthly $99 `price_data`, card grossed-up 2.9%+$0.30 / ACH flat, metadata `pipeline=SPECIALIST_ONBOARDING`/`payment_kind=license`).
4. **Stripe webhook** (`router/webhooks.ts`, 3 additive blocks): `checkout.session.completed` + `invoice.paid` both fire — whichever lands first captures the payment method (gotcha #77) + marks `payment_made` + chains **`license-confirmation-email.ts`** (`SPECIALIST_lic_confirmation|card`/`|ach`); first `invoice.paid` → **`license-invoice-receipt.ts`** (`INV-SPECLIC`/`REC-SPECLIC` PDFs to Drive, `SPECIALIST_lic_invoicereceipt` email — body currently **"TBC"**) + advance **Stage 4 → Stage 5**; recurring monthly `invoice.paid` → monthly invoice/receipt; `invoice.payment_failed` → `lic_payment_status='failed'` + Tracy dunning FYI.

The 7 Stage-4 AutoSteps (Agreement sent → … → Invoice/receipt sent) are driven by these progress markers (no date chip). State in 20 `specialist_onboarding` columns (`lic_*` + `agreement_*`; see [tables/specialists.md](../tables/specialists.md)). **⚠️ `invoice.paid` + `invoice.payment_failed` must be enabled on the Stripe webhook endpoint** (sandbox done; **live pending** — gotcha #75). **Stage 5 (going live) is still the manual checklist** (no auto-promotion to `experts`).

## Reminder sweep (`specialist-sweep-daily`, 07:00 UTC)

`automation_SPECIALIST_sweep` fires a **48h reminder email** then a **96h Tracy FYI** for **7 stalls**: SIF not submitted, exec hasn't voted R1/R2 (emails only the missing exec(s)), Core/Max/Questions not chosen, **DD checklist not submitted**, **final rev-share unanswered**, **agreement not signed** (signature reminder fetches a fresh BoldSign link), **license payment not made**. (The old per-meeting rev-share stall was removed.) Timer-guard columns + bases: gotcha #66. NO 14-day auto-decline.

## Notifications

To **Tracy** (`tnmiller@elitert.com`), and **Tim/Anton/Paul** for their specific steps; `pipeline='SPECIALIST_ONBOARDING'`, link `/admin?tab=specialists&section=specialist_onboarding&onboarding=<id>` (gotcha #61). **Action-required (non-dismissible, clear on the action):** reviewer-notes-needed (Tracy/Tim), vote-needed (Anton/Paul R1), second-decision-needed (R2), re-vote (split), further-questions (Tracy). **FYI (dismissible):** SIF submitted, rev-share response, voting completed (R1/R2), payment cleared, payment failed, all 96h reminder escalations. (Full map: see the session notes.)

## Templates & assets

- `email_templates` (pipeline `SPECIALIST_ONBOARDING`, all editable incl. CC/BCC): `SPECIALIST_yes`, `SPECIALIST_no`, `SPECIALIST_step2_progress`, `SPECIALIST_denied`, `SPECIALIST_step3`, `SPECIALIST_step3_proceed`, `SPECIALIST_bg_receipt` (id 80, now **written** — DD checklist + Exhibit A), `SPECIALIST_bg_confirmation|card`, `SPECIALIST_bg_confirmation|ach`, `SPECIALIST_ddc_edits` (id 88, Denied reason + resubmit link), `SPECIALIST_ddc_approved` (id 87, **now written**), the two new Stage-3 completion emails `SPECIALIST_bg_passed` (id 89) + `SPECIALIST_revshare_complete` (id 90) (gotcha #73), the reminder templates `SPECIALIST_sif_reminder`/`_vote_reminder`/`_choice_reminder` + **(2026-06-05)** `_ddc_reminder`/`_revfinal_reminder`/`_signature_reminder`/`_licpayment_reminder` (97–100), and the **Stage-4 set (this session)**: `SPECIALIST_agreement_sent` (91), `SPECIALIST_ceo_countersign` (92), `SPECIALIST_lic_payment` (93), `SPECIALIST_lic_confirmation|card` (94) / `|ach` (95), `SPECIALIST_lic_invoicereceipt` (96, body **"TBC"**). **Removed:** `SPECIALIST_revshare_reminder` (dead per-meeting reminder). All specialist emails end with the AI-PC / Proactive Coordinator footer (`VFO_SIGNATURE`).
- `agreement_templates` id=12 (`Specialist`/`Single`) holds the agreement `html_body` (placeholders `[SPECIALIST_NAME]`/`[SPECIALIST_EMAIL]`/`[PROPOSED_REVENUE_SHARE]`) + a populated **`field_map`** (BoldSign coords) + **`boldsign_template_id`** `a04ead86-…`. The Stage 1 email attaches the static reference PDF; the **BoldSign signing flow renders the HTML→PDF fresh** per-specialist (gotcha #79).
- Public bucket `specialist-onboarding-assets`: `onboarding-process.png`, `VFO-Specialist-Agreement.pdf`, `revenue_share_examples.pdf`, `VFO-Specialist-Onboarding-Presentation.pdf` (all three PDFs attached to the Stage 1 email). **Private** bucket `specialist-dd-materials` for DD checklist uploads (gotcha #69).
- Receipt/invoice PDFs are html2pdf-generated (`utils/specialist-html-templates.ts`) and archived to Drive **`VFO Specialist Onboarding/<Name> - Specialist`** (parent `13eFhVvCgABtRgRbg0l4s2sUilOzMjrWb`).

## Frontend

`components/admin/SpecialistOnboarding.jsx` (Stages 1–5 tracker) + `components/admin/SpecialistAutomationPanel.jsx` (Automation tab → "Specialist Onboarding"); pages `SpecialistSifPage.jsx` (`/specialist-sif`, with the tax-specialist branch), `SpecialistPayPage.jsx` (`/specialist-pay` — `&type=core|max` one-time background check **or** `&kind=license` for the $99/mo subscription, added 2026-06-05), `SpecialistQuestionsPage.jsx` (`/specialist-questions`), and (2026-06-04) `SpecialistDdcPage.jsx` (`/specialist-ddc`, file-upload DD form), `SpecialistDdcHelpPage.jsx` (`/specialist-ddc-help`), `SpecialistRevShareFinalPage.jsx` (`/specialist-revshare-final`). **Removed:** `SpecialistRevShareDecidePage.jsx` + `/specialist-revshare-decide` (orphaned after per-meeting rev-share dropped). `EmailTemplatesPanel.jsx` Specialist section; `AdminPortal.jsx` deep-link + automation section; skeletons `SpecialistOnboardingListSkeleton`/`SpecialistOnboardingDetailSkeleton`.

## Not yet built / follow-ups

- ~~**Stage 4 sign/pay flow**~~ **DONE (2026-06-05)** — agreement auto-send → BoldSign → CEO countersign → $99/mo Stripe subscription → confirmation → invoice/receipt → Stage 4→5 (see the Stage-4 section above). **Remaining for go-live:** (a) `npm run deploy` the frontend (the `/specialist-pay?kind=license` page + Stage-4 auto-send UI live only on the dev server); (b) add `invoice.paid` + `invoice.payment_failed` to the **live** Stripe webhook; (c) flip SPECIALIST sandbox→live; (d) the `SPECIALIST_lic_invoicereceipt` email body is **"TBC"** + the invoice/receipt email shows `$99` even for card payers actually charged $102.27 (gross-up) — wording fixes deferred. **Stage 5 (going live)** is still a manual checklist; no auto-promotion to the `experts` roster yet.
- ~~`SPECIALIST_ddc_approved` TBD~~ **DONE** — body written this session (gotcha #72 resolved); `SPECIALIST_bg_receipt` (id 80) also written.
- ~~Stage 3 gate question~~ **RESOLVED** — Stage 3 → Stage 4 now requires all three (bg Passed + DD Approved + rev finalized) via `maybeAdvanceStage3`.
- **Specialist pipeline is in sandbox** (`sandbox_mode=true`) — flip to live (via the panel toggle) before real payments.
- ~~Frontend production deploy required~~ **DONE** — the whole Specialist UI is now deployed/live. (Code is deployed but **not yet committed** in git.)
- Card declines don't webhook (only ACH-settle failures notify).

## Cross-references

- Specialist tables: [../tables/specialists.md](../tables/specialists.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
