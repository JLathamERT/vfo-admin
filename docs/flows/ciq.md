# CIQ flow (Client Intake Questionnaire)

A multi-step intake-and-prioritization process owned by a member, run for each of their clients. Lives entirely within the portal — no external integrations, no email or webhook chaining.

## Trigger

A member opens the CIQ tab in their portal: [MemberPortal.jsx → MemberCIQ](src/components/shared/MemberCIQ.jsx). Or, an admin opens a member's profile in [MembersPanel](src/components/admin/MembersPanel.jsx) and switches to the CIQ feature tab.

Members can **always view** their CIQs. The `members.ciq_enabled` flag (admin-controlled via `member_profile_save`; settings toggle labelled "Allow Member to Start New CIQs") only gates whether a member can **start new** CIQs — when off, the "+ Start New CIQ" button is hidden and `ciq_create` / `ciq_add_client_and_create` 403 a member caller (`actions/ciq/shared.ts` `blockIfMemberCannotStart`). Admins are never gated. *(Historically `ciq_enabled=false` hid the entire tab; repurposed 2026-06-18.)*

## Step 1 — Load settings + list

**Triggered on:** mount of `MemberCIQ`.

**Handlers:** [MemberCIQ.jsx:40](src/components/shared/MemberCIQ.jsx) calls `ciq_load_settings`. Then [MemberCIQ.jsx:64-65](src/components/shared/MemberCIQ.jsx) parallels `ciq_load_list` and `load_member_contacts`. [MemberCIQ.jsx:76](src/components/shared/MemberCIQ.jsx) loads `msm_load_member_clients` for the "add new client" workflow.

