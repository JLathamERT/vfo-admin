# Specialists tables

"Specialists" (also called "experts" in the schema) are the third-party domain experts that members can refer their clients to. The `experts` table is large (~30 columns) because each row holds full marketing copy for the public website widget. The onboarding workflow is its own state machine in `specialist_onboarding`.

## `experts`

The specialist roster. Most columns are display/marketing text (the "D&B" prefix = Details & Benefits — the public-facing copy).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `name` | text | not null |
| `photo_url` / `headshot_image` | text | Two image fields — likely one is hosted URL and the other a Supabase-storage object key. |
| `short_bio` / `long_bio` | text | |
| `branding` | text | |
| `details_and_benefits` | text | |
| `sort_order` | integer | default `0`, nullable. Display order. Renormalized to 1-based alphabetical position by `name` on every `save_specialist` insert. Edits do not touch this column. The `save_specialist_order` admin reorder API still exists but is overridden on the next insert. |
| `background_check` | text | |
| `D&B_strategy_expertise` | text | |
| `D&B_cutoff_date` | text | (Stored as text, not date) |
| `D&B_client_requirements` | text | |
| `D&B_investment_cost` | text | |
| `D&B_ideal_client` | text | |
| `D&B_summary_benefits` | text | |
| `D&B_getting_started` | text | |
| `D&B_professional_process` | text | |
| `D&B_competitive_advantage` | text | |
| `D&B_audit_risk_general` | text | |
| `D&B_audit_risk_history` | text | |
| `D&B_audit_risk_worst_case` | text | |
| `D&B_audit_risk_precautions` | text | |
| `D&B_revenue_share` | text | |
| `D&B_tax_risk_mindset` | text | |
| `D&B_tax_risk_notes` | text | |
| `top_of_t` | boolean | not null, default `false`. Promotion flag for "top of the table" placement. |

**Note:** Column names containing `&` (`D&B_*`) require quoting in SQL.

**Touched by:** `load_data` (returned as `data.experts`), `save_specialist`, `save_specialist_order`, `delete_specialist`, `upload_headshot`. Frontend: [SpecialistsPanel.jsx](src/components/admin/SpecialistsPanel.jsx).

---

## `vfo_ecosystem_assignments`

Many-to-many tag table — which `experts` belong to which "ecosystem" (a free-form tag, e.g., `"Estate Planning"`).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `expert_id` | bigint | fk → `experts.id` (CASCADE) |
| `ecosystem_id` | bigint | (No FK — just a numeric tag id, source is application-level) |
| `name` | text | not null. Display name of ecosystem. |

**Touched by:** `load_data` (returned as `data.ecosystems`). Joined into `ecoMap` in [AdminPortal.jsx:94](src/pages/AdminPortal.jsx).

---

## `specialist_onboarding`

Multi-stage onboarding workflow. Stages 1..N are application-defined; each stage has its own task list (in `specialist_onboarding_progress`), meeting log, and vote tally.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `specialist_name` | text | not null |
| `specialist_email` | text | |
| `current_stage` | integer | not null, default `1`. Status field — drives which stage's UI is active. |
| `status` | text | not null, default `'active'`. Status field. |
| `background_check_type` | text | |
| `created_by` | text | |
| `created_at` / `updated_at` | timestamptz | default `now()` |

**Status fields:** `current_stage`, `status`.

**Touched by:** `load_onboardings`, `create_onboarding`, `load_onboarding`, `update_onboarding`. Frontend: [SpecialistOnboarding.jsx](src/components/admin/SpecialistOnboarding.jsx).

---

## `specialist_onboarding_progress`

Per-task progress within a stage of an onboarding.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `onboarding_id` | integer | not null. fk → `specialist_onboarding.id` (CASCADE). |
| `stage` | integer | not null |
| `task_key` | text | not null |
| `status` | text | not null, default `'pending'`. Status field. Values seen: `'pending'`, `'completed'`. |
| `completed_by` | text | |
| `completed_at` | timestamptz | |
| `notes` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `save_onboarding_progress`.

---

## `specialist_onboarding_meetings`

Meetings logged against an onboarding.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `onboarding_id` | integer | not null. fk → `specialist_onboarding.id` (CASCADE). |
| `meeting_date` | date | |
| `items_discussed` | text[] | array, default `'{}'` |
| `notes` | text | |
| `outcome` | text | |
| `created_by` | text | |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `save_onboarding_meeting`.

---

## `specialist_onboarding_votes`

Per-stage vote log. Each voter casts one vote per stage.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `onboarding_id` | integer | not null. fk → `specialist_onboarding.id` (CASCADE). |
| `stage` | integer | not null |
| `voter_name` | text | not null |
| `vote` | text | not null. Application-defined (e.g., `'yes'`/`'no'`/`'abstain'`). |
| `notes` | text | |
| `voted_at` | timestamptz | default `now()` |

**Touched by:** `save_onboarding_vote`.
