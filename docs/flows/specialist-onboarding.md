# Specialist onboarding flow

A multi-stage workflow for vetting a new specialist (third-party expert) before they're added to the live `experts` roster. Stage count is application-defined; each stage has its own task list, meeting log, and vote tally.

## Trigger

Admin navigates: AdminPortal → Specialists dropdown → Onboarding ([AdminPortal.jsx:181](src/pages/AdminPortal.jsx)). Mounts [SpecialistOnboarding.jsx](src/components/admin/SpecialistOnboarding.jsx) (55KB).

## Step 1 — Load list

**Handler:** `load_onboardings` ([SpecialistOnboarding.jsx:65](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3804-3808](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Reads all `specialist_onboarding` rows (no per-admin filter).

## Step 2 — Create new onboarding

**Handler:** `create_onboarding({specialist_name, specialist_email, created_by})` ([SpecialistOnboarding.jsx:75](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3810-3816](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). INSERTs a `specialist_onboarding` row with `current_stage=1`, `status='active'`.

## Step 3 — Open existing onboarding

**Handler:** `load_onboarding({onboarding_id})` ([SpecialistOnboarding.jsx:160](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3818-3829](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Reads the parent row plus all child rows from `specialist_onboarding_progress`, `specialist_onboarding_meetings`, `specialist_onboarding_votes`.

## Step 4 — Per-stage activities

Each stage in the UI has three independent action types:

### Task progress

**Handler:** `save_onboarding_progress({onboarding_id, stage, task_key, status, completed_by, notes})` ([SpecialistOnboarding.jsx:178](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3831-3837](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Upserts `specialist_onboarding_progress` row keyed on `(onboarding_id, stage, task_key)`. Status defaults to `'completed'` if empty in the payload.

### Meeting log

**Handler:** `save_onboarding_meeting({onboarding_id, meeting_date, items_discussed, notes, outcome, created_by})` ([SpecialistOnboarding.jsx:437, 458](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3839-3845](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

INSERTs `specialist_onboarding_meetings`. The `items_discussed` field is a Postgres `text[]` array (default `'{}'`). The handler appears to insert without an upsert — every save creates a new meeting row.

### Vote

**Handler:** `save_onboarding_vote({onboarding_id, stage, voter_name, vote, notes})` ([SpecialistOnboarding.jsx:188](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3847-3853](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Upserts `specialist_onboarding_votes` keyed on `(onboarding_id, stage, voter_name)` — one vote per voter per stage, latest wins.

## Step 5 — Update parent (advance stage / change status)

**Handler:** `update_onboarding({onboarding_id, current_stage?, status?, background_check_type?, ...})` ([SpecialistOnboarding.jsx:196](src/components/admin/SpecialistOnboarding.jsx) → [admin-api:3855-3866](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

UPDATEs `specialist_onboarding`. Used to:
- Advance `current_stage` to the next number when admin determines stage is complete.
- Set `status` (e.g., `'active'`, `'rejected'`, `'approved'`).
- Set `background_check_type` once known.

There is no automatic stage advancement based on task completion or vote tallies — admin manually advances via this action.

## Tables touched

- **Read:** `specialist_onboarding`, `specialist_onboarding_progress`, `specialist_onboarding_meetings`, `specialist_onboarding_votes`.
- **Written:** all four (insert/upsert/update).

## Downstream chains

**None.** No email, no webhook, no integration. The handler just records state.

> **Note:** No observed code adds the onboarded specialist to `experts` automatically when `status` flips to (e.g.) `'approved'`. The admin would need to separately invoke `save_specialist` to add the row to the live roster. The two systems are not linked.

## Auth

All `*_onboarding*` actions are in `ADMIN_ONLY_ACTIONS` ([admin-api:2245](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Member callers get 403.

## Failure modes

1. **Concurrent vote by same voter** — upsert is keyed on `(onboarding_id, stage, voter_name)` so latest wins. No history is preserved.
2. **Concurrent task save** — same. Last write wins.
3. **Meeting saves are append-only** — duplicate clicks would create duplicate rows. The UI presumably guards this client-side.
4. **No completion validation** — `update_onboarding` lets admin set any `current_stage` or `status` value. There's no check that all stage tasks are completed before advancing.

## Open questions

1. How many stages exist? Hardcoded in the React component but the count is not visible from this audit (file is 55KB and was not read in full).
2. What does the `status` field's value space look like in practice? `'active'` is the default; other values are not constrained at DB level.
3. When (if ever) does an onboarded specialist transition to a row in `experts`? Manual or automated?

## Cross-references

- Specialist tables: [../tables/specialists.md](../tables/specialists.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
