# Specialist onboarding flow

A multi-stage workflow for vetting a new specialist (third-party expert). Five stages: 1 Preliminary Meeting, 2 Detail Meetings, 3 Due Diligence, 4 Contract & Details, 5 Going Live. Each stage has a task checklist, meeting log, and exec-vote tally on the onboarding row + child tables.

> **2026-06-02:** Stages **1–2 automated** (template emails, SIF form page, per-meeting rev-share proposal, notifications).
> **2026-06-03 (v374):** added **Stage 2 account-scoped exec voting** (2 rounds), **reviewer notes** (Tracy + Tim), **decline-on-deny**, the full **Stage 3 background-check payment chain** (Stripe ACH/Card $350/$950, confirmation + invoice/receipt PDFs, Drive archival, Further Questions flow, auto-advance to Stage 3), the **Specialist Automation Panel**, and a **reminder sweep** (`specialist-sweep-daily` 07:00 UTC). Stages 4–5 remain a manual checklist. ⚠️ **frontend STILL NOT deployed** — the email's SIF/pay/questions links point at production and only resolve after `npm run deploy` (test on localhost by swapping the host). Specialist pipeline is currently in **sandbox** (`pipeline_sandbox_config` SPECIALIST_ONBOARDING `sandbox_mode=true`) — flip to live before real payments.

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
| `save_onboarding_vote` | `save-vote.ts` | Upsert `(onboarding_id, stage, voter_name, vote_round)` (stage-4 votes; Stage-2 exec votes go through `automation_SPECIALIST_execvote` instead) |
| `update_onboarding` | `update.ts` | Advances `current_stage` / sets `status` / `background_check_type`. No auto-advance. |

All of the above are `ADMIN_ONLY_ACTIONS`.

## Automation handlers (`actions/onboarding/`)

