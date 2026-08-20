# MSM (Member-Servicing-Manager) tracking flow

The largest action surface in the system. ~32 `msm_*` actions covering: programs, enrollments, training progress, client management, client priorities, tax tracking, and per-client home pages. Both admins and members use it (admin has full visibility; members are scoped to their own data).

There is no single "MSM flow" — it's a collection of related CRUD operations on the program/enrollment/client/priority tables. This doc maps the territory.

## Triggers

- Admin: opens a member's profile in [MembersPanel.jsx](src/components/admin/MembersPanel.jsx) → MSM Tracking feature tab → mounts [MSMTracking.jsx](src/components/admin/MSMTracking.jsx) (90KB).
- Member: opens [MemberPortal.jsx](src/pages/MemberPortal.jsx) → MSM Tracking dropdown → MSM Home or per-program tab → mounts [MemberMSMTracking.jsx](src/components/member/MemberMSMTracking.jsx) (56KB).
- Both admins and members can drill into a specific client via [ClientDetail.jsx](src/pages/ClientDetail.jsx).

## Subsystems

The 32 `msm_*` actions fall into 5 subsystems. Each is a small CRUD island — no chains, no integrations.

### A — Program / enrollment management

| Action | Tables | Notes |
|---|---|---|
| `msm_load_programs` | `programs` | Returns all programs. |
| `msm_load_enrollments` | `member_enrollments` | Filtered by `member_number`. |
| `msm_enroll_member` | inserts `member_enrollments` | Creates enrollment with default `training_status='pre'`, `program_status='active'`. |
| `msm_update_enrollment` | updates `member_enrollments` | Updates training/program status, target_clients, assigned_msm. |
| `msm_load_enabled_programs` | `member_program_enabled` | Reads which programs are enabled for the member. |
| `msm_toggle_program` | upserts `member_program_enabled` | Enables/disables a program for a member. Drives MemberPortal's dynamic tab list. |
| `msm_update_assigned_msm` | updates `members.assigned_msm` (or enrollment-level) | Reassigns the MSM. |

### B — Training tracking (per-enrollment)

