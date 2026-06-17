# Advisor Growth Plan — Build Handoff

> Handoff for continuing the Advisor Growth Plan feature in a new chat.
> Read this in full before doing anything. Then read the files it points to.

## TL;DR
Phases 1–6 are **built + user-verified** (scoring → one-page matrix). What remains:
**Phase 7 (Accountability Mode)**, an **edit-history audit log**, and **Phase 8
(Parking Garage + Growth History + member-portal wiring)**. The feature is
**advisor-only** for now; an accountant variant comes later (same structure,
different question/action copy — keep copy isolated in `constants.js`).

---

## Where the work lives
- **Branch (both repos):** `claude/wonderful-taussig-a3b871`
  - Frontend: `C:\vfo-react` — worktree `C:\vfo-react\.claude\worktrees\wonderful-taussig-a3b871`
  - Edge: `C:\vfo-edge-functions` — worktree `C:\vfo-edge-functions\.claude\worktrees\wonderful-taussig-a3b871`
- ⚠️ **Continue on THIS branch — do NOT branch fresh from `main`**, or you lose Phases 1–6 (not yet merged). Check out `claude/wonderful-taussig-a3b871` into worktrees in both repos.
- **Deploy state:** DB migration is **applied to live**; `vfo-admin-api` is **deployed live** with the 6 growth actions; **frontend is dev-only (NOT deployed)**. Nothing is merged.

## Files
**Frontend** (`vfo-react/src/components/growth/`)
- `constants.js` — all G1 questions (15, 3 sections), word→number maps (Q2/Q6), Q10 preference, the 20 default actions, category labels, `GP_STEPS`, and score math (`computeScores`, `sectionPercent`, `partnershipAverage` — **partnership avg is rounded** to match the legacy tool).
- `ui.jsx` — shared tokens + atoms (`cardStyle`, `accentStrip`, `pillSolid/Outline/Ghost`, `NumBadge`, `Radios`, `GrowthNeed`, `StepNav`). **Must be `.jsx`** (contains JSX).
- `AdminGrowthPlan.jsx` — container: loads the plan bundle (`growth_plan_load`), routes the `gp_*` sub-tabs, passes `{ memberNumber, memberName, bundle, reload, onNavigate }` down.
- `GrowthScoring.jsx` (G1), `GrowthActions.jsx` (G2), `GrowthPrioritize.jsx` (G3), `GrowthBuildPlan.jsx` (G4), `GrowthOnePage.jsx` (G5).

**Admin wiring** — `vfo-react/src/components/admin/MembersPanel.jsx`
- Growth Plan is a `FeatureTabDropdown` (7 items = `GP_STEPS`), rendered **only when `growthPlan` prop is true** (passed by `AdvisorsPanel`, not `AccountantsPanel`), positioned **immediately left of CIQ** (injected in the tab `.map` before the `ciq` key, via `Fragment`).
- Content render: `{growthPlan && memberFeatureTab.startsWith('gp_') && <AdminGrowthPlan member={selectedMember} activeStep={memberFeatureTab} onNavigate={...} />}`.

**Backend** (`vfo-edge-functions/supabase/functions/vfo-admin-api/actions/growth/`)
- `shared.ts` — `resolveMemberNumber(body, auth)` (member→own, admin→body.member_number) + `getCurrentScoreId`.
- `load.ts`, `load-history.ts`, `save-score.ts`, `save-summary.ts`, `save-actions.ts`, `save-accountability.ts`.
- Registered in `router/dispatch.ts` AUTH_HANDLERS (6 entries). **No role-gate list changes**: not in ADMIN_ONLY ⇒ members allowed; not in CLIENT/SPECIALIST allowlists ⇒ those denied by default.

## DB schema (live — migration `advisor_growth_plan_schema`)
- `growth_plan_scores` — id, member_number (FK→members.member_number, text), created_at, completed_at, section1/2/3_score, composite_score, section1/2/3_enabled (bool), raw_answers (jsonb), is_current (bool). One `is_current=true` per member; re-scoring archives prior.
- `growth_plan_actions` — id, member_number, score_id (FK), action_number (1–20), category, action_text, g2_status (`drop|park|potential`), g3_status (`drop|park|one_page_plan`), g3_action_type (`new|continuing`), g3_notes, owned_by, assisted_by, value_level (`high|medium|low`), effort_level, accountability_status (`not_started|progressing|ahead|behind|completed`), accountability_updated_at. UNIQUE(score_id, action_number).
- `growth_plan_partnerships` — id, score_id (FK), name, score, is_na.
- All RLS-enabled with deny-all (edge function uses service-role).

