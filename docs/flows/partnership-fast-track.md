# Partnership Fast Track (PFT) — end-to-end flow

Built 2026-06-05/06 (branch `claude/objective-hopper-26d8a3`). Backend live **v415**; frontend **not yet deployed**; nothing committed.

## What it is
The Partnership Fast Track program recruits **accountants**. Each accountant is a `clients` row enrolled in
the "Partnership Fast Track" program (program_id=2) under a Testing/real member, shown in the admin under
**Accountants → member → Accountants tab → accountant → "PFT Engagement Process" tab**
(`components/admin/pft/PFTEngagementTrack.jsx`). At the end the accountant is handed off to the separate
**Accountant Onboarding** pipeline.

## Data model
- **Track structure** is DB-driven: `program_client_phases` + `program_client_tasks` with
  `track_type='partnership_fast_track'` (program-level rows shared by all PFT accountants). The component
  renders special UI by matching each task's **exact name**. Per-accountant task status lives in
  `client_progress` (`client_id`, `task_id`, `status`, `completed_date`, `notes`).
- **Per-accountant extras**: NEW table `pft_engagement` (one row per client) — `discovery_token`,
  `discovery_data` (jsonb), `discovery_submitted_at`, `discovery_email_sent_at`, `discovery_reminder_sent_at`,
  `discovery_pf_notified_at`, `ft_response_token`, `ft_email_sent_at`, `ft_response`
  (`confirm`|`another_meeting`), `ft_response_at`, `ft_reminder_sent_at`, `ft_pf_notified_at`,
  `accountant_onboarding_id`. **Undecided-decision columns** (2026-07-13): `decision_token`,
  `decision_email_sent_at`, `decision_task_id`, `decision_response` (`vfo_ft`|`vfo_associate`|`no`),
  `decision_response_at`, `decision_reminder_sent_at`, `decision_pf_notified_at`.
- **Emails**: `email_templates` pipeline `PARTNERSHIP_FAST_TRACK` (9 rows — incl. `PFT_decision_undecided`). **Sandbox**:
  `pipeline_sandbox_config` row `PARTNERSHIP_FAST_TRACK` (`sandbox_mode=true`, `sandbox_email=jlatham@elitert.com`) —
  all PFT emails are **Gmail drafts**. Flip to live before real accountants.

## Phases (after this session's restructure)
1. **Preliminary Setup** — Relationship type.
2. **Initial Contact** — Call arranged · Call outcome · **Meeting 1 confirmation email** (3-button).
3. **Accountant Meeting 1** — Initial high level discussion · Right accountant? (3 Yes/No + auto conclusion) ·
   **Meeting 2 confirmation email (+ discovery form)** (3-button).
4. **Accountant Meeting 2** — presentation · **"Does the Accountant need a third meeting?"** (Yes/No gate,
   both green) · then EITHER **Meeting 3 confirmation email** (gate=Yes) OR **Accountant decision confirmation
   email** (gate=No). Nothing past the gate is interactive until it's answered.
5. **Accountant Meeting 3** (only when gate=Yes) — presentation · **Accountant decision confirmation email**.
6. **VFO-Associate New Member Setup** / **VFO-FT Accountant New Member Setup** — task-less; rendered as 2
   dynamic progress indicators. Before the decision: both show greyed. After a decision: only the matching
   section shows.

## Meeting confirmation emails (Meeting 1/2/3)
One warm template `PFT_meeting_confirm` for all three, parameterised by `automation_PFT_meetingemail`:
- `[PRIOR_MEETING]` (your recent call / our first meeting / our second meeting), `[NEXT_MEETING]`
  (our first/second/third Partnership Fast Track meeting), `[NEXT_MEETING_TITLE]` (Meeting 1/2/3, subject),
  `[FORM_SECTION]` (discovery-form button — Meeting 2 only), `[CLOSING]` ("on \<date> at \<time> \<tz>" for
  the with-date button, else "in due course").
