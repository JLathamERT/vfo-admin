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

## Phases
1. **Initial Contact** — **Who is completing the tracking for this accountant?** (`VFOS` / `Member`, first step) · Call arranged · Call outcome · **Meeting 1 confirmation email** (3-button). The tracking-owner step gates the other three: they render greyed + non-clickable until it is set, `VFOS` keeps them inert (phase = 1 step) and `Member` re-enables them (phase = 4 steps). Mirrored in the Client Overview engine (`overview-pft.ts`, `applicable:false`) — gotcha #218. _(The old **Preliminary Setup / Relationship type** phase was removed 2026-07-13.)_
2. **Accountant Meeting 1** — Initial high level discussion · Right accountant? (3 Yes/No + auto conclusion) ·
   **Meeting 2 confirmation email (+ discovery form)** (3-button).
3. **Accountant Meeting 2** — presentation · **"Does the Accountant need a third meeting?"** (Yes/No gate,
   both green) · then EITHER **Meeting 3 confirmation email** (gate=Yes) OR **Accountant decision confirmation
   email** (gate=No). Nothing past the gate is interactive until it's answered.
4. **Accountant Meeting 3** (only when gate=Yes) — presentation · **Accountant decision confirmation email**.
5. **VFO-Associate New Member Setup** / **VFO-FT Accountant New Member Setup** — task-less; rendered as 2
   dynamic progress indicators. Before the decision: both show greyed. After a decision: only the matching
   section shows.

## Meeting confirmation emails (Meeting 1/2/3)
One warm template `PFT_meeting_confirm` for all three, parameterised by `automation_PFT_meetingemail`:
- `[PRIOR_MEETING]` (your recent call / our first meeting / our second meeting), `[NEXT_MEETING]`
  (our first/second/third Partnership Fast Track meeting), `[NEXT_MEETING_TITLE]` (Meeting 1/2/3, subject),
  `[FORM_SECTION]` (discovery-form button — Meeting 2 only), `[CLOSING]` ("on \<date> at \<time> \<tz>" for
  the with-date button, else "in due course").
