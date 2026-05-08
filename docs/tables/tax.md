# Tax tables

Tax engagements run alongside (and downstream of) the regular member-program. A `client_tax_plans` row represents the engagement; specialists are attached via `client_tax_specialists`; per-task progress is tracked in `client_tax_progress`.

## `client_tax_plans`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | not null. fk → `clients.id` (CASCADE). |
| `status` | text | not null, default `'live'`. Status field. |
| `created_at` | timestamptz | not null, default `now()`. |

**Touched by:** `tax_load_plans`, `tax_start_plan`. Frontend: [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx).

---

## `client_tax_specialists`

Many-to-many between a tax plan and the `experts` working on it.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `tax_plan_id` | integer | not null. fk → `client_tax_plans.id` (CASCADE). |
| `expert_id` | bigint | not null. fk → `experts.id` (NO ACTION). |
| `specialist_name` | text | not null. Snapshot of name (so display survives expert renames). |
| `status` | text | not null, default `'live'`. Status field. |
| `created_at` | timestamptz | not null, default `now()`. |

**Touched by:** `tax_load_specialists`, `tax_add_specialist`.

---

## `client_tax_progress`

Per-task progress within a tax plan, scoped to a specialist.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `tax_plan_id` | integer | not null. fk → `client_tax_plans.id` (CASCADE). |
| `tax_specialist_id` | integer | fk → `client_tax_specialists.id` (SET NULL). |
| `task_id` | integer | not null. fk → `program_client_tasks.id` (NO ACTION). |
| `status` | text | Status field. |
| `completed_date` | date | |
| `completed_by` | text | |
| `notes` | text | |

**Touched by:** `tax_load_progress`, `tax_save_task`.