- 3 buttons → `automation_PFT_meetingemail` with `decision` = `confirm_date` / `confirm_no_date` / `declined`.
  Statuses written to `client_progress`: "Confirmation email sent" / "Email sent - date not yet arranged" /
  "Meeting declined". Declined uses `PFT_meeting_declined`.

## Discovery form (Meeting 2)
- Meeting 2's confirm email contains a **Complete the discovery form** button →
  `<portal>/pft-discovery?token=<discovery_token>` (`PftDiscoveryPage.jsx`, SIF-style; all fields required
  **except "How long have you owned your firm?"**). Loads/saves via `automation_PFT_loaddiscovery` /
  `automation_PFT_submitdiscovery` (store into `pft_engagement.discovery_data`).
- Admin sees a **"View discovery form"** collapsible under the Meeting 2 step once submitted.
- On submit → notify the **assigned PF**. If not completed after **4 days** (sweep) → notify PF.

## Decision step + handoff
The tracker's **Accountant decision confirmation email** step shows four buttons: **Email confirming VFO FT**,
**Email confirming VFO Associate**, **Undecided email**, **Email confirming No**. The first two + "No" call
`automation_PFT_decisionemail` (`choice` = `vfo_ft` | `vfo_associate` | `no`); **Undecided email** calls
`automation_PFT_undecided` (see next section — defers the choice to the client).