## Backend action contract (live)
- `growth_plan_load { member_number?, score_id? }` → `{ score, actions[], partnerships[] }` (current plan, or a specific archived `score_id`).
- `growth_plan_load_history { member_number? }` → `{ scores[] }` (is_current=false, newest first).
- `growth_plan_save_score {...score fields, raw_answers, partnerships[], actions[] }` → versioned create (archive prior, insert score + Q7 partnerships + 20 seed actions).
- `growth_plan_save_summary { section1/2/3_enabled, composite_score }` → updates current score's checkbox/composite.
- `growth_plan_save_actions { updates:[{id, action_text?, g2_status?, g3_status?, g3_action_type?, g3_notes?, owned_by?, assisted_by?, value_level?, effort_level? }] }` → bulk update current plan's actions (whitelisted + enum-validated).
- `growth_plan_save_accountability { updates:[{id, status}] }` → set accountability_status + accountability_updated_at on current plan.

## Conventions (MUST follow)
- **Match the Portal design vibe, NOT legacy screenshots** (navy `#002973`, blue `#125ecc`, sky `#0a85e8`, green `#1b9254`, page `#f4f7fd`; rounded white cards + navy→blue accent strips; Inter; TrackKit/StepKit). Legacy screenshots are functional/spec reference only.
- **Any file containing JSX must be `.jsx`** — the rollup production build errors on JSX in `.js` (the esbuild dev server is lenient, so it only shows up at `npx vite build`).
- **Verify before handing back:** `cd <react worktree>; npx vite build` (must end `✓ built in …`). Backend: `deno check --no-lock supabase/functions/vfo-admin-api/index.ts` (must be 0 errors).
- **Member key** = `members.member_number` (text) = `selectedMember.plugin_member_number` in the admin UI.
- **Scoping** is in-handler via `auth.callerRole` / `auth.callerMemberNumber`; clients/specialists are denied by default.
- Reads named `*_load*` retry on timeout (api.js); writes (`*_save_*`) do not — keep that naming.
- Dev server: `npm run dev` in the react worktree, **no `VITE_API_URL`** (hits live Supabase). If you rename a file, **restart** the dev server (Vite caches the old module graph).
- Deploys (`supabase functions deploy`, `npm run deploy`) need **explicit user approval** each time. Run SQL via the Supabase MCP.

## Decisions locked (do not re-litigate)
- Owned By / Assisted By = **free-text inputs** (not dropdowns).
- **No banner** on G5 (portal header + date only).
- Matrix gradient: **darkest top-right** (High Value/High Effort) → lightest bottom-left. Dots must always stand out (white now; bright status colors under accountability, each with a contrasting ring).
- **Ongoing items also appear on the matrix** (matrix shows all One-Page items; shared 1…N numbering cross-references both tables).
- Every "proceed" button is at the **bottom**; each linear stage has **← Back + forward** at the bottom (G1 first = no back; G5 last = no forward), and Back/Forward **save** before navigating.
- Assigned-admin list = **`allowed_admins`** (12 people; store the chosen `email` so notification `recipient = email` reaches their bell).

---

## REMAINING WORK

### Phase 7 — Accountability Mode
**Schema (new migration, additive):**
- `growth_plan_scores` += `accountability_mode` bool default false, `assigned_admin_email` text, `assigned_admin_name` text.
- `growth_plan_actions` += `due_date` date, `overdue_notified_at` timestamptz.

**Assigned admin (required before scoring):**
- G1 (`GrowthScoring.jsx`) gets a **required "Assigned Admin" dropdown** (populate from the admin list — reuse the existing admin-only `load_admins`, which returns `allowed_admins` name+email). **Block "Generate Score" until one is chosen.** Save `assigned_admin_email` + `assigned_admin_name` in `growth_plan_save_score`; backend returns 400 if missing.

