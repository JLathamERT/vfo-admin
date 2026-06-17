# Tables — Advisor Growth Plan

> Schema for the Advisor Growth Plan feature (advisor-only; **in progress** — see
> [`../GROWTH_PLAN_HANDOFF.md`](../GROWTH_PLAN_HANDOFF.md)). Migration:
> `advisor_growth_plan_schema`. All three tables are **RLS deny-all** (the edge
> function uses the service-role key, which bypasses RLS). IDs are `bigint
> GENERATED ALWAYS AS IDENTITY`. Enums are modelled as **TEXT + CHECK**.

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

Index: `(member_number, is_current)`.

## growth_plan_actions
The 20 actions per session, carried G2 → G3 → G4 → G5.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| member_number | text → members (cascade) | denormalized for member-scoping |
| score_id | bigint → growth_plan_scores (cascade) | |
| action_number | int | 1–20 (original G2 slot / priority) |
| category | text | `vfo_ft` / `pft` / `marketing_vfo` / `other` |
| action_text | text | editable; the edited text carries forward |
| g2_status | text NOT NULL default `drop` | CHECK `drop\|park\|potential` |
| g3_status | text | CHECK `drop\|park\|one_page_plan` (null pre-G3) |
| g3_action_type | text | CHECK `new\|continuing` |
| g3_notes | text | |
| owned_by / assisted_by | text | free text |
| value_level / effort_level | text | CHECK `high\|medium\|low` |
| accountability_status | text | CHECK `not_started\|progressing\|ahead\|behind\|completed` (Phase 7) |
| accountability_updated_at | timestamptz | |
| created_at | timestamptz default now() | |

UNIQUE `(score_id, action_number)`. Indexes: `(score_id)`, `(member_number)`.

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

## Phase 7 additions (planned — NOT yet migrated)
- `growth_plan_scores` += `accountability_mode` bool, `assigned_admin_email`, `assigned_admin_name`.
- `growth_plan_actions` += `due_date` date, `overdue_notified_at` timestamptz.
- NEW `growth_plan_history` (edit audit log: actor, event, detail, created_at).

See [`../GROWTH_PLAN_HANDOFF.md`](../GROWTH_PLAN_HANDOFF.md) for the full Phase 7/8 spec.