`automation_PFT_decisionemail`:
- **vfo_ft** — drafts `PFT_decision_vfo_ft` with **two recipient buttons** ("I Don't Need Another Meeting -
  Confirm Onboarding" / "I'd Like Another Meeting" → `/pft-ft-decide?token=&decision=confirm|another_meeting`).
  **Immediately creates** the `accountant_onboarding` handoff (`selected_vfo_ft`, `accountant_type='VFO FT'`),
  links it on `pft_engagement.accountant_onboarding_id`, stamps `ft_response_token` + `ft_email_sent_at`.
- **vfo_associate** — (2026-07-13) now **mirrors vfo_ft**: drafts `PFT_decision_vfo_associate` with the SAME
  two recipient buttons (confirm / another meeting → the shared `/pft-ft-decide` + `ft-response.ts` flow),
  immediately creates the handoff (`selected_pft`, `accountant_type='VFO Associate'`), links it, stamps
  `ft_response_token` + `ft_email_sent_at`. The former immediate `PFT_associate_confirmed` bell is dropped —
  the confirm/another-meeting bell fires on the client's click instead (worded per `accountant_type`).
- **no** — drafts `PFT_decision_no`; sets client `status='lost'`.

## Undecided decision — client self-selects (2026-07-13)
Mirrors the MAP 1 `/decide` undecided flow. Admin clicks **Undecided email** →
`automation_PFT_undecided` (AUTH): drafts `PFT_decision_undecided` to the **client** with three buttons
(VFO FT / VFO Associate / No → `/pft-decide?token=<decision_token>&choice=vfo_ft|vfo_associate|no`), stamps
`decision_token` + `decision_email_sent_at` + `decision_task_id`, and marks the step
**"Undecided - awaiting client"** (an amber pending status that the tracker treats as "no final decision" so
both Phase-6 sections stay visible-but-pending). Client clicks → `PftDecidePage.jsx` (`/pft-decide`) →
`automation_PFT_undecided_response` (PUBLIC, idempotent on `decision_response`) records the choice then
**delegates in-process to `automation_PFT_decisionemail`** with that choice, so the exact same per-choice work
runs (onboarding + confirmation email + progress + lost-on-no). Rolls `decision_response` back to null if the
delegate fails so the link can be retried.

An **AI PC Admin** history block (rendered under the decision step, styled like the Tax 5 AI PC Admin cascade)
derives the full timeline from `pft_engagement`: undecided email sent → client's path choice → onboarding
created → confirmation email sent → client's another-meeting response (plus reminder / PF-notified rows).

Phase 6 indicators (matching section only): **"Sent to Accountant Onboarding"** (green once
`accountant_onboarding_id` exists) + **"Accountant onboarding progress"** (live stage from
`pft_load_engagement` + a **View onboarding →** deep-link to that record).

## VFO Fast Track / VFO Associate recipient response
`automation_PFT_ftresponse` (PUBLIC, token, idempotent on `ft_response`) — shared by BOTH the VFO FT and (as
of 2026-07-13) the VFO Associate confirmation email; the notification wording is derived from the linked
`accountant_onboarding.accountant_type`:
- **confirm** → notify **PF + Rachael**; auto-set the linked Accountant Onboarding **Preliminary Meeting =
  "Request no meeting"** (only if still null).
- **another_meeting** → notify **PF + Rachael**.
If unanswered: **2-day** reminder email to the accountant (`PFT_decision_vfo_ft_reminder`), **4-day** PF notice
(both via the sweep).

## Notifications (who gets what)
PF routing via `actions/pft/_shared.ts` `PF_EMAILS` (Evan `eanderson@`, Bridger `bsilvester@`, Ian
`iwelham@`) → falls back to all-admins if the client has no Assigned PF (set in the Profile tab) or the name
isn't mapped. Rachael = `rhopson@elitert.com` (hardcoded). FT-response (either button) + VFO-Associate pick →
**PF + Rachael**; discovery-complete / discovery-4-day / FT-4-day → **PF only**. All notification links
deep-link to the specific record (`?onboarding=<id>` for the handoff record, `/admin/client/<id>?tab=pft` for
the PFT track).

## Cron
`pft-sweep-daily` 08:00 UTC → `automation_PFT_sweep` (PUBLIC, service-role): discovery 2-day reminder email +
4-day PF notice; FT 2-day reminder email + 4-day PF notice; **undecided-decision 2-day reminder email
(re-sends `PFT_decision_undecided`) + 4-day PF notice** (rules `PFT_undecided_reminder_email` /
`PFT_undecided_stall_bell`, guards `decision_reminder_sent_at` / `decision_pf_notified_at`). No auto-decline.

## Accountant Onboarding handoff differences
- New `accountant_onboarding.accountant_type` (`'VFO FT'` | `'VFO Associate'`). "+ New Onboarding" requires it.
- **VFO Associate** skips Stages 1 & 2 (no agreement/payment) — `AccountantOnboarding.jsx` hides them and
  unlocks Stage 3; `create-member.ts` bypasses the `invoice_sent_at` gate for associates.
- Stage-1 Preliminary Meeting gained the status **"Request no meeting"** (auto-set by FT confirm).

## Backend files (`actions/pft/`)
`_shared.ts` (PF_EMAILS/RACHAEL, notify helpers, `ftButtons` + `undecidedButtons`, template/sandbox/progress
helpers), `meeting-email.ts`, `decision-email.ts`, `ft-response.ts`, `undecided-email.ts`,
`undecided-response.ts`, `discovery.ts`, `sweep.ts`, `load-engagement.ts`.
Dispatched: `automation_PFT_meetingemail`/`_decisionemail`/**`_undecided`** + `pft_load_engagement` (AUTH);
`automation_PFT_ftresponse`/**`_undecided_response`**/`_sweep`/`_loaddiscovery`/`_submitdiscovery` (PUBLIC).

## Frontend
`components/admin/pft/PFTEngagementTrack.jsx` (track UI + `PFTTrackSkeleton` + the `DecisionStep` 4-button step
+ `DecisionHistory`/AI PC Admin cascade), `pages/PftFtDecidePage.jsx` (`/pft-ft-decide`),
`pages/PftDecidePage.jsx` (`/pft-decide` — the undecided 3-button client page), `pages/PftDiscoveryPage.jsx`
(`/pft-discovery`). Nav: ClientDetail "Back to Accountants" restore + Phase-6 deep-link into Accountant Onboarding.
