# Tables — Advisor Growth Plan

> Schema for the Advisor Growth Plan feature (advisor-only). Built through Phases
> 1–8 + custom priorities/sub-tasks — see [`../GROWTH_PLAN_HANDOFF.md`](../GROWTH_PLAN_HANDOFF.md).
> Migrations: `advisor_growth_plan_schema` (base 3 tables), then this session
> `growth_plan_phase7a_accountability_columns`, `growth_plan_history_audit_log`
> (NEW `growth_plan_history`), `growth_plan_custom_and_subtasks`. All tables are
> **RLS deny-all** (the edge function uses the service-role key, which bypasses
> RLS). IDs are `bigint` identity. Enums are modelled as **TEXT + CHECK**.

## growth_plan_scores
One row per scoring session. `is_current=true` is the member's active plan;
re-scoring archives the prior row (sets it false) and inserts a new current row,
so history is preserved by `score_id` linkage.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| member_number | text → `members.member_number` (ON DELETE CASCADE) | the advisor |
| created_at | timestamptz default now() | |
| completed_at | timestamptz | when "Generate Score" ran |
| section1_score / section2_score / section3_score | numeric | section % (0–100) |
| composite_score | numeric | avg of enabled sections |
| section1_enabled / section2_enabled / section3_enabled | bool default true | Growth Summary checkboxes |
| raw_answers | jsonb default `{}` | `{ answers: {q1..q15: {value,na,notes}}, q10_preference }` |
| is_current | bool default true | exactly one true per member |
| accountability_mode | bool default false | Phase 7b — admin toggle; gates member edits + recolors the matrix; carried forward on re-score |
| assigned_admin_email | text | Phase 7a — REQUIRED at scoring; the accountability-notification recipient |
| assigned_admin_name | text | display name of the assigned admin |

Index: `(member_number, is_current)`.

## growth_plan_actions
The 20 seeded actions per session (carried G2 → G3 → G4 → G5), PLUS any custom
priorities + sub-tasks added on the One Page Plan (`is_custom=true`, `action_number` > 20).

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| member_number | text → members (cascade) | denormalized for member-scoping |
| score_id | bigint → growth_plan_scores (cascade) | |
| action_number | int | 1–20 (original G2 slot / priority) — CATALOG order; NOT the displayed number |
| plan_number | int | PERMANENT One Page Plan number for a top-level priority (null for sub-tasks, which display as `parent.N`). Assigned server-side the first time a priority enters the plan = (highest plan_number ever used on the plan)+1; never cleared/reused, so completing/parking one never renumbers the rest. Display sorts by this, NOT action_number (gotcha #208) |
| category | text | `vfo_ft` / `pft` / `marketing_vfo` / `other` |
| action_text | text | editable; the edited text carries forward |
| g2_status | text NOT NULL default `drop` | CHECK `drop\|park\|potential` |
| g3_status | text | CHECK `drop\|park\|one_page_plan` (null pre-G3) |
| g3_action_type | text | CHECK `new\|continuing` |
| g3_notes | text | |
| owned_by / assisted_by | text | free text; the UI is a shared type-and-add combobox (`ui.jsx NameCombo`) that also lists every system admin (from `growth_plan_load_admins`, admin callers only). Naming a real admin + saving fires the `GROWTH_assignee_added` bell to them (gotcha #209) |
| value_level / effort_level | text | CHECK `high\|medium\|low` |
| accountability_status | text | CHECK `not_started\|progressing\|ahead\|behind\|completed` (Phase 7b; completed items leave the matrix for a Completed Action Items table) |
| accountability_updated_at | timestamptz | |
| due_date | date | Phase 7b "Update By" date (admin-set; read-only to the member) |
| overdue_notified_at | timestamptz | Phase 7c — stamped by the overdue cron so a priority is flagged only once |
| parent_action_id | bigint → growth_plan_actions(id) ON DELETE CASCADE | sub-task link (null = top-level); deleting a parent cascade-deletes its sub-tasks |
| is_custom | bool default false | true for custom priorities + sub-tasks (deletable; the 20 seeded defaults are not) |
| created_at | timestamptz default now() | |

UNIQUE `(score_id, action_number)`. Indexes: `(score_id)`, `(member_number)`, `(parent_action_id)`.

## growth_plan_partnerships
Q7 dynamic rows (existing accountant / influencer relationships).

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| score_id | bigint → growth_plan_scores (cascade) | |
| name | text | |
| score | int | 1–10 (null when N/A) |
| is_na | bool default false | |
| created_at | timestamptz default now() | |

Index: `(score_id)`.

## growth_plan_history
Edit-history audit log (Phase 8) — one row per growth write, written best-effort
by `logGrowthHistory` from every growth write handler. **FK-free + append-only**
(NOT cascade-deleted with a score/member, so the log survives). RLS deny-all.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| member_number | text | the advisor (no FK) |
| score_id | bigint | the plan version (no FK) |
| actor_role | text | `admin` \| `member` |
| actor_name | text | admin via `allowed_admins.name`, member via member name |
| event | text | `scored` / `summary_updated` / `actions_edited` / `prioritized` / `plan_built` / `parking_moved` / `progress_set` / `accountability_on` / `accountability_off` / `due_date_set` / `custom_added` / `subtask_added` / `custom_deleted` |
| detail | jsonb | event-specific (e.g. `{composite}`, `{count}`, `{action_text, parent_action_id}`) |
| created_at | timestamptz default now() | |

Index: `(member_number, created_at desc)`. Loaded newest-first by `growth_plan_load_audit`.

See [`../GROWTH_PLAN_HANDOFF.md`](../GROWTH_PLAN_HANDOFF.md) for the full feature spec.