| Action | Tables | Notes |
|---|---|---|
| `msm_load_training_track` | `program_training_phases`, `program_training_tasks` | The training curriculum template. `program_training_tasks.task_type` ∈ `'dropdown'`\|`'section'`\|`'substep'`: `'section'` rows are label-only sub-headings (never counted), `'substep'` rows render indented inside the enclosing section box — see gotcha #173 + `tables/programs.md`. **Completion is decided client-side by `components/shared/trainingStatus.js`: POSITIVE-only (a task counts only on a done-style status, not `Outstanding`/`Stopped`/`Will Watch`); `N/A` removes a task from the total; any `Stopped` step makes the "90 Day Plan:" header read Stopped — gotcha #233.** |
| `msm_load_training_progress` | `member_training_progress` | Per-enrollment task progress. |
| `msm_save_training_task` | upserts `member_training_progress` | Keyed by `(enrollment_id, task_id)`. **ADMIN_ONLY as of 2026-07-21** (gotcha #256 — the list previously carried only the dead name `msm_save_training_progress`, leaving this ungated). |
| `training_tracker_load` | `training_tracker_entries`, `program_training_tasks` | **Member-driven tracker steps (2026-07-21).** MEMBER_SCOPED; loads a step's entries (`{enrollment_id, task_id}`), admins any / members own-enrollment via `denyIfNotOwnEnrollment`. Config resolved by `resolveTrackerConfig` — sentinel `status_options` (`tracker_accountants`/`tracker_clients`) first, exact task-name fallback (gotcha #255). |
| `training_tracker_add` | inserts `training_tracker_entries`; syncs `member_training_progress`; bell | MEMBER-only 403 gate + ownership. The member adds an accountant/client row (task id 76 PFT "Add ≥2 Accountants", id 19 Holistic "Add ≥5 Clients"); `syncTrackerProgress` re-derives the step status from the entry count (0→grey/row-deleted, 1..threshold-1→`In Progress`, ≥threshold→`Completed`), never overwriting `Stopped`/`N/A`. Completion-only FYI bell to the assigned MSM (`TRAINING_tracker_accountant_added`/`_client_added`) — fires once when the step reaches `Completed` at the threshold, not per add. |
| `training_tracker_delete` | deletes `training_tracker_entries`; syncs `member_training_progress` | ADMIN_ONLY. Removes a member-added row, re-derives status via `syncTrackerProgress`. |

### C — Meetings (per-enrollment)

| Action | Tables | Notes |
|---|---|---|
| `msm_load_meetings` | `member_meetings` | Filtered by `enrollment_id`. |
| `msm_log_meeting` | inserts `member_meetings` | |
| `msm_delete_meeting` | deletes `member_meetings` | |

### D — Client management (per-enrollment)

| Action | Tables | Notes |
|---|---|---|
| `msm_load_clients` | `clients`, `client_enrollments` | Joins clients to enrollment. |
| `msm_load_member_clients` | `clients` | All clients for a member, regardless of enrollment. |
| `msm_add_client` | inserts `clients` + optional `client_contacts` + `client_enrollments` | Creates a new client tied to an enrollment. |
| `msm_link_existing_client` | inserts `client_enrollments` | Links existing client to a new enrollment. |
| `msm_update_client` | updates `clients` | Defined twice in source — line 3079 wins, line 3216 is dead code. |
| `msm_add_client_contact` | inserts `client_contacts` | `email` REQUIRED since 2026-08-20. |
| `msm_update_client_contact` | updates `client_contacts` | New 2026-08-20. Name/email for any permitted caller; the `cc_on_emails` / `use_in_greeting` toggles are **admin-only**. See [additional-contacts.md](additional-contacts.md). |
| `msm_delete_client_contact` | deletes `client_contacts` | |

### E — Client tracks & priorities (per-client)

| Action | Tables | Notes |
|---|---|---|
| `msm_load_client_track` | `program_client_phases`, `program_client_tasks` | The "client" curriculum template, filtered by `track_type` (e.g., `'map1'`, `'partnership_fast_track'`). |
| `msm_load_client_progress` | `client_progress` | Per-client task progress. |
| `msm_save_client_task` | upserts `client_progress` | The action that records each c-task completion in MAP1/PFT/Regular tabs. **Also called by [PIPDecisionForm.jsx:106](src/components/admin/map1/PIPDecisionForm.jsx) before chaining `automation_PIPFU_decision`.** |
| `msm_load_priority_tracks` | `client_priority_tracks` | List of priority tracks for a client. |
| `msm_load_regular_phases` | `program_client_phases` filtered to `track_type='regular'` | |
| `msm_add_priority_track` | inserts `client_priority_tracks` | **Custom specialist (2026-08-20).** The Add Regular Priority picker carries a permanent trailing **"Custom"** option (module sentinel `OTHER_SPEC_VALUE = '__other__'`) that reveals an 80-char name input; the request then carries `custom: true` + `custom_name` and the **server** builds the stored value, sanitizing exactly like `tax_add_specialist` (collapse whitespace → trim → strip a leading case-insensitive `"custom -"` so it cannot double → 80-char cap) and prepending `"Custom - "`. Empty `custom_name` on the custom path is a 400. Same contract as the tax track's Custom allocation — see [tax-planning.md](tax-planning.md#allocating-an-off-directory-specialist-custom-2026-07-31-v683). **Deploy-window note:** the frontend also sends the already-prefixed `specialist_name` on the custom path, so the *old* handler (which ignores `custom`/`custom_name`) stores the identical value instead of NULL; the new handler ignores that field when `custom` is true and re-derives it. That belt-and-braces field can be dropped once the backend deploy has settled. |
| `msm_update_priority_status` | updates `client_priority_tracks.status` | E.g. `'live'`, `'archived'`. |
| `msm_load_priority_progress` | `priority_progress` | Per-track task progress. |
| `msm_save_priority_task` | upserts `priority_progress` | |
| `msm_load_client_home` | `clients` + `client_contacts` + `member_enrollments` + `programs` + `client_enrollments` | Aggregate read for ClientDetail's home tab. |
| `msm_load_client_detail` | `clients` + `member_enrollments` + `programs` | Smaller aggregate read. |

## Member-side view

Members can call all `msm_load_*` reads — but they are scoped server-side: `MEMBER_SCOPED_ACTIONS` (`constants/role-gates.ts`) overwrites `body.member_number` with the caller's own. Specifically scoped:

```
msm_add_client, msm_add_client_contact,
msm_load_enrollments, msm_load_clients, msm_load_member_clients,
msm_load_enabled_programs, msm_load_meetings,
msm_load_training_progress, msm_load_training_track,
load_exclusions, load_member_contacts
```

**Adding clients is member-allowed (v337).** `msm_add_client` (the member-side "+ Add Client" on Holistic / Tax / Partnership Fast Track — on Partnership the "clients" are accountants, same action with an `-PFT` ref) and `msm_add_client_contact` are in `MEMBER_SCOPED_ACTIONS`. Because the middleware only scopes `member_number` (not `enrollment_id` / `client_id`), the **handlers add their own ownership guard**: `add-client.ts` returns `403` unless `enrollment.member_number === member_number` (all callers; no-op for admins), and `add-client-contact.ts` returns `403` unless the target client belongs to the caller (member callers only). See [04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md#role-gates).

Other mutations are admin-only (in `ADMIN_ONLY_ACTIONS` array — `constants/role-gates.ts`). Notably:
- `msm_save_client_task` is NOT in either list — the handler doesn't enforce role, so members could in theory write client progress for any client they know the ID of (application/UI-level ownership is the only guard). **`msm_save_training_task` was closed 2026-07-21** — it is now in `ADMIN_ONLY_ACTIONS` (the list previously carried only the dead name `msm_save_training_progress`, which matched no dispatched action, so the real training-status writer was ungated; gotcha #256).

## Cross-talk with other flows

- `msm_save_client_task` is called by [PIPDecisionForm.jsx:106](src/components/admin/map1/PIPDecisionForm.jsx) inside the MAP1 contract flow — see [contract-and-payment.md](contract-and-payment.md#step-2--pip-follow-up-decision).
- `member_load_pipeline` is invoked from [MemberMSMTracking.jsx:484](src/components/member/MemberMSMTracking.jsx) to surface the MAP1 pipeline state read-only inside the member view.

## Tables touched (composite list)

- **Read/written:** `programs`, `program_training_phases`, `program_training_tasks`, `program_client_phases`, `program_client_tasks`, `member_enrollments`, `member_program_enabled`, `member_training_progress`, `training_tracker_entries` (member-driven 90 Day Plan tracker steps, 2026-07-21), `member_meetings`, `clients`, `client_contacts`, `client_enrollments`, `client_progress`, `client_priority_tracks`, `priority_progress`, `members.assigned_msm`.
- **Read only:** `members` (for context).

## Downstream chains

**None.** Every msm action is single-shot CRUD.

## Failure modes

1. **No DB transactions** — `msm_add_client` does 3 inserts (`clients`, `client_contacts`, `client_enrollments`) sequentially, not in a transaction. A failure between #1 and #2 leaves an orphan `clients` row.
2. **`msm_update_client` duplicate handler** — see [05-api-action-catalog.md](../architecture/05-api-action-catalog.md). The duplicate at line 3216 is dead code.
3. **Cross-tenant write** — for actions not in `ADMIN_ONLY_ACTIONS` and not in `MEMBER_SCOPED_ACTIONS` (notably `msm_save_client_task`, `msm_save_priority_task` — `msm_save_training_task` was moved into `ADMIN_ONLY_ACTIONS` 2026-07-21, gotcha #256), there's no server-side ownership check. Relies on UI not exposing other members' enrollment/client IDs. (`msm_add_client` / `msm_add_client_contact` are NO LONGER in this gap as of v337 — they're member-scoped AND carry handler-level ownership guards on `enrollment_id` / `client_id`.)
4. **`msm_link_existing_client`** could in theory let an admin link a client to any enrollment without ownership validation. No checks observed.

## Cross-references

- Programs/enrollments tables: [../tables/programs.md](../tables/programs.md)
- Clients tables: [../tables/clients.md](../tables/clients.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
