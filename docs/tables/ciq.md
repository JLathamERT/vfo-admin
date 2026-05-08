# CIQ tables

CIQ = **Client Intake Questionnaire**. Each member can run one or more CIQs against each of their clients. The CIQ collects answers across many sections, then surfaces a ranked list of priorities the advisor can drop / park / prioritize. Every state version of the priority ranking is captured in `ciq_priority_snapshots`.

## `client_ciqs`

One per (client, CIQ-run) pairing. Status moves `'draft'` → `'completed'`.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `client_id` | bigint | not null. fk → `clients.id` (CASCADE). |
| `member_number` | text | not null. Owning member. |
| `status` | text | not null, default `'draft'`. **Status field. CHECK: `status IN ('draft', 'completed')` — only DB-constrained status in the schema.** |
| `created_at` | timestamptz | not null, default `now()` |
| `completed_at` | timestamptz | Set when `status` flips to `'completed'`. |
| `priorities_completed_at` | timestamptz | Set when priority ranking is finalized (separate step from CIQ completion). |

**Status fields:** `status` (DB CHECK).

**Touched by:** `ciq_load_list`, `ciq_create`, `ciq_add_client_and_create`, `ciq_load`, `ciq_save`, `ciq_complete`, `ciq_load_priorities`, `ciq_save_priorities`, `ciq_complete_priorities`, `ciq_save_priority_snapshot`, `ciq_load_priority_snapshots`, `ciq_load_settings`. Frontend: [MemberCIQ.jsx](src/components/shared/MemberCIQ.jsx).

---

## `ciq_answers`

Key/value answer storage. One row per `(ciq_id, question_key)`.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `ciq_id` | bigint | not null. fk → `client_ciqs.id` (CASCADE). |
| `question_key` | text | not null. Question identifier (form field key). |
| `answer_value` | text | Stored as text regardless of underlying type. |

**Touched by:** `ciq_load`, `ciq_save`, `ciq_complete`.

---

## `ciq_priorities`

Generated priority items derived from a completed CIQ. The advisor then assigns each a `decision`.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `ciq_id` | bigint | not null. fk → `client_ciqs.id` (CASCADE). |
| `item_key` | text | not null |
| `item_label` | text | not null. Display text. |
| `item_section` | text | not null. CIQ section grouping. |
| `item_value` | text | |
| `decision` | text | not null, default `'drop'`. **Status field. CHECK: `decision IN ('drop', 'park', 'prioritize')`.** |
| `notes` | text | |

**Status fields:** `decision` (DB CHECK).

**Touched by:** `ciq_load_priorities`, `ciq_save_priorities`, `ciq_complete_priorities`.

---

## `ciq_priority_snapshots`

Append-only history of the entire priority list at each save. Every "save priorities" action writes a new row containing the full JSONB snapshot, so the user can see the evolution.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `ciq_id` | bigint | not null. fk → `client_ciqs.id` (CASCADE). |
| `saved_by` | text | |
| `saved_at` | timestamptz | not null, default `now()`. |
| `snapshot` | jsonb | not null. Full priority list at this point in time. |

**Touched by:** `ciq_save_priority_snapshot`, `ciq_load_priority_snapshots`. Frontend: [MemberCIQ.jsx:425-432](src/components/shared/MemberCIQ.jsx).

---

## `ciq_assignments`

Maps experts to CIQ-section names. Used to produce the "who handles this priority" recommendations.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `expert_id` | bigint | fk → `experts.id` (CASCADE) |
| `name` | text | not null. Section/category name (e.g., `"Tax Planning"`). |

**Touched by:** `load_data` (returned as `data.ciq` map). Joined into `ciqMap` in [AdminPortal.jsx:101](src/pages/AdminPortal.jsx).