**Access model (enforce server-side, in-handler):**
- `save_score`, `save_summary` → **admin only** (member → 403).
- `save_actions`, `save_accountability` → admin always; **member only if the current plan's `accountability_mode` is true** (else 403).
- New `growth_plan_set_accountability` (**admin only**): `{ enabled?, due_dates:[{id, due_date}] }` → sets the score's `accountability_mode` and/or per-action `due_date`.
- Member normally sees **only G5**; under accountability the member can edit G2–G5 priorities + set progress.

**G5 UI:**
- Admin: a natural **"Accountability Mode" toggle** on the One Page Plan; when on, a **date picker next to each priority** (writes `due_date`) + a **progress-status selector per row** in the New/Ongoing tables; **matrix dots recolor** by status (use bright status colors on the blue cells with a white ring so they stay legible).
- Member (Phase 8 portal): on their G5, the **per-row progress-status dropdown** is the main surface; matrix recolors to match.
- Status values + colors: Completed=`completed` (blue `#125ecc`), Ahead of Expectation=`ahead` (green `#1b9254`), Progressing on Plan=`progressing` (amber `#e06717`), Behind Expectations=`behind` (light red/pink), Not Started=`not_started` (red `#e74c3c`). (These keys already satisfy the column CHECK.)

**Notifications (FYI → assigned admin's bell; `notifications` table, `recipient = assigned_admin_email`, `dismissible=true`):**
- When the **member** updates progress (`save_accountability` with `callerRole==='member'`) → insert an FYI (on-time or late).
- When a priority is **past its `due_date` with no progress** → FYI. Time-triggered, so add a **daily cron** (a 6th `pg_cron` sweep): new PUBLIC service-role handler `automation_GROWTH_overdue_sweep` (mirror existing sweeps in `actions/pipeline/*-sweep.ts`); idempotent via `overdue_notified_at`. Install via a `supabase/cron/*.sql` file like the others.

### Edit history (audit log) — NEW requirement
- New table `growth_plan_history` — id, member_number, score_id, actor_role (`admin|member`), actor_name, event (e.g. `scored`, `actions_edited`, `prioritized`, `plan_built`, `accountability_on/off`, `progress_set`, `due_date_set`), detail (text or jsonb), created_at.
- Write a history row on **every** write handler (save_score / save_actions / save_summary / save_accountability / set_accountability).
- The **Growth History tab** renders this as a **dated list, newest first**, alongside the archived plan snapshots (from `growth_plan_load_history`).
- Actor name: admins via `allowed_admins.name` (look up by `auth.session.email`); members via their member name.

### Phase 8 — Parking Garage + Growth History + member portal
- **Parking Garage tab** — list actions where `g2_status='park'` OR `g3_status='park'` for the current plan; let admin **move back to Potential** (set `g2_status='potential'`, clear `g3_status`) or **permanently Drop**. (All via `growth_plan_save_actions`.)
- **Growth History tab** — archived plan snapshots (read-only view of each past score + its one-page plan via `growth_plan_load?score_id=`) **plus** the edit-history audit list (newest first).
- **Member portal** — `vfo-react/src/pages/MemberPortal.jsx` has a `growthplan` tab placeholder (currently `<ComingSoon>`). Wire a `MemberGrowthPlan` that: shows **only G5** by default (read-only); when `accountability_mode` is on, lets the member edit G2–G5 priorities + set progress on G5. Members are advisors only for now — gate by `member_category==='advisor'` if needed.

## Test fixture
- **Member 59524** (Test Member). Growth-plan data was cleared for a clean E2E run. After 7a, scoring will require an assigned admin first.
- Reset growth data anytime via MCP: `DELETE FROM growth_plan_scores WHERE member_number='59524';` (cascades to actions + partnerships).

## Verification gates before declaring a phase done
1. `npx vite build` clean (frontend) and/or `deno check --no-lock …/index.ts` = 0 (backend).
2. If you edited `router/dispatch.ts` / `middleware/auth.ts` / shared backend code → run `scripts/smoke-pipelines.ps1` (needs Jake's superadmin token).
3. Hand back a numbered click-through for the user to verify; don't commit/deploy until they confirm + approve.