| Action | Auth | Trigger | Does |
|---|---|---|---|
| `automation_SPECIALIST_prelimemail` | AUTH | Stage 1 decision buttons | `continue`/`continue_no_date` → drafts `SPECIALIST_yes` (process image + SIF button + 2 static PDF attachments + closing); mints `sif_token`; stamps `sif_email_sent_at`. `stop` → `SPECIALIST_no`. |
| `automation_SPECIALIST_stage2email` | AUTH | Stage 2 "Still interested — Send email" | Drafts `SPECIALIST_step2_progress`; injects per-meeting rev-share proposal + Approve/Propose-edit buttons (stamps `rev_proposal_email_sent_at`); "all areas complete" closing when nothing remains. |
| `automation_SPECIALIST_loadsif` | PUBLIC | `/specialist-sif` load | By `sif_token` → prefill + existing `sif_data` |
| `automation_SPECIALIST_submitsif` | PUBLIC | `/specialist-sif` submit | Saves `sif_data` (incl. the tax-specialist Q + 4 tax-risk answers) + `sif_submitted_at`; notifies Tracy (FYI) |
| `automation_SPECIALIST_revsharedecide` | PUBLIC | `/specialist-revshare-decide?token=&decision=Approved\|Edit` | Records `rev_proposal_response` on the meeting; notifies Tracy (FYI); one-time |
| `automation_SPECIALIST_execvote` | AUTH (admin) | Stage 2 Initial executive approval buttons | Caster derived from session; round 1 Approved/Further-Questions, round 2 Approved/Denied. Both-Approved → chain `step3email` + advance Stage 3; both-Denied → `deniedemail` + stop; split → reset + re-vote notif; fires "vote completed" FYI. (Reveal handled in `load.ts`, gotcha #64.) |
| `automation_SPECIALIST_deniedemail` | PUBLIC (svc-role/admin) | Chained on both-Denied | Drafts `SPECIALIST_denied` (idempotent on `denied_email_sent`) |
| `automation_SPECIALIST_step3email` | PUBLIC (svc-role/admin) | Chained on both-Approved | Creates Stripe customer + `bg_checkout_token` + `further_questions_token`; drafts `SPECIALIST_step3` (Core/Max/Questions buttons); advances `current_stage` to 3 |
| `automation_SPECIALIST_bgloadpayment` | PUBLIC (token) | `/specialist-pay` load | Returns name + Core/Max type + amount ($350/$950) |
| `automation_SPECIALIST_bgcheckout` | PUBLIC (token) | `/specialist-pay` ACH/Card pick | Stripe Checkout one-time, metadata `pipeline=SPECIALIST_ONBOARDING`/`payment_kind=background_check`/`bg_type` |
| `automation_SPECIALIST_bgconfirmation` | PUBLIC (svc-role) | Webhook at payment time (both methods) | Drafts `SPECIALIST_bg_confirmation\|card`/`\|ach` (MAP1 wording) |
| `automation_SPECIALIST_bgreceipt` | PUBLIC (svc-role) | Webhook on clearance (card now / ACH on settle) | Invoice+receipt PDFs → Drive `VFO Specialist Onboarding/<Name> - Specialist`; drafts `SPECIALIST_bg_receipt` (TBD body) w/ both attached; marks paid; Tracy FYI; sets Checkr/Scherzer label |
| `automation_SPECIALIST_questionsrequest` | PUBLIC (token) | `/specialist-questions` | Records request + non-dismissible Tracy notif |
| `automation_SPECIALIST_questionsresolve` | AUTH (admin) | Tracy's Proceed/Stop buttons | Proceed → `SPECIALIST_step3_proceed`; Stop → `SPECIALIST_no` + stop; clears Tracy's notif |
| `automation_load_specialist_pipelines` | AUTH (admin) | Automation tab loader | All rows + votes + meetings + final-proposal + sandbox config |
| `automation_SPECIALIST_sweep` | PUBLIC (svc-role) | cron `specialist-sweep-daily` 07:00 UTC | 48h reminder / 96h Tracy FYI for 4 stalls (gotcha #66) |

## Stage 1 — Preliminary Meeting

Admin picks (MAP1-style row, "Sending…" lock): **Continue — Send email (with date)** (date + time + US-timezone picker), **Continue — date not yet arranged**, or **Stop — Send email**.
- Continue → `SPECIALIST_yes` draft + `sif_token`. The **AI PC Admin** sub-section shows *Email sent… (SIF form, rev share examples, template agreement attached)* + *SIF form completed by potential specialist* (green + expandable to all SIF answers once `sif_submitted_at` set).
- Specialist clicks **Complete the SIF Form** → `/specialist-sif?token=<sif_token>` (all fields required except Company Name, Website URL, and the two "if applicable" fields) → submit → `sif_data` + Tracy notified.
- Stop → `SPECIALIST_no` decline draft, no AI PC Admin block.

## Stage 2 — Detail Meetings

- 9-item checklist; ticking is **toggleable** until the meeting is logged (`'unchecked'` sentinel, gotcha #62).
- **Revenue Share Proposal** sits in Stage 2, before "Initial executive approval." The **final** proposal box (manual entry, "Submit final revenue share proposal") is what Anton & Paul vote on; shows a **▶ View proposal / ▼ Hide proposal** toggle after submit.
- Ticking **"Discuss revenue share (detail)"** reveals a per-meeting proposal textarea that **must be filled** before sending.
- **"Still interested — Send email"** logs the meeting then drafts the Stage 2 email (save-meeting first so the token exists, then stage2email with `meeting_id` — gotcha #63). Buttons collapse to a single "Still interested" (no date/no-date) when the current checks complete ALL items.
- If rev-share was discussed, the email carries the proposal + **Approved / Propose an edit** buttons → `/specialist-revshare-decide`. The outcome shows in that meeting's card under a collapsible **AI PC Admin** block.
- **Stop — Send email** logs a stopped meeting + fires `SPECIALIST_no`. Once stopped the live remaining-items checklist is read-only.
- **SIF tax branch:** the SIF form's last question is "Are you a Tax Specialist?" Yes/No. Yes reveals 4 required tax-risk questions (general risks / history / worst-case / precautions), all stored in `sif_data`. Tax specialists additionally require **Tim's** tax-risk notes below.

## Stage 2 — Reviewer notes → Executive approval (2-round voting)

1. **Final revenue share proposal** submitted (the box, → `rev_share_prepared`). On submit, fires non-dismissible action notifications: **Tracy** (general notes, always) + **Tim** (tax-risk notes, only if tax specialist). They clear when the notes save.
2. **Initial executive approval opens** once final proposal + Tracy's notes + (Tim's notes, if tax) are all done → non-dismissible "vote needed" to Anton + Paul, and `vote_r1_opened_at` is stamped.
3. **Round 1:** each exec clicks **Approved** or **Further Questions**. A vote's value is **private until both vote** (server-side redaction in `load.ts`, gotcha #64) — others see "Voted — awaiting". A **View details ▼** dropdown bundles SIF answers + final proposal + Tracy/Tim notes.
4. **Outcomes:** both **Approved** → auto-draft `SPECIALIST_step3` + advance to Stage 3. Any **Further Questions** → **round 2** opens (`vote_r2_opened_at`) with **Approved / Denied** + "second decision needed" notif. Round 2 both **Approved** → Stage 3; both **Denied** → `SPECIALIST_denied` decline + `status='stopped'`; **split** → round-2 votes reset + "re-vote" notif. On either round completing, an "Executive voting completed" FYI goes to Anton + Paul + Tracy.

## Stage 3 — Due Diligence: background-check payment

The Stage 3 panel begins with the payment flow (the manual DD checklist follows below it):
- **`SPECIALIST_step3` email** (auto-sent on approval) has **Core $350** / **Max $950** / **I Have Further Questions** buttons.
- **Core/Max** → `/specialist-pay?token=<bg_checkout_token>&type=core|max` → ACH-or-Card picker → Stripe one-time. **Card:** `bgconfirmation` + `bgreceipt` fire immediately. **ACH:** confirmation at authorization, **receipt on clearance** (2–4 days, via `payment_intent.succeeded`). Receipt = invoice + receipt PDFs emailed (+ archived to Drive), `payment_received`, Core→Checkr / Max→Scherzer label, Tracy FYI.
- **I Have Further Questions** → `/specialist-questions` → records request + non-dismissible Tracy notif → admin **Further Questions** sub-step with **Proceed** (re-send `SPECIALIST_step3_proceed`) / **Stop** (`SPECIALIST_no` + stop), which clear Tracy's notif.
- Payment failure (`payment_intent.payment_failed`, ACH-settle only) → `bg_payment_status='failed'` + Tracy FYI.

## Reminder sweep (`specialist-sweep-daily`, 07:00 UTC)

`automation_SPECIALIST_sweep` fires a **48h reminder email** then a **96h Tracy FYI** for 4 stalls: SIF not submitted, rev-share proposal unanswered (per meeting), exec hasn't voted R1/R2 (emails only the missing exec(s), no button), Core/Max/Questions not chosen. Timer-guard columns + bases: gotcha #66. NO 14-day auto-decline.

## Notifications

To **Tracy** (`tnmiller@elitert.com`), and **Tim/Anton/Paul** for their specific steps; `pipeline='SPECIALIST_ONBOARDING'`, link `/admin?tab=specialists&section=specialist_onboarding&onboarding=<id>` (gotcha #61). **Action-required (non-dismissible, clear on the action):** reviewer-notes-needed (Tracy/Tim), vote-needed (Anton/Paul R1), second-decision-needed (R2), re-vote (split), further-questions (Tracy). **FYI (dismissible):** SIF submitted, rev-share response, voting completed (R1/R2), payment cleared, payment failed, all 96h reminder escalations. (Full map: see the session notes.)

## Templates & assets

- `email_templates` (pipeline `SPECIALIST_ONBOARDING`, all editable incl. CC/BCC): `SPECIALIST_yes`, `SPECIALIST_no`, `SPECIALIST_step2_progress`, `SPECIALIST_denied`, `SPECIALIST_step3`, `SPECIALIST_step3_proceed`, `SPECIALIST_bg_receipt` (**TBD body** — fill later), `SPECIALIST_bg_confirmation|card`, `SPECIALIST_bg_confirmation|ach`, and the 4 reminder templates `SPECIALIST_sif_reminder`/`_revshare_reminder`/`_vote_reminder`/`_choice_reminder`.
- `agreement_templates` row (`Specialist`/`Single`) holds the agreement `html_body`; the Stage 1 email attaches the **static** `VFO-Specialist-Agreement.pdf`.
- Bucket `specialist-onboarding-assets`: `onboarding-process.png`, `VFO-Specialist-Agreement.pdf`, `revenue_share_examples.pdf`.
- Receipt/invoice PDFs are html2pdf-generated (`utils/specialist-html-templates.ts`) and archived to Drive **`VFO Specialist Onboarding/<Name> - Specialist`** (parent `13eFhVvCgABtRgRbg0l4s2sUilOzMjrWb`).

## Frontend

`components/admin/SpecialistOnboarding.jsx` (Stages 1–5 tracker) + `components/admin/SpecialistAutomationPanel.jsx` (Automation tab → "Specialist Onboarding"); pages `SpecialistSifPage.jsx` (`/specialist-sif`, now with the tax-specialist branch), `SpecialistRevShareDecidePage.jsx` (`/specialist-revshare-decide`), `SpecialistPayPage.jsx` (`/specialist-pay`), `SpecialistQuestionsPage.jsx` (`/specialist-questions`); `EmailTemplatesPanel.jsx` Specialist section; `AdminPortal.jsx` deep-link + automation section; skeletons `SpecialistOnboardingListSkeleton`/`SpecialistOnboardingDetailSkeleton`.

## Not yet built / follow-ups

- **Stages 4–5 automation** (contract/BoldSign, going-live) — still manual; no auto-promotion to the `experts` roster. Stage 3's DD checklist + background-check-results steps remain manual (after the payment).
- **`SPECIALIST_bg_receipt` email body is a TBD placeholder** — needs the full receipt + next-steps + DD-checklist copy.
- **Specialist pipeline is in sandbox** (`sandbox_mode=true`) — flip to live (via the panel toggle) before real payments.
- **Frontend production deploy** (`npm run deploy`) required — the entire Specialist UI (both sessions) is not on the live site yet; email SIF/pay/questions links only resolve after deploy.
- Card declines don't webhook (only ACH-settle failures notify).

## Cross-references

- Specialist tables: [../tables/specialists.md](../tables/specialists.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