- Buttons → `automation_PFT_meetingemail` with `decision` = `confirm_date` / `confirm_no_date` / `declined` / `us_declined`.
  Statuses written to `client_progress`: "Confirmation email sent" / "Email sent - date not yet arranged" /
  "Meeting declined" / "Declined by Member" (Meeting 1) / "Declined by ERT/VFOS" (Meeting 2/3). `declined` =
  the client declines us (`PFT_meeting_declined`). **`us_declined` = WE decline them** (2026-07-20, gotcha #247):
  requires a typed `decline_reason` (injected as `[DECLINE_REASON]`), opens an inline reason+preview card cloned
  from the Tax 3 decline card; Meeting 1 uses `PFT_meeting1_member_declined` (button "Send Email - Member
  Declined", "chat with us…"), Meetings 2/3 use `PFT_meeting_ert_declined` (button "Send Email - ERT/VFOS
  Declined", "meet with us…"). The buttons render in 3 rows (green confirm · red client/we-decline · Complete-NO-EMAIL);
  the confirm buttons were renamed "Send Email - Date Confirmed / Date Not Confirmed". `[FORM_SECTION]` (discovery)
  attaches only on confirm decisions.
- **Automation & Config → Partnership Fast Track** (2026-07-20, gotcha #247): `PFTAutomationPanel` (loader
  `automation_load_pft_pipelines`) is the read-only pipeline view of every client with PFT email activity — meeting
  sends, discovery/decision/FT button-clicks, and the onboarding handoff — and holds the ONLY UI for the
  `PARTNERSHIP_FAST_TRACK` sandbox toggle. Its Meeting 1 card shows only when the Initial-Contact tracking-owner
  step = `Member`.
- **Admin backfill — "Complete - NO EMAIL"** (2026-07-17, gotcha #243): a 4th solid-green button marks the
  meeting step complete (status `Complete`) via `msm_save_client_task` with NO email — for bringing
  old-system accountants up to date. Frontend-only; PFT-only (lives in `PFTEngagementTrack.jsx`'s `MeetingStep`).

## Discovery form (Meeting 2)
- Meeting 2's confirm email contains a **Complete the discovery form** button →
  `<portal>/pft-discovery?token=<discovery_token>` (`PftDiscoveryPage.jsx`, SIF-style; all fields required
  **except "How long have you owned your firm?"**). Loads/saves via `automation_PFT_loaddiscovery` /
  `automation_PFT_submitdiscovery` (store into `pft_engagement.discovery_data`).
- Admin sees a **"View discovery form"** collapsible under the Meeting 2 step once submitted.
- On submit → notify the **assigned PF**. If not completed after **4 business days** (sweep) → notify PF.

## Decision step + handoff
The tracker's **Accountant decision confirmation email** step shows four buttons: **Email confirming VFO FT**,
**Email confirming VFO Associate**, **Undecided email**, **Email confirming No**. The first two + "No" call
`automation_PFT_decisionemail` (`choice` = `vfo_ft` | `vfo_associate` | `no`); **Undecided email** calls
`automation_PFT_undecided` (see next section — defers the choice to the client).

**Admin backfill — "Complete - NO EMAIL:"** (2026-07-17, gotcha #243): a second row (VFO FT / VFO Associate /
No, solid-green) writes the REAL outcome status (`VFO FT confirmed` / `VFO Associate confirmed` / `No confirmed`)
via `msm_save_client_task` so the matching Phase-6 track reveals, but sends NO email AND does **not** create the
`accountant_onboarding` handoff record (that only happens in `automation_PFT_decisionemail` above) — so the AI
PC Admin history line "Accountant Onboarding record created" stays correctly un-done. For migrating existing
accountants without spamming them. Frontend-only; PFT-only (`PFTEngagementTrack.jsx`'s `DecisionStep`).

`automation_PFT_decisionemail`:
- **vfo_ft** — drafts `PFT_decision_vfo_ft` with **two recipient buttons** ("I Don't Need Another Meeting -
  Confirm Onboarding" / "I'd Like Another Meeting" → `/pft-ft-decide?token=&decision=confirm|another_meeting`;
  that page shows a confirmation card and records nothing until the recipient clicks it — gotcha #290).
  **Immediately creates** the `accountant_onboarding` handoff (`selected_vfo_ft`, `accountant_type='VFO FT'`),
  links it on `pft_engagement.accountant_onboarding_id`, stamps `ft_response_token` + `ft_email_sent_at`.
- **vfo_associate** — (2026-07-13) now **mirrors vfo_ft**: drafts `PFT_decision_vfo_associate` with the SAME
  two recipient buttons (confirm / another meeting → the shared `/pft-ft-decide` + `ft-response.ts` flow),
  immediately creates the handoff (`selected_pft`, `accountant_type='VFO Associate'`), links it, stamps
  `ft_response_token` + `ft_email_sent_at`. The former immediate `PFT_associate_confirmed` bell is dropped —
  the confirm/another-meeting bell fires on the client's click instead (worded per `accountant_type`).
- **no** — drafts `PFT_decision_no`; sets client `status='lost'`. **Ordering note (2026-08-03, gotcha #320):** `savePftProgress` now calls `activateClientIfPending` (which flips `pending`→`active`), but that call happens BEFORE this `'lost'` write returns — and because the auto-activate is conditional on `.eq("status","pending")`, the `'lost'` write lands last and correctly wins. A client declined here does NOT end up "active".

## Undecided decision — client self-selects (2026-07-13)
Mirrors the MAP 1 `/decide` undecided flow. Admin clicks **Undecided email** →
`automation_PFT_undecided` (AUTH): drafts `PFT_decision_undecided` to the **client** with three buttons
(VFO FT / VFO Associate / No → `/pft-decide?token=<decision_token>&choice=vfo_ft|vfo_associate|no`), stamps
`decision_token` + `decision_email_sent_at` + `decision_task_id`, and marks the step
**"Undecided - awaiting client"** (an amber pending status that the tracker treats as "no final decision" so
both Phase-6 sections stay visible-but-pending). Client clicks → `PftDecidePage.jsx` (`/pft-decide`), which
**shows a confirmation card and records nothing until the client clicks it** (2026-07-27, gotcha #290 — note
this page's param is `choice`, not `decision`; the confirm card renders `vfo_ft`/`vfo_associate` as
"VFO Fast Track"/"VFO Associate") →
`automation_PFT_undecided_response` (PUBLIC, idempotent on `decision_response`) records the choice then
**delegates in-process to `automation_PFT_decisionemail`** with that choice, so the exact same per-choice work
runs (onboarding + confirmation email + progress + lost-on-no). Rolls `decision_response` back to null if the
delegate fails so the link can be retried.

An **AI PC Admin** history block (rendered under the decision step, styled like the Tax 5 AI PC Admin cascade)
derives the full timeline from `pft_engagement`: undecided email sent → client's path choice → onboarding
created → confirmation email sent → client's another-meeting response (plus reminder / PF-notified rows).

**2026-08-12 (v734) — the reminder / PF-notified rows changed in two ways that matter here.** (1) They are now **conditional on their own column being stamped** (`<stall>_reminder_sent_at` / `<stall>_pf_notified_at`); they previously rendered **always**, which showed a chase history on engagements that never stalled. (2) `PFTEngagementTrack.jsx` **dropped its extra `!decResp` / `!ftResp` guards**, so the rows now **survive the client's response** instead of disappearing the moment the accountant replies — the whole point of a paper trail is that it outlives the thing it was chasing. The PF-notified row (the 4-business-day tier) additionally carries an indented **"Reached out?"** checkbox saving through `automation_stall_ack` (`pipeline:'pft'`, `stall` ∈ `discovery` / `ft` / `decision` → `<stall>_pf_ack_at`), hidden in `readOnly`. Every row also shows a non-editable MM/DD date. **No live PFT data existed to click-test**, so these paths were verified by diff + build only. Gotcha **#381**.

Phase 6 indicators (matching section only): **"Sent to Accountant Onboarding"** (green once
`accountant_onboarding_id` exists) + **"Accountant onboarding progress"** (live stage from
`pft_load_engagement` + a **View onboarding →** deep-link to that record).

## VFO Fast Track / VFO Associate recipient response
`automation_PFT_ftresponse` (PUBLIC, token, idempotent on `ft_response`) — shared by BOTH the VFO FT and (as
of 2026-07-13) the VFO Associate confirmation email; the notification wording is derived from the linked
`accountant_onboarding.accountant_type`:
- **confirm** → notify **PF only** (`notifyPf`; Rachael dropped 2026-07-14); auto-set the linked Accountant
  Onboarding **Preliminary Meeting = "Request no meeting"** (only if still null).
- **another_meeting** → notify **PF only**.
If unanswered: **2-business-day** reminder email to the accountant (`PFT_decision_vfo_ft_reminder`),
**4-business-day** PF notice (both via the sweep — see Cron).

## Notifications (who gets what)
PF routing via `actions/pft/_shared.ts` `PF_EMAILS` (Evan `eanderson@`, Bridger `bsilvester@`, Ian
`iwelham@`) → falls back to all-admins if the client has no Assigned PF (set in the Profile tab) or the name
isn't mapped. As of 2026-07-14 `notifyPfAndRachael` was renamed **`notifyPf`** and no longer CCs Rachael (the
`RACHAEL_EMAIL` export was removed) — so FT-response (either button), VFO-Associate pick, discovery-complete,
and the discovery + FT stall bells (4 business days) **all notify the assigned PF only**. All notification links deep-link to the
specific record (`?onboarding=<id>` for the handoff record, `/admin/client/<id>?tab=pft` for the PFT track).

On handoff into Accountant Onboarding (FT confirm / VFO-Associate pick, in both `decision-email.ts` and the
`ft-response.ts` fallback insert), the client's `assigned_pf` is copied into the new
`accountant_onboarding.onboarding_team_member` (+ `onboarding_team_member_at`), so the onboarding's downstream
Team-Member-Responsible notifications route to that PF from the start.

## Cron
`pft-sweep-daily` 08:00 UTC → `automation_PFT_sweep` (PUBLIC, service-role): discovery 2-business-day reminder
email + 4-business-day PF notice; FT 2-business-day reminder email + 4-business-day PF notice;
**undecided-decision 2-business-day reminder email
(re-sends `PFT_decision_undecided`) + 4-business-day PF notice** (rules `PFT_undecided_reminder_email` /
`PFT_undecided_stall_bell`, guards `decision_reminder_sent_at` / `decision_pf_notified_at`). No auto-decline.

**All six tiers count BUSINESS DAYS as of 2026-08-14.** The configured `notification_rules.delay_days` are
unchanged as numbers (2 and 4); the sweep resolves each cutoff through `businessDelayCutoffIso()` in
[`utils/notify.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/notify.ts), a backward walk
over weekdays only (Mon–Fri UTC, **no holiday calendar**) — so an accountant who goes quiet on a Thursday is
reminded the following Monday rather than over the weekend. The three PF bell bodies interpolate their own
delay and now read *"N business day(s) have passed since …"*. PFT has no auto-decline, so it has no calendar
survivor of the advisor/accountant 14-day kind.

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
