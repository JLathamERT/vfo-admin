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
| `msm_load_training_track` | `program_training_phases`, `program_training_tasks` | The training curriculum template. |
| `msm_load_training_progress` | `member_training_progress` | Per-enrollment task progress. |
| `msm_save_training_task` | upserts `member_training_progress` | Keyed by `(enrollment_id, task_id)`. |

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
| `msm_add_client_contact` | inserts `client_contacts` | |
| `msm_delete_client_contact` | deletes `client_contacts` | |

### E — Client tracks & priorities (per-client)

| Action | Tables | Notes |
|---|---|---|
| `msm_load_client_track` | `program_client_phases`, `program_client_tasks` | The "client" curriculum template, filtered by `track_type` (e.g., `'map1'`, `'partnership_fast_track'`). |
| `msm_load_client_progress` | `client_progress` | Per-client task progress. |
| `msm_save_client_task` | upserts `client_progress` | The action that records each c-task completion in MAP1/PFT/Regular tabs. **Also called by [PIPDecisionForm.jsx:106](src/components/admin/map1/PIPDecisionForm.jsx) before chaining `automation_PIPFU_decision`.** |
| `msm_load_priority_tracks` | `client_priority_tracks` | List of priority tracks for a client. |
| `msm_load_regular_phases` | `program_client_phases` filtered to `track_type='regular'` | |
| `msm_add_priority_track` | inserts `client_priority_tracks` | |
| `msm_update_priority_status` | updates `client_priority_tracks.status` | E.g. `'live'`, `'archived'`. |
| `msm_load_priority_progress` | `priority_progress` | Per-track task progress. |
| `msm_save_priority_task` | upserts `priority_progress` | |
| `msm_load_client_home` | `clients` + `client_contacts` + `member_enrollments` + `programs` + `client_enrollments` | Aggregate read for ClientDetail's home tab. |
| `msm_load_client_detail` | `clients` + `member_enrollments` + `programs` | Smaller aggregate read. |

## Member-side view

Members can call all `msm_load_*` reads — but they are scoped server-side: `MEMBER_SCOPED_ACTIONS` ([admin-api:2261](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) overwrites `body.member_number` with the caller's own. Specifically scoped:

```
msm_load_enrollments, msm_load_clients, msm_load_member_clients,
msm_load_enabled_programs, msm_load_meetings,
msm_load_training_progress, msm_load_training_track,
load_exclusions, load_member_contacts
```

Mutations are admin-only (in `ADMIN_ONLY_ACTIONS` array — [admin-api:2226-2252](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Notably:
- `msm_save_training_task` and `msm_save_client_task` are NOT in either list. The handler doesn't enforce role. Members could in theory write training/client progress for any enrollment/client they know the ID of. Application-level (UI-level) ownership is the only guard.

## Cross-talk with other flows

- `msm_save_client_task` is called by [PIPDecisionForm.jsx:106](src/components/admin/map1/PIPDecisionForm.jsx) inside the MAP1 contract flow — see [contract-and-payment.md](contract-and-payment.md#step-2--pip-follow-up-decision).
- `member_load_pipeline` is invoked from [MemberMSMTracking.jsx:484](src/components/member/MemberMSMTracking.jsx) to surface the MAP1 pipeline state read-only inside the member view.

## Tables touched (composite list)

- **Read/written:** `programs`, `program_training_phases`, `program_training_tasks`, `program_client_phases`, `program_client_tasks`, `member_enrollments`, `member_program_enabled`, `member_training_progress`, `member_meetings`, `clients`, `client_contacts`, `client_enrollments`, `client_progress`, `client_priority_tracks`, `priority_progress`, `members.assigned_msm`.
- **Read only:** `members` (for context).

## Downstream chains

**None.** Every msm action is single-shot CRUD.

## Failure modes

1. **No DB transactions** — `msm_add_client` does 3 inserts (`clients`, `client_contacts`, `client_enrollments`) sequentially, not in a transaction. A failure between #1 and #2 leaves an orphan `clients` row.
2. **`msm_update_client` duplicate handler** — see [05-api-action-catalog.md](../architecture/05-api-action-catalog.md). The duplicate at line 3216 is dead code.
3. **Cross-tenant write** — for actions not in `ADMIN_ONLY_ACTIONS` and not in `MEMBER_SCOPED_ACTIONS` (notably `msm_save_training_task`, `msm_save_client_task`, `msm_save_priority_task`), there's no server-side ownership check. Relies on UI not exposing other members' enrollment/client IDs.
4. **`msm_link_existing_client`** could in theory let an admin link a client to any enrollment without ownership validation. No checks observed.

## Cross-references

- Programs/enrollments tables: [../tables/programs.md](../tables/programs.md)
- Clients tables: [../tables/clients.md](../tables/clients.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
