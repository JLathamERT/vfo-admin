# Programs tables

A "program" is a curriculum / engagement template. It has two parallel hierarchies of phases & tasks:

- **Training** (`program_training_phases` → `program_training_tasks`) — what the *member* learns
- **Client** (`program_client_phases` → `program_client_tasks`) — what the *member does for each client*

Each member enrolls into a program (`member_enrollments`), then training-progress is tracked per enrollment, while client-progress is tracked per client.

## `programs`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `name` | text | not null |
| `description` | text | |
| `active` | boolean | default `true` |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `msm_load_programs`. Frontend: [MemberPortal.jsx:34](src/pages/MemberPortal.jsx), [MemberMSMTracking.jsx](src/components/member/MemberMSMTracking.jsx), [MSMTracking.jsx](src/components/admin/MSMTracking.jsx).

---

## `program_training_phases`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `program_id` | integer | fk → `programs.id` (NO ACTION) |
| `phase_number` | integer | not null |
| `name` | text | not null |
| `phase_order` | integer | not null |

---

## `program_training_tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `phase_id` | integer | fk → `program_training_phases.id` (NO ACTION) |
| `task_code` | text | |
| `name` | text | not null |
| `task_type` | text | default `'dropdown'` |
| `task_order` | integer | not null |
| `status_options` | text | Comma/JSON-encoded list of allowed `status` values for `member_training_progress.status`. |
| `video_url` | text | Optional training video. |

---

## `program_client_phases`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `program_id` | integer | fk → `programs.id` (NO ACTION) |
| `phase_number` | integer | not null |
| `name` | text | not null |
| `phase_order` | integer | not null |
| `track_type` | text | default `'map1'`. Distinguishes which track this phase belongs to (e.g., `'map1'`, `'partnership_fast_track'`, `'regular'`, `'tax'`). |

---

## `program_client_tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `phase_id` | integer | fk → `program_client_phases.id` (NO ACTION) |
| `task_code` | text | |
| `name` | text | not null |
| `task_type` | text | default `'dropdown'` |
| `task_order` | integer | not null |
| `status_options` | text | Allowed `status` values for downstream progress tables. |

**Referenced by:** `client_progress.task_id`, `client_tax_progress.task_id`, `priority_progress.task_id` — all `NO ACTION`.

---

## `member_enrollments`

A member's enrollment in a program. Drives both training-progress and client-program tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | fk → `members.member_number` (CASCADE) |
| `program_id` | integer | fk → `programs.id` (NO ACTION) |
| `date_enrolled` | date | |
| `training_status` | text | default `'pre'`. Status field. |
| `program_status` | text | default `'active'`. Status field. |
| `assigned_msm` | text | Member-Servicing-Manager assigned to this enrollment. |
| `target_clients` | integer | default `0`. Goal count. |
| `notes` | text | |
| `created_at` | timestamptz | default `now()` |

**Status fields:** `training_status`, `program_status`.

**Touched by:** `msm_load_enrollments`, `msm_enroll_member`, `msm_update_enrollment`, `msm_load_clients`, `msm_load_member_clients`, `msm_update_assigned_msm`. Frontend: [MemberMSMTracking.jsx](src/components/member/MemberMSMTracking.jsx), [MSMTracking.jsx](src/components/admin/MSMTracking.jsx).

---

## `member_training_progress`

Per-task progress through the training curriculum. One row per `(enrollment_id, task_id)`.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `enrollment_id` | integer | fk → `member_enrollments.id` (CASCADE) |
| `task_id` | integer | fk → `program_training_tasks.id` (NO ACTION) |
| `status` | text | Status field. |
| `completed_date` | date | |
| `completed_by` | text | |
| `notes` | text | |

**Touched by:** `msm_load_training_progress`, `msm_save_training_task`.

---

## `member_meetings`

Meeting log per enrollment.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | fk → `members.member_number` (CASCADE) |
| `enrollment_id` | integer | fk → `member_enrollments.id` (CASCADE) |
| `meeting_date` | date | |
| `meeting_type` | text | |
| `conducted_by` | text | |
| `notes` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `msm_load_meetings`, `msm_log_meeting`, `msm_delete_meeting`.

---

## `member_program_enabled`

Flag table — which programs are enabled for which members.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | fk → `members.member_number` (CASCADE) |
| `program_id` | integer | fk → `programs.id` (NO ACTION) |
| `enabled` | boolean | default `false`. Status field. |

**Touched by:** `msm_load_enabled_programs`, `msm_toggle_program`.

---

## `member_program_notes`

Free-text per-program notes attached to a member.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | not null |
| `program_name` | text | not null |
| `note_text` | text | not null |
| `created_by` | text | not null |
| `created_at` / `updated_at` | timestamptz | default `now()` |

**Touched by:** `load_member_program_notes`, `add_member_program_note`, `update_member_program_note`, `delete_member_program_note`.
