# Specialist onboarding flow

A multi-stage workflow for vetting a new specialist (third-party expert). Five stages: 1 Preliminary Meeting, 2 Detail Meetings, 3 Due Diligence, 4 Contract & Details, 5 Going Live. Each stage has a task checklist, meeting log, and exec-vote tally on the onboarding row + child tables.

> **2026-06-02:** Stages **1–2 are now automated** (template emails, SIF form page, per-meeting revenue-share proposal, notifications). Stages 3–5 remain a manual checklist. Backend live at `vfo-admin-api` v360; **frontend NOT yet deployed** — the email's SIF/rev-share links point at production and only resolve after `npm run deploy` (test on localhost by swapping the host).

- **Pipeline label:** `SPECIALIST_ONBOARDING` (`email_templates.pipeline`, `agreement_templates.pipeline`, `notifications.pipeline`).
- **State tables:** `specialist_onboarding` (main; `current_stage` 1–5, `status`, `background_check_type`, + new `sif_token`/`sif_data`/`sif_submitted_at`), `specialist_onboarding_progress` (task checklist), `specialist_onboarding_meetings` (Stage 2 meetings + per-meeting rev-share proposal cols), `specialist_onboarding_votes`.
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
| `save_onboarding_vote` | `save-vote.ts` | Upsert `(onboarding_id, stage, voter_name)` |
| `update_onboarding` | `update.ts` | Advances `current_stage` / sets `status` / `background_check_type`. No auto-advance. |

All of the above are `ADMIN_ONLY_ACTIONS`.

## Automation handlers (`actions/onboarding/`) — Stages 1–2

| Action | Auth | Trigger | Does |
|---|---|---|---|
| `automation_SPECIALIST_prelimemail` | AUTH | Stage 1 decision buttons | `continue`/`continue_no_date` → drafts `SPECIALIST_yes` (inline process image + "Complete the SIF Form" button + 2 static PDF attachments from the bucket [agreement + rev-share examples] + closing "as arranged on DATE at TIME [TZ]" or "in due course"); generates `sif_token`. `stop` → drafts `SPECIALIST_no` decline. |
| `automation_SPECIALIST_stage2email` | AUTH | Stage 2 "Still interested — Send email" | Drafts `SPECIALIST_step2_progress`: `[COMPLETED_LIST]` + `[REMAINING_BLOCK]` from the checklist. With `meeting_id`, if that meeting carries a rev-share proposal it injects `[REV_PROPOSAL_BLOCK]` (proposal + Approved/Propose-an-edit buttons) and stamps `rev_proposal_email_sent_at`. When NO items remain, `[REMAINING_BLOCK]` is empty and `[CLOSING_BLOCK]` = the "completed all areas… Best Regards," note. |
| `automation_SPECIALIST_loadsif` | PUBLIC | `/specialist-sif` load | By `sif_token` → prefill + existing `sif_data` |
| `automation_SPECIALIST_submitsif` | PUBLIC | `/specialist-sif` submit | Saves `sif_data` + `sif_submitted_at`; notifies Tracy |
| `automation_SPECIALIST_revsharedecide` | PUBLIC | `/specialist-revshare-decide?token=&decision=Approved\|Edit` | Records `rev_proposal_response` on the meeting (by `rev_proposal_token`); notifies Tracy; one-time |

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
- **Stop — Send email** logs a stopped meeting + fires `SPECIALIST_no`. Once stopped the live remaining-items checklist is read-only (stopped earlier) or hidden (stopped within Stage 2).

## Notifications (to Tracy)

`recipient='tnmiller@elitert.com'`, `pipeline='SPECIALIST_ONBOARDING'`, `dismissible=true`, link `/admin?tab=specialists&section=specialist_onboarding&onboarding=<id>` (deep-links to the specialist — gotcha #61). Fired on SIF submit + rev-share button click. Tracy is an `allowed_admins` row (gotcha #60).

## Templates & assets

- `email_templates` (pipeline `SPECIALIST_ONBOARDING`): `SPECIALIST_yes`, `SPECIALIST_no`, `SPECIALIST_step2_progress` (editable incl. CC/BCC in the Email Templates panel).
- `agreement_templates` row (`Specialist`/`Single`) holds the agreement `html_body`, but the Stage 1 email attaches the **static** `VFO-Specialist-Agreement.pdf` from the bucket (not html2pdf).
- Bucket `specialist-onboarding-assets`: `onboarding-process.png`, `VFO-Specialist-Agreement.pdf`, `revenue_share_examples.pdf`.

## Frontend

`components/admin/SpecialistOnboarding.jsx`; pages `SpecialistSifPage.jsx` (`/specialist-sif`) + `SpecialistRevShareDecidePage.jsx` (`/specialist-revshare-decide`); `EmailTemplatesPanel.jsx` Specialist section; `AdminPortal.jsx` `?tab`/`?section`/`?onboarding` deep-link.

## Not yet built / follow-ups

- Stages 3–5 automation (background check, due diligence, contract/BoldSign, going-live) — still manual; no auto-promotion to the `experts` roster.
- No Stripe/BoldSign for specialists → no `pipeline_sandbox_config` row (defaults live; drafts only).
- Decline email wired on Stage 1 + Stage 2 Stop; later-stage Stop points are a follow-up.
- **Frontend production deploy** required for the email's SIF + rev-share links to work outside localhost.

## Cross-references

- Specialist tables: [../tables/specialists.md](../tables/specialists.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