**What it does:**
- `ciq_load_settings` ([admin-api:3760-3767](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — reads `members.ciq_enabled, ciq_vfos_managed`.
- `ciq_load_list` ([admin-api:3582-3593](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — joins `client_ciqs` × `clients` for this member.
- `load_member_contacts` — gathers `clients` + `client_contacts` for the member's roster.

## Step 2 — Create a CIQ

The member can either:

- **Create against existing client** → `ciq_create({client_id, member_number})` ([MemberCIQ.jsx:90](src/components/shared/MemberCIQ.jsx) → [admin-api:3595-3606](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Inserts a new `client_ciqs` row with `status='draft'`.
- **Add a new client + create CIQ at once** → `ciq_add_client_and_create({member_number, first_name, last_name, email, additional_contact})` ([MemberCIQ.jsx:101](src/components/shared/MemberCIQ.jsx) → [admin-api:3608-3639](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Inserts `clients`, optional `client_contacts`, and `client_ciqs` in sequence.

## Step 3 — Open a CIQ for editing

**Trigger:** member clicks a CIQ in the list.

**Handlers:** [MemberCIQ.jsx:112-114](src/components/shared/MemberCIQ.jsx) parallels three reads:
- `ciq_load({ciq_id})` ([admin-api:3641-3659](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — joins `client_ciqs`, `clients`, `ciq_answers` (the answer key/value pairs).
- `ciq_load_priorities({ciq_id})` ([admin-api:3704-3713](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — reads `ciq_priorities`.
- `ciq_load_priority_snapshots({ciq_id})` ([admin-api:3751-3758](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — reads `ciq_priority_snapshots`.

## Step 4 — Save answers (incremental)

**Trigger:** member changes a form field in MemberCIQ. Auto-save fires on blur / debounced.

**Handler:** `ciq_save({ciq_id, answers})` ([MemberCIQ.jsx:131, 144](src/components/shared/MemberCIQ.jsx) → [admin-api:3661-3673](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Upserts `ciq_answers` rows by `(ciq_id, question_key)`.

## Step 5 — Mark CIQ complete

**Trigger:** member clicks "Complete CIQ" after answering all questions.

**Handler:** `ciq_save` (final write of any pending answers) followed by `ciq_complete({ciq_id})` ([MemberCIQ.jsx:144-145](src/components/shared/MemberCIQ.jsx) → [admin-api:3675-3685](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

`ciq_complete` UPDATEs `client_ciqs.status='completed'`, `client_ciqs.completed_at=now()`. The status CHECK constraint is the only DB-level validation — `'completed'` is the only valid alternate value to `'draft'`.

### Side effect — the MAP 1 "CIQ complete" step ticks itself (2026-08-03, v695)

Finishing a CIQ is precisely what the MAP 1 **"CIQ complete"** step tracks, so an admin no longer ticks a box the system already knew the answer to. After the status update, `ciq_complete` calls module-local **`syncMap1CiqStep`**:

1. Read `client_ciqs.client_id` for the completed CIQ (return quietly if null).
2. Resolve the MAP 1 phases — `program_client_phases` where `program_id=1` and `track_type='map1'`.
3. Find the task **BY NAME** — `program_client_tasks.name = 'CIQ complete'` within those phase ids. **There is no hardcoded id** (live id is `7`) because ids differ per environment.
4. Upsert `client_progress {client_id, task_id, status:'Completed', completed_date:<today>}` — an existing row already `Completed` is left alone.
5. Call `activateClientIfPending` (see [msm-tracking.md](msm-tracking.md), gotcha #320) so a client whose first tracked activity is the CIQ stops sitting at "Pending".

**It is fail-soft in every branch** — the whole block is `try`/`catch` and each `{error}` is destructured and checked; a failure emits `console.error("ciq complete: MAP1 step sync failed", …)` and the CIQ completion still returns success. **It also works before MAP 1 exists:** `client_progress` is keyed `(client_id, task_id)` with no enrollment column, so the row is simply written early and is already present when the track is later created. **Previously-completed CIQs were NOT backfilled.**

> **The name is the contract, and nothing enforces it.** Renaming the task or the `map1` phase track silently breaks the auto-complete, and the same `'CIQ complete'` literal is exact-matched three more times in `ClientTrackViewV2.jsx` (the hyperlink condition + the two `autoCompleteCodes` lists). Grep both repos before renaming. Gotcha **#323**.

### Deep link — opening one client's CIQ from elsewhere in admin (2026-08-03)

Two admin-only surfaces now navigate straight to a client's questionnaire: the client profile's **Profile** dropdown gained a **"CIQ"** entry below "Vault" (rendered only when `client.member_number` exists), and the MAP 1 **"CIQ complete"** step title is hyperlinked (`#0095ff`, admin/`!readOnly` only). Both emit:

```
/admin?member=<member_number>&feature=ciq&ciqclient=<client_id>&_n=<Date.now()>
```

`'ciq'` is a **navigation action, not a tab** — `ClientDetail.jsx`'s `handleTabSelect` intercepts it before `setActiveTab`, and `validTabsForProgram` was deliberately left untouched. `AdminPortal.jsx`'s `?member=` branch parks `ciqclient` in **sessionStorage `ciqInitialClientId`** (mirroring the existing `sub` → `msmInitialSubTab` handling), and `MemberCIQ.jsx`'s `loadCiqs` consumes it **once** — `isAdmin` only, `removeItem` even when nothing matches — then finds the newest CIQ with that `client_id` and **`await openCiq(match)`**. The `await` holds the loading skeleton; without it the CIQ *list* flashes on screen before the questionnaire opens.

> **Note:** `ciq_complete` does NOT auto-generate `ciq_priorities` rows. Those are populated separately when the user enters the priorities phase (Step 6) — but the exact code that inserts them is inside the large `MemberCIQ.jsx` (file is 111KB). The `ciq_save_priorities` action upserts whatever the UI sends; the UI must build the list initially.

## Step 6 — Rank priorities

**Trigger:** the priorities phase of the UI surfaces all CIQ-derived items as draggable / decision-tagged cards. Each item has a `decision` field constrained by DB CHECK to `'drop'`, `'park'`, or `'prioritize'`.

**Handler:** `ciq_save_priorities({ciq_id, priorities})` ([MemberCIQ.jsx:425](src/components/shared/MemberCIQ.jsx) → [admin-api:3715-3727](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Upserts `ciq_priorities` rows.

## Step 7 — Save snapshot (immutable history)

**Trigger:** every priority save also writes an immutable JSONB snapshot.

**Handler:** `ciq_save_priority_snapshot({ciq_id, snapshot, saved_by})` ([MemberCIQ.jsx:427](src/components/shared/MemberCIQ.jsx) → [admin-api:3740-3749](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). INSERTs into `ciq_priority_snapshots` (append-only — there is no update or delete handler).

The snapshot list is reloaded after each save via `ciq_load_priority_snapshots` ([MemberCIQ.jsx:432](src/components/shared/MemberCIQ.jsx)).

## Step 8 — Mark priorities complete

**Trigger:** member clicks "Complete Priorities".

**Handler:** `ciq_complete_priorities({ciq_id})` ([admin-api:3729-3738](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). UPDATEs `client_ciqs.priorities_completed_at=now()`. Note: this is a separate timestamp from `completed_at` — a CIQ can be marked "done" with answers but priorities still pending.

## Step 9 — Track progress on the One Page Plan ("Update Progress")

Once priorities are completed, the One Page Plan view (`ciqView === 'onePagePlan'`) lists Immediate (`decision='prioritize'`) and Parked (`decision='park'`) priorities. A per-CIQ **Update Progress** toggle (`client_ciqs.accountability_mode`) — flippable by admin AND member — reveals per-priority controls:

- **Immediate** item: Not Started / In Progress / Completed (sets `ciq_priorities.progress_status`) + **Move to Parked** (`decision='park'`) + **Drop** (`decision='drop'`).
- **Parked** item: **Set as Priority** (`decision='prioritize'`) + **Drop**.
- Items set to **Completed** (`progress_status='completed'`) leave the Immediate list and render in a new **Completed** section at the bottom (shown whenever non-empty, even with the toggle off).

**Handlers:**
- `ciq_set_accountability({ciq_id, enabled})` ([actions/ciq/set-accountability.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/ciq/set-accountability.ts)) — UPDATEs `client_ciqs.accountability_mode`. AUTH; admin + member.
- `ciq_save_priorities` — the existing upsert, now also persisting `progress_status`. Each control click sends a single-item array (optimistic local update, revert on error). Controls render only on the live "Latest Version", never on historical snapshots.

No snapshots are written for progress updates (snapshots stay tied to the Prioritize step). No notifications/cron — unlike the Growth Plan accountability feature this mirrors.

## Tables touched

- **Read:** `client_ciqs`, `clients`, `client_contacts`, `ciq_answers`, `ciq_priorities`, `ciq_priority_snapshots`, `members` (CIQ flags incl. `ciq_enabled` start-gate).
- **Written:** `client_ciqs` (insert + status/timestamp updates + `accountability_mode` via `ciq_set_accountability`), `ciq_answers` (upsert), `ciq_priorities` (upsert incl. `progress_status`), `ciq_priority_snapshots` (insert), `clients` + `client_contacts` (`ciq_add_client_and_create` only).

## Downstream chains

**None.** CIQ is self-contained — no email, no webhook, no integration. The advisor reads the completed CIQ + ranked priorities to inform their next conversation with the client.

## Admin vs member access

The same `MemberCIQ.jsx` component is used by both. The `isAdmin` prop differentiates ([MemberPortal.jsx:132](src/pages/MemberPortal.jsx) passes `false`; admin-side mounts pass `true`). The actions are NOT in `ADMIN_ONLY_ACTIONS` and NOT in `MEMBER_SCOPED_ACTIONS` — they're freely callable by both roles. Authorization relies on:
- The frontend filtering by `member_number` it already has.
- Each action's `member_number` parameter being set correctly in the payload.

> **Caveat:** there is no server-side scoping that prevents a member from passing a `client_id` belonging to another member's client. The handler trusts the payload. Worth flagging — security relies on UI not exposing other clients.

> **Start-gate (2026-06-18):** `ciq_create` + `ciq_add_client_and_create` now receive `auth` and 403 a member caller when `members.ciq_enabled` is false (`actions/ciq/shared.ts`). Members can still view/continue existing CIQs; only *starting* new ones is gated. `ciq_set_accountability` (the "Update Progress" toggle) is callable by both roles, like the other CIQ writes.

## Failure modes

1. **`ciq_save` race** — concurrent saves of overlapping answer keys could lose updates (last write wins). The handler upserts by `(ciq_id, question_key)` — so a single answer field is atomic, but if the UI batches multiple answers and another tab saves a subset between, results could interleave.
2. **`ciq_complete_priorities` does not validate** — there's no check that all priorities have a `decision` set, or that snapshots exist. The UI presumably gates this.
3. **No cascade clean-up** — deleting a CIQ would cascade-delete answers/priorities/snapshots (all CASCADE per FK delete rules in [tables/ciq.md](../tables/ciq.md)). But there is no delete action exposed for `client_ciqs` in the API. The only way a CIQ gets deleted is via cascading delete of its parent `clients` row.

## Cross-references

- CIQ tables: [../tables/ciq.md](../tables/ciq.md)
- MemberCIQ component: [orchestration-files.md](../architecture/06-orchestration-files.md) (largest file in repo, 111KB)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
