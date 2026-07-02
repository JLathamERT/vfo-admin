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
| `name` | text | not null |
| `task_type` | text | default `'dropdown'`. **Three values render differently in the 90-Day-Plan UI:** `'dropdown'` = a normal checkable step (status dropdown, counts toward phase completion); `'section'` = a **label-only sub-heading** (no dropdown, NEVER counted — see gotcha #173); `'substep'` = a checkable step rendered **indented inside** the enclosing section box (counts normally). |
| `task_order` | integer | not null. Section headers and their sub-steps are contiguous — a `'section'` owns every following `'substep'` until the next `'section'` or a `'dropdown'`. |
| `status_options` | text | Comma/JSON-encoded list of allowed `status` values for `member_training_progress.status`. NULL for `'section'` rows (labels have no status). |
| `video_url` | text | Optional training video — the member-side `VideoTask` embeds it. Three providers, detected by URL shape: **YouTube** (`…?v=<id>`, YT IFrame API), **Wistia** (`https://fast.wistia.net/embed/iframe/<mediaId>`), or **Loom** (`https://www.loom.com/embed/<id>`) — any URL containing `wistia` or `loom` renders in a plain 16:9 iframe. Provider **share** links are NOT stored directly: Wistia `/s/<slug>` (resolve via oEmbed) and Loom `/share/<id>?sid=…` (rewrite to `/embed/<id>`) must be converted first — see gotcha #174. |

> **90-Day-Plan sections (2026-07-02):** VFO Holistic Planning (program 1) MSM 1–4 and Partnership Fast Track (program 2) MSM 1–4 were restructured so each old "Watched Module/Step" step is now a `task_type='section'` header with `'substep'` watch-items beneath it (e.g. Holistic MSM 1 → *Watch "Foundation of a Virtual Family Office"* + 4 sub-steps). Section rows are labels only — both the admin `MSMTracking.jsx` and member `MemberMSMTracking.jsx` exclude them from every count via `countableTasks()` and enclose each `groupTasks()` group in a tinted box. Data-only change (rendering already generic); see gotcha #173.

> The `task_code` column (the visible `M#`/`P#` step IDs) was **dropped** for the 90-Day-Plan cleanup — codes are no longer stored or displayed. The 3 per-program "Review" checkpoint phases (MSM 4/8/12 Review) were also deleted; the training track now runs MSM 1 Training → MSM 12 Activity only. (`program_client_tasks.task_code` below — the MAP 1 C-codes — is unaffected.)

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

> **Tax 4 task this session:** ids **153 + 154** (the Tax 4 `task_order=0` task in both tax programs) were renamed to **"High Level Meeting Confirmation Email"** and their `status_options` changed `tax_meeting_date` → **`tax_hlm_confirm`** (date-picker task replaced by the `automation_TAX_highlevelmeeting_confirm` send-email button).

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
