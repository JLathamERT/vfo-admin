# Clients tables

A client is a member's **end customer** — the person whose tax/financial planning the advisor manages. Owned by a member; tracked through programs, priorities, and tax engagements.

## `clients`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_ref` | text | Human-friendly reference (e.g., `VFO-XYZ-123`). |
| `enrollment_id` | integer | fk → `member_enrollments.id` (SET NULL). Which member enrollment owns this client. |
| `member_number` | text | fk → `members.member_number` (CASCADE). |
| `first_name` / `last_name` / `email` / `phone` | text | |
| `status` | text | default `'pending'`. Status field. Values seen: `'pending'`, `'active'`, others — not DB-constrained. |
| `assigned_pf` | text | Planning Facilitator assigned to this client. |
| `created_at` | timestamptz | default `now()` |

**Status fields:** `status`.

**Touched by:** `msm_load_clients`, `msm_load_member_clients`, `msm_add_client`, `msm_link_existing_client`, `msm_update_client`, `msm_load_client_track`, `msm_load_client_progress`, `msm_load_client_home`, `msm_load_client_detail`, `msm_update_assigned_msm`, `automation_*` (most read `clients`), and indirectly anywhere `client_id` is used. Frontend: [ClientDetail.jsx](src/pages/ClientDetail.jsx), [MSMTracking.jsx](src/components/admin/MSMTracking.jsx), [MemberMSMTracking.jsx](src/components/member/MemberMSMTracking.jsx).

---

## `client_contacts`

Additional contacts attached to a client (spouse, business partner, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | fk → `clients.id` (CASCADE) |
| `first_name` / `last_name` / `email` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `msm_add_client_contact`, `msm_delete_client_contact`, `load_member_contacts`, `msm_load_client_home`.

---

## `client_notes`

Phase/tab-scoped notes on a client. Used by the program-tracking UI to attach notes to specific phase steps.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | not null. fk → `clients.id` (CASCADE). |
| `phase_name` | text | not null |
| `tab_name` | text | not null |
| `program_name` | text | |
| `note_text` | text | not null |
| `created_by` | text | not null |
| `created_at` / `updated_at` | timestamptz | default `now()` |

**Touched by:** `load_client_notes`, `add_client_note`, `update_client_note`, `delete_client_note`. Frontend: [PhaseNotes.jsx](src/components/shared/PhaseNotes.jsx), [AddGeneralNote.jsx](src/components/shared/AddGeneralNote.jsx).

---

## `client_enrollments`

Many-to-many bridge linking a `client` to a `member_enrollments` row. Allows one client to participate in multiple enrollments.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | not null. fk → `clients.id` (CASCADE). |
| `enrollment_id` | integer | not null. fk → `member_enrollments.id` (CASCADE). |
| `created_at` | timestamptz | default `now()` |

**Touched by:** indirectly via `msm_load_clients`, `msm_add_client`.

---

## `client_progress`

Per-task progress tracking for "client" (non-training) program tasks. Drives the MAP1 / regular / PF tracks UI.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | fk → `clients.id` (CASCADE) |
| `task_id` | integer | fk → `program_client_tasks.id` (NO ACTION) |
| `status` | text | Status field. Values defined per-task in `program_client_tasks.status_options`. |
| `completed_date` | date | |
| `completed_by` | text | |
| `notes` | text | |

**Touched by:** `msm_load_client_progress`, `msm_save_client_task`, `msm_load_client_track`. Frontend: [PFTEngagementTrack.jsx](src/components/admin/pft/PFTEngagementTrack.jsx), [ClientTrackViewV2.jsx](src/components/admin/map1/ClientTrackViewV2.jsx).

---

## `client_priority_tracks`

Each client can have multiple "priority tracks" — e.g., a regular priority and a tax priority. Each track has its own progression through tasks.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | fk → `clients.id` (CASCADE) |
| `priority_name` | text | |
| `track_type` | text | default `'regular'`. Distinguishes track types (e.g., `'regular'`, `'partnership_fast_track'`). |
| `specialist_name` | text | |
| `status` | text | default `'live'`. Status field. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `msm_load_priority_tracks`, `msm_load_regular_phases`, `msm_add_priority_track`, `msm_update_priority_status`. Frontend: [RegularPrioritiesTab.jsx](src/components/admin/regular/RegularPrioritiesTab.jsx).

---

## `priority_progress`

Per-task progress within a priority track (parallel to `client_progress` but scoped to a `client_priority_tracks` row).

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `priority_track_id` | integer | fk → `client_priority_tracks.id` (CASCADE) |
| `task_id` | integer | fk → `program_client_tasks.id` (NO ACTION) |
| `status` | text | Status field. |
| `completed_date` | date | |
| `completed_by` | text | |
| `notes` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `msm_load_priority_progress`, `msm_save_priority_task`.

## `pft_engagement`

Per-accountant state for the Partnership Fast Track engagement track (added 2026-06-05). One row per PFT client; the DB-driven track tasks themselves live in `program_client_phases`/`program_client_tasks` (`track_type='partnership_fast_track'`) with status in `client_progress`. See [../flows/partnership-fast-track.md](../flows/partnership-fast-track.md).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk (generated always as identity) |
| `client_id` | integer | **UNIQUE** fk → `clients.id` (CASCADE) |
| `discovery_token` | text | token for the Meeting-2 discovery form (`/pft-discovery`) |
| `discovery_data` | jsonb | submitted discovery answers |
| `discovery_submitted_at` | timestamptz | |
| `discovery_email_sent_at` | timestamptz | Meeting-2 send timer (drives the 2-day reminder / 4-day PF notice) |
| `discovery_reminder_sent_at` | timestamptz | 2-day reminder guard |
| `discovery_pf_notified_at` | timestamptz | 4-day PF-notice guard |
| `ft_response_token` | text | token for the VFO Fast Track email buttons (`/pft-ft-decide`) |
| `ft_email_sent_at` | timestamptz | FT decision-email send timer |
| `ft_response` | text | `confirm` \| `another_meeting` (idempotency) |
| `ft_response_at` | timestamptz | |
| `ft_reminder_sent_at` | timestamptz | 2-day reminder guard |
| `ft_pf_notified_at` | timestamptz | 4-day PF-notice guard |
| `accountant_onboarding_id` | bigint | fk → `accountant_onboarding(id)` `ON DELETE SET NULL`; the handoff record created on a VFO FT / VFO Associate decision |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `automation_PFT_meetingemail`, `automation_PFT_decisionemail`, `automation_PFT_ftresponse`, `automation_PFT_loaddiscovery`, `automation_PFT_submitdiscovery`, `automation_PFT_sweep`, `pft_load_engagement`.

> Also added 2026-06-05: `accountant_onboarding.accountant_type` (`'VFO FT'` | `'VFO Associate'` | NULL) — associates skip Stages 1-2; and `accountant_onboarding.prelim_meeting_status` gained the value `'Request no meeting'` (auto-set by the PFT FT "confirm" response).
