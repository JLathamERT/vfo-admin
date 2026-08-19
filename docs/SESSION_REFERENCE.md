# VFO SESSION REFERENCE

> **Read this file IN FULL at the start of every session. It is hard-capped at 250 lines so that stays possible — if an edit pushes it over, something must move out, not be squeezed.**
>
> **Volatile facts are DERIVED, never trusted from prose.** Versions, tags, counts, cron jobs and advisor state are produced by the command block below. A stamp like `(v: 2026-08-14)` means "last confirmed on that date" — it is a staleness hint, not authority. When prose and `git`/MCP disagree, **git and MCP win** (#376).
>
> History → [CHANGELOG.md](CHANGELOG.md) · full numbered gotcha registry → [GOTCHAS.md](GOTCHAS.md) (this hub keeps a curated always-applies subset) · per-area detail → the **DOC MAP** near the bottom. New gotchas increment from the max in GOTCHAS.md; never renumber.

---

## 🔒 SECURITY INVARIANTS *(check on EVERY DB or handler change — these must NOT regress)*

Non-negotiables from the 2026-06-18 security remediation. Re-check any time you add a table, policy, handler, or function — do not let a new feature quietly undo these:

1. **Every new public table = RLS deny-all + verify.** Create it with `enable row level security` + `create policy "Deny all access" … for all to public using (false)` in the SAME migration, then confirm with an anon-key probe (`curl --head -H "apikey:<anon>" -H "Authorization:Bearer <anon>" -H "Prefer:count=exact" "<base>/rest/v1/<table>?select=*"` → must be `Content-Range: */0`). The anon key is PUBLIC and `anon`/`authenticated` hold full table grants, so RLS is the ONLY thing protecting the DB. (gotcha #141)
2. **Every member-facing AUTH handler = caller-ownership check on `auth.callerMemberNumber`, NEVER a body id.** The edge fn runs as service-role (bypasses RLS), so a handler that reads/writes by a body `client_id`/`ciq_id`/`enrollment_id` without re-checking ownership is an IDOR. Reuse `utils/client-ownership.ts` (`denyIfNotOwnClient`/`denyIfNotOwnEnrollment`) + `actions/ciq/shared.ts denyIfNotOwnCiq`. Role-gates are deny-by-OMISSION + matched by EXACT action name. (gotcha #142) **The same principle extends to every deny-by-default portal role whose allowlist is broad:** a `tax_planner` caller (2026-07-22) skips the tab + ADMIN_ONLY gates, so every planner-callable tax handler MUST also carry an in-handler `denyIfNotPlannerClient`/`denyIfNotPlannerPlan` GROUP-scope guard (`utils/tax-planner-ownership.ts`) — the allowlist alone is not an ownership check (gotcha #257). **Deny-by-OMISSION cuts both ways — an action in NO gate list is UNGATED, not safe:** `vault_upload_url` minted signed writes into any `member-vault`/`member-tax-returns` folder off a body `member_number` while sitting in no list at all, until it was added to `MEMBER_SCOPED_ACTIONS` on 2026-07-30. Every signed-upload-URL minter must be provably covered by a **named** confinement — either grep `role-gates.ts` and name the gate (gotcha #309), or, for a PUBLIC token page, show that the destination bucket + path are derived **entirely server-side from the token row** and that the request body selects nothing (`vault_tax_upload_url`, and the 2026-07-30 `vault_request_upload_url` whose `vault_upload_tokens` row is its whole credential — gotcha #310). A minter with neither is a hole.
3. **Every new SECURITY DEFINER function = pin `search_path` + `REVOKE EXECUTE … FROM public`.** (gotcha #143)
4. **After ANY DB/table/policy/function change → run the Supabase security advisor (`get_advisors`, type `security`) and confirm it's GREEN** — this is the automated net that catches a regressed (anon-reachable) table before it ships. It is part of the VERIFICATION GATE below.

Full audit history + live-verified detail: the 2026-06-18 security-remediation entry in [CHANGELOG.md](CHANGELOG.md) + gotchas #141–#146.

---

## DERIVE AT SESSION START

Run these instead of believing any version/tag/count written anywhere. Expected values are stamped so you can spot drift; the command's answer always wins.

```powershell
# 1. Live function versions — MCP list_edge_functions { project_id: "ejpsprsmhpufwogbmxjv" }
#    Expect: vfo-admin-api ACTIVE + boldsign-webhook ACTIVE, verify_jwt=false on BOTH.
#    Plus helper draft-agreement-pdfs v1 (no business logic). (v: 2026-08-19 — v761 / v40)

# 2. Deploy tags — git is the source of truth, these lines are not (#222, #376).
#    Re-stamp these THREE lines AFTER wrap-up Part 4D, not during Part 1: the
#    version and tag do not exist yet when the hub is written (#408).
cd C:\vfo-react;          git tag -l 'live-*'         --sort=v:refname | Select-Object -Last 1   # (v: 2026-08-19 → live-155-bell-hygiene)
cd C:\vfo-edge-functions; git tag -l 'backend-good-*' --sort=v:refname | Select-Object -Last 1   # (v: 2026-08-19 → backend-good-2026-08-19-v760)

# 3. Action-count parity — the ANCHORED patterns are required; a raw unanchored
#    grep on index.ts returns 7 (the 7th is a comment on line 3). (v: 2026-08-19 → 6 + 458 = 464)
cd C:\vfo-edge-functions   # or the worktree
$logins   = (Select-String -Path supabase/functions/vfo-admin-api/index.ts          -Pattern '^\s*if \(action === '            -AllMatches).Matches.Count
$dispatch = (Select-String -Path supabase/functions/vfo-admin-api/router/dispatch.ts -Pattern '^\s*"([a-zA-Z0-9_]+)":\s*\(c\)'  -AllMatches).Matches.Count
"action count: $($logins + $dispatch)"

# 4. Type-check baseline — must be 0; --no-lock avoids the v5 deno.lock the bundler rejects (#112)
& C:\Users\jakel_fjetgbx\.deno\bin\deno.exe check --no-lock supabase/functions/vfo-admin-api/index.ts

# 5. Frontend build — expect exit 0. (v: 2026-08-19 → 33 route pages)
cd C:\vfo-react; npm run build

# 6. Pipeline smoke gate — hand it to Jake in EXACTLY this form (literal <password>, never a token, never Read-Host)
& C:\vfo-edge-functions\scripts\smoke-pipelines.ps1 -Email "jlatham@elitert.com" -Passcode "<password>"
```

```sql
-- 7. Cron inventory (MCP execute_sql).  (v: 2026-08-17 → 15 jobs, all active)
select jobname, schedule from cron.job order by jobid;
-- 8. Sandbox posture — every row should read false.  (v: 2026-08-17 → all 8 pipelines LIVE)
select pipeline, sandbox_mode from pipeline_sandbox_config order by pipeline;
```

**9. Security advisor** — MCP `get_advisors { project_id: "ejpsprsmhpufwogbmxjv", type: "security" }`. **GREEN baseline = deny-all `rls_enabled_no_policy` INFO ×5 + the `pg_net` `extension_in_public` WARN, and nothing else.** Any `rls_disabled_in_public` / `sensitive_columns_exposed` ERROR or `rls_policy_always_true` WARN = a table regressed to anon-reachable → STOP. *(v: 2026-08-19 — exact baseline re-confirmed, unchanged)*

---

## LIVE STATE — non-derivable only

Nothing here can be produced by a command. Everything else was deleted from this section on purpose — derive it above.

**OPEN / OWED**
- **Test Client 62 fixtures — RE-DERIVED 2026-08-19 after the ROI-notes session; the "0 plans" state is GONE and that is deliberate.** SQL now returns **plan 148** (program 4, `live`, created `15:39Z`) plus **FIVE `client_tax_progress` rows** (ids 1042–1046, tasks 119/177/116/117/123, all dated today) — the fixture this session's deck testing needed, left in place rather than wiped. **FIVE notifications, and only two are fixtures:** 1347/1348 *"Test Client hasn't set up their payment method"* (cron-minted `04:00Z`, 1347 **still unread**) again prove a live sweep re-mints on this client after any wipe, so "clean" here means *no plan rows*, never *no bells*; 1359/1360 are the vault-drop test bells (both read); and **1361 *"Download the ROI presentation for Test Client"*** (`dismissible:false`, **UNREAD**) was minted by this session's assess-form save and clears on download. **Owed by hand:** the Drive *"ROI Presentations"* decks — the **TEN** carried from 2026-08-17/18 **plus at least THREE more** generated on plan 148 today, one per template stage (every regenerate creates a NEW Drive file and only the newest is in `generated_presentation_url`, stamped `15:51:13Z`), **unless hand-deleted since**; and the test file **`client-tax-returns/62/340ccd1c5f481b5c_ERT_Zoom_Background.png`** (the **Sensitive Documents** vault), **confirmed still present** by a bucket listing and deletable only through the **UI/Storage API** — SQL cannot touch it (#206). Newly observed alongside it: two test agreements at `client-ert-docs/62/*_VFO-Tax-Agreement-Test-Client.pdf`. *(v: 2026-08-19)*
- **Two untested paths from the 2026-08-18 two-year ROI branch:** the generator's 400 on a **hand-corrupted `year2` group** (*"Re-save the Assess form — the Year 2 totals are incomplete"*) and the **notes 5000-character cap**. Both are code-reviewed with their FE mirrors in place; neither has been exercised. Everything else on that branch — single-year save + 27-slide deck, two-year save + 29-slide deck, and the Add-Year-2 **toggle-off round trip** (group dropped from storage, notes survived, 27-slide regen) — was owner-tested against v759. *(v: 2026-08-18)*
- **Two untested paths from the 2026-08-19 ROI-titles / planner-notes branch (v761, template v5).** (a) The **EMPTY-notes live path** — an assess form carrying no `notes` should leave slide 23's speaker-notes paragraph as one empty invisible run with **no *"TAX PLANNER NOTES:"* label**; that is the ordinary code path, not a branch, but it was only ever simulated. (b) A **TWO-YEAR (29-slide) deck against template v5** — v5 touched slides 7–13 and one notes part and nothing else, so slides 24/28/29 and the whole drop block are provably unchanged from v4, but no two-year deck has been generated since the bump. What WAS exercised live: a **single-year** deck on plan 148 with a **two-line** note, regenerated and `/export/pptx`-verified after **each of the three template stages** (8 slides reading *"VFO Tax Planning Process"*, zero *"Proactive Planning"*, 27 slides, no leftover tokens), and the pipeline smoke gate at **5/5 PASS against v761**. *(v: 2026-08-19)*
- **The 2026-08-19 bells branch shipped with THREE things unexercised, and the CHANGELOG's "live-tested" covers less than it sounds.** (1) **Assigned-PF tax-vault VIEW was never seen on a real PF session** — the widened `canViewClientTaxVault` read path and the `can_view`/`can_manage` split in `ClientVaultTab.jsx` were verified by code review + a DB mapping only; **Evan is owed an eyeball**, and until then nobody has confirmed a PF sees View without Add/Delete/Share. (2) **Only ONE of the seven stall-clear pipelines was actually clicked** — MAP 1 `c14` (dual-clear of the stall bell + the month-old `dismissible:false` extra-meeting bell) plus the PFT discovery checkbox's render/persist. **TAX** (incl. the `(tax)` extra-meeting coupling and the `&program=<id>` narrow), **advisor/accountant** (stage-matched coupling + the `onboarding=<id>` link scope), **specialist** and **regular** are all code-only — and regular has **no live target rows at all** to click. (3) The **refire guards are unverified**: `.is("<stall>_pf_ack_at", null)` was added to all 7 sweeps but no cron has run since — **check tomorrow that no bell was re-minted over a ticked ack**. *(v: 2026-08-19)*
- **Flagged, not built (2026-08-19):** `actions/pft/meeting-email.ts:~90` **nulls `discovery_pf_notified_at` on a non-reschedule send**, so the PF-notified paper-trail row and its ack disappear on a plain resend; the new sweep guard stops the *re-mint* over an ack but the null-out itself is untouched. Separately, `advisor/extra-meeting.ts` + `accountant/extra-meeting.ts` still match bells on an **un-anchored `'%onboarding=<id>%'`** link (the 5-vs-51 collision class) — pre-existing, deliberately NOT fixed while the neighbouring stall-ack clear was END-anchored, so the two now disagree in the same area. *(v: 2026-08-19)*
- **The Outstanding Payment Links "Resend email" buttons have still never been clicked by anyone** — shipped 2026-08-04, live since, zero human exercise. *(v: 2026-08-14)*
- **Aug 6 specialist payouts fired twice (~$1,382).** Legacy platform is still live on the same Stripe account and still reacts to migrated clients' payments (#361). Reconciliation not closed. *(v: 2026-08-14 — UNVERIFIED, carried from prior doc; not re-checked against Stripe this session)*
- **`NOTIFICATION_AUDIT.md` needs REGENERATION, not patching** — ~57 live rules (a third) have no entry and five whole areas are missing, incl. Tax Planners (16). It carries a live per-area table and a derive-don't-count caveat, so it is honest but incomplete. Per-area table re-derived 2026-08-17. *(v: 2026-08-17)*
- **Flagged, not built:** a `payout_status` column on `specialist_revenue_recurring_lines` (the one Accounting panel that cannot be annotated) and persisting `pip_rev_share_status`'s richer `revPaidValue`. *(v: 2026-08-14 — column confirmed still absent via `information_schema`)*
- **Flagged, not built (2026-08-16):** `actions/tax/decision.ts` writes `tax_decision` unconditionally, so re-submitting the Tax 3 decision as **No** on a plan whose retainer is already paid would strand that plan's live action-required bells with no clear site left. Still unguarded — **neither** 2026-08-17 edit to that file is the fix (one is a `meeting_first`-only presentation check, the other the new `status='stopped'` write on **No**, which stops the plan but clears nothing). No click-path found that reaches it accidentally. *(v: 2026-08-17)*
- **Flagged, not built (2026-08-17):** **13 tax plans carry `tax4_meeting_date` with no `tax4_meeting_confirm_email_sent_at`** and so render a BLANK completion date on that step (deliberate — blank beats a wrong date, #406). They were dated through **`automation_TAX_save_meeting_date`, which is dispatched and role-gated but has ZERO frontend callers** — apparent dead code, left in place. Either backfilling the stamps or retiring the action needs a decision. *(v: 2026-08-17)*
- **Three UNTESTED items from the 2026-08-17 ROI-skip branch, still unexercised** — they were carried on a handoff block, and reached `main` with no landing place until #238 gave rule 5 one: (1) the **`retainer_first` skip route was click-tested BEFORE** the later `save-task` / `invoice-receipt` / `revshare-sweep` / `confirmation-email` edits landed, so that route has no post-change run; (2) the **decline path on a `meeting_first` plan** was never walked; (3) the **`meeting_first` positional reorder is STILL unviewed, and no longer for want of looking** — Client Overview's tax tab was click-tested hard on 2026-08-18 across dozens of live plans, but the reorder fires only on a `meeting_first` plan and **there is no LIVE one**; the only such plan, test-client 62's plan 145, is `stopped` and renders `closed`, and a closed track emits no ordering at all. Discharging this needs a `meeting_first` plan mid-flight, not more Client Overview time. The code sits in `utils/tax-plan-steps.ts` (moved VERBATIM out of `overview-tax.ts` 2026-08-17); 2026-08-18 broadened `yesPath` beside it without touching the reorder. The CHANGELOG's "click-tested end to end, 9/9 bells" covers `meeting_first` only. *(v: 2026-08-18)*
- **The Client Overview redesign (2026-08-18) shipped with three surfaces unexercised.** (1) **Regular Priorities and PFT were never click-tested past the column change** — MAP 1 and the merged Tax Planning tab were, twice; the other two pills were only confirmed to render. (2) The **MAP 5 - Implementation `groupLabel` collapse was NOT in the last backend deploy of that session** — it is the one edit that shipped to git ahead of the runtime, so Regular's next-action column cannot be judged until the pending deploy lands (derive the live version, do not trust a number written here). (3) The **closed-state restyle** (red dot + `closed_reason`) was only ever seen through a hot reload, never confirmed aloud. *(v: 2026-08-18)*
- **`client_overview_warnings` is now an ORPHANED grant — decision owed, not a bug yet.** The 2026-08-18 redesign deleted the whole warnings UI from `ClientOverviewPanel.jsx`, so nothing reads the flag; the backend still COMPUTES `warnings` per track and still ships them in the payload, and the grant still exists in both places (`constants/role-gates.ts` `TAB_ACTIONS.client_overview_warnings: []` and the `AdminEditor.jsx` `TAB_OPTIONS` checkbox, which grants a capability no surface exposes). Either retire all three together or keep the flag deliberately as the re-entry point for a future warnings view — **do not remove only the checkbox**, which would leave granted admins with a stored tab nobody can regrant. *(v: 2026-08-18)*
- **Known-unbuilt, each with a live consequence:** #327 webhook event-id dedupe (only the MAP 1 P2–P4 branch is latched; every other branch is exposed) · #333 an `auto_renew`-off membership plan **lapses DARK** · #335 force-overwriting an ORGANIC MAP 1 row leaves stale `rec{i}_strat_paid` (a stale `'Yes'` suppresses a real payout) · #318 every "connected" pill except the member-profile dot still infers from `stripe_account_id` presence (known false-green). *(v: 2026-08-14)*

**WATCH**
- **Steve Bitzer's Sep 4 installment** — the first real strategic-continuation payout. `rec2_strat_paid` should flip to `'Yes'` with a **$135** transfer and a partner rev-share draft to the Action Coach contact. If it does not, #335 is the place to look. *(v: 2026-08-14)*

**PARKED — do not "fix" without re-approval**
- **#384 — MAP 1 and Tax agreement signature DATES.** Both pipelines write bare `'Yes'` flags; the `*_at` columns are stamped only on the advisor/accountant branches, and Tax's `client_signed_at`/`ceo_signed_at` are dead columns (0 rows, no writer). Dating them requires a `boldsign-webhook` change, which needs explicit approval. **Raised and PARKED by the user 2026-08-12.** Never synthesise a date from `updated_at`. *(v: 2026-08-14)*

**STANDING**
- **Test-member `59524` is force-flipped to sandbox** in every client-scoped TAX / MAP 1 / PIP money, email and BoldSign handler via `loadSandboxConfigForClient` — force-ON only, fail-safe (#251). Constant: `constants/test-sandbox.ts`. **Membership is NOT covered** (it is member-keyed, not client-keyed) — testing a membership plan on 59524 means flipping the panel toggle by hand, and forgetting means a real charge. *(v: 2026-08-14)*
- **`"Test Group"` in `constants/vault-assess-groups.ts` is a PERMANENT fixture**, not a leftover — it keeps the ICG vault-assess path exercisable with the test planner login (#400). *(v: 2026-08-14)*

**ACCESS LISTS — read the code, never a list of names here.** `isTaxAdmin` / `TAX_VIEWERS` → `constants/tax-access.ts` · `isErtManager` / `ERT_MANAGERS` → `constants/ert-access.ts` (**deliberately a separate list — widening TAX_VIEWERS must not widen ERT**) · the two-human add-member gate → `src/components/admin/MembersPanel.jsx` `canAddMembers` (frontend-only, #353) · sales-team names → `constants/onboarding-team.ts`. Code is authoritative; these lists change without a doc edit.

---

## SYSTEM MAP

- **Frontend** `vfo-react` — `github.com/JLathamERT/vfo-portal`, local `C:\vfo-react`, live **https://vfoportal.com/**. Vite + React 18 + react-router-dom v6, `gh-pages` deploy. No backend code, no tests, no CI.
- **Backend** `vfo-edge-functions` — `github.com/JLathamERT/vfo-edge-functions`, local `C:\vfo-edge-functions`. Deno 2 / Supabase Edge Runtime.
- **Supabase** project `ejpsprsmhpufwogbmxjv` ("VFO Showroom"), us-east-2, Postgres 17.
- **`vfo-admin-api`** — `index.ts` orchestrator + ~470 modular handler files in `actions/<group>/*.ts` + `router/dispatch.ts` + `router/webhooks.ts` + `middleware/auth.ts` + `utils/` + `constants/` + `integrations/`. Serves all 464 actions. *(v: 2026-08-19)*
- **`boldsign-webhook`** — standalone. **Deploy with `--no-verify-jwt` (mandatory)** and **only with explicit approval** (#10, #180).
- **Helper functions** — `draft-agreement-pdfs` (v1, on-demand Gmail drafts, no business logic). `boldsign-template-fields` **is GONE** — deleted without a doc update; re-deploy a throwaway if you need template-field coordinates. *(v: 2026-08-14)*
- **Key entry points** — `index.ts` (logins) · `router/dispatch.ts` (PUBLIC_HANDLERS + AUTH_HANDLERS) · `router/webhooks.ts` (Stripe + BoldSign by shape) · `middleware/auth.ts` (six login types, role precedence) · `constants/role-gates.ts` (every gate list) · `utils/notify.ts` (all bells + the business-day helpers).
- **Storage buckets** — documented in [integrations/supabase.md](integrations/supabase.md); per-bucket prose preserved in [CHANGELOG.md](CHANGELOG.md) under the 2026-08-14 restructure heading. **Public:** `tax-agreements`, `map1-agreements`, `map1-assets`, `advisor-onboarding-agreements`, `accountant-onboarding-agreements`, `specialist-onboarding-assets`, `vfo-widget`, `headshots`. **Private:** `specialist-dd-materials`, `client-tax-returns`, `client-documents`, `specialist-documents`, `specialist-tax-returns`, `member-vault`, `member-tax-returns`, `tax-planner-documents`, `member-ert-docs`, `client-ert-docs`, `specialist-ert-docs`, `presentation-templates`. *(v: 2026-08-14)*
- **NOT in the system:** no automated tests, no test runner, no CI/CD on either repo, no frontend TypeScript, no Supabase Auth (custom session tokens over `admin_sessions`, six login types / five portals, salted PBKDF2-HMAC-SHA256), no React Context (just a promise cache in `src/lib/api.js`), no structured logging (frontend errors go to Sentry only). **Email is Gmail DRAFTS by default** — only eleven `email_templates` rows have `send_mode=true` (#325). Full prose → [CHANGELOG.md](CHANGELOG.md).
- **Architecture docs live in `vfo-react/docs/`** — in the *frontend* repo, documenting the backend.

---

## CURATED ALWAYS-APPLIES GOTCHAS

Money, auth/security, data-loss and cross-repo contracts only. **Everything narrower still lives in full in [GOTCHAS.md](GOTCHAS.md)** — nothing was deleted, and a `see #N` resolves there. When working an area, grep GOTCHAS.md for that area's keyword.

**Deploy / cross-repo**
- **#337 / #288** — a worktree can be cut from stale local main **and the freshness check can return a false 0**; run `git fetch origin && git rev-list --count HEAD..origin/main` → must be **0**, immediately before EVERY deploy, in the SAME invocation — and that invocation must `cd` **explicitly**, because the tool shell's cwd PERSISTS across calls and silently lands a repo-specific command in the other repo (#419). A stale edge worktree DEPLOYS REVERTED CODE over live.
- **#376** — derive deploy state from git tags + MCP FIRST, then read docs; when they disagree git wins. Runs in BOTH directions — a "still owed" claim needs the same proof as a "done" claim.
- **#145** — production deploys need an EXPLICIT "deploy"; "continue"/"yes" are not approval. **#36** — `docs/` exist in main AND every worktree; only ever edit the worktree copy.
- **#196** — every migration applied via MCP `apply_migration` MUST also be committed as a file, or a rebuilt environment silently lacks it. **#223** — multi-statement `execute_sql` returns only the LAST result.
- **#10** — `boldsign-webhook` deploys need `--no-verify-jwt` every time. **#74/#112** — use `deno check --no-lock`; a v5 `deno.lock` breaks the bundler. **#134** — one angle bracket of JSX makes it a `.jsx` file, or the rollup build fails.
- **#401 / #402** — this hub is hard-capped at 250 lines and DERIVES volatile facts; every edit is declared ADD/UPDATE/DELETE/NOOP and superseded values move to CHANGELOG the same pass. **Never write a COUNT into prose** (rules, tables, columns, buckets) — write the query; a file contradicting itself on a quantity means nobody has read it end to end.
- **#399** — when a doc and a code comment disagree about sweep behaviour, the **handler wins**; deleting a timed automation means grepping the docs tree for its interval AND vocabulary (`24h`, `auto-lock`, `auto-charge`) in the same commit.
- **#410** — a generated artifact (a Drive deck, a bucket object) is **shared-writable and may have been hand-edited since**, so it is never evidence of what the code emits: generate a fresh one or read the handler. Two agreeing samples from one sitting are ONE event — the code wins until three disagree with it.

**Auth / security**
- **#141 / #142 / #143** — see the SECURITY INVARIANTS box above; they are the same four rules.
- **#309** — every `*_upload_url` signed-URL minter must be provably covered by a NAMED gate; "in no gate list" means UNGATED, not safe. **#310** — for a PUBLIC token page the token ROW is the whole credential: bucket + path derive server-side, the body selects nothing, ever.
- **#257** — `TAX_PLANNER_ALLOWED_ACTIONS` is the ONLY boundary for a planner caller, so every planner-callable action ALSO needs an in-handler group-scope guard; the entire token-forwarding chain closure must be allowlisted + guarded.
- **#385** — an allowlist entry is NOT the grant: **before widening any allowlist, grep the target handler for a second in-handler gate** (`isTaxAdmin`, `isSuperadmin`, a bare email compare). Inverse of #309.
- **#256** — a gate entry matching no dispatched action protects nothing; grep `dispatch.ts` for the EXACT registered name. **#167** — a new action behind a tab-gated surface must join `TAB_ACTIONS[...]` or granted admins 403.
- **#338** — the `accounting` grant is the WHOLE boundary for every control in the tab, money included; do NOT restore an in-handler superadmin check. **#353** — the add-member restriction is FRONTEND-ONLY: a guardrail, not a boundary.
- **#355** — `request_password_reset` is anti-enumeration by construction (always `{success:true}`, 1200 ms floor, throttle counts every request); never add a distinguishing branch or widen the response. **#144** — new login-type actions must join `LOGIN_ACTIONS`. **#259** — a new restricted role that allowlists the bell must scope BOTH load and mark-read to email, or admin broadcasts leak.
- **#11** — a handler chaining another AUTH handler must forward `body.token`, not just the header.

**Money**
- **#252** — a revshare `share` is ALWAYS dollars of the TOTAL engagement; portion = `(share / totalGross) × paymentReceived`. Payout and display must use the same math.
- **#394** — the three legs are NOT prorated alike: MEMBER pays its entered share in full, STRATEGIC is gross-prorated, VFOS is the RESIDUAL. **Copy `contract-revshare.ts`; never re-derive from column names.**
- **#304** — `member_contribution` is a member-funded DISCOUNT and Member Share is entered ALREADY NET of it — never subtract or scale it again.
- **#303** — NEVER initialise a payout-leg status to a TERMINAL value with the transfer behind a condition; use an exhaustive branch chain, and a non-terminal status is safe only if EVERY retry path accepts it.
- **#377** — `"Pending"` is a POST-TRIGGER value the sweep RETRIES; a backfill must write **NULL** for a leg that has not been triggered. **#380** — when a guard stops short-circuiting, re-audit every sibling leg's terminal check.
- **#265** — a stranded-leg rescue must verify the UPSTREAM leg resolved first. **#277** — a backfill of an already-collected payment MUST settle every leg its sweep can rescue. **#362** — a pre-settled leg is skipped FOREVER; check Stripe Transfers before assuming either way.
- **#335** — Payment Continuation is a SECOND write path into `pipeline_map1`/`client_tax_plans` and must carry the strategic split; a missing one is INVISIBLE (NULL reads as "no partner", nothing reports it).
- **#398** — the Tax 5 implementation fee fires from exactly ONE call site (the client's own click); nothing may ever chain `automation_TAX_charge_implementation` from a sweep. `'Auto-Locked'` has zero writers system-wide.
- **#327** — Stripe REDELIVERS a webhook whose 200 we were too slow to return and there is NO event-id dedupe; name the column that proves a side effect already happened and check it first. **#228** — off-session idempotency keys must be LOGICAL/date-less. **#15** — rotate keys per RETRY, never per logical charge.
- **#287** — purchase-email policy: card = receipt only, ACH = confirmation + docs at settle, check = both at clear. Gate PLACEMENT is load-bearing.
- **#282** — `allocateDocNumber` returns its candidate even when the reservation INSERT fails; verify the reservation landed or you issue duplicate accounting numbers. **#315** — a multi-period collection must change a row's AMOUNT, never the row COUNT.
- **#159 / #317 / #268** — verify `capabilities.transfers === 'active'` before a Connect transfer; every account link must append `collection_options[fields]=eventually_due` (else a silent $3,000 cap); never email a raw `connect.stripe.com` link — use the durable `/payout-setup?token=` page.
- **#396 / #397** — reminder ladders count BUSINESS days via `businessDelayCutoffIso`; it walks whole weekdays FIRST then subtracts fractional hours, and **a bigger `days` must always yield an earlier-or-equal cutoff**. The calendar survivors are deliberate — see [architecture/07-server-chains.md](architecture/07-server-chains.md).

**Data loss**
- **#206** — Supabase blocks direct SQL `DELETE FROM storage.objects`; delete vault files through the Storage API. **#305** — `client_tax_progress.tax_specialist_id` is FK ON DELETE SET NULL and NULL means PLAN-LEVEL, so a naive specialist delete orphans progress rows and corrupts plan state.
- **#187** — ALWAYS destructure `{ data, error }` in webhook/automation code; otherwise a real DB failure is indistinguishable from "no rows" and fails 100% silently. **#215** — multi-row inserts fill missing keys with NULL, not the column default.
- **#188** — a sudden 42703 on an established column is a PostgREST schema-cache split; route that write through a SECURITY DEFINER RPC.

**Cross-repo contracts**
- **#339** — the tax step machine (now `utils/tax-plan-steps.ts`, called by `overview-tax.ts` AND the planner portal) is the BACKEND MIRROR of the FE `isTaskStatused`; add both branches in the same change, and remember `computeTrack` is POSITIONAL — warnings, `next_action` and `next_actions` are all a function of ORDER.
- **#414** — a plan MIGRATED from the legacy system never got its branch column backfilled, so a step machine that keys a whole branch on that one column points every migrated row weeks into the past. **Prove a branch by the columns that branch itself writes** (agreement sent / signed / paid / decided), not by the decision field alone — and check for legacy rows before trusting any single-column branch test.
- **#403** — a **terminal/negative** outcome can SATISFY a "cascade complete" predicate, so `locked: !cascadeDone` unlocks exactly the closed records. Test the decline/refund/stop state FIRST, and back the UI lock with a handler 400 — the lock alone is choreography (#353).
- **#404** — re-invoking a confirmation-email handler to RESEND re-arms every reminder ladder it stamps. A reschedule must pass an explicit `reschedule` flag and every ladder-arming side effect must sit behind `!reschedule`; the failure is silent (a chase restarts on a form the recipient already has).
- **#365 / #179** — an action-required bell (`dismissible:false`) is a CONTRACT: a clear site for every satisfying path, a satisfied-on-fire guard, and a title nobody edits. Only the completing handler can clear it. **#176** — every bell goes through `notifyByRule` + a `notification_rules` seed. **#313** — one event serving two audiences needs TWO rule keys.
- **#324 / #413** — a recipient ROLE TOKEN does NOTHING unless the HANDLER passes it (in template ctx, or in `notifyByRule`'s `dynamic` map), and it is dropped SILENTLY. **To know who receives a templated email or a bell, read the HANDLER — the template row and `notification_rules.default_recipients` are documentation, not routing.** A rule's `recipients` override wins only when non-empty AND resolvable, else the code default; the fallback direction is safe, keep it.
- **#411** — a bell's TITLE is the clear contract, so its RECIPIENT is FREE: re-address a live action-required bell by moving `defaultRecipients` and **leave the title (and the rule KEY) alone even when it now names the wrong role**. The clear site matches title-prefix + client_id and never reads recipient, so it retires both vintages with no cutover window.
- **#356** — a template's Draft/Send mode is keyed by `(pipeline, template_name)` in TWO places per consumer; a mismatch looks exactly like a deliberately-Draft row and the mail sits in Drafts forever with no error. **#325** — exactly ELEVEN rows are `send_mode=true`; editing one reaches a real person with nobody in between.
- **#382 / #392 / #323** — a user-visible LABEL can be a lookup key, a DISPLAYED name can diverge from the STORED name, and a task NAME can be exact-matched across both repos with no compile-time protection. Grep both repos before renaming anything.
- **#342** — an external asset the code reads BY NAME is coupled to the deploy: content-only assets hot-swap, structure-bearing ones need a NEW versioned name + a lockstep deploy, uploaded FIRST. **Diff against the object the LIVE FUNCTION READS, never against your build artifact** — 2026-08-18's template v4 was byte-identical to a backup already in the bucket and still needed a new version, because relative to the hot-swapped live object it restored a token SITE (#336).
- **#406** — a "completed on" cell fed by a scheduling field (`_send_date`, `_meeting_date`) displays a FUTURE date and reads as fact, not bug; a step whose work is *scheduling* dates from when it was scheduled and must not move later. Fix the FE and its `overview-tax.ts` mirror in the SAME change — they disagree silently, both dates being plausible.
- **#407** — two asks answered at DIFFERENT times need DIFFERENT bell titles (one prefix = one clear contract); two keys may share a title only when the instruction is identical. To add a second ordering to a one-way flag, put a DISCRIMINATOR beside it (NULL = original) so everything keyed on the flag stays route-blind.

---

## DOC MAP — read before you touch

| Touching… | Read first |
|---|---|
| **Any handler that chains another handler**, any Stripe/BoldSign webhook branch, any sweep tier | [architecture/07-server-chains.md](architecture/07-server-chains.md) |
| Backend file layout, adding a handler | [architecture/03-edge-functions.md](architecture/03-edge-functions.md) |
| "Which action lives where?" | [architecture/05-api-action-catalog.md](architecture/05-api-action-catalog.md) |
| Overall shape, crons, data flow | [architecture/01-system-map.md](architecture/01-system-map.md) |
| Routes, pages, components, loading UX | [architecture/02-frontend-shell.md](architecture/02-frontend-shell.md) |
| Logins, sessions, roles, gates | [architecture/04-auth-and-sessions.md](architecture/04-auth-and-sessions.md) |
| `api.js`, orchestration, caching, timeouts | [architecture/06-orchestration-files.md](architecture/06-orchestration-files.md) |
| Tax pipeline (**any** step) | [flows/tax-planning.md](flows/tax-planning.md) |
| MAP 1 / Holistic contract or payment | [flows/contract-and-payment.md](flows/contract-and-payment.md) · [flows/stripe-webhook.md](flows/stripe-webhook.md) |
| Agreement signing, countersign | [flows/boldsign-webhook.md](flows/boldsign-webhook.md) · [integrations/boldsign.md](integrations/boldsign.md) |
| Specialist onboarding or SpecRev | [flows/specialist-onboarding.md](flows/specialist-onboarding.md) |
| Advisor / accountant onboarding, PFT | [flows/partnership-fast-track.md](flows/partnership-fast-track.md) |
| Membership fees, renewals, pauses | [flows/membership-fees.md](flows/membership-fees.md) · [flows/coaching-renewals.md](flows/coaching-renewals.md) |
| PIP Meetings | [flows/pip-meetings.md](flows/pip-meetings.md) |
| CIQ | [flows/ciq.md](flows/ciq.md) · [tables/ciq.md](tables/ciq.md) |
| 90 Day Plan / training tracks | [flows/msm-tracking.md](flows/msm-tracking.md) |
| Growth Credits | [flows/gift-credits.md](flows/gift-credits.md) · [tables/marketplace-gc.md](tables/marketplace-gc.md) |
| Card/bank updates, Payment Continuation | [flows/payment-method-change.md](flows/payment-method-change.md) |
| Bells, rules, recipients | [flows/notifications.md](flows/notifications.md) · [tables/notifications.md](tables/notifications.md) · [NOTIFICATION_AUDIT.md](NOTIFICATION_AUDIT.md) |
| Schema for a domain | `tables/` — `tax` · `pipeline` · `clients` · `members` · `membership-fees` · `specialists` · `programs` · `coaching` · `growth` · `documents` · `auth` · `ciq` · `marketplace-gc` · `notifications` |
| Stripe, Gmail, Drive, Sheets, Sentry, Supabase, env vars | `integrations/` — one file each |
| **History / how something got this way** | [CHANGELOG.md](CHANGELOG.md) |
| **A trap in area X** | grep [GOTCHAS.md](GOTCHAS.md) for the area keyword |
| A term you don't recognise | [glossary.md](glossary.md) |

**Treat docs as source of truth for architecture, then verify against code before changing anything** — docs drift on details, and when prose and a handler disagree, the handler wins (#399).

---

## VERIFICATION GATE + ENVIRONMENT

Commands live in **DERIVE AT SESSION START** above — this is only *when* each applies.

| Gate | Run it after | Pass |
|---|---|---|
| `deno check --no-lock` | any non-trivial backend change | **0 errors**; any error = fail |
| Action-count parity | any change near `dispatch.ts` / `index.ts` | matches your own pre-change count |
| `npm run build` | any `src/` change | exit 0 |
| Security advisor | **ANY** DB / table / policy / function change | the documented baseline exactly |
| 5-pipeline smoke gate | any `vfo-admin-api` deploy, or editing shared routing/dispatch/webhook/auth code | 5/5 PASS. Run as **superadmin** (Jake) — the five loaders are `SUPERADMIN_ONLY_ACTIONS`, so any other token reads as a false failure. Wiring check only: it asserts HTTP 200 + no `error`, and proves **nothing** about chain semantics, money math or bells. Skip for frontend-only, doc-only or isolated single-handler changes. |
| Live click-through | anything behavioural | the only gate that sees a bell, a stamp or an email fork — none of the above do |

**Environment** (Windows + PowerShell; full prose incl. every PowerShell trap → [CHANGELOG.md](CHANGELOG.md), 2026-08-14 restructure heading)
- Deno (not on PATH): `C:\Users\jakel_fjetgbx\.deno\bin\deno.exe` · Supabase CLI: `C:\Users\jakel_fjetgbx\scoop\shims\supabase.exe`
- Frontend dev against the REAL backend: `cd C:\vfo-react\.claude\worktrees\<branch>; npm run dev` — **no `VITE_API_URL` override**, never `supabase start`, and `dev@local.test` is a local-only fake that must not be offered.
- Deploys (each needs explicit approval): `supabase functions deploy vfo-admin-api` · `supabase functions deploy boldsign-webhook --no-verify-jwt` · `npm run deploy` (**this IS production** — vite build + gh-pages).
- **Bash is not on PATH; PowerShell has no `tail`; `sort -V` is NOT version-aware** (use `--sort=v:refname`, #222); `Set-Content`/`Out-File -Encoding utf8` write a **BOM** that leaks into commit subjects — prefer the Edit tool, or `[System.IO.File]::WriteAllText($f,$c,(New-Object System.Text.UTF8Encoding $false))`. `gh` is NOT installed.
