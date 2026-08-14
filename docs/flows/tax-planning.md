# Tax Planning flow (client_tax_plans)

The master flow for tax planning engagements. Originally built as the **Tax Priorities** track inside VFO Holistic Planning (program_id=1); since aligned to serve the standalone **VFO Tax Planning** program (program_id=4) byte-equivalently — same handlers, same DB shape, same chains. The only intentional difference is the **Set Up phase** that program_id=4 plans see at the top (program_id=1 plans skip it because Holistic clients arrive via MAP1 instead). Parallel to [contract-and-payment.md](contract-and-payment.md) (MAP1) but operating on `client_tax_plans` rows. Touches every integration: Stripe, BoldSign, Gmail, Google Drive, Supabase Storage.

The state machine is the column values on a single `client_tax_plans` row — see [../tables/tax.md](../tables/tax.md). Each step in this flow either updates the row or branches based on column values. `client_tax_plans.program_id` is set at plan creation by `tax_start_plan` (legacy rows pre-dating the column may be NULL — treated as Holistic for label purposes).

> **Program-aware client-visible labels** (added in the Tax Planning alignment session). The invoice/receipt PDF headers + footer, Stripe Checkout line items, the Stripe off-session implementation charge description, and the BoldSign agreement title all switch between "VFO Holistic Planning" (program_id=1 or NULL legacy) and "VFO Tax Planning" (program_id=4) via the `programLabel(programId)` helper in `utils/program-label.ts`. Internal-only labels (`notifications.pipeline='TAX'`, `email_templates.pipeline='TAX'`, sandbox-config `pipeline='TAX'`) stay program-agnostic — they're keys, not display names.

> **Session-3 redesign note (2026-05-19).** Steps 13 (Tax 4 Continue/Stop) and 14 (Tax 5 implementation) below describe the **original** Phase 6/7 designs where admin clicks fire money movement directly. Both have since been **redesigned** to mirror a unified pattern: admin picks a 3-option dropdown → for the affirmative pick, the client gets an email with a back-out button + 24h grace; for Undecided, the client gets a buttons-email with a 48h reminder + 96h PF-call-the-client admin notification; for the decline pick, the engagement closes immediately. **(Update 2026-07-22: the Tax 4 Continue 24h grace/auto-lock was REMOVED — Tax 4 Continue is now click-only with the 48h/96h nag ladder like Undecided; only Tax 5 implementation Proceed retains the 24h auto-charge — gotcha #264.)** **(Update 2026-08-14: the Tax 5 Proceed 24h auto-charge is REMOVED too. NOTHING on the tax track locks a decision or moves money without a client click; the Proceed branch now runs its own reminder ladder. In the same change every ladder tier on this page moved from calendar hours to **BUSINESS days** — read every "48h" below as **2 business days** and every "96h" as **4 business days**.)** Daily sweep (`tax-revshare-sweep-daily`) drives all timers. Same pattern was also added to Tax 3 (Undecided email reminder, agreement-signing reminder, payment-link reminder). For the canonical current behavior of these steps see [TAX_BUILD_RESUME.md](C:/vfo-edge-functions/.claude/worktrees/thirsty-gould-06a64e/TAX_BUILD_RESUME.md) Phase index and [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md) entries `automation_TAX_postreviewdecision`, `automation_TAX_postreviewclientdecision`, `automation_TAX_implementdecision`, `automation_TAX_implementfinaldecision`, `automation_TAX_revshare_sweep`. Notifications now carry a `dismissible` boolean — FYI notifications have a Done button; action-required ones (Tax 3 Yes → pricing form; Tax 3 ExtraMeeting → schedule meeting) clear only when admin completes the action.

## Lifecycle overview

```
ROI Mtg booked   →  Tax 3 Decision  →  /tax-decide      →  PCADMIN pricing  →  BoldSign agreement  →  Stripe customer  →  /tax-pay  →  Stripe payment  →  Confirmation + Invoice/Receipt  →  Tax 4 Continue/Stop  →  Implementation charge
   (Tax 2)         (Yes / Und / No)    (Yes / No /         (after client            (client signs,        (after both                                       (Phase 6 — admin-driven)            (Phase 7 — fires ONLY
                                          ExtraMeeting)        picks Yes)             then CEO)             signatures)                                                                              on the client's own
                                                                                                                                                                                                       Proceed click)
```

### Phase cards vs stored phases (display, 2026-07-22)

The tax track stores **7 phases on Holistic (program 1)** and **8 on VFO Tax Planning (program 4)**, but renders **6** and **7** cards respectively, because the two stored phases named `Tax 5` — `Tax 5 - Education & DD (Specialist Allocation)` and `Tax 5 - Education & DD (Post Allocation)` — render as ONE card badged `5`, with each half a sub-section inside it (own status pill, own unlock gate, one shared notes thread). Badge numbers are derived from the phase NAME (`Set Up` → `S`, `Tax <n>` → `n`), never the render position, so badges read `1,2,3,4,5,6` on Holistic and `S,1,2,3,4,5,6` on Tax Planning and always match the card title.

**Do not rename the stored phases** to "fix" the numbering — the names are exact-string-matched in `actions/clients/overview-tax.ts` (`phaseReach`), at ~14 sites in `TaxPrioritiesTab.jsx`, and are stored as data in `client_notes.phase_name`. See gotcha #260. Steps below still refer to the stored phase names (including "Tax 5a"/"Tax 5b" shorthand), which are unchanged.

### Per-specialist phases: Tax 5a and Tax 6 (2026-07-31, v683)

**TWO phases store their tasks per allocated specialist rather than once per plan** — `Tax 5 - Education & DD (Specialist Allocation)` and, since 2026-07-31, **`Tax 6 - Implementation`** (gotcha #311). Their progress rows carry a non-NULL `client_tax_progress.tax_specialist_id` (FE progress key `${task.id}_${spec.id}`), written through the ordinary `tax_save_task` with a `tax_specialist_id` — **no dedicated action**. For a Tax 6 task a plan-level (`tax_specialist_id` NULL) row is **dead data** no reader will surface; the eight that predated the cutover were backed up and deleted.

- **Admin UI.** The Tax 6 card body renders **one expandable box per allocated specialist** (cloned from the Tax 5 specialist-box style — name display-only, chip, ▼ caret, expand key `tax6_spec_<id>`, default-expanded until all four steps are answered), each containing the phase's four tasks. With nothing allocated it reads "No specialists allocated yet."
- **Chip precedence per box: `Stopped` > `Done` > `In progress · n/4` > `Not started`.** Any step `Stopped` wins outright; "answered" counts `Completed`, `Stopped` **and** `N/A`. The card pill counts **specialists × 4**, and the hero total/done counts add Tax 6 as a per-specialist term (it is deliberately excluded from the plan-level reduce so it is not double-counted).
- **Phase done requires ≥ 1 allocated specialist** AND every specialist having every non-auto task statused. A plan with no specialists can never read Done — a deliberate change from the old vacuously-true behavior.
- **Client overview (`actions/clients/overview-tax.ts`).** A `Tax 6 - Implementation` branch emits **one step per specialist**, labelled `<task> — <specialist>`, gated on `applicable: implReach`, and tagged with the **same `spec-<id>` scope as the Tax 5 steps** — so one specialist's Tax 5 + Tax 6 steps scan as a single sequence for skipped-step warnings and never warn across two different specialists.
- **Removing a specialist** drops the row optimistically in the UI and clears both the `spec_<id>` and `tax6_spec_<id>` expand keys plus that specialist's progress keys; the backend still deletes the progress rows before the specialist row (#305).

### Allocating an off-directory specialist: "Custom" (2026-07-31, v683)

The specialist picker's permanent trailing option is **"Custom"** (module sentinel `OTHER_SPEC_VALUE = '__other__'`, exempt from the already-allocated dedupe). Selecting it reveals a **name input** (80-char cap) and **Add stays disabled until it is non-empty**; the request is `tax_add_specialist { tax_plan_id, other: true, custom_name }`.

- The server owns the label format: `add-specialist.ts` sanitizes the name (collapse whitespace → trim → strip a leading case-insensitive `"custom -"` so it cannot double → 80-char cap) and stores **`Custom - <name>`**.
- **`expert_id` stays NULL**, so the allocation points at no `experts` row and can never reach a member showroom or the public widget (#305 / #231 / #201).
- **An empty or absent `custom_name` still produces the legacy `Other #N (See notes)` max+1 numbering** — retained for API back-compat and for rows already in the wild. The UI can no longer reach that path, and **no live row carries an `Other #N` name** (the last one was converted to `Custom - Steven Cox` on 2026-07-31).
- Neither unlinked path dedupes — multiple custom allocations on one plan are legitimate.

### Completion dates on the tax track are DISPLAY-ONLY (both programs)

Every step's completion date in `TaxPrioritiesTab.jsx` is read-only: the date is whatever the save recorded and cannot be hand-edited. The mechanism is a **module-level `StepDate` component that SHADOWS the shared editable control** in `components/shared/StepDate` — the import was removed, and the local version renders a muted span, ignoring the `onChange`/`disabled` props the call sites still pass. Every other tracking track (MAP 1, onboarding, PFT, PIP, Regular) still imports and uses the **editable** shared control, so do not "fix" the tax call sites by re-adding the import. "Allocate Team Member / Tax Planner" now shows its completion date too.

### Risk profile seeding (Holistic only, 2026-07-22)

On a **Holistic** plan, `tax_start_plan` copies the client's MAP 1 "Priorities Decided / Risk Profile" answer onto the new plan's Tax 1 "Client risk profile complete" task (`Completed + Risk N` → `Yes — Risk N — <Mindset>`). Creation-time only, never re-synced; `Completed + N/A` seeds nothing; program 4 clients are excluded (no MAP 1 track). Expect a new Holistic plan to open at `1 / N` with Tax 1 reading "In progress". See gotcha #261.

Each arrow is either:
- A user clicking something in the admin UI (`callApi(...)`),
- A token-link landing page (raw fetch, no session),
- A webhook (Stripe / BoldSign), or
- A server-to-server chain (admin-api → admin-api with service-role or admin-token auth).

---

## STEP PREREQUISITE GATING — "natural barriers" (2026-08-13, frontend-only, gotcha #390)

Until this shipped, every step on the tax track was independently clickable in any order. The process existed only in whoever remembered it — an admin could send a presentation link before the returns arrived, allocate a Team Member and then complete a review only a Tax Planner may run, or record a client decision that nothing had led up to. **`TaxPrioritiesTab.jsx` now enforces the order in the UI.**

### The mechanism

`stepGate(task, phase)` returns `{ locked, hint }`, or `null` when a step is unrestricted. `renderTask` consults it **before** `renderTaskInner` and before the plannerMode wrapper. A locked step renders an **inert row** — full brightness (not dimmed), hollow dot, task name in normal ink, a red circle-slash `LockedIcon` where the control would sit, a gray 11px hint naming the blocking step, and an em-dash in the date column.

Steps are matched **sentinel-first, exact-name-as-fallback** (the file's convention). Each gate names only its **DIRECT** prerequisites — the chain is transitively safe without recursion, because an earlier lock keeps the earlier step unanswered.

> **This is choreography, not authorization.** There is **no backend enforcement**: `tax_save_task` will still accept a write to a locked step from any caller entitled to call it. Never cite this as a security control. Same class as #353.

### The three safety rules

1. **`isTaskStatused` remains the single owner of every done-signal**, including the sentinels whose truth lives on `client_tax_plans` rather than in `client_tax_progress` (`tax_hlm_confirm`→`tax4_meeting_date`, `tax_returns_request`→`tax_returns_received_at`, `tax_planner_select`→`tax_planner_id`, `tax_generate_presentation`→`generated_presentation_at`, `tax_presentation_link`→`presentation_send_date`, `tax_refund`→Proceed-or-refunded, and *"Additional information required"*'s status-plus-received-stamp rule). Every predicate reads through it, so a gate can never disagree with the green dot beside it.
2. **`alreadyDone` short-circuits the gate**, so a step that has ever been answered always renders its normal editable control — history stays visible and correctable even if a prerequisite is later un-set. Per-specialist steps key on the composite `${task.id}_${spec.id}` progress key (which `isTaskStatused` does **not** handle), and `tax_implement_decision` additionally accepts the plan column, because legacy plans carry `implementation_decision` with no progress row.
3. **An absent task is vacuously satisfied.** `prereqDone` returns true on a lookup miss — Holistic (program 1) genuinely lacks the deposit and Green/Red Light steps, and gating on a task that does not exist would lock everything downstream forever.

### The chain

| Step | Locked until | Hint |
|------|--------------|------|
| `Request Tax Returns` | (P4) deposit `pi_` entered | `Enter the Stripe deposit payment (Set Up) first` |
| `Allocate Team Member / Tax Planner` | returns received (P4 also deposit) | `Waiting for tax returns to be received` |
| `Additional information required?` | returns received **and a Tax Planner allocated** | three-way: returns / planner / both |
| `Tax planner review complete` | *Additional information* done **and** a Tax Planner allocated | `Complete "Additional information required" first` |
| `ROI Meeting booked` (`tax_3_decision`) | review = **Proceed** (or, **Holistic only**, review = Stop) | `Complete "Tax planner review complete" first` |
| `Assess tax planning opportunities` | review = **Proceed** | same |
| `Generate and download presentation` | review = **Proceed**; then its own bespoke hint takes over | chain hint, then `Submit the tax planning opportunities form first` |
| `Send presentation link` | ROI meeting booked **and** deck generated | `Book the ROI meeting and generate the presentation first` |
| `ROI Presentation` | **every** Tax 1 + Tax 2 step, incl. Green/Red resolved (P4) | `Complete every Tax 1 and Tax 2 step first` |
| `Client tax planning decision` | `ROI Presentation` answered | `Complete the "ROI Presentation" step first` |
| `Detailed tax plan meeting confirmation email` | the Tax 3 AI PC Admin cascade completed | `Waiting for the Tax 3 AI PC Admin steps to complete` |
| `Detailed tax plan presentation` | that confirmation email sent (`tax4_meeting_date`) | `Send the detailed tax plan meeting confirmation email first` |
| `Client decision 1` | confirmation email **and** detailed presentation | `Complete the confirmation email and detailed tax plan presentation first` |
| `Client decision 2` | the above **and Client decision 1** | `Complete "Client decision 1" first` |
| Tax 5a per-specialist steps | `Client decision 1` | `Waiting for Client decision 1` |
| Tax 5b *Post Allocation* | unchanged `tax5bUnlocked` rule | `Unlocks when "Confirm ready for implementation" is Yes or Undecided on any specialist` |
| Tax 6 (all four, per specialist) | Implementation decision **and** its AI PC Admin cascade — **or** any Tax 6 work already started (`tax6Started`) | `Locked until Implementation decision + AI PC Admin complete` |

**Never gated:** `Deposit Paid`, `Client risk profile complete`, `Allocate to VFO Specialist` / adding specialists, every `AI PC Admin` row, `auto` steps, and the steps `renderTaskInner` hides outright.

### The escape hatches (deliberate — do not "tidy" them away)

A gate that locks a stop path makes a bell un-performable (#365/#367), so the stop routes stay walkable:

- **The Green/Red Light row is NEVER row-locked.** Its **Refund** button appears as soon as a `deposit_payment_intent_id` exists — that is the program-4 stop route, and it must stay reachable for a client who never provides information, i.e. exactly when the chain can never complete. Only its **Proceed** button is gated (`canProceed = diagnosticChain`).
- **`reviewStop` unlocks `ROI Meeting booked` on Holistic ONLY.** Program 1 has no Green/Red step, and its Stop bell names that step's decline button as the stop route (#367). On program 4 the stop route is the Refund, so the unlock is not needed and is not granted.
- **`tax6Started`** keeps Tax 6 editable on any plan where per-specialist work already exists, so the gate cannot strand historic rows.

### "Answered" is not "Proceed" (#391 — this shipped as a bug and was caught in testing)

The first build treated *"Tax planner review complete"* as a boolean. Choosing **Stop tax planning** therefore unlocked the whole forward half of the track — Assess, ROI-booked, the deck, and a **Proceed** button on Green/Red, i.e. precisely the decision the Stop had just refused. The predicate is now **`reviewProceed`** (status exactly `'Proceed with tax planning'`) and the old any-answer `reviewDone` was deleted so it cannot be reused. **An override after a Stop is done by flipping the review answer back to Proceed** — the step stays editable once answered.

### Surfaces

- **Member portal (`readOnly`): fully exempt.** Members see zero lock rows and zero hints.
- **Tax-planner portal (`plannerMode`): sees the locks**, on top of the existing per-step whitelist inert-wrapper.
- **Display-only renames (#392):** `TASK_DISPLAY_LABELS` / `TASK_SUB_LABELS` shorten three step names in the UI — the Green/Red Light step (with its refund clause demoted to a gray sub-line), the Assess step (parenthetical dropped) and *"Additional information required?"* (question mark added). **Stored `program_client_tasks.name` values are untouched and remain the cross-repo lookup keys**; bells and email chips still speak the long names.
- **One deliberate member-visible change:** Tax 5 *Post Allocation* stopped being a full block-out and became ordinary locked rows with the `PhasePill` always shown, so members now see those rows where they previously saw an empty section.

---

## Step 0 — Set Up phase (VFO Tax Planning program_id=4 only)

**Context:** standalone VFO Tax Planning clients pay a deposit BEFORE we even know they exist (typically via a public Stripe payment link, outside our system). Admin then creates the client record and binds them to the program. Holistic Tax Priorities (program_id=1) clients don't see this phase — they arrive via MAP1.

**As of 2026-07-27 the Set Up phase contains exactly ONE task.** The former `tax_greenlight` ("Tax Plan Greenlight", Go/Stop) task is **deleted**, and the former "Refund Paid" task has been renamed and **relocated into Tax 1 - Diagnostic** as a single go/no-go decision — see [Step 0b](#step-0b--tax-plan-greenred-light-decision-inside-tax-1---diagnostic) below. **It now sits at `task_order=8` of Tax 1, with "Client risk profile complete" (9) the only step after it.**

| Task | status_options | What it does |
|---|---|---|
| Deposit Paid | `tax_deposit_pi` | Text input. Admin pastes the Stripe PaymentIntent ID (`pi_...`) or a Stripe dashboard URL containing it. `tax_save_deposit_pi` extracts the last `pi_...` substring (defensive against paste-over), writes it to `client_tax_plans.deposit_payment_intent_id`, and marks the task `Completed`. |

**Handler:** [`tax_save_deposit_pi`](../../supabase/functions/vfo-admin-api/actions/tax/save-deposit-pi.ts) — AUTH (admin-only).

---

## Step 0b — Tax Plan Green/Red Light decision (inside Tax 1 - Diagnostic)

**Task:** "Tax Plan Green/Red Light - Refund $500 Deposit if unable to proceed based on the information provided" (`program_client_tasks` id **116**, sentinel `status_options='tax_refund'`, `phase_id=26`, **`task_order=8`**). It sits immediately below the new **"Tax planner review complete"** step (177, order 7) and is followed only by "Client risk profile complete" (117, order 9). The decision is deliberately placed AFTER the information-gathering steps and after the planner has recorded their Proceed/Stop call, because that is where the information needed to make it arrives — the risk profile follows it, since it is not worth doing until the plan has a green light. See the [Tax 1 order](#tax-1---diagnostic-step-order) section below.

**Two admin buttons:**

| Button | What it does |
|---|---|
| **Proceed** (green) | Saves progress status **`'Proceed'`** via `tax_save_task`. The step goes done, a green `Proceed` pill replaces the buttons, and they do not come back — **one-way in the UI**, the same shape as the Tax 3 decline pattern. Nothing else fires; the plan continues into Tax 2. |
| **Refund** (red) | **Saves nothing.** Opens an inline email-preview card (copied from the `tax_3_decision` decline card): the real subject line, `Hi [Client First],`, a **required** reason `<textarea>` sitting mid-body (placeholder *"Type the reason we are not moving forward here - written as if speaking directly to the client."*), the fixed refund / questions / thank-you / sign-off paragraphs, and **Cancel** + **Send Refund**. Send Refund is disabled until a reason is typed **AND** `client_tax_plans.deposit_payment_intent_id` exists, then `confirm()`s before firing. |

**Send Refund** → `automation_TAX_depositrefund` with a **REQUIRED `reason`** body field (**400 `"reason required"`** without it), which: (1) fetches the PaymentIntent from Stripe to get the amount, (2) POSTs to `/v1/refunds` with `payment_intent=<saved pi_>` (full amount), (3) writes `deposit_refund_id`/`deposit_refund_amount`/`deposit_refund_date`/`deposit_refund_status='succeeded'`, (4) drafts a Gmail confirmation to the client from template `TAX_deposit_refund` with the typed reason substituted into the **`[Refund Reason]`** token (HTML-escaped, newlines → `<br>`, injected by function replacement so a `$` in the reason stays literal), (5) inserts an admin notification with the Stripe refund id, and (6) **clears Tray's action-required `Tax Planner review complete for%` bell** — on a program-4 Stop the refund IS that bell's instruction, and the clear sits immediately after the refund columns are written so the money moving is what retires it (see [the tax-track hand-off chain](#the-tax-track-hand-off-chain)). Refund columns and the PF bell are otherwise unchanged.

**Done-math (both repos):** done = progress `status === 'Proceed'` **OR** `client_tax_plans.deposit_refund_status === 'succeeded'`. **The Refund path writes no progress status at all** — the closed state rides on `deposit_refund_status` alone. `'Proceed'` is an exact-matched load-bearing string in the FE `isTaskStatused` helper (`TaxPrioritiesTab.jsx`) and in `overview-tax.ts`; renaming the task or that string breaks both. See gotcha **#293**.

**Visibility:** the client/member-facing `readOnly` track **hides this step entirely unless a refund actually happened** (the go/no-go is an internal call). The **tax-planner portal shows it visible but LOCKED** — the task name is deliberately absent from both `PLANNER_EDITABLE_TASK_NAMES` whitelists (#262), because the step is admin-only.

**Handler:** [`automation_TAX_depositrefund`](../../supabase/functions/vfo-admin-api/actions/tax/deposit-refund.ts) — AUTH (admin-only; removed from `TAX_PLANNER_ALLOWED_ACTIONS` in the #262 trim).

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`(pipeline=`TAX`), `email_templates`.
**Tables written:** `client_tax_plans`(deposit_payment_intent_id, deposit_refund_*, deposit_refund_email_sent), `client_tax_progress` (Deposit Paid status + the `'Proceed'` decision), `notifications`.
**External calls:** Stripe `GET /v1/payment_intents/<id>`, Stripe `POST /v1/refunds`, Gmail drafts API.

> **Proceed is the normal lifecycle path** — flow continues to Step 1 below. Refund closes the engagement (`overview-tax.ts` reports `"Stopped — deposit refunded"`). The whole deposit / Set Up / Green-Red-Light flow is **program_id=4 (standalone VFO Tax Planning) only**.

---

## Tax 1 - Diagnostic step order

The phase reads in the order the work actually happens: the client's returns are requested first (they are what start everything), somebody is allocated to them second, the information is gathered, the planner records their review call, and only then do the go/no-go and risk steps land. **Both programs share the order** except for the two steps program 1 does not have.

| Program 4 (VFO Tax Planning) — `phase_id=26` | | Program 1 (Holistic Tax Priorities) — `phase_id=18` | |
|---|---|---|---|
| 1 | 172 Request Tax Returns (`tax_returns_request`) | 1 | 175 Request Tax Returns (`tax_returns_request`) |
| 2 | 118 Allocate Team Member / Tax Planner (`tax_planner_select`) | 2 | 84 Allocate Team Member / Tax Planner (`tax_planner_select`) |
| 3 | 119 Additional information required | 3 | 85 Additional information required |
| 4 | 120 Email to obtain information required sent *(hidden legacy)* | 4 | 86 Email to obtain information required sent *(hidden legacy)* |
| 5 | 121 Information received *(hidden legacy)* | 5 | 87 Information received *(hidden legacy)* |
| 6 | 122 Information passed to VFO-L *(hidden legacy)* | 6 | 88 Information passed to VFO-L *(hidden legacy)* |
| 7 | **177 Tax planner review complete** | 7 | **176 Tax planner review complete** |
| 8 | **116 Tax Plan Green/Red Light** (`tax_refund`) | 8 | 83 Client risk profile complete |
| 9 | 117 Client risk profile complete | | |

The hidden legacy rows (86–88 / 120–122) stay filtered out of every surface — see gotcha #271. Tasks 84/118 are matched by the FE **sentinel (`tax_planner_select`) first**, with the pre-2026-08-10 name "Allocate to Advanced Tax Planner" kept as a fallback. Team Members are allocatable and are the deliberate FIRST holder of a plan — see [the tax-track hand-off chain](#the-tax-track-hand-off-chain) below and gotcha #294 as amended.

**Migration note (2026-08-11).** The order above and the new step were applied by `20260811160000_tax1_reorder_planner_review_step.sql` (reorder + the new step at 7) and `20260811180000_tax1_request_first_and_chain_rules.sql` (Request Tax Returns to 1, Allocate to 2), both **DML only, applied live via MCP `apply_migration` and committed as files**. **No task ids changed, so ZERO `client_tax_progress` selections moved** — only `task_order` values, and there is no unique index on `(phase_id, task_order)`, so the intermediate collisions during the rewrite are harmless. One ledger discrepancy is recorded in the first file's own header: it was applied while the Stop option still read `'Stop tax planning - suggest refund'`, then renamed in-session by a follow-up live `UPDATE`, so `supabase_migrations` holds the pre-rename text while the committed file carries the final wording.

**Accepted consequence, carried forward:** `computeTrack`'s skipped-step warnings are **positional**, so every reorder retroactively changes `next_action` and the warning scan on plans that already exist — including the new step, which no existing plan has answered. The user has reviewed and accepted this on each reorder rather than change the seeding (#261 auto-seeds the risk profile at plan creation, and that step now sits last). See gotcha **#339**.

**Portal sessions need a page reload to see the new order** — the task template is module-cached client-side.

---

## "Tax planner review complete" — the reviewer's Proceed/Stop call (2026-08-11)

`program_client_tasks` **176** (program 1, `phase_id=18`) / **177** (program 4, `phase_id=26`), name exactly **`Tax planner review complete`**, `task_type='dropdown'`, `task_order=7`, `status_options='Proceed with tax planning|Stop tax planning'`. **A plain dropdown — there is no sentinel**, so the FE renders it through the generic dropdown path; its two statuses colour green `#1b9254` (Proceed) and red `#e74c3c` (Stop) in `TaxPrioritiesTab.jsx`'s status-colour map.

The step exists because the plan needed a recorded reviewer decision between "we have the client's information" and "we spend money on this plan": on program 4 it precedes the Green/Red Light refund call, on program 1 it precedes the ROI booking. It is **on all three planner-editable surfaces** (#262): the FE `PLANNER_EDITABLE_TASK_NAMES` set, the backend `PLANNER_EDITABLE_TASK_NAMES` exported from `save-task.ts`, and — because it saves through the ordinary `tax_save_task` — the existing allowlist entry for that action.

**Its two option strings are load-bearing.** `utils/tax-review-bell.ts` exports them as `REVIEW_PROCEED` / `REVIEW_STOP` alongside the step name (`REVIEW_TASK_NAME`), and every clear site in the hand-off chain decides what to do by reading this step's **stored status** rather than by parsing bell rows. Renaming the step or either option breaks that read. Answering it is also what fires Tray's outcome bell and (on Proceed) the planner's assess bell — see [the tax-track hand-off chain](#the-tax-track-hand-off-chain).

---

## Request Tax Returns — the same step in BOTH programs (2026-08-07)

Until 2026-08-07 only **VFO Tax Planning (program 4)** had a "Request Tax Returns" step (`program_client_tasks` **172**, sentinel `tax_returns_request`, first in Tax 1 - Diagnostic). **Holistic had no step at all** — its clients were asked for returns by an "Upload Tax Documents" button inside the **MAP 1 first-payment invoice/receipt email**, which minted `clients.tax_upload_token` and linked `/tax-upload`. That worked as an email and failed as a process: no request stamp, no received stamp, no step to look at, and no phase-scoped bell — the upload landed as a generic `UPLOAD_tax_return_uploaded` FYI and the tax track never moved. Holistic now has the real step (**task 175**), the first-payment email has given the job up ([contract-and-payment.md](contract-and-payment.md) Step 12, gotcha **#341**), and the whole model is gotcha **#340**.

**Handler.** `automation_TAX_request_returns` (`actions/tax/request-returns.ts`, AUTH, `ADMIN_ONLY_ACTIONS` — deliberately **not** planner-allowed, unlike the additional-info twin, #262). Unchanged in shape: mints `clients.tax_upload_token` if absent, drafts a Gmail to the client carrying the secure `/tax-upload?token=` link and an "Upload Tax Returns" button, stamps `client_tax_plans.tax_returns_requested_at`.

**Per-program wording.** The plan's `program_id` is now in the handler's `.select()`, and the template is chosen `(plan.program_id || 1) === 1 ? 'TAX_request_returns|holistic' : 'TAX_request_returns'`, **falling back to the base name** when the variant row is missing or inactive. `email_templates` **214** (`TAX_request_returns|holistic`, pipeline `TAX`, **Draft mode**, To `[CLIENT]`, Cc `[ASSIGNED_PF, MEMBER, tnmiller@vfo-services.com, tvaldes@vfo-services.com]`, Bcc `[platham@elitert.com, aanderson@elitert.com]`) is a copy of row **194** differing only in its opening line ("We're now ready to begin work on the tax planning priority within your VFO Services Membership."), with #326-correct addresses. **`gmailDraftFetch` receives the template name ACTUALLY used** — that argument resolves the per-template Draft/Send toggle, so passing the hardcoded base name while drafting from 214 would silently apply the wrong row's send mode. The frontend mirrors the same ternary in the step's `StepEmailsChip` (`TaxPrioritiesTab.jsx`) and `templateMeta.js` carries the matching description.

**Upload → received, and why the Holistic half is REQUEST-GATED.** `actions/vault/upload-notify.ts` runs **two independent lookups**: the newest **program-4** plan (unconditional — that step's request is implicit) and the newest **Holistic** plan, selected `.or("program_id.is.null,program_id.eq.1")` — `.eq` would exclude the NULL legacy rows — **and only when `tax_returns_requested_at` is set**. Every unstamped candidate gets `tax_returns_received_at`; the **action-required** `TAX_returns_allocate_team_member` bell (Tracy / Tray, title `Allocate a team member for <Client>`) fires **exactly once** — and is **skipped when every plan this upload stamped already has a planner**, because that instruction is already carried out and its clear site would never run again; a client holding plans in BOTH programs has both stamped by one upload. The request-gate is the compatibility layer, not a nicety: **`clients.tax_upload_token` is durable and per-client**, so every `/tax-upload` link sent by an older first-payment email is the SAME URL the new step mints — without the gate those old links would retro-green a step for Holistic clients who were never asked. An upload with no requested plan still falls through to the generic FYI, byte-identically to before.

> **v710 exists because the first shape was wrong.** v709 made the Holistic lookup an `else` on the program-4 one, so a client holding plans in both programs had program 4 **swallow** the upload and the Holistic plan never went green. Caught in click-testing, fixed by making the lookups independent and the stamp a loop. On a two-program client, "the newest plan" is never one query.

**Done-state.** Like its program-4 twin the step is **column-proven and writes NO `client_tax_progress` row** — `done = !!tax_returns_received_at`, `at = received ?? requested`. `overview-tax.ts`'s `tax_returns_request` sentinel branch (added v708, gotcha **#339**) is therefore what keeps Client Overview honest for BOTH programs.

**Accepted consequence (explicit user decision).** Inserting the step at `task_order=1` means every existing Holistic plan's Tax 1 reopens as not-done until returns are requested and received, and the **12 Holistic plans already past Tax 1** gained a permanent "Request Tax Returns — not recorded" warning in Client Overview (#339's positional-warning mechanics). The user was shown this and accepted it. Portal sessions need a **page reload** to pick up the new step.

---

## Step 1 — ROI Meeting booked - Send Confirmation Email *(renamed + moved 2026-08-10, v717 — gotcha #358)*

**Trigger:** Admin clicks the **`ROI Meeting booked - Send Confirmation Email`** task in the Tax 2 phase ([TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx)). The task is `program_client_tasks` **90** (program 1) / **124** (program 4), sentinel `status_options='tax_3_decision'`.

> **What changed on 2026-08-10.** The task was **renamed** from "Tax 3 Confirmation Email" (itself a rename of "Ready for Tax 3?") and **moved to `task_order=0`**, so it is now the FIRST step of `Tax 2 - Deeper Dive` — the same `task_order=0` convention the Tax 4 confirmation step uses. Both changes are DML (`20260810130100_tax_roi_step_renames.sql`). Per gotcha **#339** the reorder is positional and retroactive: plans that passed this step un-completed now show a skipped-step warning on it, reviewed and accepted exactly as the 2026-08-07 Tax 1 reorder was. The FE matches the step by **sentinel first**, which is what made the rename safe to apply while the old bundle was still live.

**TWO buttons on Holistic, ONE on VFO Tax Planning.** **Send email (with date)** (green) opens the date / time / timezone form, with Send **disabled until a date is entered** and a Cancel beside it. **`No - Declined email to client`** (red) opens the inline red-dashed `[DECLINE_REASON]` textarea and **renders for Holistic (program 1) ONLY** (`canDecline = (plan.program_id || 1) === 1` in `TaxPrioritiesTab.jsx`) — program 4's stop route is the Green/Red Light refund instead, so offering both would be two ways to close the same plan. **That gate is FRONTEND-ONLY: the backend still accepts `decision:"declined"` on a program-4 plan** — a guardrail, not a boundary, the same shape as gotcha #353. **"Send email – date not confirmed" is GONE** — `decision:"confirm_no_date"` now returns **400 `"A meeting date is required"`**, deliberately kept as its own named branch so an old cached bundle gets a legible refusal rather than a generic one.

**Handler:** [`automation_TAX_readyfortax3`](../../supabase/functions/vfo-admin-api/actions/tax/ready-for-tax3.ts) — AUTH handler.

**What it does:**
1. Validates `client_tax_plans` row exists (created earlier by `tax_start_plan`). (No longer hard-blocks on `ready_for_tax3_email_sent='Yes'` — re-sends are allowed.) `confirm_no_date` → **400**; `confirm_date` → **400 unless `meeting_date` matches `^\d{4}-\d{2}-\d{2}$`**. **A confirm send still 400s unless the plan has a `tax_planner_id` allocated**, now worded **"Allocate a Team Member / Tax Planner before sending the confirmation email"** because either role may hold the plan (#294 as amended); the `declined` path is exempt. The Yes template gets `[Planner Name]` substitution + the `TAX_PLANNER` Cc chip.
2. Loads `clients`, `members`, `pipeline_sandbox_config` (pipeline='TAX').
3. UPDATEs plan: `ready_for_tax3_decision`=`Yes` (confirm) / `No` (declined), `ready_for_tax3_email_sent='No'` initially, `sandbox`.
4. Loads `email_templates` row — `confirm_date` → `TAX_readyfortax3|Yes`; `declined` → `TAX_readyfortax3|No`.
5. Substitutes `[Client Name]`, `[Client First]`, `[Member Name]`, `[PF Name]`, plus **`[CLOSING]`** ("on \<date\> at \<time\> \<tz\>") on the Yes template and `[DECLINE_REASON]` on the No template.
6. Creates Gmail draft to client (CC member + PF; BCC `aanderson@elitert.com` + `platham@elitert.com`).
7. Flips `ready_for_tax3_email_sent='Yes'` **and, on `confirm_date`, PERSISTS `tax3_meeting_date` / `tax3_meeting_time` / `tax3_meeting_timezone`.** Those three columns are the only source for the step's **"Meeting booked for M/D/YYYY at h:mm AM TZ"** pill, for the nightly sweep's assess-reminder window and for that email's `[Meeting Date]`/`[Meeting Time]`/`[Meeting Timezone]` tokens. The decline path never writes them. **Legacy rows survive display-only:** plans confirmed before v717 have no trio, so the pill falls back to the stored progress status and the old `'Yes - Confirmation email (date TBC)'` value is deliberately retained in the FE colour map.
8. **Hand-off chain, fail-soft (gotchas #357/#179).** All of it is wrapped in one try/catch — a bell can never fail an email that has already been drafted. In order: (a) either decision clears this client's unread action-required bells titled `Book the ROI meeting for%` — **that bell has no call site any more, but unread rows of that shape still exist in production, so the clear stays**; (b) the **review-outcome** bell (`Tax Planner review complete for%`) is consumed here per the matrix in `utils/tax-review-bell.ts` — on `confirm_date` a recorded Proceed clears it (program 4 only once the Green/Red Light also reads `Proceed`; the save-task branch finishes the job when the booking lands first), a recorded Stop also clears because booking anyway overrides the recommendation, and on `declined` **every variant clears unconditionally**, since declining IS the Holistic Stop bell's instruction and makes any Proceed variant moot; (c) on `confirm_date` with a **Team Member** allocated it fires `TAX_team_member_allocate_planner` — "open the client and allocate the Tax Planner who will run the plan".

**Tables read:** `clients`, `members`, `pipeline_sandbox_config`, `email_templates`, `tax_planners` (the allocatee's `planner_role`).
**Tables written:** `client_tax_plans` (update), `notifications` (clear + insert).
**External calls:** Google OAuth, Gmail drafts API.
**Chains:** none.
**Read-only viewers** (member portal / planner `readOnly`) get a Not-started pill instead of the controls.

---

## Step 1¼ — Generate and download presentation (Tax 2 - Deeper Dive, added 2026-08-06 v706; **TWO-YEAR v2 rewrite 2026-08-07, v713**)

The ROI deck generator. It sits at **`task_order=2`** in **Tax 2 - Deeper Dive** (`program_client_tasks` ids **173** prog 1 Holistic / **174** prog 4 VFO Tax Planning, name "Generate and download presentation", sentinel `status_options='tax_generate_presentation'`) — inserting it pushed ids 90/124 to `task_order=3` and the "Send presentation link" step (168/169) to **4**. **(90/124 have since moved AGAIN — to `task_order=0` on 2026-08-10, so the ROI confirmation step now precedes everything in this phase; 173/174 and 168/169 were not renumbered, so the phase reads 90/124 → … → 173/174 → 168/169.)** It replaces a human assembling the deck by hand from numbers already stored on the plan.

**Handler:** [`tax_generate_presentation`](../../supabase/functions/vfo-admin-api/actions/tax/generate-presentation.ts) — **AUTH, `ADMIN_ONLY_ACTIONS`, deliberately NOT planner-callable** (the FE renderer is also hidden when `readOnly || plannerMode`). Full invariants: gotcha **#336**.

**Readiness gates — the FE spells each one out rather than greying the button silently:**
- assess form not submitted → *"Submit the assessment form first"*
- assess form submitted **before 2026-08-06** (no `taxes_without_plan` key) → *"Re-save the Assess form — the Total Taxes field is new"*; the handler's matching 400 is *"Re-save the Assess form — it was submitted before the Total Taxes field existed"*
- no risk grade → *"Set the Client risk profile step first"*
- `taxes_without_plan <= 0` → 400 *"Total Taxes without a Tax Plan must be greater than zero"* (it is a divisor)

**What Generate does, end to end.** Reads the plan + `assess_form` + the **plan-level** risk grade (`client_tax_progress` where `tax_specialist_id IS NULL`, task "Client risk profile complete", parsed `/Risk\s*([1-5])/`) → downloads **`ROI-template-master-v3.pptx`** from the private **`presentation-templates`** bucket → substitutes **21 `{{TOKENS}}`** across the parts **1/20/23/24/25/27/28/29** (XML-escaped) → **in single-year mode, drops the year-2 appendix slide from the package (see below)** → repositions the slide-20 `upArrow` to the client's risk band off a hardcoded EMU table (1→801612, 2→2566499, 3→4349395, 4→6126289, 5→7900180) → re-zips with **fflate** (untouched entries **stored at level 0**, only the 8 edited slide XMLs deflated — the ~27 MB of PNGs is never recompressed) → uploads to Google Drive **multipart with metadata `mimeType='application/vnd.google-apps.presentation'`**, which is what makes Drive convert it into a **real Google Slides file**, into an **"ROI Presentations"** folder under `GOOGLE_DRIVE_FOLDER_ID` → sets sharing **role=writer type=anyone** (deliberate, user-approved over view-only after a security review) → reads `webViewLink` → stamps `client_tax_plans.generated_presentation_{drive_id,url,at,by}` → returns `{success, url, generated_at}`. Runs ~30–60s, which is why `src/lib/api.js` grants this action **90s** via `LONG_TIMEOUT_ACTIONS` (writes still never retry, #30).

**The deck is TWO-YEAR as of 2026-08-07 (v713) — one combined slide plus two single-year slides.**

- **Slide 24 is the COMBINED view and now says so.** Header `Your investment: {{INVEST_YEARS}}` **as of v3 / v729** (box widened to 4.70in, `wrap="none"`, so it can never wrap), and the year was **removed** from the "Estimated Tax Savings" / "Net Tax Savings" / "Plan Investment" labels — the values there were always two-year totals and the labels used to contradict them. Do not put the year back. **`INVEST_YEARS` replaced the old `{{YEAR}} + {{YEAR2}}` run on this slide** so a one-year plan can render just the year; `YEAR`/`YEAR2` still exist as tokens and are still substituted, but only the appendix slides carry them now.
- **Two appendix slides break it out per year.** Year 1: Σ `gross_y1`, the same fee block as slide 24, Plan Investment = Σ `invest_y1`, Net = `gross_y1 − invest_y1 − the FULL fee`. Year 2: Σ `gross_y2`, a One-Time Fee of literal **"$0"** (**template text, not a token** — there is no `PLANNING_FEE_Y2`), Σ `invest_y2`, Net = `gross_y2 − invest_y2`. Neither carries the percentage-reduced box; that stays a combined-view claim.
- **⚠ FILENAMES ARE NOT POSITIONS.** The two new parts are **`slide28.xml` (year 1) and `slide29.xml` (year 2)** but they **DISPLAY at 25 and 26** — `sldIdLst` order is `1–24, 28, 29, 25, 26, 27`, pushing "Choose Who You Pay" / Double-Guarantee / Congratulations out to display **27/28/29**. Parts are addressed by filename, so `SLIDE_PARTS` is right as written; never "correct" it to display numbers.

**SINGLE-YEAR MODE — the generated deck's slide COUNT is variable as of v3 / v729 (#374).**

- **The trigger is per-strategy, not per-total.** `singleYear` is `form.strategies.every(s => num(gross_y2) === 0 && num(invest_y2) === 0)`. It is deliberately NOT tested on the sums: offsetting `+5000` / `−5000` year-2 entries sum to zero but are still a two-year plan.
- **What changes.** `INVEST_YEARS` renders as the bare year, and the **year-2 appendix (`slide29.xml`) is dropped from the output package** — not blanked, removed. Four things go together, and missing any one makes PowerPoint call the file corrupt: the `<p:sldId>` in `ppt/presentation.xml`, the `<Relationship>` in `ppt/_rels/presentation.xml.rels`, the `<Override>` in `[Content_Types].xml`, and `slide29.xml` + `slide29.xml.rels` in the zip.
- **The rId is resolved dynamically**, by matching the relationship whose `Target="slides/slide29.xml"`, then finding the `<p:sldId>` carrying that `r:id`. It is never hardcoded. Each of the three XML patches asserts **exactly one match** and returns a **loud 500** naming the part and the count if not — a silent partial edit here would ship a corrupt deck.
- **Consequence for anyone reading a generated deck:** it is **28 slides in single-year mode and 29 otherwise**, so no consumer may assume 29 slides or fixed display positions past display 25. This is the generated OUTPUT only — the template in the bucket always has all 29.

**Values on the deck:** the per-year sums come first — `gross_y1=Σ gross_y1`, `gross_y2=Σ gross_y2`, `invest_y1=Σ invest_y1`, `invest_y2=Σ invest_y2` — and the combined `gross` / `invest` are **DERIVED from them** so the two views cannot drift. Then `taxes_with=taxes_without−gross`, `net=gross−invest−fee`, **`net_y1=gross_y1−invest_y1−fee`**, **`net_y2=gross_y2−invest_y2`**, `outlay_plus_fee=invest+fee`, `fee_half=fee/2`, `pct=round(gross/taxes_without×100)`, `year` = the **generation-time** calendar year, `year2=year+1`. **The fee is charged entirely to year 1, so `NET_Y1 + NET_Y2 === NET_BENEFIT`** (likewise gross and invest) — that identity is the check to run against any generated deck, and it is why **`NET_Y1` can legitimately come out NEGATIVE** on a year-1-light plan. Money is whole-dollar with commas — **`FEE_HALF` is the only cents-tolerant token**; negatives use accounting parentheses.

**Buttons:** Generate → then **Download** (opens the Slides URL — there is no local file) and **Regenerate** (creates a **NEW** Drive file each time; the plan row points at the newest, old files are not deleted).

**The step is done when `generated_presentation_at` is non-NULL** — the handler writes **NO** `client_progress` / `client_tax_progress` row, and both `actions/clients/overview-tax.ts` and the FE `isTaskStatused` read the column directly.

**Deliberately NOT auto-filled:** the Tax 2 "Send presentation link" field below. An admin reviews the generated deck and pastes the link manually, so `member_presentation_link` and `presentation_link` are untouched by this step.

**Template maintenance cycle** — edit a copy in Google Slides → download as .pptx → **rebuild** through the script chain `build_master.py` → clone step → `edit_v2.py` → `revise_v2.py` → **`restyle_23.py` → `restyle_bullets.py`** → **`make_v3.py`** (applies the two v3 edits — the slide-24 title/`INVEST_YEARS` swap and the slide-26 bullet removal — to an unpacked v2 package, every edit expect-asserted) → re-upload as exactly `ROI-template-master-v3.pptx`. **Full detail lives in `scripts/roi-presentation/README.md` in the EDGE repo** — read it before touching the deck. The master is always rebuilt, never hand-patched (every re-export shifts the paragraph/run indices the scripts edit by), and **the restyle steps are not optional**: a fresh export carries the old styling, so skipping them silently reverts the look while the numbers stay perfectly correct.

**How a deck change ships — two paths, and the choice is not yours to make freely (#336/#342).** A change confined to **token-free** slides (styling, layout, colour, bullets) ships by **replacing the SAME bucket object: no code, no deploy**, live on the next generation — that is exactly how the 2026-08-07 slide-2/3/4/28 restyles went out after v713. A change to **any token, the slide count, a part filename or `sldIdLst`** requires a **NEW versioned object name plus a lockstep backend deploy** (upload first, keep the superseded object as rollback) — that is why the two-year rewrite became `…-v2.pptx` and why `ROI-template-master.pptx` still sits in the bucket. **The 2026-08-12 v3 change took the second path** — it added a token (`INVEST_YEARS`) and made the slide count variable — so it shipped as a NEW object `ROI-template-master-v3.pptx`, uploaded BEFORE the v729 deploy, with v2 left in place as the rollback.

**Tables read:** `client_tax_plans`, `client_tax_progress`, `clients`, `program_client_tasks`.
**Tables written:** `client_tax_plans` (`generated_presentation_drive_id`, `_url`, `_at`, `_by`).
**Chains:** none. **No emails, no notifications.**

---

## Step 1½ — Send presentation link to member before meeting (Tax 2 - Deeper Dive)

A scheduled, cron-drafted step that sits after "Generate and download presentation" in the **Tax 2 - Deeper Dive** phase (`program_client_tasks` ids 168 prog 1 / 169 prog 4, `status_options='tax_presentation_link'`, **`task_order=4` as of 2026-08-06** — it was 3 until the generator step was inserted at 2). Lets the admin queue a presentation link to go to the **member** ahead of the Tax 3 ROI meeting, sent on a chosen date.

**Schedule handler:** [`automation_TAX_presentation_schedule`](../../supabase/functions/vfo-admin-api/actions/tax/presentation-schedule.ts) — AUTH. Admin clicks the green "Schedule email" button → pastes a link + picks a date → handler writes `member_presentation_link`, `presentation_send_date`, `presentation_scheduled_at` (and nulls `presentation_email_sent_at`). **No email here.** Uses its OWN `member_presentation_link` column — deliberately separate from the Tax 3 `presentation_link` (Step 2) so the two never overwrite each other.

**Sweep handler:** [`automation_TAX_presentation_sweep`](../../supabase/functions/vfo-admin-api/actions/tax/presentation-sweep.ts) — PUBLIC service-role; daily cron `tax-presentation-sweep-daily` at **09:00 UTC**. Selects plans where `member_presentation_link IS NOT NULL` AND `presentation_email_sent_at IS NULL` AND `presentation_send_date <= today`; for each, drafts the `TAX_presentation_link` email (id 151) **To the member, Cc the assigned PF** (`[Member First]` greeting, `[PRESENTATION_LINK]` → "View the presentation" button linking the pasted URL), then stamps `presentation_email_sent_at` and **clears the assigned PF's action-required `Download the ROI presentation for%` bell** (`clearPresentationDownloadBells`, fail-soft after the draft has already been created). **This sweep is the ONLY site that stamps `presentation_email_sent_at`** — `presentation-schedule.ts` merely NULLs the column when a new send is scheduled. **It is no longer the only site that CLEARS that bell, though (v726):** `presentation-schedule.ts` now calls `clearPresentationDownloadBells` too, the moment a send date is scheduled — scheduling *is* the PF's job done, and waiting for the 09:00 UTC draft left the bell in their inbox for up to a day after the work was finished. The sweep's clear stays as the backstop for bells raised on plans scheduled before v726. **Drafts only — no auto-send**, consistent with every other automation. The frontend step shows green "Schedule email" → blue "Scheduled — <date>" (with Edit) → green "Email drafted — <date>".

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans` (`member_presentation_link`, `presentation_send_date`, `presentation_scheduled_at`, `presentation_email_sent_at`).
**Chains:** none.

---

## Step 2 — Tax 3 — "Client tax planning decision"

**Trigger:** Admin opens the `Client tax planning decision` task in Tax 3 phase → fills `TaxDecisionForm` ([TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx)) → submits. The form submits in 2 API calls back-to-back: `tax_save_task` (writes the progress row with status `Completed - <decision>`) then `automation_TAX_decision`.

**Handler:** [`automation_TAX_decision`](../../supabase/functions/vfo-admin-api/actions/tax/decision.ts) — AUTH handler. Takes `tax_plan_id`, `decision` (Yes/Undecided/No), `form_data` (JSON).

> **Member signing & paying on behalf** (added this session, mirrors MAP 1 PIP-Follow-Up). The `TaxDecisionForm` carries a Yes/No "is the member signing & paying on the client's behalf?" question. When Yes, `automation_TAX_decision` writes `client_tax_plans.member_paying_on_behalf=true` (default false), and the flag **carries through Tax 3 → Tax 4 → Tax 5**. When true, every downstream email flips **To member / Cc client**, uses the **member email-template variant** (template_name + the suffix ` (member signing/paying on clients behalf)` — 22 member rows, `email_templates` ids 126–147), the **member is the BoldSign signer 1 and the Stripe customer/payer**, and invoice/receipt **"Bill To" = member**. 14 tax handlers branch on the flag: decision, send-agreement, stripe-customer, payment-email, confirmation-email, invoice-receipt, paidbycheck, final-decision, extra-meeting, postreview-decision, refund, implement-decision, implementation-receipt, charge-implementation; plus `revshare-sweep.ts` `sendReminderEmailUnified` (all 5 reminder types flip to the member template). **NOT changed:** `ceo-countersign` (always Anton), `revshare` (pays the member their share regardless of who paid), and the Setup-phase `deposit-refund` (the deposit predates the Tax 3 decision → always client-paid).

**What it does (branches by decision):**

> **Diron Insley display-only discount** (added 2026-07-14). For clients whose `clients.member_number` = `59073` (`constants/tax-discount.ts DISCOUNT_MEMBER_NUMBER`), all three pricing forms (`TaxDecisionForm`, `TaxPricingForm` for the deferred Undecided→Yes path, and the extra-meeting outcome form) show a "Discount applied due to previous Diron Insley planning issue?" toggle + required $ input + live invoice-preview box. The value persists to `client_tax_plans.discount_applied` (server-gated by member number in `decision.ts`/`pricing.ts`/`extra-meeting.ts`; re-saving with the toggle off clears it). When > 0: the invoice PDF shows gross "Tax Planning Fee" (retainer + implementation + discount), "Discount Applied*" in red, "Net Payable", drops the "(50%)" row suffixes, and adds a small-print footnote; the retainer invoice/receipt email + implementation receipt email get a small-print footnote after the signature. **Purely cosmetic** — charged amounts, receipt PDFs, agreement, and revshare are unchanged; non-discount plans render byte-identical to before.

> **3-way revenue split + Tax Planner allocation gate** (added 2026-07-21). `TaxDecisionForm` + `TaxPricingForm` (shared by program-1 Holistic Tax Priorities + program-4 VFO Tax Planning) now split the fee three ways — **Member / Tax Planner / VFOS** — via a preset `1/3 Member, 1/3 Tax Planner, 1/3 VFOS` or a Custom mode where all three boxes are editable and must sum to `total_fee` (1-cent tolerance, PIPDecisionForm idiom). The pick persists to `member_share` / `tax_planner_share` / `vfos_share`. Strategic-member clients instead get a 4-way split from `src/lib/strategicSplits.js` (`programType='tax'`): Action Coach `{strategic .10, member .30, planner .30, vfos .30}`, Tax Plan IQ `{strategic .10, member .50, planner .20, vfos .20}` (VFOS absorbs the rounding remainder). **Allocation gate:** somebody must be allocated (via the **"Allocate Team Member / Tax Planner"** step — renamed from "Allocate to Advanced Tax Planner" on 2026-08-10 — → `tax_allocate_planner` → `client_tax_plans.tax_planner_id`; **as of v717 a Team Member satisfies this gate too**, since the column is the same and the gate only checks that it is set) before the Yes-path can submit — `decision`(Yes), `pricing`, and `extra-meeting`(Yes) return **400** without a `tax_planner_id`, and the frontend disables submit with "You must allocate a tax planner before submitting." Gotchas #252/#253/#254.

### Decision = `Yes`

1. UPDATEs plan with pricing fields: `tax_decision`, `risk_mindset`, `retainer_amount`, `implementation_amount`, `total_fee`, `split_type`, `member_share`, `tax_planner_share`, `vfos_share`, `discount_applied` (Diron clients only, see note above), `presentation_link`, `meeting_notes`, `extra_cc`, `sandbox`.
2. **Chains** `automation_TAX_sendagreement` — server-to-server via HTTP fetch + **admin auth token forwarded in body.token** (critical — see Step 4 chain auth note).

### Decision = `Undecided`

1. UPDATEs plan with: `tax_decision='Undecided'`, `potential_tax_savings`, `initial_retainer_quoted`, `tax_token` (32-byte hex generated if not already present), `presentation_link`, `meeting_notes`, `extra_cc`, `sandbox`.
2. Fetches the static **Tax Planning Engagement Agreement PDF** from Supabase Storage public URL `https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/tax-agreements/tax-planning.pdf` (no auth required). When `member_paying_on_behalf=true` it instead uses the member-paid variant `tax-agreements/tax-planning-member.pdf` (not yet uploaded by the user → code falls back to `tax-planning.pdf` if missing).
3. Loads `email_templates` row `'TAX_decision_undecided'`.
4. Builds `[BUTTONS]` HTML — 3 buttons (Yes / No / Extra Meeting) pointing to `https://vfoportal.com/tax-decide?token=<tax_token>&decision=<choice>`. Same green/red/blue styling as MAP1's `[BUTTONS]`.
5. Substitutes `[Client Name]`, `[Client First]`, `[Meeting Attendees]` (= "[PF Name] and [Member Name]"), `[Member Name]`, `[PF Name]`, `[TAX_SAVINGS]`, `[INITIAL_RETAINER]`, `[BUTTONS]`, `[PRESENTATION_LINK]`.
6. Builds **multipart MIME** Gmail draft to client with the PDF attached as `Tax-Planning-Engagement-Agreement.pdf`.
   - MIME headers built without empty-string CC/BCC lines (see "MIME-empty-line bug" gotcha).
7. Flips `tax_decision_email_sent='Yes'` AND writes `tax_decision_email_sent_at=now()`. Both columns must be set together — the boolean-flag is the idempotency guard, the timestamp is the base for the **2-business-day** reminder + **4-business-day** PF-notification timers driven by `tax-revshare-sweep-daily` (both tiers count Mon–Fri UTC only — 2026-08-14).

### Decision = `No`

1. UPDATEs plan with `tax_decision='No'`, `presentation_link`, `meeting_notes`, `extra_cc`, `sandbox`.
2. Loads template `'TAX_decision_decline'`.
3. Substitutes `[Client Name]`, `[Client First]`, `[Meeting Attendees]` (= "[PF Name] and [Member Name]"), `[Member Name]`, `[PF Name]`, `[PRESENTATION_LINK]` (clickable anchor, or "(no link provided)").
4. Creates Gmail draft to client.
5. Flips `tax_decision_email_sent='Yes'`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans`.
**External calls:** Supabase Storage public-URL fetch (Undecided only — PDF), Gmail drafts.
**Chains:** `automation_TAX_sendagreement` (Yes only).

> **Chain auth gotcha:** the chain forwards `body.token` (the admin session token from frontend `callApi`) in the chain body, NOT just the Authorization header. The frontend's `callApi` sends `Authorization: Bearer <SUPABASE_ANON_KEY>` and the admin session token in body.token — the auth gate reads token from the body. Forgetting this returns 401 from the chained handler.

---

## Step 3a — Client clicks decision button on `/tax-decide` (Undecided path only)

**Trigger:** Client receives the email, clicks one of the 3 buttons. Browser navigates to [TaxDecidePage.jsx](src/pages/TaxDecidePage.jsx) at `/tax-decide?token=<tax_token>&decision=Yes|No|ExtraMeeting`. **Opening the link records NOTHING** — the page validates the params and renders a confirmation card; the client must click its button to submit (2026-07-27, gotcha #290).

**Handler:** [`automation_TAX_finaldecision`](../../supabase/functions/vfo-admin-api/actions/tax/final-decision.ts) — PUBLIC handler (pre-auth), called via raw fetch from `/tax-decide` on the confirm button's `onClick`. Handler, body and token are unchanged.

**What it does:**
1. Looks up plan by `tax_token`. If `tax_final_decision` already set, returns `existing_decision` (idempotent).
2. UPDATEs `tax_final_decision`.
3. Branches:
   - **`Yes`**: inserts `notifications` row (recipient='admin', pipeline='TAX', title `"X chose to proceed with tax planning"`, link to admin client detail). Admin must then complete pricing form.
   - **`ExtraMeeting`**: inserts `notifications` row (`"X requested extra meeting (tax)"`).
   - **`No`**: loads template `'TAX_decision_decline'`, drafts Gmail decline email to client. No notification.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans` (tax_final_decision), `notifications` (Yes/ExtraMeeting).
**Chains:** none — admin still needs to submit pricing / extrameeting outcome manually.

---

## Step 3b — PCADMIN pricing (Undecided → Yes path)

**Trigger:** After client picks Yes via `/tax-decide`, admin sees the notification, opens the client, in the AI PC Admin task (Tax 3) a pricing form auto-appears. Admin fills retainer/implementation/total/split/member/VFOS shares + risk mindset, submits.

**Handler:** [`automation_TAX_pricing`](../../supabase/functions/vfo-admin-api/actions/tax/pricing.ts) — AUTH handler.

**What it does:**
1. Validates `tax_final_decision='Yes'` AND `agreement_sent !== 'Yes'`.
2. Marks all unread admin notifications for this client as read (pipeline='TAX').
3. UPDATEs plan pricing fields.
4. **Chains** `automation_TAX_sendagreement` (admin token forwarded in body.token).

**Tables read:** `client_tax_plans`.
**Tables written:** `client_tax_plans`, `notifications.read=true`.
**Chains:** `automation_TAX_sendagreement`.

---

## Step 3c — PCADMIN extra meeting (Undecided → ExtraMeeting path)

**Trigger:** After client picks ExtraMeeting via `/tax-decide`, admin schedules + holds the meeting (manual), then in AI PC Admin task clicks **Yes — proceed with pricing** (opens pricing form) or **No — decline**.

**Handler:** [`automation_TAX_extrameeting`](../../supabase/functions/vfo-admin-api/actions/tax/extra-meeting.ts) — AUTH handler. Takes `outcome` (Yes/No) and `form_data` if Yes.

**What it does:**
- **Yes outcome:** UPDATEs `tax_via_extra_meeting=true` + all pricing fields. Clears unread notifications. **Chains** `automation_TAX_sendagreement`.
- **No outcome:** UPDATEs `tax_via_extra_meeting=true`, `tax_final_decision='No'` (overrides 'ExtraMeeting'). Drafts decline email (reuses `TAX_decision_decline` template). No chain.

**Tables written:** `client_tax_plans`, `notifications.read=true`.
**Chains:** `automation_TAX_sendagreement` (Yes only).

---

## Step 4 — Send agreement to BoldSign

**Trigger:** Server-to-server chain from `automation_TAX_decision` (Yes), `automation_TAX_pricing`, or `automation_TAX_extrameeting` (Yes outcome). NOT directly user-triggered.

**Handler:** [`automation_TAX_sendagreement`](../../supabase/functions/vfo-admin-api/actions/tax/send-agreement.ts) — AUTH handler.

**What it does:**
1. Validates `retainer_amount` is set and `agreement_sent !== 'Yes'`.
2. Loads `agreement_templates` row `(pipeline='TAX', service_level='Tax Planning', payment_plan='Single', active=true)` **plus `.eq("payer_type", memberPays ? "member" : "client")`** — REQUIRED now that two TAX rows exist (client id 8 + member id 20). The member row (id 20, BoldSign template `3e575f15-...`) has a `<!--MC-->...<!--/MC-->` member-contribution block that `send-agreement.ts` **strips at render** so the PDF matches the member field_map coordinates (captured from the stripped PDF). When `member_paying_on_behalf=true`, the **member is BoldSign signer 1** (CEO Anton still signer 2).
3. Renders HTML body with placeholder substitutions: `[CLIENT_NAME]`, `[CLIENT_EMAIL]`, `[TAX_RISK_MINDSET]`, `[TOTAL_FEE]`, `[RETAINER_PAYMENT]`, `[IMPLEMENTATION_FEE]`.
4. POSTs to `https://api.html2pdf.app/v1/generate` to produce PDF.
5. POSTs to `https://api.boldsign.com/v1/document/send` with `EnableSigningOrder=true`, `DisableEmails=true`, two signers (client first, CEO Anton second). Hardcoded `BrandId=f6b2e092-73a4-438e-b786-ebd20e472732`. Form fields built from `agreement_templates.field_map` (7 fields: addr+phone on page 1, ceoSig+ceoDate+clientSig+printName+clientDate on page 3 — coordinates user-supplied).
6. Polls `getEmbeddedSignLink` for client signer (5 retries × 5s).
7. UPDATEs plan: `agreement_sent='Yes'`, `boldsign_doc_id`, `client_signed='No'`, `ceo_signed='No'`, `signed_followup_sent_date=<today>`.
8. Loads template `'TAX_agreementsent|Yes'`, substitutes `[ENGAGEMENT]` with embedded sign-link `<a>` tag.
9. Creates Gmail draft to client (`From: VFO Services <aipc@vfo-services.com>`). CC member + PF + parsed `extra_cc`. BCC `aanderson` + `platham`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `agreement_templates`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans` (agreement_sent, boldsign_doc_id, client_signed, ceo_signed, signed_followup_sent_date).
**External calls:** html2pdf.app, BoldSign send + getEmbeddedSignLink, Google OAuth + Gmail drafts.
**Chains:** none — waits for BoldSign webhook.

> **Sandbox config gotcha:** sendagreement reads `pipeline_sandbox_config` for `pipeline='TAX'`. **Without a TAX row, it defaults to live mode** and creates the BoldSign doc in the live BoldSign account where webhooks aren't configured (MAP1's webhooks live on the sandbox account). Result: doc creates, signing works, BUT webhooks never fire. Fix is `INSERT INTO pipeline_sandbox_config ('TAX', sandbox_mode=true, sandbox_email='jlatham@elitert.com', ...)` matching MAP1's sandbox row.

---

## Step 5 — Client signs in BoldSign

**Trigger:** Client opens the Gmail draft (after admin reviews + sends), clicks the embedded sign link, signs in the BoldSign-hosted iframe.

**Handlers:** Both webhook surfaces have tax routing — `boldsign-webhook` standalone function AND `vfo-admin-api/router/webhooks.ts:maybeHandleBoldSignWebhook` (embedded). The standalone is the live URL per BoldSign sandbox dashboard config: `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/boldsign-webhook`. Either handler works — both have tax routing.

**Both handlers:**
1. Receive `event.eventType='Signed'` with the client's signer info.
2. Try `pipeline_map1` lookup first (existing MAP1 logic untouched).
3. If MAP1 miss, fall back to `client_tax_plans` lookup by `boldsign_doc_id`.
4. If `client_signed === 'Yes'` already, idempotent skip.
5. UPDATEs `client_signed='Yes'`.
6. **Chains** `automation_TAX_ceocountersign` via service-role auth.

**Tables written:** `client_tax_plans.client_signed='Yes'`.
**Chains:** `automation_TAX_ceocountersign`.

> **JWT-verification gotcha:** `boldsign-webhook` MUST be deployed with `--no-verify-jwt` flag, AND `config.toml` must have `verify_jwt = false` for `[functions.boldsign-webhook]`. Without these BoldSign gets 401 silently. The CLI deploy default ENABLES JWT verification — easy regression.

---

## Step 6 — CEO countersign email

**Trigger:** Server-to-server chain from BoldSign webhook (after client signed).

**Handler:** [`automation_TAX_ceocountersign`](../../supabase/functions/vfo-admin-api/actions/tax/ceo-countersign.ts) — PUBLIC handler (service-role auth from webhook).

**What it does:**
1. Validates `boldsign_doc_id` exists, `ceo_signed !== 'Yes'`.
2. Polls BoldSign `getEmbeddedSignLink` for `aanderson@elitert.com` (3 retries × 2s).
3. Loads template `'TAX_ceocountersign|Yes'`.
4. Substitutes `[Client Name]`, `[Total Fee]`, `[SIGNING_LINK]`.
5. Creates Gmail draft to CEO with embedded sign link.

**Chains:** none — waits for CEO to sign.

---

## Step 7 — CEO signs in BoldSign

**Trigger:** CEO opens the Gmail draft (after admin sends), clicks the sign link, signs.

BoldSign fires `event.eventType='Signed'` with CEO email AND eventually `event.eventType='Completed'` once both signers are done.

**Handlers (both webhook surfaces):**
- On `Signed` with CEO email → UPDATE `ceo_signed='Yes'`. No chain (single-signed event).
- On `Completed` → UPDATE both `client_signed='Yes'` and `ceo_signed='Yes'` (idempotent re-set). **Chains** `automation_TAX_stripecustomer`.

> **Sandbox email collision:** in sandbox mode, both client + CEO BoldSign signers get the same `sandbox_email` (override). The webhook's `signerEmail === ceoEmail` check fails (both look like the client). Doesn't matter because the `Completed` event sets both flags + fires the chain regardless.

---

## Step 8 — Create Stripe customer + send payment email

**Trigger:** Server-to-server chain from BoldSign webhook (Completed event).

**Handler:** [`automation_TAX_stripecustomer`](../../supabase/functions/vfo-admin-api/actions/tax/stripe-customer.ts) — PUBLIC handler (service-role from webhook).

**What it does:**
1. Validates plan exists. If `stripe_customer_id` already set, idempotent return.
2. POSTs to `https://api.stripe.com/v1/customers` with `email`, `name`, `metadata[tax_plan_id]`, `metadata[client_id]`, `metadata[pipeline]='TAX'`.
3. UPDATEs `client_tax_plans.stripe_customer_id`.
4. Generates 32-byte `checkout_token` (hex), UPDATEs `client_tax_plans.checkout_token`.
5. **Chains** `automation_TAX_paymentemail`.

**Then:** [`automation_TAX_paymentemail`](../../supabase/functions/vfo-admin-api/actions/tax/payment-email.ts):
1. Loads template `'TAX_paymentemail|Yes'`.
2. Substitutes `[PAYMENT_LINK]` with `<a href="https://vfoportal.com/tax-pay?token=<checkout_token>">Complete Payment</a>`.
3. Creates Gmail draft to client (To: client only — no CC/BCC, matching MAP1).

**Tables written:** `client_tax_plans.stripe_customer_id`, `.checkout_token`.
**External calls:** Stripe customers create, Google OAuth + Gmail drafts.

> **Stripe customer is per-tax-plan, NOT reused from MAP1.** Even if the same client has an existing `pipeline_map1.stripe_customer_id`, tax creates a fresh customer. Design choice — keeps tax payment isolated from MAP1.

---

## Step 9 — Client pays on `/tax-pay` page

**Trigger:** Client opens the Gmail draft (after admin sends), clicks Complete Payment button. Lands on [TaxPayPage.jsx](src/pages/TaxPayPage.jsx) at `/tax-pay?token=<checkout_token>`.

**Handlers (raw fetch, no session):**

1. [`automation_TAX_loadpayment`](../../supabase/functions/vfo-admin-api/actions/tax/load-payment.ts) — looks up plan by `checkout_token`, returns `client_name`, `pipeline='TAX'`, `payment_label='Tax Planning Retainer'`, `payment_amount=retainer_amount`, `payment_x='1'`, `payment_y='1'`.
2. Client picks ACH or Card → [`automation_TAX_stripecheckout`](../../supabase/functions/vfo-admin-api/actions/tax/stripe-checkout.ts) creates Stripe Checkout Session with `customer=<stripe_customer_id>`, single line item, `metadata.tax_plan_id`, `metadata.client_id`, `metadata.checkout_token`, `metadata.pipeline='TAX'`. **Two branches by plan state**:
   - **Retainer (initial):** `retainer_status` IS NULL → amount=`retainer_amount`, product name "Retainer", `metadata.payment_kind='retainer'`, includes `payment_intent_data[setup_future_usage]=off_session` so the card is saved for the later off-session implementation charge.
   - **Implementation retry:** `retainer_status='succeeded'` AND `implementation_charge_status IN (declined, auth_required, manual_required)` → amount=`implementation_amount`, product name "Implementation Fee", `metadata.payment_kind='implementation'`, **no** `setup_future_usage`. Same `/tax-pay` page + same `checkout_token`, but the page's loadpayment + this handler both branch on plan state. Used by the Phase 7 charge-implementation failure-recovery flow (saved-card off-session charge failed → fresh checkout_token regenerated → client gets a new `/tax-pay` Gmail draft).
   - Any other resolved state → `"Payment already completed"` 400 error.

   Returns Stripe URL.
3. Client redirected to Stripe → enters payment → Stripe charges → Stripe redirects to `https://www.vfo-services.com/payment-successful/` (leaves SPA).

**Chains:** none — waits for Stripe webhook.

---

## Step 10 — Stripe webhook fires

**Trigger:** Stripe sends `checkout.session.completed` to admin-api with `stripe-signature` header. See [stripe-webhook.md](stripe-webhook.md) for full dispatch.

**Tax retainer payment** ([webhooks.ts](../../supabase/functions/vfo-admin-api/router/webhooks.ts) — extension AFTER MAP1's logic):
1. Looks up `pipeline_map1` by `stripe_customer_id` (MAP1 logic).
2. If MAP1 miss, looks up `client_tax_plans` by `stripe_customer_id`.
3. Expands the PaymentIntent to get `payment_method.type` and `last4`.
4. UPDATEs `retainer_status` (`succeeded` for card, `processing` for ACH), `payment_method_type`, `acct_last4`, `card_processing_fee`, `retainer_date`, `retainer_payment_intent_id`. Sets `retainer_confirmation_status='Confirmation Needed'`.
5. **Chains** `automation_TAX_confirmationemail` always — for BOTH methods, deliberately. The handler also raises the "paid the retainer" PF bell and copies the signed agreement into the ERT vault, so the card gate lives INSIDE it (see Step 11): a card retainer gets no client confirmation email.
6. **Chains** `automation_TAX_invoicereceipt` for card only — ACH waits.

**For ACH retainer cleared** (subsequent `payment_intent.succeeded` with `metadata.payment_kind='retainer'` and `retainer_status='processing'`):
- UPDATEs `retainer_status='succeeded'`, **chains** `automation_TAX_invoicereceipt`.

> **No revshare chain on Stripe webhook for tax.** Tax retainer revshare is gated by the Tax 4 Continue path — admin records `post_review_decision='Continue - Revenue Share'`, then revshare fires **only** when the client clicks the green "Continue now" button in the post-review email (`post_review_client_decision='Confirmed'`). **As of 2026-07-22 this is CLICK-ONLY — the 24h auto-lock is REMOVED (gotcha #264):** Tax 4 no longer writes `post_review_client_decision='Auto-Locked'`; if the client never clicks, the sweep runs a Continue reminder ladder (**2-business-day** reminder email + **4-business-day** PF bell) but never auto-fires revshare. MAP1 auto-chains revshare on payment; tax does not.

---

## Step 10⅔ — Check-payment branch (parallel to Step 10)

Some clients prefer to pay by physical check. Admin uses the **Tax Automation Panel** (Automation tab → "Holistic Planning - Tax Planning") to manage this:

### "Pay via check" button

Visible when `checkout_token IS NOT NULL` AND `retainer_status IS NULL`.

**Handler:** [`automation_TAX_paidbycheck`](../../supabase/functions/vfo-admin-api/actions/tax/paidbycheck.ts) — admin-only.

**What it does:**
1. Sets `payment_method_type='check'`, `retainer_status='check_pending'`, `retainer_date=CURRENT_DATE`.
2. Drafts a Gmail to the client with the check mailing address (template `TAX_paidbycheck|check`). Mailing address: `12636 High Bluff Drive, Suite 400, San Diego, CA 92130`. Sandbox-aware. Non-fatal — if Gmail fails, DB state still reflects check path.

**Side effect:** the `automation_TAX_stripecheckout` rejects "Payment already completed" when `retainer_status` is truthy. `/tax-pay` link is auto-blocked.

### "Mark check cleared" button

Visible when `payment_method_type='check'` AND `retainer_status='check_pending'`.

**Handler:** [`automation_TAX_checkcleared`](../../supabase/functions/vfo-admin-api/actions/tax/checkcleared.ts) — admin-only.

**What it does:**
1. Sets `retainer_status='succeeded'`, `retainer_confirmation_status='Confirmation Needed'`.
2. **Chains** `automation_TAX_confirmationemail` (uses `TAX_confirmationemail|check` template — `[PROCESSING_TIME]` substituted to "Your check has been received and cleared."). **The check path is deliberately EXEMPT from the card receipt-only policy** — a cleared check still gets both the confirmation and the docs.
3. **Chains** `automation_TAX_invoicereceipt`.
4. No revshare chain — handled by Phase 6 admin button.

---

## Step 11 — Confirmation email *(ACH + check only — a card retainer is receipt-only)*

**Trigger:** Server-to-server chain from Stripe webhook OR `automation_TAX_checkcleared`.

**Handler:** [`automation_TAX_confirmationemail`](../../supabase/functions/vfo-admin-api/actions/tax/confirmation-email.ts) — PUBLIC handler.

**What it does:**
1. Validates `retainer_confirmation_status` is neither `'Sent'` NOR `'Skipped - Card (Receipt Only)'` — both are terminal (idempotent; without the second value a replayed webhook would re-raise the PF bell).
2. Loads template `'TAX_confirmationemail|card'`, `'|ach'`, or `'|check'` based on `payment_method_type`.
3. Substitutes `[Client Name]`, `[Client First]`, `[Payment Amount]`, `[CARD_FEE_TEXT]` (empty for ACH/check), `[PROCESSING_TIME]` (ACH: "2-4 business days...", check: "Your check has been received and cleared.").
4. **Card retainer → the client Gmail draft is SKIPPED** (`cardReceiptOnly = !isImpl && isCard`). The card has already cleared and the Step 12 invoice/receipt lands in the same moment. **ACH and check still get the draft** (client only, no CC/BCC — same as MAP1's confirmation pattern).
5. UPDATEs `retainer_confirmation_status='Sent'` on the emailed paths; on the skipped card path it writes **`'Skipped - Card (Receipt Only)'`** (`constants/confirmation-status.ts CONFIRMATION_CARD_SKIP`, mirrored in the frontend at `src/lib/confirmationStatus.js`) and **deliberately does NOT stamp `retainer_confirmation_email_sent_at`**, so a manual admin resend stays possible.
6. Raises the **"paid the retainer" PF bell** (`TAX_retainer_paid`, notification #8b below) — retainer kind only.
7. **NEW 2026-07-31 (v687): raises ONE bell to Tray asking her to schedule the Detailed tax plan meeting** — rule **`TAX_retainer_paid_schedule_meeting`**, code-default recipients `["tvaldes@elitert.com"]`, title `"<Client First Last> has decided to move forward with tax planning"`, message `"Please schedule the Detailed tax plan meeting."`, link `/admin/client/<id>?tab=tax&program=<program_id||1>`, `dismissible:true`, `dedupe:"unread"`, wrapped in try/catch so a notification failure can never fail the payment handler. It sits in the retainer-only (`!isImpl`) block **after** step 5/6 and **before** the ERT agreement copy, which means it fires at `checkout.session.completed` for **BOTH card and ACH** — deliberately at submit time, NOT held for ACH settlement, because Tray should start booking the moment the client commits. Check payers reach the same point at check-clear via the `automation_TAX_checkcleared` chain (intended). The step-1 terminal-status early-return makes it exactly-once on a webhook replay. **The key is deliberately DISTINCT from the `TAX_retainer_paid` PF rule** — see gotcha #313 (a reused key would have made the seed a no-op and coupled the two bells in the Notification Editor). Seed migration `20260731140000_tax_retainer_paid_tray_bell.sql`.

> **The gate lives INSIDE the handler, not at the webhook call site, on purpose.** The blocks after the draft — the "paid the retainer" PF bell, the Tray scheduling bell and the `copyAgreementToErtOnce` vault copy — are retainer-payment side effects that MUST still run for a card. A call-site gate would silently kill them. Implementation charges are unaffected (they have had no confirmation email since 2026-07-15).

**Chains:** none.

---

## Step 12 — Invoice & receipt PDFs + Drive + email

**Trigger:** Server-to-server chain from Stripe webhook (card immediately; ACH after `payment_intent.succeeded`) OR `automation_TAX_checkcleared`.

**Handler:** [`automation_TAX_invoicereceipt`](../../supabase/functions/vfo-admin-api/actions/tax/invoice-receipt.ts) — PUBLIC handler.

**What it does:**
1. **Idempotent** on `retainer_receipt_status='Sent'`.
2. **Generates document numbers** from `document_numbers` table count. `INV-<client_ref>-<seq>` and `REC-<client_ref>-<seq>`. Updates `retainer_invoice_number` and `retainer_receipt_number` on the plan. (Same not-serialized concurrency caveat as MAP1.)
3. **Renders HTML** via inline `generateTaxInvoiceHTML()` and `generateTaxReceiptHTML()` (defined in [invoice-receipt.ts](../../supabase/functions/vfo-admin-api/actions/tax/invoice-receipt.ts) itself, not extracted to utils).
   - **Invoice** shows: VFO Tax Planning header, client info, engagement details (service: "Tax Planning Engagement", payment method), payment schedule table with TWO rows: Retainer (50% — paid today, ✓ Paid) + Implementation Fee (50% — Scheduled, due on first specialist implementation). For card, an extra "Total Charged for Retainer" row including card processing fee, with the ✓ Paid badge moved there (not on the base retainer row — single Paid badge per fee group). When `plan.discount_applied > 0` (Diron Insley clients — see the Step 2 note), the engagement-details total row becomes three rows (gross "Tax Planning Fee" / red "Discount Applied*" / "Net Payable"), schedule labels drop "(50%)", the bottom band reads "Net Payable", and a small-print footnote is appended; the email body also gets a small-print footnote after the signature (same for the implementation receipt email).
   - **Receipt** shows: green header, payment received line, payment details (invoice ref, service, payment method, date), amount received card, card fee breakdown if applicable, note about implementation fee being charged separately.
4. **Generates PDFs** via two POST calls to `https://api.html2pdf.app/v1/generate`.
5. **Uploads to Google Drive**: finds or creates a per-client folder named `<first> <last> - <client_ref>` under `GOOGLE_DRIVE_FOLDER_ID`. Uploads both PDFs as multipart, retrieves file IDs.
6. UPDATEs `retainer_invoice_drive_id` and `retainer_receipt_drive_id`.
7. Loads template `'TAX_invoicereceipt_email|retainer'`.
8. Re-fetches the PDFs from Drive (`?alt=media`) as base64.
9. Builds **multipart MIME** Gmail draft with both PDFs attached. CC member + PF + `tracy@vfo-services.com`. **Critical: CC/BCC lines only pushed if non-empty — empty strings in the headers array breaks Gmail parsing (first empty line is the body separator).**
   - **`[PORTAL_SETUP]` "create your account" button** (added in the presentation-step session, mirroring MAP 1's first-payment email): mints `clients.client_setup_token` if null, then replaces the template's trailing `[PORTAL_SETUP]` with a "Set up your secure portal login" button → `https://vfoportal.com/client-setup?token=<client_setup_token>`. The member-paid variant (id 137, email goes To the member) addresses the button to the client by first name. Same `/client-setup` page + token column as MAP 1 — no new route.
10. UPDATEs `retainer_invoice_email_sent=true`, `retainer_receipt_status='Sent'`.

**Tables read:** `client_tax_plans`, `clients` (incl. `client_setup_token`), `members`, `pipeline_sandbox_config`, `email_templates`, `document_numbers`.
**Tables written:** `document_numbers` (insert), `clients` (`client_setup_token` mint), `client_tax_plans` (numbers + drive IDs + email_sent + receipt_status).
**External calls:** html2pdf.app ×2, Google OAuth, Drive search/create/upload/download, Gmail drafts (multipart).
**Chains:** none — Phase 6 (revshare/refund) is admin-button-driven.

---

## Step 12½ — Tax 4 Detailed tax plan meeting confirmation email + in-app reminder to the planner & Tracy

**Trigger:** Admin opens the **"Detailed tax plan meeting confirmation email"** task at the top of the `Tax 4 - Tax Plan Review` phase (RENAMED 2026-07-22 from "High Level Meeting Confirmation Email"; the name is exact-matched in the FE `PLANNER_EDITABLE_TASK_NAMES` whitelist, so both were changed together — gotcha #262). The task lives in `program_client_tasks` ids **153 + 154** (both tax programs — Holistic Planning phase 21 + standalone Tax Planning phase 29) with `task_order=0` (above `Detailed tax plan presentation`); `status_options` is `tax_hlm_confirm`. The task renders a single green **"Send email (with date)"** button plus date (required) / time / timezone pickers. It is one of the planner-editable steps (saves via `automation_TAX_highlevelmeeting_confirm`, not `tax_save_task`).

**Handler:** [`automation_TAX_highlevelmeeting_confirm`](../../supabase/functions/vfo-admin-api/actions/tax/highlevel-meeting-confirm.ts) — AUTH admin-only (registered in `router/dispatch.ts`). Takes `tax_plan_id` + `meeting_date` (required) + optional `meeting_time` / `meeting_timezone`.

**What it does:**
1. Loads the template `TAX_highlevelmeeting_confirm|Yes` (id 148, **CLIENT-ONLY** — no member variant). **As of 2026-07-22 the hardcoded "Tim Gacsy" was replaced with the `[Planner Name]` token** (substituted per-send from the plan's allocated planner; templates 148/16/25/137 were de-hardcoded). The template also carries `"TAX_PLANNER"` in its `cc_list` (the new "Tax Planner" recipient chip — gotcha #266) so the allocated planner is Cc'd on live-mode sends.
2. Drafts a Gmail confirmation to the client.
3. Records `client_tax_plans.tax4_meeting_date` + new columns `tax4_meeting_time` / `tax4_meeting_timezone` + `tax4_meeting_confirm_email_sent_at`.
4. **Nulls `tax4_meeting_reminder_last_sent_at`** so the in-app reminder (below) fires fresh.

> The old `automation_TAX_save_meeting_date` handler is now orphaned (its frontend caller was removed) but still registered. (An earlier note here claimed an unused `TAX_meeting_nudge|Yes` template row survives in the DB — **it does not**; no `email_templates` row matches `%meeting_nudge%`.)

**In-app reminder — SUPERSEDED 2026-08-11 (#170); the two old tiers are DORMANT.** Both `TAX_tax4_decision_needed` (PF + planner + Tracy, action-required, title `Client decision 1 needed — <client>`) and the planner FYI `TAX_planner_post_meeting` ("Confirm detailed tax plan presentation completion and client decision 1") **have lost their call sites**; their rule rows are kept enabled for rollback + Editor visibility, and their clears stay in the code because unread rows of both shapes exist in production. Per gotcha #178, removing the call site is what stopped the bells.

**What fires instead:** the `tax-revshare-sweep-daily` cron (02:30 UTC) raises **ONE persistent action-required bell to the ALLOCATED PLANNER** — rule **`TAX_planner_tax4_steps_needed`**, title **`Complete the tax plan review steps for <client>`** — when `tax4_meeting_date < today` AND a planner is set AND `tax4_meeting_reminder_last_sent_at IS NULL` (the **same** one-shot guard column the old PF tier used; `automation_TAX_highlevelmeeting_confirm` nulls it on every re-confirm). It asks for **BOTH** steps that meeting produces — "Detailed tax plan presentation" **and** "Client decision 1" — and is skipped outright when both are already done (`tax4StepsSatisfied`), because an already-satisfied action-required bell would be unretirable. Rule-disable-gated BEFORE the stamp (gotcha #176). **This trigger is a deliberate CALENDAR survivor of the 2026-08-14 business-day conversion** — it is not a delay ladder at all but a comparison against a real meeting date, and a meeting that happened on Friday has still happened by Saturday. (The older `sendMeetingNudgeEmail` function that drafted a daily Gmail is **DELETED**; the departed-Tim-Gacsy recipient re-cut of the old tier is gotcha #291, the planner `links` override #292.)

**Cleared by:** the new bell is retired when **BOTH** halves are done, whichever lands second — `save-task.ts` (the presentation dropdown) and `postreview-decision.ts` (Client decision 1, **every** branch, Stop - Refund included) both call `clearTax4StepBellsWhenBothDone`. `postreview-decision.ts` ALSO still runs the legacy `.ilike("title","Client decision 1 needed%")` clear for the dormant tier's surviving rows.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, `email_templates`(`TAX_highlevelmeeting_confirm\|Yes`).
**Tables written:** `client_tax_plans` (`tax4_meeting_date`, `tax4_meeting_time`, `tax4_meeting_timezone`, `tax4_meeting_confirm_email_sent_at`, `tax4_meeting_reminder_last_sent_at` nulled via handler; reminder timestamp set via sweep), `notifications` (sweep insert; postreview-decision clear).
**External calls:** Google OAuth + Gmail drafts API.
**Chains:** none. The PF / planner / Tracy click the Tax 4 `Client decision 1` dropdown (which clears every recipient's copy of the notification — the clear matches on title) to advance to Step 13.

> **Audit-date UX**: all tax-tab task date inputs were converted to read-only `Mar 15, 2026`-style small text spans during the earlier redesign. The completed_date still auto-populates from `tax_save_task` on first save; the inline back-date input was removed.

> **Login redirect bonus**: as part of this work, `AdminLogin.jsx` now reads a `?next=` query param post-login and navigates there instead of `/admin`. `ClientDetail.jsx` and `AdminPortal.jsx` set `?next=` when bouncing unauthenticated users to login. So clicking the email link from a fresh browser session → login → land directly on the client Tax tab (no manual navigation needed).

---

## Step 13 — Tax 4 Continue/Undecided/Stop

**Trigger:** After Tax Plan Review meeting (Tax 4 phase, manual), admin picks one of the 3-option `Client decision 1` values. Picks `automation_TAX_postreviewdecision` which sends the appropriate client email:

- **`Continue - Revenue Share`** → drafts client email with **two buttons**: green "Continue now" (→ immediate revshare, writes `post_review_client_decision='Confirmed'`) + red "Refund my retainer" (fires refund chain). **CLICK-ONLY as of 2026-07-22 (gotcha #264): the 24h auto-lock is REMOVED** — if the client never clicks, revshare NEVER auto-fires; instead the sweep runs a Continue reminder ladder (**2-business-day** reminder email via `TAX_postreview_continue_reminder_email`, reusing the `TAX_postreview|Reminder` template + **4-business-day** PF bell `TAX_postreview_continue_stalled`, title "«Client name» hasn't made a decision on Client decision 1"), REUSING the `post_review_reminder_sent_at`/`post_review_pf_notified_at` guard columns (safe — Continue and Undecided are mutually exclusive per plan). Client email body was rewritten (templates 35/138) to drop all 24h language.
- **`Undecided`** → drafts client email with green "Proceed with planning" + red "Refund my retainer". **2-business-day** sweep reminder + **4-business-day** PF notification if neither clicked. Client Proceed click writes `post_review_client_decision='Proceed'` and fires revshare; client Refund click fires refund.
- **`Stop - Refund`** → no client email; immediately chains `automation_TAX_refund` server-to-server. Engagement closes.

Both Tax 4 client buttons land on `/tax-postreview-decide`, which as of 2026-07-27 renders a confirmation card first and records nothing until the client clicks it (gotcha #290). Revshare + refund handler details follow below. The `tax-revshare-sweep-daily` cron (02:30 UTC) drives the Continue **and** Undecided ladders — **2 business days / 4 business days as of 2026-08-14**, and **neither path, nor Tax 5's, auto-locks or auto-charges anything any more**.

> **The `window_expired` flag on `/tax-postreview-decide` is NOT a 24h window and never was one since #264.** `postreview-client-decision.ts` keeps a **money-moved** backstop — a **Refund** click is rejected once the retainer revenue share has already been transferred — and that rejection still returns the JSON flag `window_expired` purely because the frontend `TaxPostReviewDecidePage` reads that key. Do not read the name as evidence of a grace period; the Tax 5 twin was renamed `already_charged` for exactly this reason.

### Revenue Share path

**Handler:** [`automation_TAX_revshare`](../../supabase/functions/vfo-admin-api/actions/tax/revshare.ts) — PUBLIC handler. Takes `tax_plan_id` + `payment_kind` (`'retainer'` | `'implementation'`). Mirrors MAP1's `automation_CONTRACT_revshare` with column-family branching by `payment_kind`.

**Frontend:** Tax 4 `Client decision 1` Continue button at [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx) `saveTask` → `callApi('automation_TAX_revshare', { tax_plan_id, payment_kind: 'retainer' })` → derived-status write to `Revenue share for initial 50%` subtask progress row (`Completed - Revenue Share` | `Completed - Money Mapping` | `Completed - N/A` | `Failed` | `Pending`).

> **⚠️ Updated 2026-07-01 (gotcha #164):** the **Tracy Revenue-Master cross-check was REMOVED** from `tax/revshare.ts`. Steps 3–6 below (reading the sheet, matching the tab/receipt row, and the `K+L+M+N+O=J` reconciliation) **no longer happen** — the share now pays the instant the payment clears, amounts taken straight from the PF input form on `client_tax_plans`. The **trigger is unchanged** (still the Tax 4 Continue/Confirmed client-click decision — that business gate stayed; note the 24h auto-lock was removed 2026-07-22, so the trigger is now the client click only — gotcha #264). The handler also now transfers the 10% **strategic partner share** to the partner company (½ retainer / ½ implementation) + drafts the partner rev-share email when the connected member is a strategic member.

> **⚠️ Added 2026-08-12 (v731–v733, gotchas #377–#380): a MIGRATED plan can now arrive here with LIVE retainer legs.** The Payment Continuation tool's opt-in **"Retainer revenue share NOT paid yet"** checkbox (`retainer_share_unpaid` on `migration_backfill_tax`) is for the client whose retainer was collected on the old system but whose revenue share was **never paid anywhere**. It leaves `retainer_rev_share` / `retainer_rev_paid` / `retainer_rev_completed_at` **NULL** — and `retainer_planner_paid` / `_completed_at` NULL too, **but only when a stored `tax_planner_share > 0` exists** (`transferPlannerShare` skips a null share with no DB write, so a share-less pending leg would never resolve). The **strategic leg stays pre-settled**. Three consequences for this handler: (a) the step-1 `isResolved` skip **no longer fires** on such a plan, so it runs to completion and pays both legs in one run, seconds apart — **out of the VFO platform Stripe balance**, since the retainer cash itself is on the old system; (b) that is exactly why the **strategic** guard at step 9 was hardened from `!== "Yes"` to the full terminal list `["Yes", "N/A — No Share Due"]` — a migration-settled strat leg would otherwise have re-fired a partner transfer (#380); and (c) **nothing may pre-stamp `'Pending'`** on a leg that has not been triggered — see step 2 below and #377.

**What it does:**
1. Validates plan + receipt number exists, idempotent skip if `rev_paid` already resolved (`Yes`/`Money Mapping`/`N/A — No Share Due`).
2. Sets `[revShareKey]='Pending'` upfront. **This is the ONLY writer of that value, and it runs only AFTER the client's decision-1 confirm — which is what makes `'Pending'` mean "the handler started and did not finish" and what makes `tax_revshare_sweep`'s `isRetry` re-drive it as a crashed run.** A backfill that stamps `'Pending'` has scheduled a payout for that night; it must write **NULL** instead (gotcha **#377**, caught between v731 and v732 before any real row was written).
3. ~~Reads Tracy's Revenue Master sheet~~ (removed 2026-07-01 — see banner above; steps 3–6 are historical).
4. Walks batch sheet tabs, picks one whose name contains `client_ref` + a 4-digit year + NOT "account".
5. Reads tab G7:O200, looks for row where col I = receipt number AND col J within $0.01 of expected payment AND K+L+M+N+O sums to col J. Side-scans for "Member Contribution" row in col G.
6. On no batch sheet / no tab / no matching row → returns `{ pending: true, reason: "..." }`. Daily sweep retries (Phase 6c).
7. On verified: computes `shareAmount` from `member_share`. **Updated 2026-07-21 (gotcha #252):** `member_share` is ALWAYS a dollar amount of the TOTAL engagement and the portion for this payment is proportional — `portion = (member_share / total_fee) × paymentReceived` (fallback `total_fee` → `retainer_amount + implementation_amount` → last-resort `share / 2`). The legacy ">100 = flat half-split, ≤100 = percent-of-payment" heuristic was REMOVED. **Updated 2026-07-29 (gotcha #304): the member-contribution deduction was DELETED** — it was dead code (nothing ever wrote `member_contrib_status='Pending'`) and a latent overpay-on-retry bug, and `client_tax_plans` has no `member_contribution` column at all. Member Share is entered already net of any contribution.
8. **The branch chain is EXHAUSTIVE as of 2026-07-29 (gotcha #303)** — every path assigns `rev_paid`, so a due share can no longer fall through to a terminal value: `Money Mapping` → `shareAmount <= 0` (`N/A — No Share Due`) → **no `member.stripe_account_id`** → **missing `STRIPE_KEY`** → transfer.
9. **No Connect account → `rev_paid='Awaiting Connect Setup'` (NON-terminal) + an action-required `TAX_member_share_held` bell** naming the held dollars, whose title is reconstructable so it self-clears when the share finally pays. Missing `STRIPE_KEY` → `Failed` + the `FAILURE_tax_revshare_transfer` bell. Otherwise Stripe POST `/v1/transfers` with `amount`, `currency=usd`, `destination=stripe_account_id`, `description='Tax Planning Revenue Share - Client: (<ref>) <Client Name> - Member: (<member_number>) <Member Name> - <Retainer|Implementation>'`.
10. On Stripe success → `rev_paid='Yes'`; on Stripe error → `rev_paid='Failed'`, no email, sweep retries. **`{kind}_rev_completed_at` is stamped ONLY on a terminal outcome** (`Yes` / `Money Mapping` / `N/A — No Share Due`) — a held or failed leg must not read as finished.
11. On `Yes` or `Money Mapping`: drafts Gmail to member (CC: PF email; BCC: aanderson + platham; sandbox redirects To: jlatham@elitert.com). Subject `VFO Services - Revenue Share Confirmation - <member>: <client> (<ref>) - Tax <Retainer Fee | Implementation Fee>`. Body shows payment details, green "received" badge, remaining implementation line (retainer only) or "final payment" line (implementation), blue rev-share box. Sets `[revEmailKey]=true`.

**Tables read:** `client_tax_plans`, `clients`, `members`, `pipeline_sandbox_config`, Tracy's Master sheet, client batch sheet.
**Tables written:** `client_tax_plans.retainer_rev_share` / `.implementation_rev_share`, `.retainer_rev_paid` / `.implementation_rev_paid`, `.retainer_rev_email_sent` / `.implementation_rev_email_sent`, `member_contrib_status='Applied'` (retainer only).
**External calls:** Google Sheets read ×2, Stripe POST /v1/transfers, Gmail drafts.

> **Adaptations from MAP1:**
> - Single handler with `payment_kind` param vs MAP1's `payment_number` (1-4)
> - No quarterly schedule block (tax has 2 payments max — replaced with single "implementation pending" line on retainer email)
> - No Tracy intro email (`c24_email_sent` equivalent skipped — Tracy already CC'd on `automation_TAX_invoicereceipt`)
> - `member_share` (and `tax_planner_share`) are dollars of the TOTAL, paid proportionally per installment (`share/total × payment`) — NOT a flat half-split or a percent-of-payment (gotcha #252)

### Tax Planner Share leg (added 2026-07-21)

Alongside the member + strategic legs, `automation_TAX_revshare` also pays the **Tax Planner Share** by calling `utils/tax-planner-payout.ts transferPlannerShare(sb, plan, payment_kind, stripeKey)` — the third leg of the 3-way split. It returns `skipped` (no write) only when the plan carries **no `tax_planner_share`** — genuinely nothing to pay. A share with **no allocated planner is HELD, not skipped** (2026-07-25, gotcha #284): it writes `{kind}_planner_paid = 'Awaiting Planner Allocation'` and fires an action-required `TAX_planner_share_withheld` bell to Jake naming the withheld dollars, so the money parks visibly instead of quietly staying in the VFO balance. That status is non-terminal and has three release paths: `tax_allocate_planner` pays it out the instant a planner is allocated (primary), the daily sweep's planner-retry query accepts it as a backstop, and any later revshare re-fire picks it up. The bell self-clears on ANY terminal outcome — `Money Mapping` and `N/A — No Share Due` resolve a held share as truly as a transfer does. Amount semantics mirror the member leg exactly: `portion = (tax_planner_share / total_fee) × paymentReceived`. **The destination is the planner's GROUP Connect account**, resolved `tax_planners.member_type` → `tax_planning_groups.name` (exact match) → `stripe_account_id` (NOT the planner's own account). Statuses written to `{retainer,implementation}_planner_paid`:

- `Yes` — transferred (idempotency key `planner-tax-<plan.id>-<kind>`); also drafts the `TAX_planner_revshare|<kind>` confirmation email (ids 198/199, Draft) to the planner's own email.
- `Money Mapping` — the planner is on Money Mapping (nothing transferred).
- `N/A — No Share Due` — the portion is zero.
- `Failed` — the planner has no `member_type`, the named group is missing, the group has no Stripe account, or the transfer errored → fires a `FAILURE_tax_planner_share` action-required bell to Jake; the daily `tax-revshare-sweep-daily` retries (it covers both `Failed` AND stranded-NULL `*_planner_paid` rows). Stripe memo: `Tax Planning Revenue Share - ... - Tax Planner: <name> — <group> - Retainer|Implementation`. Gotcha #253.

> **Gotcha:** `members.stripe_account_id` must point to a Connect account with `transfers` capability ACTIVE. Failed transfers return `rev_paid='Failed'`; the actual Stripe error body is logged via `console.error` but NOT surfaced by `get_logs` MCP — diagnose via `dashboard.stripe.com/test/events`. Fix is to update the member row; no handler change needed.

### Refund path

**Handler:** [`automation_TAX_refund`](../../supabase/functions/vfo-admin-api/actions/tax/refund.ts) — AUTH admin-only handler (`ADMIN_ONLY_ACTIONS`).

**Frontend:** Tax 4 `Stop - Refund` button at [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx) — `window.confirm()` guard → `saveTask` decision1 row → `callApi('automation_TAX_refund', { tax_plan_id })` → derived-status write to `Refund initial 50%` subtask (`'Completed - Refunded'`). Alerts surface error / email-failure / idempotent skip.

**What it does:**
1. Loads `client_tax_plans` row by `tax_plan_id`. Idempotent skip if `refund_status='succeeded'` → returns existing `refund_id`.
2. **Hard guard #1**: if `retainer_payment_intent_id IS NULL` → 400. Message branches on `payment_method_type==='check'` (check payments must be refunded manually via finance — no Stripe PI to refund against).
3. **Hard guard #2**: if `retainer_rev_paid='Yes'` → 400 with "Revenue share already paid to member — refunding now would leak funds. Reverse the Stripe Connect transfer first, clear retainer_rev_paid, then re-try."
4. Validates `retainer_amount > 0`. Reads `pipeline_sandbox_config.pipeline='TAX'` to pick Stripe key.
5. POSTs to `https://api.stripe.com/v1/refunds` with `payment_intent=retainer_payment_intent_id`, `amount=retainer_amount * 100` (BASE only — no card-fee gross-up), `reason=requested_by_customer`, `metadata[tax_plan_id]`, `metadata[client_id]`, `metadata[pipeline]='TAX'`, `metadata[refund_kind]='retainer_full'`.
6. On Stripe failure → updates `refund_status='failed'`, returns 502 with `stripe_error_code` + error message. No email, no other state change.
7. On Stripe success → UPDATEs plan: `refund_status='succeeded'`, `refund_id=<re_…>`, `refund_amount=<base>`, `refund_date=CURRENT_DATE`, `post_review_decision='Stop - Refund'`.
8. Drafts Gmail to client (template `TAX_refund_email|Yes`). Substitutions: `[Client Name]`, `[Client First]`, `[Payment Amount]` (BASE retainer formatted as `$X,XXX.XX`). Recipients: To: client (sandbox redirects); CC: none; BCC: aanderson+platham (sandbox drops). Sets `refund_email_sent=true`. Non-fatal on email error — returns `email_drafted=false` with reason but DB refund state stays succeeded.

**Tables read:** `client_tax_plans`, `clients`, `pipeline_sandbox_config`, `email_templates`.
**Tables written:** `client_tax_plans`(refund_status, refund_id, refund_amount, refund_date, refund_email_sent, post_review_decision).
**External calls:** Stripe POST /v1/refunds, Google OAuth + Gmail drafts.
**Chains:** none.

> **Card-fee design:** Client absorbs the Stripe processing fee on a refund. The retainer charge was `retainer_amount + card_processing_fee`; the refund is only `retainer_amount`. This is intentional per the engagement guarantee.

> **Guard ordering matters:** Check-guard fires first, then rev-paid guard. If both apply (check payment AND rev_paid='Yes' which shouldn't happen in practice), check error is the surfaced one. Update guard order if business rules change.

### Sweep extension

**Handler:** [`automation_TAX_revshare_sweep`](../../supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) — PUBLIC handler with service-role auth required (`Bearer SUPABASE_SERVICE_ROLE_KEY` in Authorization header; non-service-role → 401).

**Cron:** Daily pg_cron job `tax-revshare-sweep-daily` at **02:30 UTC** — between MAP1's `revshare-sweep-daily` (02:00) and `chargescheduled-sweep-daily` (03:00) to avoid races on shared rows. Install script at [supabase/cron/tax-revshare-sweep.sql](../../supabase/cron/tax-revshare-sweep.sql). Uses the `sb_secret_*` API key (NOT the legacy `eyJ` JWT — per gotcha #1).

**What it does:**
1. Validates Authorization header matches `SUPABASE_SERVICE_ROLE_KEY` (401 otherwise).
2. Enumerates `client_tax_plans` for both `retainer_*` and `implementation_*` payment kinds (Phase 7 future-proof — implementation_* rows currently never match since Phase 7 hasn't shipped).
3. Candidate = receipt_number IS NOT NULL AND (`rev_share='Pending'` OR `rev_paid='Failed'` OR **`rev_paid='Awaiting Connect Setup'`** — the held value, added 2026-07-29, gotcha #303: the handler writes `rev_share='Completed - Revenue Share'` even when a share is held, so WITHOUT this third leg a held leg matched neither predicate and would have been dropped from the sweep permanently). **Retry-only**: plans where revshare was never started are NOT picked up — they must wait for their natural trigger (Undecided→Proceed/Confirmed **or** Continue→Confirmed client click — the 24h Continue auto-lock is REMOVED as of 2026-07-22, gotcha #264) to set `Pending` first. This gate was added to prevent revshare from auto-firing on a paid plan as soon as Tracy's sheet was populated, bypassing the Tax 4 admin decision entirely.
   - **PLANNER-LEG PREMATURE-PAYOUT FIX (2026-07-22, gotcha #265):** the v633 planner-payout "stranded leg" retry (receipt set + planner + share + `*_planner_paid` NULL) used to pay the planner share BEFORE the client's Tax 4 confirmation (masked for months by the then-24h auto-lock). It now only retries a NULL planner leg when the MEMBER leg resolved (`retainer_rev_paid`/`implementation_rev_paid` ∈ Yes / Money Mapping / N/A — No Share Due); `Failed`-leg retries are unchanged. Live-verified on v642.
4. For each candidate: POSTs to `automation_TAX_revshare` with `tax_plan_id` + `payment_kind` + service-role auth. Logs the fire reason (`still-pending` / `retry-failed`).
5. Returns `{ ok: true, swept: <count>, fired: [...candidates with results...], …, assess_reminder_actions: [...] }`.
6. **NEW 2026-08-10 (v717) — the Tax 2 assess-form reminder before the booked ROI meeting** (rule `TAX_tax3_assess_reminder_email`, gotcha **#359**). Query: `tax3_meeting_date` NOT NULL **AND `>= today` AND `<= businessDayHorizonDateOnly(today, delayDays)`**, `assess_form_submitted_at` NULL, **`assess_vault_uploaded_at` NULL (added 2026-08-14 — a vault-assess group that has already delivered its PDF must not be chased, #400; harmless for every other row)**, `tax3_assess_reminder_sent_at` NULL, `tax_planner_id` NOT NULL. **`delayDays` here means BUSINESS days BEFORE the meeting (default 2) — the only countdown delay in the system**, which the Notification Editor cannot express, so the rule's own `description` carries the warning. **It is one of the two FORWARD business-day conversions of 2026-08-14** (the other is the MAP 1 check-payment lookahead): the horizon is walked forward over Mon–Fri only by `businessDayHorizonDateOnly`, where every other tier walks backwards from `now()` with `businessDelayCutoffIso`. **TEMPLATE FORK (2026-08-14, #400):** per row the sweep first reads the planner's `member_type` and picks **`TAX_tax3_assess_reminder|vault`** when it is a vault-assess group (that copy asks for the Tax Assessment PDF in the Sensitive Documents section rather than for the form) and the base `TAX_tax3_assess_reminder` otherwise — and **the chosen name is passed to BOTH the `email_templates` lookup AND `gmailDraftFetch`**, because the per-template Draft/Send toggle keys off the name handed to the draft call; a mismatch is a silent outage, not an error (#356). Otherwise, per row it drafts `email_templates` **217** (`TAX`/`TAX_tax3_assess_reminder`, **Draft mode by explicit user choice** — a human sends it from Gmail Drafts) **To** the allocated planner, **Cc** the planner's own group Active Team Members (computed by the sweep — same `member_type`, `planner_role='Team Member'`, minus self — and passed as `resolveTemplateRecipients`' **extraCc**, because no role token names that set) plus `ASSIGNED_PF` via `getPfEmail` plus the template's Tracy/Tray addresses; sandbox is resolved per client via `loadTaxSandboxConfigForClient` and **suppresses all Cc**, so the Cc list can only ever be verified in live mode. Delivery is `gmailDraftFetch(..., "TAX", "TAX_tax3_assess_reminder")` — the name must match the row that was loaded or the Draft/Send toggle resolves against nothing (#356). **`tax3_assess_reminder_sent_at` is stamped ONLY after a successful draft**: a missing planner email or a failed Gmail auth `console.warn`s and skips **without** stamping, so the row retries the next night. Body tokens: `[Planner First]`, `[Client Name]`, `[Meeting Date]`, `[Meeting Time]`, `[Meeting Timezone]`, `[BUTTONS]` (a green "Open Tax Planner Portal" button to `${BASE_PORTAL}/tax-planner`); a date-only booking drops the whole " at [Meeting Time] [Meeting Timezone]" clause so the sentence stays grammatical.

**Tables read:** `client_tax_plans` (filtered by receipt_number presence + rev_paid not resolved).
**Tables written:** none directly (downstream `automation_TAX_revshare` writes plan state).
**External calls:** internal HTTP fetch to admin-api per candidate.
**Chains:** `automation_TAX_revshare` per candidate.

> **Idempotency:** if all rows resolved → `swept: 0`, no candidates enumerated, no downstream calls. Verified: re-running the sweep with a Completed plan returns `{ok:true, swept:0, fired:[]}` (no Stripe / Sheets / Gmail traffic).

> **Notification program-context fix (this session).** All 12 tax notification `link`s now append `&program=${plan.program_id}` (in final-decision, postreview-client-decision, implement-final-decision, charge-implementation, deposit-refund, and revshare-sweep — 3 PF notifications + the meeting-nudge clientLink). Reason: a client enrolled in BOTH VFO Holistic (program 1) and VFO Tax Planning (program 4) previously opened their DEFAULT enrollment (Holistic) on `?tab=tax` instead of the program the notification was about. `src/pages/ClientDetail.jsx` now reads `?program=` from the URL and passes `program_id` to `msm_load_client_home`; `actions/msm/load-client-home.ts` accepts a `program_id` param and resolves the matching enrollment (via `client_enrollments` ⋈ `member_enrollments`) before falling back to `clients.enrollment_id`. MAP1/PFT/Advisor/Accountant notifications are unaffected (single default program).

---

## Step 14 — Implementation flow (Tax 5b — BUILT)

> **"Client decision 2" is a PLAIN dropdown (2026-07-23 evening, gotcha #274).** The Tax 5 "Client decision 2" task previously used a `status_options='tax_dd_implementation'` sentinel that rendered a two-button (Continue DD / Move to Implementation) FE branch. It is now a plain two-option dropdown: `program_client_tasks` ids 99/132 `status_options` swapped `'tax_dd_implementation'` → `'Continue DD|Move to Implementation'`, and `TaxPrioritiesTab.jsx` DELETED the two-button branch (the task falls through to the generic dropdown+StepDate). The two status STRINGS `'Continue DD'` / `'Move to Implementation'` are LOAD-BEARING: FE `tax5bUnlocked` + the grey-outs read them (the grey-out NOTE text was reworded to "(Due Diligence Skipped - Moved to Implementation)" on 2026-07-31 — that is display-only and the two status strings are UNCHANGED), and BE `actions/clients/overview-tax.ts` now resolves the task **BY NAME** — `moveToImpl = statusOfTask(byName("Client decision 2")) === "Move to Implementation"` (was `byCode("tax_dd_implementation")`; the old `else if (code === "tax_dd_implementation")` branch was left in place but is dead — it falls to the generic `else`, verified equivalent for Tax 5 phases). Do not rename the task or either option string.

> **Single-button rework (2026-06-09).** The admin step is now ONE button — **"Send implementation decision email"** — that always sends the (reworded) `TAX_implementdecision|Undecided` email with two **client** buttons: **"Yes - Proceed with implementation"** (→ charge on that click) and **"No - Do not proceed"** (→ decline, engagement closes, no charge). No-response → a **2-business-day** reminder + **4-business-day** PF notify (no auto-charge). Internally it still records `implementation_decision='Undecided'` (reuses that path). The old admin 3-option choice (Proceed / Undecided / Not Implementing) is gone from the UI, and the **24h auto-lock is gone outright as of 2026-08-14**. The `implementation_decision='Proceed'` branch is unreachable from the frontend but is **not dead code**: the handler still serves it and the nightly sweep now runs a **Proceed-branch reminder ladder** over any row sitting in that state (see below). Frontend: `TaxPrioritiesTab.jsx` shows the one button + pill "Email sent — awaiting client decision".

> **CONFIRM-ONLY — the invariant to protect (2026-08-14).** **Nothing on this path charges without a client click.** `automation_TAX_charge_implementation` has exactly **ONE runtime call site in the whole codebase** — `actions/tax/implement-final-decision.ts`, i.e. the client's own Proceed/Confirmed click on `/tax-implement-decide` (verified by grep). The nightly sweep's old "Proceed + 24h of silence → write `implementation_final_decision='Auto-Locked'` and fire the off-session charge" tier is **deleted**, and a silent Proceed plan now simply waits, indefinitely, being reminded. **A second call site is a regression, not a feature** — if a new caller looks necessary, the answer is a bell, not a charge.

Current flow — admin clicks the one button → client picks Yes/No on `/tax-implement-decide`. **Landing on that page records NOTHING as of 2026-07-27 (gotcha #290)** — it renders a confirmation card (the Proceed variant states the fee will be charged to the payment method on file) and only the card's button submits. This is the exact page that an email link-scanner auto-Declined a $10,000 implementation on, so the guard matters most here:
- **Yes (`decision=Proceed`)** → `automation_TAX_implementfinaldecision` **drafts the client acknowledgment email, then** fires `automation_TAX_charge_implementation` on that click — the only thing in the system that ever fires it. See the acknowledgment note directly below.
- **No (`decision=Decline`)** → drafts the decline email (`TAX_implementdecision|Not Implementing` template). Engagement closes; no charge ever.
- **No response** → the sweep's ladder: a **2-business-day** reminder email + a **4-business-day** PF notification (routes to the assigned PF). **No auto-charge on either branch.**

> **The Proceed-branch reminder ladder (NEW 2026-08-14) — what replaced the auto-charge.** A plan whose `implementation_decision='Proceed'` and whose client has not clicked now nags exactly like the Undecided branch, through two `notification_rules` rows seeded live: **`TAX_impl_proceed_reminder_email`** (kind `email`, sort **131**, `default_delay_days` **2**) drafts the shared `TAX_implementdecision|Reminder` template with **Proceed-branch buttons** re-rendered into it — green **"Proceed now"** (`&decision=Confirmed`) and red **"Decline implementation"** (`&decision=Decline`) — and **`TAX_impl_proceed_stalled`** (bell, sort **141**, `default_delay_days` **4**) raises the PF bell *"«Client» hasn't confirmed implementation"*, whose message states outright that nothing is charged until they confirm. **Both tiers REUSE the Undecided ladder's `implementation_reminder_sent_at` / `implementation_pf_notified_at` guard columns** — safe for the same reason the Tax 4 pair is: `implementation_decision` is single-valued, so a row can only ever match one ladder.

> **`'Auto-Locked'` is now HISTORICAL-ONLY.** **Zero code writes it.** `actions/clients/overview-tax.ts` still READS it (`Proceed` / `Confirmed` / `Auto-Locked` all map to "continue") so plans locked by the retired mechanism keep rendering correctly — that read is the only reason the string survives at all. `implement-final-decision.ts` also **lost its dead `Auto-Locked && Decline` rejection**; the one rejection left is **"the charge already succeeded → a later Decline is refused"**, and its JSON flag was renamed **`window_expired` → `already_charged`** to stop the name implying a grace period that no longer exists. (The Tax 4 twin keeps the old `window_expired` key because `TaxPostReviewDecidePage` reads it — see Step 13.)

> **Client acknowledgment email on the Proceed click (added 2026-08-03, v694 — gotcha #321).** The green button used to answer with silence: the client got nothing back until the receipt landed, and **nothing at all if the charge failed** (the Decline branch has always drafted an email). `implement-final-decision.ts` now drafts **`TAX_implementdecision|Proceeding`** (`email_templates` **id 211** — To CLIENT, Cc MEMBER/ASSIGNED_PF/TAX_PLANNER + Tracy + Tray, Bcc Aaron/Paul) inside the `isProceedLike` branch. Three properties are load-bearing:
> - **Drafted BEFORE the charge chain, deliberately.** A charge failure falls back to emailing a fresh `/tax-pay` link, so an acknowledgment placed *after* the chain would be silently swallowed in exactly the case the client most needs it. Going first means **a failed charge can never skip it**, and the copy *"...will now be processed"* stays truthful on both paths. The block is `try`/`catch` — an email failure never fails the recorded decision — and both Proceed-branch returns carry `email_drafted: ackEmailDrafted`.
> - **CLICK ONLY.** It fires on a genuine client click (`Proceed` / `Confirmed` / legacy `Yes`). It was written to exclude the 24h sweep auto-lock, which had no human on the other end to acknowledge; **since 2026-08-14 that tier no longer exists, so a click is the only way to reach this branch at all.** The Decline branch is untouched.
> - **New token `[Payment Amount]`** = the BASE implementation fee (`$` + `toLocaleString` 2dp of `plan.implementation_amount`, same formatting as `implementation-receipt.ts`); `EMAIL_DISCOUNT_FOOTNOTE` is appended when `plan.discount_applied > 0`. Mechanics mirror the Decline branch one-for-one (template fetch `active=true`, `resolveTemplateRecipients`, sandbox via `loadTaxSandboxConfigForClient`, inline Google token refresh, AI-PC signature, `gmailDraftFetch` tagged `"TAX"`/`"TAX_implementdecision|Proceeding"` so the Draft/Send toggle applies). **Template 211 ships `send_mode=false` (DRAFT)** until the user flips it.

**Charge handler:** `automation_TAX_charge_implementation` — off-session charge against saved payment method.
- Charge amount: `implementation_amount` (may differ from retainer per design — separate columns).
- Stripe PaymentIntent with `confirm=true off_session=true`, `metadata.payment_kind='implementation'`, `metadata.tax_plan_id`, `Idempotency-Key: tax-impl-{tax_plan_id}-{retainer_pi_last8}-{YYYY-MM-DD}` (PI suffix included so DB-reset retries don't collide with Stripe's idempotency cache).
- Card amount uses same gross-up as retainer for card; ACH at base. **Exception (2026-07-15):** plans with `card_fee_waived=true` (payment-continuation setup-link clients — only `migration_backfill_tax` sets it) charge base even on card.
- Payment-method resolution order (2026-07-16): default_payment_method_id → retainer-PI method → **auto-grab a saved method off the Stripe customer** (persisted to the row; covers hand-migrated continuation rows that carry only a `cus_` and check-paid retainers with a later-saved method) → fresh `/tax-pay` checkout link as last resort.
- Idempotent on `implementation_charge_status` — if already set, skip.
- Failure → `implementation_charge_status='declined'` or `'auth_required'` + admin notification + Gmail asking client to use a fresh `/tax-pay` link (see Failure mode #9 below for the ACH-retainer special case).

**Webhook chain on charge success** → `automation_TAX_implementation_receipt` (REC PDF + Gmail draft, no invoice — design decision; **the `automation_TAX_confirmationemail` `payment_kind='implementation'` chain was removed 2026-07-15** — for ACH it only fired at clearing anyway, landing back-to-back with the receipt, so implementation charges now get the receipt as the single client email. **⚠️ The `TAX_confirmationemail|implementation` template row still EXISTS in `email_templates` and `confirmation-email.ts` still supports `payment_kind='implementation'`, but NO caller anywhere passes that kind — it is DEAD CODE** (`charge-implementation.ts` says so in comments). It was still being advertised on the "Implementation fee auto-charged" `StepEmailsChip` until 2026-08-03, promising admins an email that never sends; that chip now points at `TAX_implementdecision|Proceeding`. **Do not resurrect it or re-advertise it in a chip** — the receipt is the single post-charge client email by design, and the Proceed-click acknowledgment above is the only other client email on this path (gotcha #321)) + **`automation_TAX_revshare` (`payment_kind=implementation`)** — added 2026-06-09. The webhook MUST kick off the implementation revshare explicitly (mirrors the retainer): the `tax-revshare-sweep` is **retry-only** and would never *start* it, so before this chain the implementation revshare never fired at all (gotcha #95). It sets `implementation_rev_share='Pending'`; if Tracy's sheet (its OWN distinct `implementation_receipt_number` row) verifies it transfers, else the sweep retries + the Tracy "Enter revenue share" FYI fires. The implementation receipt number is now allocated **collision-safe** so it can't collide with the retainer's (gotcha #92) — if it did, the implementation revshare would falsely verify against the retainer's sheet row.

**Failure mode for zero implementations:** if client picks Decline OR Not Implementing, no charge ever fires. No automatic refund — client absorbs the retainer cost (different rule from the Tax 4 Stop-Refund branch).

> **Template wording fix (2026-07-15, 3 LIVE client templates):** `TAX_implementdecision|Undecided` + `TAX_postreview|Undecided` dropped the false "within 48 hours" deadline; `TAX_implementdecision|Reminder` dropped a vestigial "if you can no longer find the original email" line. **Update 2026-07-22:** with the Tax 4 24h Continue auto-lock removed (gotcha #264), ONLY the Tax 5 implementation Proceed path still had a 24h auto-charge — the Tax 4 Continue path became click-only. The Continue client body (templates 35/138) was rewritten to click-to-confirm wording. **Update 2026-08-14: the last one is gone too.** `email_templates` **33** and **142** (the `TAX_implementdecision|Proceed` client + member-paid variants) were rewritten to confirm-first copy and **no longer promise a 24-hour auto-charge** — already applied live. No client-facing tax template makes an auto-charge or auto-lock promise any more; if you find one, it is a bug.

---

## Notification inventory (TAX pipeline) — audit 2026-06-09

Complete inventory of every in-app (`notifications` table) row the TAX flow inserts or clears across Tax 3 / Tax 4 / Tax 5, plus the email-only "nag" ladders. Scope: the Tax Planning program + the Tax Priorities section in Holistic. (`pipeline='TAX'` for all rows.)

### Recipient model (read this first)

`load_notifications` returns rows where `recipient = session.email OR recipient = 'admin' OR recipient = 'all'`, unread, newest 20 ([actions/notifications/load.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/notifications/load.ts)). So:
- **`recipient:'admin'`** = the **shared admin bell** — every admin sees it.
- **`recipient:'<email>'`** = a **personal bell** — only the admin whose login email matches sees it.

> **Routing model (rerouted 2026-06-09 v432; recipients re-cut 2026-07-27 v664 when Tim Gacsy left — gotcha #291).** TAX notifications **never** target the shared `admin` bell — every one routes to a specific person via [`utils/tax-notify.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/tax-notify.ts):
> - **Tax 3 / Setup-phase** notifications → the **assigned PF's personal bell** (`taxPfRecipients(client.assigned_pf)` — same 3-PF login-email map as `constants/map1-pfs.ts`), falling back to **Tracy** when the client has no mapped PF (`TAX_OWNERS = [TRACY_EMAIL]`, NOT `admin`).
> - **Tax 4 / Tax 5 client-decision** notifications → **the assigned PF + the plan's allocated tax planner** (`taxDecisionRecipients(assigned_pf, plannerEmail)` — PF login email + `taxPlannerEmail(plan.tax_planner_id)`, deduped), falling back to **Tracy** when neither resolves. The four rules pass `dynamic: { ASSIGNED_PF, TAX_PLANNER }` so Notification-Editor token overrides resolve, and a per-recipient `links` map so the planner's row opens `/tax-planner/client/<id>?program=<n||1>` instead of the admin route (gotcha #292).
> - **The Tax 4 meeting-date nudge** (`TAX_tax4_decision_needed`) → PF + allocated planner + **Tracy** (Tracy always).
>
> The `dismissible` flag of each notification was left unchanged by either reroute — only `recipient` (and, in 2026-07-27, the per-recipient `link`) changed. `insertTaxNotifications()` writes one row per recipient. (Before the 2026-06-09 change, everything except the Tax 4 meeting nudge inserted `recipient:'admin'` and merely named the PF in the message text.)

### dismissible semantics

`notifications.dismissible` defaults to **`true`**. In [NotificationBell.jsx](src/components/NotificationBell.jsx):
- **`dismissible:true` (FYI)** — renders a green **Done** button; clicking the row (navigate) *or* Done marks it read and removes it. Any admin can clear it without taking the underlying action.
- **`dismissible:false` (action-required)** — orange left bar + an orange **ACTION** pill, **no Done button**; a row click navigates but does NOT clear it. It persists until a handler runs a targeted `UPDATE notifications SET read=true`. (Caveat: the "Mark all read" button clears *everything* visible regardless of `dismissible`.)

> **`notification_rules.action_required` is DISPLAY / DOCUMENTATION ONLY.** `utils/notify.ts` deliberately does not read it and never lets a rule override `dismissible` — flipping an action-required bell to FYI (or back) in the Editor would break the contract that a completing handler clears it. **The `dismissible:false` in the CALL SITE is what actually makes a bell action-required**; the rule column exists so the Notification Editor can label the row honestly. Keep the two in step by hand.

**Every bell in the hand-off chain below carries its instruction in its MESSAGE, and the messages QUOTE the tracking step to complete** (e.g. *complete the "Additional information required" step*). The **titles were deliberately not requoted** — a title is the clearing key (prefix-matched), so editing one strands every live bell of that shape. The bell dropdown renders the full message inline on wrapping lines, so a bell can carry a real instruction rather than a title fragment.

### In-app notification INSERTS

Recipients below reflect the **2026-06-09 reroute (v432)** as re-cut by the **2026-07-27 departed-staffer reroute (v664, gotcha #291)**. "PF" = `taxPfRecipients(assigned_pf)` (the assigned PF's bell, **fallback Tracy** — `TAX_OWNERS` is now `[TRACY_EMAIL]` alone); "PF+planner" = `taxDecisionRecipients(assigned_pf, plannerEmail)` (assigned PF + the plan's allocated tax planner, deduped, fallback Tracy, planner row link-overridden to `/tax-planner/...` per gotcha #292). All go through `insertTaxNotifications()`.

| # | Tax step | File:line | Fires when | Recipient | `dismissible` | Type | Cleared by |
|---|----------|-----------|------------|-----------|---------------|------|------------|
| 1 | Tax 3 | [final-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/final-decision.ts) | Client clicks **Yes** on `/tax-decide` | **PF** | **false** | Action-required (complete pricing form) | `pricing.ts:31` (admin submits pricing form) or `extra-meeting.ts:36` — UPDATE read=true on all unread TAX for the client |
| 2 | Tax 3 | [final-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/final-decision.ts) | Client clicks **ExtraMeeting** on `/tax-decide` | **PF** | **false** | Action-required (schedule meeting) | `extra-meeting.ts:36` (admin records extra-meeting outcome) or `pricing.ts:31` |
| 3 | Tax 4 | [postreview-client-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/postreview-client-decision.ts) | Client clicks **Refund** on post-review email | **PF+planner** | true | FYI | click / Done |
| 4 | Tax 4 | [postreview-client-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/postreview-client-decision.ts) | Client clicks **Proceed/Confirmed** on post-review email | **PF+planner** | true | FYI | click / Done |
| 5 | Tax 5 | [implement-final-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/implement-final-decision.ts) | Client clicks **Proceed/Confirmed** on implementation email | **PF+planner** | true | FYI | click / Done |
| 6 | Tax 5 | [implement-final-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/implement-final-decision.ts) | Client clicks **Decline** on implementation email | **PF+planner** | true | FYI | click / Done |
| 7 | Tax 5 | [charge-implementation.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/charge-implementation.ts) | Off-session implementation charge **fails** (incl. ACH-retainer restriction) | **Jake** (`TAX_impl_charge_failed`) | true | FYI (failure alert — someone must email a fresh `/tax-pay` link) | click / Done |
| 8 | Tax 1 (prog 4) | [deposit-refund.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/deposit-refund.ts) | Deposit refund issued — admin picked **Refund** on the Tax Plan Green/Red Light step and typed a reason | **PF** | true | FYI | click / Done |
| 8b | Tax 3 | [confirmation-email.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/confirmation-email.ts) | **Retainer paid** (card/ACH/check; retainer kind only) — **NEW 2026-06-09** | **PF** | true | FYI | click / Done |
| 8c | Tax 3 | [confirmation-email.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/confirmation-email.ts) | **Retainer paid → schedule the Detailed tax plan meeting** (rule `TAX_retainer_paid_schedule_meeting`, `dedupe:"unread"`; same event as 8b, fired for card + ACH at checkout and for check at clear) — **NEW 2026-07-31 (v687)** | **Tray** (`tvaldes@elitert.com`, a real address rather than a role token) | true | FYI ("«Client» has decided to move forward with tax planning") | click / Done |
| 9 | Tax 4 | [revshare-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) | Detailed tax plan meeting date passed + NOT(presentation answered AND Client decision 1 recorded) — once/plan, guard `tax4_meeting_reminder_last_sent_at`, rule **`TAX_planner_tax4_steps_needed`**. **A DELIBERATE CALENDAR SURVIVOR** — it compares a real meeting date against today and was left alone by the 2026-08-14 business-day conversion. **Replaced the dormant `TAX_tax4_decision_needed` (PF+planner+Tracy) tier on 2026-08-11 (#170)** | **the allocated planner** | **false** | Action-required ("Complete the tax plan review steps for \<client\>" — both Tax 4 steps) | BOTH halves done, whichever lands second: `save-task.ts` (presentation) + `postreview-decision.ts` (Client decision 1), via `clearTax4StepBellsWhenBothDone`. The legacy `.ilike("title","Client decision 1 needed%")` clear in `postreview-decision.ts` stays for the dormant tier's surviving rows |
| 10 | Tax 4 | [revshare-sweep.ts:186](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) | Undecided pick, **4 business days** with no client click (guard `post_review_pf_notified_at`) | **PF** | true | FYI ("\<PF\>: reach out") | click / Done |
| 10b | Tax 4 | [revshare-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) | **Continue** pick, **4 business days** with no client click (rule `TAX_postreview_continue_stalled`, REUSES guard `post_review_pf_notified_at`) — NEW 2026-07-22, replaces the removed 24h auto-lock | **PF** | true | FYI (title "«Client name» hasn't made a decision on Client decision 1") | click / Done |
| ~~P~~ | Tax 4 | — | ~~Day after `tax4_meeting_date` + planner set + NOT(presentation done AND decision set) (rule `TAX_planner_post_meeting`, one-shot guard `tax4_planner_nudge_sent_at`)~~ — **DORMANT since 2026-08-11 (#170): no call site.** Same trigger, recipient and instruction as row 9's action-required replacement, so leaving it enabled would have given the planner two bells a night. Rule row kept for rollback | ~~allocated planner~~ | true | ~~FYI~~ | — |
| 11 | Tax 5 | [revshare-sweep.ts:292](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) | Undecided pick, **4 business days** with no client click (guard `implementation_pf_notified_at`) | **PF** | true | FYI ("\<PF\>: reach out") | click / Done |
| 11b | Tax 5 | [revshare-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) | **Proceed** pick, **4 business days** with no client click (rule `TAX_impl_proceed_stalled`, REUSES guard `implementation_pf_notified_at`) — **NEW 2026-08-14, replaces the deleted 24h auto-charge tier** | **PF** | true | FYI (title "«Client name» hasn't confirmed implementation"; the message says outright that nothing is charged until they confirm) | click / Done |
| 12 | Tax 3 | [revshare-sweep.ts:337](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) (`addPfNotif`, ×3 stalls) | **4 business days** on each of: Undecided email not clicked (guard `tax_decision_pf_notified_at`), agreement unsigned (`signed_pf_notified_at`), retainer unpaid (`payment_pf_notified_at`) | **PF** | true | FYI ("\<PF\>: reach out") | click / Done |
| **13** | Tax 1 | [vault/upload-notify.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/vault/upload-notify.ts) | The client's **tax returns** land (portal upload OR `/tax-upload` link) and at least one stamped plan has **no** planner (rule `TAX_returns_allocate_team_member`, `dedupe:"unread"`) | **Tracy + Tray** | **false** | Action-required ("Allocate a team member for \<client\>") | `allocate-planner.ts` when an allocation is **SET** (`clearAllocateTeamMemberBells`) — a clear-to-nobody deliberately leaves it standing |
| **14** | Tax 1/2 | [allocate-planner.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/allocate-planner.ts) (**any** Team Member allocation — no stage split) **and** [ready-for-tax3.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/ready-for-tax3.ts) (`confirm_date` while a Team Member holds the plan) | rule `TAX_team_member_allocate_planner` | **the allocated Team Member** (via `notifyAllocatedPlanner`, planner-portal link) | **false** | Action-required ("Allocate a Tax Planner for \<client\>") | `allocate-planner.ts` on **any** allocation change (the prefix sweep) |
| **15** | Tax 1 | [allocate-planner.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/allocate-planner.ts) | A **Tax Planner** is allocated while "Tax planner review complete" is **unanswered** (rule `TAX_planner_review_needed`) | **the allocated planner** | **false** | Action-required ("Review the tax returns for \<client\>") | `save-task.ts` when **"Additional information required" is ANSWERED** (either option) — that step IS the instruction — **and** `allocate-planner.ts` on any allocation change |
| **16** | Tax 1 | [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) | "Additional information required" answered **`No additional info required`** and the review step not yet answered (rule `TAX_planner_review_step_needed`) | **the allocated planner** | **false** | Action-required ("Complete the tax planner review for \<client\>") | `save-task.ts` when "Tax planner review complete" is ANSWERED (either option), **or** the re-allocation sweep |
| **17** | Tax 1 | [vault/upload-notify.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/vault/upload-notify.ts) **and** [vault/tax-text-submit.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/vault/tax-text-submit.ts) | The client **supplies the requested additional information** — by upload OR by written explanation — while the review step is unanswered (rule `TAX_planner_additional_info_uploaded`) | **the allocated planner** | **false** | Action-required — **the SAME title as #16 on purpose** ("Complete the tax planner review for \<client\>") | identical to #16: `save-task.ts` on the review answer, or the re-allocation sweep |
| **18** | Tax 1 | [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) | **"Tax planner review complete" answered** — fires on every genuine outcome change, no dedupe (rule `TAX_planner_review_complete`) | **Tray** (`tvaldes@elitert.com`) | **false** | Action-required ("Tax Planner review complete for \<client\>") — **FOUR variants, all action-required** | one variant per program × outcome; see the clearing matrix in [the hand-off chain](#the-tax-track-hand-off-chain) |
| **19** | Tax 1/2 | [allocate-planner.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/allocate-planner.ts) (Tax Planner allocated with the review already **Proceed** and `assess_form_submitted_at` NULL) **and** [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) (the review answered **Proceed**) | rule `TAX_planner_assess_needed`, `dedupe:"unread"` so the two fires never double up. **Both guards ALSO require `assess_vault_uploaded_at` NULL as of 2026-08-14, and both branch the MESSAGE (never the title) for a vault-assess group — see #400** | **the allocated planner** | **false** | Action-required ("Enter the tax planning opportunities for \<client\>") | `save-assess-form.ts` (on submit) **and** `allocate-planner.ts` (any allocation change) |
| **20** | Tax 2 | [save-assess-form.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-assess-form.ts) | **FIRST** submission of the assess form only (a later edit is silent, #314) — rule `TAX_assess_completed_pf`, `dedupe:"unread"` | **assigned PF**, resolved through `taxPfLoginEmail` (the PORTAL LOGIN address, not the `pf-emails.ts` correspondence map) | **false** | Action-required ("Download the ROI presentation for \<client\>"; the message names the allocated planner who assessed) | `presentation-schedule.ts` when the send date is **scheduled** (primary, v726), with `presentation-sweep.ts` stamping `presentation_email_sent_at` kept as the backstop |
| **20a** | Tax 2 | [assess-vault-stamp.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/assess-vault-stamp.ts), called from BOTH planner vault minters at MINT time | a **vault-assess group** planner (#400) drops any document on a plan with no assess form and no prior stamp — rule `TAX_assess_vault_uploaded_pf`, `dedupe:"unread"`, once per plan | **assigned PF**, via `taxPfLoginEmail` (portal login address) | **false** | Action-required ("Tax Assessment PDF added for \<client\>"; the message names the planner, the file and the vault section and instructs entering its information into the assess step). Link carries `&program=` (#90) | `save-assess-form.ts` on submit — **the only clear site, because the form is the only completion path** |

### In-app notification CLEARS (targeted `UPDATE read=true`)

| File:line | Scope | Clears |
|-----------|-------|--------|
| [pricing.ts:31](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/pricing.ts) | all unread TAX for `client_id` | #1 / #2 (and any other unread TAX FYI for that client) |
| [extra-meeting.ts:36](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/extra-meeting.ts) | all unread TAX for `client_id` | #1 / #2 |
| [postreview-decision.ts:53](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/postreview-decision.ts) | unread TAX matching title `Client decision 1 needed%` | #9 |
| [allocate-planner.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/allocate-planner.ts) | unread TAX for `client_id`, `dismissible=false`, the FOUR prefixes `Allocate a Tax Planner for%`, `Enter the tax planning opportunities for%`, `Review the tax returns for%`, `Complete the tax planner review for%` — on **ANY** allocation change, set or clear, and **BEFORE** the new bell is fired | #14 / #15 / #16 / #17 / #19 |
| [allocate-planner.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/allocate-planner.ts) (second, conditional clear) | title `Allocate a team member for%` — **only when the allocation is SET** (`clearAllocateTeamMemberBells`). Clearing to nobody must leave it standing: nothing would ever re-fire it, because the returns have already arrived | #13 |
| [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) | on a save of either review step: `Review the tax returns for%` once "Additional information required" is answered, `Complete the tax planner review for%` once "Tax planner review complete" is answered. **Not gated on a status CHANGE**, so a re-save still clears | #15 / #16 / #17 |
| [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) | `Tax Planner review complete for%` — cleared **before every re-fire** on a genuine outcome change (including a cleared dropdown, which re-fires nothing), and again when the Green/Red Light is saved `Proceed` on a program-4 plan whose review reads Proceed + ROI booked, or outright when it overrides a recorded Stop | #18 |
| [ready-for-tax3.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/ready-for-tax3.ts) | `Tax Planner review complete for%` per the matrix (Proceed → booked, program 4 also needing Green/Red `Proceed`; Stop → overridden by booking; **`declined` → unconditional**). Also still clears the legacy `Book the ROI meeting for%` on either decision — **that bell has no call site any more, but unread rows of that shape survive in production** | #18 (+ legacy rows) |
| [deposit-refund.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/deposit-refund.ts) | `Tax Planner review complete for%` — the succeeded refund is the program-4 Stop variant's instruction | #18 |
| [save-assess-form.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-assess-form.ts) | `Enter the tax planning opportunities for%` | #19 |
| [save-assess-form.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-assess-form.ts) | `Tax Assessment PDF added for%` — **added 2026-08-14**, the vault hand-off ask (#400). Submitting the form is the only completion path, so this is the only clear site it needs | #20a |
| [presentation-schedule.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/presentation-schedule.ts) | `Download the ROI presentation for%` — **PRIMARY since v726**: scheduling the send date IS the PF's job done | #20 |
| [presentation-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/presentation-sweep.ts) | `Download the ROI presentation for%` — on stamping `presentation_email_sent_at` (still the only site that stamps it). **Backstop** since v726, for bells raised on plans scheduled before it | #20 |
| [highlevel-meeting-confirm.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/highlevel-meeting-confirm.ts) | `Send the detailed tax plan meeting confirmation email for%` — the email going out IS the instruction | `TAX_planner_hlm_ready` |
| [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) **and** [postreview-decision.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/postreview-decision.ts) | `Complete the tax plan review steps for%` — both call `clearTax4StepBellsWhenBothDone`; whichever of the two Tax 4 steps lands second clears | #9 (`TAX_planner_tax4_steps_needed`) |
| [save-task.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/save-task.ts) | `Complete Client decision 2 for%` — when "Client decision 2" is answered | `TAX_planner_decision2_ready` |

> **Rows 13–20 are the tax-track hand-off chain and their TITLES are load-bearing (gotchas #357/#179).** They are all `dismissible:false`, which per #179 means `mark_notification_read` refuses them — the ONLY thing that ever clears one is the matching prefix write above (`pipeline='TAX'` + `client_id` + `dismissible=false` + `read=false` + `title ILIKE '<prefix>%'`). Reword a title without moving its clear, or raise one of them from a new handler without shipping the clear, and the bell becomes permanent and invisible to everyone who did not receive it. **The authoritative prefix → clear-site map lives in the header of [`utils/tax-review-bell.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/tax-review-bell.ts)** — read it before touching any title. A corollary the code enforces at three fire sites: **a bell whose instruction is ALREADY carried out is never minted**, because no clear site would run again to retire it.

### Email-only "nag" ladders (no persistent in-app piece)

All live in [revshare-sweep.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/tax/revshare-sweep.ts) (cron `tax-revshare-sweep-daily`, 02:30 UTC). Email tier = a sandbox-aware **Gmail draft to the client** (with the decision buttons re-rendered); bell tier = the shared-admin FYI in the table above (#10/#10b/#11/#11b/#12). **There is no in-app notification at the email tier, and the bell tier is a click-to-dismiss FYI, not persistent.** **The last row of the table is the exception on both counts (2026-08-10):** it is addressed to the **allocated planner** rather than the client, it has **no bell tier at all**, and its delay is counted **backwards from the booked meeting date** rather than forwards from a trigger (#359).

> **Every tier below counts BUSINESS days (Mon–Fri UTC, no holiday calendar) as of 2026-08-14.** The stored `notification_rules.delay_days` numbers did not change — 2 and 4 — only the unit they are counted in, via `businessDelayCutoffIso` in `utils/notify.ts` (a backward weekday walk; the forward-counting `businessDayHorizonDateOnly` serves the countdown row at the bottom of the table). Bell messages now read literally *"N business day(s) have passed"*. The old calendar helper `delayCutoffIso` still exists in the file with **zero callers** — do not wire anything new to it.

| Stall | Reminder email — 2 business days (template) | Bell — 4 business days |
|-------|----------------------|------------|
| Tax 3 — Undecided email not clicked | `TAX_decision_reminder` (line 433) | #12 |
| Tax 3 — agreement unsigned | `TAX_signing_reminder` (line 471) | #12 |
| Tax 3 — retainer unpaid | `TAX_payment_reminder` (line 508) | #12 |
| Tax 4 — post-review Undecided | `TAX_postreview\|Reminder` (line 155) | #10 |
| Tax 4 — post-review **Continue** (NEW 2026-07-22) | `TAX_postreview\|Reminder` (reused; rule `TAX_postreview_continue_reminder_email`) | #10b |
| Tax 5 — implementation Undecided | `TAX_implementdecision\|Reminder` (line 261) | #11 |
| **Tax 5 — implementation Proceed** (NEW 2026-08-14) | `TAX_implementdecision\|Reminder` (reused, with the Proceed-branch green "Proceed now" / red "Decline implementation" buttons; rule `TAX_impl_proceed_reminder_email`) | #11b |
| **Tax 2 — assess form still missing before the booked ROI meeting** (NEW 2026-08-10) | `TAX_tax3_assess_reminder` (**id 217**, Draft; rule `TAX_tax3_assess_reminder_email`) — **To the allocated PLANNER, not the client**, Cc their group's Team Members + assigned PF | *(none — there is no bell tier; it is a one-shot guarded by `tax3_assess_reminder_sent_at`)* |

**Every decision branch on the tax track now nags, and none of them ever resolves itself.** The Tax 4 Continue pick started nagging on 2026-07-22 when its 24h auto-lock was removed (#264, row #10b); the Tax 5 Proceed pick joined it on **2026-08-14** when its 24h auto-charge was deleted (row #11b). Both reuse the guard columns of their Undecided twin, which is safe because the admin's pick is single-valued per plan.

### What shipped 2026-06-09 (v432)

The audit's outcome was a **recipient reroute**, not a `dismissible` change. Per product decision, **no TAX notification may target the shared `admin` bell** — each now routes to a specific person (see Routing model above). Implemented via the new [`utils/tax-notify.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/tax-notify.ts) helper across 7 handlers; every `dismissible` flag was preserved. A **new retainer-paid FYI** (#8b) was added to `confirmation-email.ts` (PF bell) since paying previously fired emails only. The Tax 4 meeting nudge (#9) was already Tim+Tracy and was untouched.



1. **Ready-for-Tax-3 Gmail fails** → plan exists with `ready_for_tax3_email_sent='No'` indefinitely. No retry.
2. **`automation_TAX_sendagreement` fails** → `agreement_sent` not flipped, but the chain caller already returned success. No retry — admin must investigate.
3. **BoldSign sign-link polling exhausted** (5 retries) → handler still completes (`agreement_sent='Yes'`) but the Gmail body has `[ENGAGEMENT — signing link unavailable]` placeholder text in red. Visible failure.
4. **Wrong BoldSign webhook URL config** → flags don't flip. CEO countersign + Stripe customer chains never fire. The webhook URL must be `boldsign-webhook` (standalone), AND the function must have `verify_jwt=false` to accept BoldSign's POST without an auth header.
5. **`pipeline_sandbox_config` missing TAX row** → handlers default to live mode. BoldSign docs created in the wrong account where webhooks aren't configured. **Required fix** during setup.
6. **`document_numbers` race / collision** → **fixed 2026-06-09** by `utils/doc-numbers.ts` `allocateDocNumber()` (bump-and-retry against the `UNIQUE(number)` constraint; gotcha #92). The old count-then-insert silently reused a number on collision (a reused `client_ref` made retainer + implementation both land on `-0001`).
7. **Drive folder name change** → if client renamed, prior PDFs orphan in old folder.
8. **Idempotency**: `agreement_sent === 'Yes'` blocks re-send. `retainer_confirmation_status === 'Sent'` **or `=== 'Skipped - Card (Receipt Only)'`** blocks re-send (both terminal). `retainer_receipt_status === 'Sent'` blocks re-fire. `tax_final_decision` set blocks re-flip on `/tax-decide`. `ready_for_tax3_email_sent === 'Yes'`, `tax_decision_email_sent === 'Yes'` block re-fires.
9. **ACH retainer → implementation off-session charge — FIXED 2026-06-09.** Previously Stripe rejected the off-session implementation charge for an ACH-paid retainer with `"us_bank_account is not allowed for this PaymentIntent"` and fell back to a manual `/tax-pay` link. Root cause: `charge-implementation.ts` didn't declare `payment_method_types[]`, so the PaymentIntent defaulted to card-only. Fix: it now sets `payment_method_types[]` to the saved method's type (`us_bank_account`/`card`), so the ACH implementation fee **auto-charges off-session** (the retainer checkout already saved the ACH mandate via `setup_future_usage=off_session`). Verified end-to-end. The graceful-degradation path (set `implementation_charge_status='declined'`/`'auth_required'`, regenerate `checkout_token`, notify, draft a `/tax-pay` Gmail) still exists as the safety net for genuine declines/auth-required — the page + `automation_TAX_stripecheckout` branch on `retainer_status='succeeded' AND implementation_charge_status IN (declined, auth_required, manual_required)` to serve the implementation re-pay. (Check-paid retainers still have no saved PI → still use the manual link.)

---

## Tax Automation Panel (admin UI)

[TaxAutomationPanel.jsx](src/components/admin/TaxAutomationPanel.jsx) — structural mirror of [AutomationPanel.jsx](src/components/admin/AutomationPanel.jsx) for MAP1. Same table-with-click-to-expand pattern. Each plan row expands to a **12-Step vertical timeline** showing every decision and detail captured along the way (Ready for Tax 3, Tax 3 Decision, Final Decision, Contract, Payment, Confirmation, Invoice & Receipt, Tax 4 Continue/Stop, Retainer Revenue Share, Implementation Fee, Implementation Revenue Share, Wrap-up Announcement). Pay-via-check / Mark-cleared buttons live in the Payment step.

Accessible from admin portal → Automation dropdown → "Holistic Planning - Tax Planning" (alongside "Holistic Planning - MAP 1").

Backed by [`automation_load_tax_plans`](../../supabase/functions/vfo-admin-api/actions/tax/load-automation-list.ts) — admin-only — returns all tax plans joined with client + member info.

Sandbox toggle uses `save_sandbox_config` with `pipeline='TAX'` parameter (extended from MAP1-only to accept any pipeline).

---

## "Assess tax planning opportunities (and enter presentation details)" form-step (added 2026-07-22; structured presentation-details form as of 2026-07-29, v677)

A Tax 2 - Deeper Dive step (`program_client_tasks` ids **89** program 1 Holistic / **123** program 4 VFO Tax Planning), RENAMED in DB from "Assess tax planning opportunities". It is a **form step** rather than a plain status toggle:

- **Trigger:** `status_options==='assess_form'` OR the exact renamed task name (sentinel-first, the gotcha #254 pattern — the `status_options` swap on ids 89/123 is APPLIED live; the name fallback remains as belt-and-braces).
- **UI (`AssessTaxForm` in [TaxPrioritiesTab.jsx](src/components/admin/tax/TaxPrioritiesTab.jsx)):** a single **"Enter Details"** button → the inline structured form: **Fee** (required dollar input) + a shared **strategy list** (add/remove rows; each row = strategy name + 4 required dollar inputs: Investment Cost Year 1 / Year 2, Gross Savings Year 1 / Year 2 — **the four "Year 2+" display labels were relabelled to plain "Year 2" on 2026-08-12** because the deck only ever presents the following year; **the stored keys are still `invest_y2` / `gross_y2` and did NOT change**) + a live computed per-strategy Net line + a read-only **Summary table** (sections Investment Costs / Gross Tax Plan Savings / Net Tax Savings × columns Total / Year 1 / Year 2+, per-strategy rows plus a bold section-total row each). **ALL derived numbers — per-strategy totals (Y1+Y2+), section totals, and the whole Net section (Gross − Investment) — are computed at render and NEVER stored** (gotcha #306). Submit calls `tax_save_assess_form`, then `saveTask 'Completed'` greens the step. Submitted state = a green "Submitted" pill + date + a chevron-expand read-only view (Fee + Summary table). Legacy pre-2026-07-29 submissions (`{question_1}`) still render their single-question read-only view. Member readOnly = the pill only.
- **EDITABLE AFTER SUBMIT as of 2026-07-31 (gotcha #314).** The submitted row carries an **Edit** button that reopens the real form (`AssessTaxForm` takes `editing` + `existingCompletedDate`; `isViewMode = !!existingData && !editing`), Submit relabels to **"Save changes"**, and Cancel returns to the read-only view. **The backend never enforced the old lock** — `tax_save_assess_form` has always accepted a re-save and overwrites the whole `assess_form` object — so this is a pure frontend change. Three properties are load-bearing: (a) the call site passes **`key={isEditing ? 'edit' : 'view'}`** because the view renders its Summary from component state, and without the remount Cancel would display the abandoned draft; (b) an edit-resave passes the existing `completed_date` into `saveTask` so the step's completion date does **not** move (`assess_form_submitted_at`/`_by` DO move — they mean "who last touched this"); (c) **legacy `{question_1}` rows are editable and saving replaces them permanently**, with the old text shown in a dimmed "Previous answer — will be replaced when you save" box above a blank structured form. The **tax planner portal gets Edit too** — the step is already on both `PLANNER_EDITABLE_TASK_NAMES` whitelists (#262) and `tax_save_assess_form` is already in `TAX_PLANNER_ALLOWED_ACTIONS`, so no role change was needed. The member portal is unaffected (its `readOnly` early-return precedes the submitted branch).
- **Handler:** [`tax_save_assess_form`](../../supabase/functions/vfo-admin-api/actions/tax/save-assess-form.ts) — AUTH, in `ADMIN_ONLY_ACTIONS` + `TAX_PLANNER_ALLOWED_ACTIONS`, `denyIfNotPlannerPlan` group-scope guard. Validates + normalizes (mirrored in the FE): fee required ≥ 0; ≥ 1 strategy after dropping rows whose name AND all four amounts are blank (a trailing untouched row never blocks); every amount on a kept row REQUIRED (blank → 400 "All amount fields are required"), non-negative, rounded to 2 dp. Stores ONLY `{ fee, strategies:[{name, invest_y1, invest_y2, gross_y1, gross_y2}] }` into `client_tax_plans.assess_form` (jsonb) + stamps `assess_form_submitted_at` + `assess_form_submitted_by` (session email). **NO chains / emails.** Migration `20260722120000_client_tax_plans_assess_form.sql`; `tax_load_plans` uses `select("*")` so no loader change.
- **NOTIFICATIONS — it is a link in the middle of the hand-off chain, not the end of it (gotcha #357).** The handler reads the plan **BEFORE** the update (`id, client_id, program_id, tax_planner_id, assess_form_submitted_at`) because the prior stamp is the only thing separating a first submission from an edit. After a successful save it (a) clears this client's unread action-required bells titled **`Enter the tax planning opportunities for%`** — raised either when the planner was allocated or when the review step was answered Proceed — and (b) **on the FIRST submission only** fires **`TAX_assess_completed_pf`**, now an **ACTION-REQUIRED** ask titled **`Download the ROI presentation for <client>`**, to the assigned PF; its message **names the allocated planner** who did the assessing (a failed planner lookup still sends the bell with a generic actor). That bell is retired when `presentation-schedule.ts` records the send date (primary, v726) or, as the backstop, when `presentation-sweep.ts` stamps `presentation_email_sent_at`. **The PF address here is `taxPfLoginEmail` (`utils/tax-notify.ts`) — the PORTAL LOGIN address — not the `utils/pf-emails.ts` correspondence map the email templates use**; a bell routed to a non-login address is unreadable. An edit-resave is deliberately silent (#314). The whole block is one try/catch — a bell can never lose a submitted form.

### The vault-assess carve-out — Innovation Consulting Group hands the PDF over (added 2026-08-14, v743/v744; gotcha #400)

Some tax-planning groups write their own tax assessment document, so re-keying its numbers into the form above is duplicate work for the planner. **The carve-out lets the planner deliver the PDF through the client's vault instead — and it changes NOTHING about how the step completes.** Read that sentence before anything else in this subsection: the assess **FORM** still completes the step, a VFO admin still keys the document's numbers in, and every gate, done-signal and overview branch behaves identically for these groups and for everyone else.

- **Who is in it.** `constants/vault-assess-groups.ts` — `VAULT_ASSESS_GROUPS = ["Innovation Consulting Group", "Test Group"]` plus `isVaultAssessGroup()`. Matching is **case-exact on `tax_planners.member_type`, which stores the group NAME**, so **renaming the group in the Tax Planning Groups UI is the retirement switch** (a renamed group simply stops matching and falls back to the ordinary flow). **`"Test Group"` is a PERMANENT fixture**, kept so the path stays exercisable with the test planner login. **There is deliberately no frontend mirror of this list** — an earlier build had one and it was removed; the FE keys off the plan stamps alone, so a group rename needs no react deploy.
- **What the drop does.** `utils/assess-vault-stamp.ts` is called from BOTH planner-reachable minters — `vault_tax_admin_upload_url` (Sensitive) and `vault_gen_upload_url` (General) — immediately **after** `notifyPlannerVaultDrop`, so it runs at **MINT time, before the browser's PUT lands** (the same accepted trade-off as Tracy's per-file bell, #393). It resolves the caller through `resolveCallerPlanner` (**admins no-op**, by `allowed_admins` precedence — and that helper now also returns `member_type`), group-checks, then takes the **newest plan for that client allocated to the caller's group with BOTH `assess_form_submitted_at` and `assess_vault_uploaded_at` null**. That row match is the latch: **once per plan**, later files silent. **Any vault section and any file type count, deliberately** — no name or MIME sniffing — so a wrong-section drop still stamps and an admin unwinds it, which was judged better than a correct document going unnoticed.
- **What it stamps, and what that stamp does NOT mean.** `client_tax_plans.assess_vault_uploaded_at` / `_by`. **It is not a completion stamp.** It is not read by the FE `isTaskStatused`, not by `actions/clients/overview-tax.ts`'s column-proven `assess_form` branch, and not by any gate. It buys exactly two things: **the chase moves off the planner** (their action-required bell is cleared and the nightly assess-reminder sweep excludes stamped rows), and **the assigned PF is asked to key the numbers in**.
- **The PF bell — action-required, and its title is a clear key.** Rule **`TAX_assess_vault_uploaded_pf`**, `dismissible:false`, `dedupe:"unread"`, to the assigned PF's **portal login** email (`taxPfLoginEmail`). Title `Tax Assessment PDF added for <client>`; the message names the planner, the file and the section and says to enter its information into the assess step. Link `/admin/client/<id>?tab=vault&program=<program_id||1>` — **the `program=` is mandatory and was missed on the first build** (#90, amended: the bell opened the client's Holistic profile). **Cleared ONLY by `save-assess-form.ts`**, which now carries a second title-prefix clear (`Tax Assessment PDF added for%`) beside the planner one — form submission is the only completion path, so it is the only clear site needed.
- **The planner-facing wording forks, the title does not.** `allocate-planner.ts` and `save-task.ts` branch the assess bell's **MESSAGE** for these groups ("Please upload the Tax Assessment PDF into the Sensitive Documents section of \<client\>'s vault") while keeping the **TITLE identical**, precisely so the single existing clear still matches it. Both fire guards were widened to require `assess_vault_uploaded_at` null as well as `assess_form_submitted_at` null — a delivered document means stop asking.
- **The reminder email forks by template NAME (#356).** See the sweep section above: `TAX_tax3_assess_reminder|vault` for these groups, the base name for everyone else, and **the chosen name is passed to BOTH the `email_templates` lookup AND `gmailDraftFetch`**.
- **The only frontend concession.** On the **not-yet-submitted** assess row (admin/planner, never the member `readOnly` view) a muted sub-note reads *"Tax Assessment PDF in vault — uploaded by \<name\> on \<date\>. Enter its information here."* It changes no done-state, hides no step and gates nothing. `templateMeta.js` also gained the `TAX_tax3_assess_reminder|vault` catalogue row.

## The tax-track hand-off chain

**The problem it solves.** Every hand-off in Tax 1 and Tax 2 — the returns arriving, the allocation, the planner's review, the reviewer's outcome, the assess form, the ROI deck — used to be either an FYI anyone could dismiss or nothing at all, which meant each one was somebody's job sitting in nobody's queue. The track now models the whole sequence as a chain of **action-required bells**, each raised by the handler that creates the obligation and retired ONLY by the handler that carries it out.

**The mechanism, and why titles are an API.** Because `dismissible:false` rows are refused by `mark_notification_read` (#179), the only thing that ever clears one is a completing handler writing `read=true` directly, matched on **`pipeline='TAX'` + `client_id` + `dismissible=false` + `read=false` + `title ILIKE '<prefix>%'`**. That makes every title prefix below a shared API (gotcha **#357**). **[`utils/tax-review-bell.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/tax-review-bell.ts) is where that API lives:** it owns every prefix constant, the step-name and option constants (`REVIEW_TASK_NAME`, `ADDL_INFO_TASK_NAME`, `REVIEW_PROCEED`, `REVIEW_STOP`, `ADDL_INFO_NONE`, `ADDL_INFO_REQUIRED`, `GREEN_RED_SENTINEL`, `PRESENTATION_TASK_NAME`, `DECISION2_TASK_NAME`), the clear helpers (`clearTaxReviewBells`, `clearPlannerReviewNeededBells`, `clearPlannerReviewStepBells`, `clearAllocateTeamMemberBells`, `clearPresentationDownloadBells`, `clearHlmConfirmBells`, `clearDecision2Bells`, and the two-condition `tax4StepsSatisfied` / `clearTax4StepBellsWhenBothDone`) and the step-status getters every clear site reads — and its header carries the authoritative **prefix → rule key(s) → clear site** map for the **ten** prefixes it owns. Read that header before touching a title. **One prefix lives outside it:** the #400 vault hand-off (`Tax Assessment PDF added for`) is fired in `utils/assess-vault-stamp.ts` and cleared inline in `save-assess-form.ts`, so eleven title prefixes are load-bearing in total.

**The chain, in order.**

1. **The returns arrive.** A client uploads their tax returns (client portal or the `/tax-upload` link). `actions/vault/upload-notify.ts` stamps `tax_returns_received_at` and raises **`Allocate a team member for <client>`** to **Tracy + Tray** (`TAX_returns_allocate_team_member`). **Skipped when every plan the upload stamped already has a planner.** Retired when `tax_allocate_planner` **sets** an allocation — Team Member or Tax Planner, either carries the instruction out. **A clear-to-nobody does NOT retire it**, deliberately: nothing would re-fire it, because the returns have already arrived. This bell **replaced the old `TAX_returns_received` FYI**, which now has no call site at all and is marked DORMANT in `notification_rules`.
2. **A Team Member is allocated.** `tax_allocate_planner` raises **`Allocate a Tax Planner for <client>`** to that Team Member (`TAX_team_member_allocate_planner`, message *"You have been allocated to \<client\>, please allocate a tax planner."*). **A Team Member allocation always produces exactly this bell** — there is no roiConfirmed / not-yet-confirmed split any more, and the old dismissible `TAX_planner_allocated` FYI fire on the Team-Member branch is deleted. `ready-for-tax3.ts` raises the same key + title again if a Team Member still holds the plan when the ROI confirmation email goes out. Retired by the re-allocation prefix sweep.
3. **A Tax Planner is allocated before the review is done.** `tax_allocate_planner` raises **`Review the tax returns for <client>`** to that planner (`TAX_planner_review_needed`) whenever "Tax planner review complete" is unanswered. Retired when **"Additional information required" is ANSWERED** (`save-task.ts`) — that step is the instruction the bell carries — or by the re-allocation sweep.
4. **The planner says nothing more is needed.** Answering "Additional information required" with **`No additional info required`** raises **`Complete the tax planner review for <client>`** (`TAX_planner_review_step_needed`) to the planner. Answering it `Additional info required` mints nothing — the client supplying the information does.
5. **The client supplies the information.** Both routes fire it — the vault/secure-link upload (`upload-notify.ts`) and the written explanation on `/tax-upload` (`tax-text-submit.ts`) — as **`TAX_planner_additional_info_uploaded`**, **repurposed from a dismissible FYI into an action-required ask** carrying the **SAME title as step 4 on purpose**: the rule KEY controls routing and enable-ability in the Notification Editor, the TITLE controls clearing, so two different triggers with one instruction share one clear site. Both are retired when "Tax planner review complete" is answered (either option), or by the re-allocation sweep. Skipped once the review step is already answered.
6. **The reviewer records Proceed or Stop.** Answering "Tax planner review complete" raises **`Tax Planner review complete for <client>`** to **Tray** (`TAX_planner_review_complete`) on **every genuine outcome change** — no dedupe, because a Proceed later flipped to Stop must reach Tray as a fresh bell. **FOUR variants, ALL action-required now**, all carrying that one title so a single prefix clears whichever is open:

   | Program | Outcome | What the bell asks | What retires it |
   |---|---|---|---|
   | 4 (VFO Tax Planning) | Proceed | pick Proceed on the Green/Red Light step **and** book the ROI meeting | **both** — whichever of the two lands second clears (`save-task.ts` + `ready-for-tax3.ts`) |
   | 4 | Stop | pick Refund on the Green/Red Light step | the **$500 deposit refund succeeding** (`deposit-refund.ts`) |
   | 1 (Holistic) | Proceed | Book the ROI meeting | the ROI meeting being booked (`ready-for-tax3.ts`) |
   | 1 | Stop | Complete the "ROI Meeting booked - Send Confirmation Email" step using the **No** button, with the reason we are stopping | a **declined** decision being recorded — `ready-for-tax3.ts` clears review bells **unconditionally** on `decision==='declined'` |

7. **Proceed also starts the planner's next job, at the same moment.** The same save fires **`Enter the tax planning opportunities for <client>`** to the planner (`TAX_planner_assess_needed`) when the plan has a planner and no assess form yet. Same key + title as the allocation-time fire, so it reuses that bell's clearing machinery, and `dedupe:"unread"` means an already-open one suppresses the second fire. Retired by `save-assess-form.ts` on submit, or the re-allocation sweep.
7a. **If the planner's group delivers its own document instead (#400).** A **vault-assess group** planner (Innovation Consulting Group; Test Group as a permanent fixture) drops their Tax Assessment PDF into the client's vault. That **retires the planner's bell above and stops the sweep chasing them**, and raises **`Tax Assessment PDF added for <client>`** on the assigned PF (`TAX_assess_vault_uploaded_pf`, action-required) telling them to key the document's numbers in. **It does NOT complete the step** — the chain then rejoins at exactly the point below, because the assess FORM is still what finishes it, for this group as for every other. Retired by `save-assess-form.ts` on submit.
8. **The assess form lands.** The FIRST submission raises **`Download the ROI presentation for <client>`** to the assigned **Proactive Facilitator** (`TAX_assess_completed_pf`, **also repurposed FYI → action-required**), naming the planner who assessed. Retired when the PF **schedules the send date** (`presentation-schedule.ts`, primary since v726 — scheduling is the job done), or, as the backstop for bells raised before v726, when `client_tax_plans.presentation_email_sent_at` is stamped by the **daily presentation sweep** (`presentation-sweep.ts`) — still the only site that stamps that column.
9. **If the planner stalls, the sweep chases them.** Two **business** days before `tax3_meeting_date` (configurable — and **the delay counts DOWN**, #359; the horizon is a forward weekday walk since 2026-08-14), the nightly tax sweep drafts `TAX_tax3_assess_reminder` to the planner, Cc'ing their group's Team Members and the assigned PF.
10. **The chain continues into Tax 4 (2026-08-11, #170).** Three more action-required planner bells, each retired by the handler that carries it out: **`Send the detailed tax plan meeting confirmation email for <client>`** (`TAX_planner_hlm_ready`, raised by `invoice-receipt.ts` when the retainer paperwork completes, retired by `highlevel-meeting-confirm.ts`); **`Complete the tax plan review steps for <client>`** (`TAX_planner_tax4_steps_needed`, raised by the nightly sweep once `tax4_meeting_date` has passed, retired only when the presentation dropdown **and** Client decision 1 are both done); and **`Complete Client decision 2 for <client>`** (`TAX_planner_decision2_ready`, raised by `postreview-decision.ts` on a `Continue - Revenue Share` pick, retired by `save-task.ts`). Two older tiers went dormant to make room — `TAX_tax4_decision_needed` and `TAX_planner_post_meeting`.

**The invariant that makes the clear sites simple.** The review branch in `save-task.ts` **clears before every re-fire** (including on a cleared dropdown, which then re-fires nothing), so **at most one review bell is open per client and its meaning always equals that step's CURRENT stored status.** That is why every clear site can decide what to do by reading the step's status through `getReviewStepStatus` / `getAdditionalInfoStatus` / `getGreenRedStatus` instead of parsing bell rows. The Green/Red step is matched by its **`tax_refund` sentinel**, not its long prose name, because prose names get edited.

**The branches that are easy to miss.**

- **A bell whose instruction is already carried out is never minted.** Three fire sites check first (the additional-info follow-on, the client-supplied-info bell, and each review variant against `roiBooked` / `deposit_refund_status` / `ready_for_tax3_decision`), because no clear site would run a second time to retire it.
- **`tax_allocate_planner` clears BEFORE it re-fires, and it clears on ANY genuine change — including a clear-to-nobody.** So a re-allocation never leaves the previous holder chasing a step that is no longer theirs. The one exception is the "Allocate a team member" prefix, cleared only on a SET (above).
- **Allocating a Tax Planner to a plan whose review is answered and whose assess form is already submitted** falls through to the original dismissible `TAX_planner_allocated` FYI, unchanged.
- **`TAX_book_roi_meeting` is DORMANT.** The allocation-time fire is deleted (Tray's booking prompt now rides the review step's Proceed) and the rule row is kept for rollback + Editor visibility — but the `Book the ROI meeting for%` **clear in `ready-for-tax3.ts` stays**, because unread bells of that shape still exist in production. Per gotcha #178, deleting a rule row would not have silenced anything; removing the call site is what stopped the bell.
- **`notifyAllocatedPlanner` takes an optional `dismissible`** (default `true`), so the older FYI planner bells are unchanged; every chain bell passes `false`.
- **Every leg is fail-soft** — a bell failure can never fail an allocation, an already-drafted email, a saved form, a refund that has already moved money, or a sweep tier that has already drafted.
- **The FE's "-- Select --" option is DISABLED in `plannerMode`.** A portal caller must *replace* themselves rather than clear the allocation: clearing would orphan the plan from the whole group's view **and** 403 the follow-up `tax_save_task` mid-flight.

**Frontend surfaces.** The allocation picker does not filter Team Members out; each option is suffixed `— Team Member` and a selected Team Member shows an amber chip. `PlannerClientsList.jsx`'s group filter labels carry the same suffix. The **bell dropdown renders each notification's full message on wrapping lines** (`NotificationBell.jsx`), which is what lets these bells carry a real instruction instead of a title fragment. `templateMeta.js` carries the `TAX_tax3_assess_reminder` entry (*"To: Allocated Tax Planner · Auto-Cc: group Team Members + PF"*).

## Per-specialist Strategy + per-specialist Notes (2026-08-10, v718)

Two small additions to the specialist cards that behave very differently (gotcha **#360**).

**Strategy** — a free-text note on `client_tax_specialists.strategy` (new column, `20260810130500_tax_specialist_strategy_column.sql`), written by exactly one action: **`tax_update_specialist_strategy`** (`actions/tax/update-specialist-strategy.ts`), which is in `ADMIN_ONLY_ACTIONS` and **deliberately NOT in `TAX_PLANNER_ALLOWED_ACTIONS`** — that omission is the entire confinement (#309). It resolves the specialist row by id and then **verifies the row's REAL `tax_plan_id` matches the body's** before writing (#257, the `tax_remove_specialist` guard pattern), trims, caps at 500 chars and stores `null` for empty. The input sits in the **Tax 5** specialist card header between the name and the decision pill (admins only — `!readOnly && !plannerMode`, placeholder "Enter Strategy", saving on blur/Enter and skipping an unchanged value); planners and read-only viewers get a muted truncated span. **Tax 6 mirrors the same value read-only beside the specialist's name and must never gain an editor** — the save updates `taxSpecialists` state, so the Tax 6 mirror is live without a reload.

**Notes** — both the Tax 5 and Tax 6 specialist cards carry the shared `PhaseNotesButton`/`PhaseNotesPanel`, writing **one thread per specialist** into `client_notes` under **`phase_name = 'Specialist - ' + spec.specialist_name`** (helper `specPhaseName`, `tab_name = 'Tax Priorities'`; expand keys `notes_spec_<id>` on Tax 5, `notes_tax6_spec_<id>` on Tax 6). That is a **NEW phase-name family with no corresponding `program_client_phases` row**, so anything enumerating real phase names will not find these threads; they surface on the client profile with a `Specialist - <name>` chip like every other thread. **Renaming a specialist would orphan its thread** — safe today only because `specialist_name` is fixed at insert (#311/#305). Planners get the buttons (the gate is `!readOnly`, and the three note write actions were already planner-callable per #273).

## Tax Planner portal (added 2026-07-22)

The 5th portal / 6th login type. A tax planner (table `tax_planners`) now has a portal login (`tax_planner_logins`) and signs in at `/tax-planner` to work their **whole Tax Planning Group's** tax clients. See [../architecture/04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md) + [../architecture/02-frontend-shell.md](../architecture/02-frontend-shell.md) for the portal/route/auth detail; the tax-flow-specific facts:

- **TWO person-types share this portal (added 2026-07-27; the allocation rule REVERSED 2026-08-10 / v717 — gotcha #294 amended in place).** `tax_planners.planner_role` is `'Tax Planner'` (default) or `'Team Member'`. **A Team Member logs in through the SAME `tax_planner_login`, holds the SAME `tax_planner` role, the SAME `TAX_PLANNER_ALLOWED_ACTIONS` allowlist, the SAME per-step locks and the SAME whole-group ownership guards** — nothing in the auth fence below changes. **Team Members ARE allocatable as of v717.** The original 400 `"Team members cannot be allocated to tax plans"` is **deleted**, and a Team Member is now the deliberate FIRST holder of a plan — a per-partnership **hand-off coordinator** who is allocated, has Tray book the ROI meeting off the back of that allocation, and then replaces themselves with the Tax Planner who will run the plan (see [the tax-track hand-off chain](#the-tax-track-hand-off-chain)). The admin allocation dropdown and the portal's `group` roster now **include** them with a `— Team Member` suffix; only the **KPI allocation leaderboard** still filters the role out. **There is still no separate notification or payout gate — both key off `client_tax_plans.tax_planner_id` — so a Team Member holding a plan DOES receive planner bells and IS a payout destination while they hold it**, which is exactly why the hand-off is meant to happen long before any money leg resolves. A team member's client list defaults to **the whole partnership roster** (`self_role` + the per-entry `planner_role` in the `tax_planner_portal_clients` response drive it), scoped by the same `member_type` group boundary; `save_tax_planner` requires a partnership for the role. **The two real coordinators are Katie Williams (`tax_planners` 14, Innovation Consulting Group) and Bridger Silvester (15, SDP)** — their role flip is migration `20260810130200_team_member_coordinators_flip.sql`, which is **deploy-time DML: apply it only AFTER the frontend deploy**, because the pre-deploy bundle filters Team Members out of every picker.
- **Auth fence.** A `tax_planner` caller is deny-by-default to `TAX_PLANNER_ALLOWED_ACTIONS` and SKIPS the tab + ADMIN_ONLY gates, so EVERY planner-callable tax handler ALSO carries an in-handler `denyIfNotPlannerClient`/`denyIfNotPlannerPlan` WHOLE-GROUP-scope guard (`utils/tax-planner-ownership.ts` — a planner may view/edit any client whose plan is allocated to a planner sharing their `tax_planners.member_type`). Gotcha #257.
- **Allowlist TRIMMED 2026-07-22 (gotcha #262), with ONE entry restored 2026-08-10.** Planners LOST `automation_TAX_decision`, `_readyfortax3`, `_presentation_schedule`, `_request_returns`, `_pricing`, `_extrameeting`, `_depositrefund`, `_sendagreement`, `tax_save_deposit_pi`, `msm_update_tax_status`. **`tax_allocate_planner` was ALSO removed then and is back as of v717** — a Team Member coordinator has to be able to hand a plan on from their own portal, and planners re-allocate within their own group; it is dual-listed in `ADMIN_ONLY_ACTIONS` + `TAX_PLANNER_ALLOWED_ACTIONS` (the #273 pattern) and fenced by `denyIfNotPlannerPlan` on the plan plus the pre-existing check that the TARGET planner is inside the caller's group. They KEEP `tax_save_task`, `tax_save_assess_form`, `tax_add_specialist`, `tax_remove_specialist`, `automation_TAX_highlevelmeeting_confirm`, `automation_TAX_request_additional_info`, `automation_TAX_implementdecision`, `automation_TAX_postreviewdecision` + the loaders / vault / notifications / portal / login actions. **Two entries ADDED 2026-08-13 (v735): `vault_tax_admin_upload_url` + `vault_gen_upload_url`** — the first widening of this list since v717, and the only write actions on it that touch Storage rather than a table. **`tax_update_specialist_strategy` (new 2026-08-10) is deliberately ADMIN-ONLY and absent from this list** — that omission is its whole confinement (#309/#360). (The in-handler group-scope guards still live on the de-allowlisted handlers as defence-in-depth, but a planner can no longer reach them.)
- **Per-step visible-but-locked whitelist (three surfaces, gotcha #262).** In `plannerMode` the Tax Priorities tab shows every step but LOCKS all but a whitelisted subset (outer div `cursor:not-allowed` + inner div `pointerEvents:'none'` — a child style must NOT set `pointerEvents:'auto'` or it punches through the lock, gotcha #263). The editable subset is decided in THREE synced places: FE `PLANNER_EDITABLE_TASK_NAMES` (**15 names**, `TaxPrioritiesTab.jsx`, incl. "Detailed tax plan meeting confirmation email" which saves via `automation_TAX_highlevelmeeting_confirm` and "Allocate Team Member / Tax Planner" which also calls `tax_allocate_planner`), BE `PLANNER_EDITABLE_TASK_NAMES` (**14** `tax_save_task`-reachable names, exported from `save-task.ts` — a planner touching any other task via `tax_save_task` gets 403 "Tax planners cannot edit this step"), and the trimmed allowlist above. **"Tax planner review complete" was added to both lists on 2026-08-11** — the planner is the one who records that call, so all three surfaces had to move together. `+ Add Specialist` and the specialist repeater picker stay active.
- **Chain closure.** `automation_TAX_refund`/`_charge_implementation` are PUBLIC_HANDLERS (bypass the gate) → intentionally NOT allowlisted.
- **Vault — view + ADD, never remove (widened 2026-08-13, v735).** In-group planners get `can_view=true` + a 300s signed download on `vault_tax_list`/`_download`, and — new — may **upload** into the two client-owned sections via `vault_tax_admin_upload_url` + `vault_gen_upload_url`. Still NO delete and NO share for planners (not allowlisted + UI hidden), and **ERT/VFOS stays admin-managed** (`admin_ert_upload_url` deliberately not allowlisted; the FE marks that section `adminOnlyUpload`). The `isTaxAdmin` (Jake/Tray/Paul) admin path is unchanged — `vault_tax_admin_upload_url` now branches `tax_planner` → `denyIfNotPlannerClient`, else the allowlist, exactly mirroring `vault_tax_download` (**gotcha #385** — the allowlist entry alone would still have 403'd). `vault_gen_upload_url` gained the same group guard `vault_gen_download` already had. **Asymmetry worth naming: a planner who uploads the wrong file needs an admin to remove it.**
- **Planner-mode Tax Priorities.** Editable per the whitelist above EXCEPT: no "+ Start Tax Plan" (`tax_start_plan` not allowlisted), all `StepEmailsChip` email-preview chips suppressed, ~~PhaseNotes hidden (note writes not allowlisted)~~ — **superseded 2026-07-23 (#273): planners DO get the per-phase Notes chips/panels, and as of 2026-08-10 the per-specialist notes buttons on the Tax 5 and Tax 6 specialist cards too** (gated on `!readOnly`, not on `plannerMode`) — the allocation dropdown sources the GROUP roster (via `tax_planner_portal_clients`, **which now includes Team Members**), the per-specialist **Strategy input is admin-only** (planners see a muted read-only span, #360), no Stripe-status chips, and the "+ Add Specialist" picker uses `tax_planner_portal_experts` (planners never receive `load_data`).
- **Notifications — the portal header `NotificationBell`** is scoped to the planner's OWN-email rows only — the `'admin'`/`'all'` broadcast recipients are excluded for planners (gotcha #259). The row-click handler awaits `mark_notification_read` BEFORE navigating so the destination bell's mount-load can't resurrect the row (gotcha #267). "View all" is hidden for `tax_planner` sessions.

### Thirteen planner notification bells (six NEW 2026-07-22, a seventh 2026-07-23, an eighth 2026-07-23 evening, a ninth and tenth 2026-08-10, an eleventh and twelfth 2026-08-11, a thirteenth later the same day)

All resolve `tax_planners.email` from the plan's `tax_planner_id` via `notifyAllocatedPlanner` (`utils/tax-planner-notify.ts`; try/catch-safe, skips null client/planner/email; bell link `/tax-planner/client/<client_id>?program=<pid||1>`). Seeded in `notification_rules` (area 'Tax Planners', `default_recipients '["ALLOCATED_TAX_PLANNER"]'` placeholder — the real email is passed per-call) by migrations `20260722130000_tax_planner_step_notifications.sql` (six) + `20260723120000_tax_additional_info_request.sql` (the seventh) + `20260723210000_impl_charged_bells.sql` (the eighth) + `20260810130300_tax_roi_notification_rules.sql` (the ninth and tenth) + `20260811170000_planner_review_chain_rules.sql` (the eleventh) + `20260811180000_tax1_request_first_and_chain_rules.sql` (the twelfth). **`notifyAllocatedPlanner` takes an optional `dismissible`** (`args.dismissible !== false`, so the default stays `true` and the older FYI bells are byte-identical); every hand-off-chain bell passes `false`, which per #179 means it can only be cleared by the matching title-prefix write in its completing handler (#357). **The bell TITLES name the client** — `notifyAllocatedPlanner` substitutes a `[Client Name]` token (lazy `clients` lookup by `plan.client_id`, only when the token is present) so a planner sees WHICH client, and because dedupe `"unread"` is title-keyed the per-client titles scope dedupe per client (gotcha #272):

| Rule key | Fires from | When |
|----------|-----------|------|
| `TAX_planner_allocated` | `allocate-planner.ts` | a genuine (re)assignment to a **Tax Planner** whose review step is already answered AND whose assess form is already submitted — the fall-through FYI. **No longer fires for a Team Member allocation at all** (that branch always raises `TAX_team_member_allocate_planner` instead) |
| ~~`TAX_planner_returns_uploaded`~~ | — **DORMANT since 2026-08-11 (v725)** | Fired on ANY sensitive-vault upload while a planner was allocated and told them to complete the Tax 2 assess step — past the Tax 1 review gate. Its condition was "a planner is allocated", not "returns were requested", so it also fired on additional-info responses; observed live raising it alongside the correct review bell, each naming a different step. Call site removed from `vault/upload-notify.ts`; the rule row is kept for rollback. The planner is told to review at allocation (`TAX_planner_review_needed`) and told the requested information arrived by `TAX_planner_additional_info_uploaded`. |
| `TAX_planner_hlm_ready` | `invoice-receipt.ts` | after the retainer invoice/receipt completes, unless `tax4_meeting_confirm_email_sent_at` is already stamped. **REPURPOSED FYI → `dismissible:false` on 2026-08-11 (#170) and RETITLED so the fixed text leads: `Send the detailed tax plan meeting confirmation email for [Client Name]`**; cleared by `highlevel-meeting-confirm.ts` when that step's email actually goes out |
| `TAX_planner_decision2_ready` | `postreview-decision.ts` | **NEW TRIGGER 2026-08-11 (#170): the moment Client decision 1 is recorded as `Continue - Revenue Share`** — the planner's next step does not wait on the money moving, and the old fire in `revshare.ts` (after retainer revshare success) is **REMOVED**. Also **REPURPOSED FYI → `dismissible:false`** and retitled `Complete Client decision 2 for [Client Name]`; cleared by `save-task.ts` when that step is answered. Not fired when it already is |
| `TAX_planner_tax4_steps_needed` | `revshare-sweep.ts` | the night after `tax4_meeting_date` passes — asks the planner for BOTH Tax 4 steps. **NEW 2026-08-11 (#170), `dismissible:false`**; one-shot on `tax4_meeting_reminder_last_sent_at`; cleared only when both steps are done (`clearTax4StepBellsWhenBothDone`). **Supersedes the now-dormant `TAX_tax4_decision_needed` and `TAX_planner_post_meeting`** |
| `TAX_planner_impl_decision_ready` | `save-task.ts` | "Confirm ready for implementation" transitions to "Yes" (dedupe unread) |
| ~~`TAX_planner_post_meeting`~~ | — **DORMANT since 2026-08-11 (#170)** | Fired the day after `tax4_meeting_date`, one-shot on `tax4_planner_nudge_sent_at` (table row P above). Same trigger, recipient and instruction as the action-required `TAX_planner_tax4_steps_needed` that replaced it, so keeping it enabled would have given the planner two bells a night. Call site removed; rule row kept for rollback |
| `TAX_planner_additional_info_uploaded` | `vault/upload-notify.ts` **and** `vault/tax-text-submit.ts` | client uploads **or writes an explanation** while a "Request additional information" request is outstanding (any program with a planner) → the requested info has arrived (dedupe unread), so review it and complete the "Tax planner review complete" step. Both paths reuse this ONE rule (#308). **REPURPOSED 2026-08-11 from a dismissible FYI into `dismissible:false`**, and it deliberately shares the title `Complete the tax planner review for [Client Name]` with `TAX_planner_review_step_needed` — the key routes, the title clears. Skipped once the review step is answered |
| `TAX_planner_impl_charged` | `implementation-receipt.ts` | the implementation fee is charged + the receipt completes (`implementation_receipt_status='Sent'`, once per plan; dedupe unread) — the EIGHTH planner bell |
| `TAX_team_member_allocate_planner` | `allocate-planner.ts` **and** `ready-for-tax3.ts` | a **Team Member** holds the plan and must hand it on — raised on **ANY** Team Member allocation (the old two-branch roiConfirmed split is gone), and again when the ROI confirmation email goes out while a Team Member still holds the plan. **NINTH planner bell, and the first that is `dismissible:false`** (action-required); cleared by `allocate-planner.ts` on any allocation change. Title `Allocate a Tax Planner for [Client Name]`. Gotcha #357 |
| `TAX_planner_assess_needed` | `allocate-planner.ts` **and** `save-task.ts` | a **Tax Planner** is allocated with the review already answered Proceed and `assess_form_submitted_at` NULL, **or** the "Tax planner review complete" step is answered Proceed. **TENTH planner bell, also `dismissible:false`**; dedupe unread means the two fires never double up; cleared by `save-assess-form.ts` on submit and by `allocate-planner.ts` (any allocation change). Title `Enter the tax planning opportunities for [Client Name]`. Gotcha #357 |
| `TAX_planner_review_needed` | `allocate-planner.ts` | a **Tax Planner** is allocated while "Tax planner review complete" is UNANSWERED — review the returns and complete the "Additional information required" step. **ELEVENTH planner bell, `dismissible:false`**; cleared by `save-task.ts` when that step is answered, or by the re-allocation sweep. Title `Review the tax returns for [Client Name]` |
| `TAX_planner_review_step_needed` | `save-task.ts` | "Additional information required" was answered **`No additional info required`** — nothing is being waited on, so complete the review step. **TWELFTH planner bell, `dismissible:false`**; cleared by `save-task.ts` on the review answer, or by the re-allocation sweep. Title `Complete the tax planner review for [Client Name]` — **shared on purpose with `TAX_planner_additional_info_uploaded`** |

The implementation-receipt tail ALSO fires a NON-planner bell to the assigned PF: **`TAX_impl_charged_pf`** (area `Tax`, `default_recipients '["ASSIGNED_PF"]'`, sort 40, via `notifyByRule`; SKIPPED when `getPfEmail(client.assigned_pf)` resolves nothing; link `/admin/client/<id>?tab=tax`). Both bell calls are whole-body try/catch so a notify failure never breaks the receipt.

### "Additional information required" step — Request Additional Information button (NEW 2026-07-23)

The "Additional information required" step (Tax 1 - Diagnostic) kept its 2-option dropdown but its 3 legacy dropdown sub-steps ("Email to obtain information required sent" / "Information received" / "Information passed to VFO-L") were REPLACED by a **"Request additional information"** email button + inline compose card + AI PC Admin cascade, cloning the Request Tax Returns pattern but **PROGRAM-AGNOSTIC** (identical in Holistic program 1 and VFO Tax Planning program 4) and carrying requester free text. **Admin OR the allocated tax planner may send** (the step is on the planner-editable whitelist; `automation_TAX_request_additional_info` is in both `ADMIN_ONLY_ACTIONS` and `TAX_PLANNER_ALLOWED_ACTIONS`, guarded by `denyIfNotPlannerPlan`). The email (template `TAX_request_additional_info`, Draft mode) carries the free text via `[REQUESTED_INFO]` and the SAME secure `/tax-upload?token=` link (reuses `clients.tax_upload_token`). On any client upload, the newest plan (ANY program) with an outstanding request gets `additional_info_received_at` stamped (ALWAYS-overwritten — re-greens on every upload) + two bells fire: `TAX_additional_info_received` (the Tracy/Tray FYI) and the **action-required** `TAX_planner_additional_info_uploaded` to the allocated planner, titled `Complete the tax planner review for <client>` and skipped once the review step is answered. A resend re-stamps `additional_info_requested_at` and CLEARS `additional_info_received_at`. Both the returns cascade and the additional-info cascade can fire on ONE upload (shared link, by design). The 3 legacy sub-task rows still exist in `program_client_tasks` with their legacy `client_tax_progress` data but are hidden unconditionally in the FE — do not resurrect (gotcha #271).

**The client can also answer in WRITING — either path completes the step (NEW 2026-07-30, v680; gotcha #308).** Most of what a planner asks for is not a document, so `/tax-upload` now carries an **"Or write an explanation"** free-text box below the dropzone (5-row textarea + Send, its own `noteError` state separate from the upload error). Send calls the NEW **PUBLIC** action **`vault_tax_text_submit`** (`actions/vault/tax-text-submit.ts`), body `{ token, text }`:

- Resolves `clients` by `tax_upload_token` — the lookup is error-checked (500 on a DB error, **403 "Invalid link"** on a genuine miss, per #187).
- Trims the text and hard-caps it at **5000 chars**; empty → 400.
- Finds the newest plan with `additional_info_requested_at NOT NULL` (`order id desc limit 1`) or returns **400 "No open request for additional information"** — a stale link cannot write into a plan with nothing outstanding.
- One `update` **appends** `{ text, at }` to `client_tax_plans.additional_info_responses` (jsonb array — **never overwritten**, because one request can draw several clarifications) **and stamps the SAME `additional_info_received_at` the upload path stamps.** That shared stamp is the whole design: the step's existing done-logic needed no change, and **any consumer asking "did the client respond?" must consider BOTH paths.**
- Fires the **two EXISTING rules** — `TAX_additional_info_received` (Tracy/Tray; message says "written explanation (no file)") and `TAX_planner_additional_info_uploaded` via `notifyAllocatedPlanner` (dedupe unread, client-named title per #272; **action-required since 2026-08-11**, byte-identical title and message to the upload path so the two share one clear site, and skipped when the review step is already answered) — inside one try/catch, so a notification failure never loses the client's answer. **No new `notification_rules` rows.** The bell link is `?tab=tax&program=` and NOT the upload path's `?tab=vault`, because text lives on the plan, not in the vault.

**The box is NOT shown to everyone — since 2026-08-04 (v699) it is gated server-side, and it has to be (gotcha #331).** `/tax-upload?token=` is handed out by **three** different emails — Request Tax Returns, Request Additional Information, and the first-payment email — and all three embed the **same** `clients.tax_upload_token`, because that token is one durable per-client value rather than a per-request one. So the page cannot tell the flows apart from the URL, and from v680 to v699 it simply showed the textarea to every arrival: a client who came from the returns-only or first-payment email could type an answer, press Send, and get back the `400 "No open request for additional information"` above. `TaxUploadPage.jsx` now POSTs the NEW **PUBLIC** action **`vault_tax_upload_context`** (`actions/vault/tax-upload-context.ts`) with `{ token }` on mount; it validates the token against `clients.tax_upload_token` (**400** no token, **403 "Invalid link"** on a miss, 500 on a DB error) and returns **`{ success: true, allow_text: <bool> }`** — **that boolean is the entire payload and must never be widened**, because this is an unauthenticated endpoint whose only credential is a value sitting in an old email. **The gate re-runs the EXACT predicate `vault_tax_text_submit` uses** (newest plan with `additional_info_requested_at NOT NULL`), so **visibility equals submittability — change one predicate and you must change the other.** Client-side, `allowText` defaults to `false` so the box never flashes, and a failed context call degrades to "no box" rather than an error card. Two consequences: **every `/tax-upload` link already sitting in a client's inbox self-corrects on load** (the gate is server state, not the link — nothing needs re-issuing), and **a client with an open additional-info request sees the box on ANY of their `/tax-upload` arrivals**, including an old Request Tax Returns email — deliberate, since it is the same page reading the same client state. The **dropzone half is unconditional and unchanged.**

Admin side: `TaxPrioritiesTab.jsx` renders a **"Client explanation"** chip row after the AI PC Admin cascade whenever `additional_info_responses` is non-empty — cloned from the assess-step submitted-chip pattern (green dot, green Submitted pill, `formatStamp` of the newest entry, ▼ caret, expand key `addinfo_resp_${task.id}`) — expanding to a panel listing every entry **newest-first** as a muted stamp line over a `pre-wrap` read-only box. One shared component, so both programs get it. **The ADMIN's own request free text is still NOT stored anywhere** — `[REQUESTED_INFO]` is interpolated into the Gmail draft and lost; only the client's replies persist.

### `TAX_PLANNER` email recipient chip (NEW 2026-07-22, gotcha #266)

`"TAX_PLANNER"` was added to `RECIPIENT_ROLE_TOKENS` (`utils/email-recipients.ts`) + `ROLE_LABELS.TAX_PLANNER='Tax Planner'` (`components/shared/templateMeta.js`), so an admin can drop a "Tax Planner" Cc chip on any tax email template. It resolves per-send from the plan's `tax_planner_id` (helper `taxPlannerEmail`); ALL 25 tax `resolveTemplateRecipients` call sites pass it in ctx. Sandbox mode SUPPRESSES all Cc, so the chip is only observable on live-mode sends. 17 templates got `"TAX_PLANNER"` appended to `cc_list` this session (148; the postreview + implementdecision families; refund 27/141). A NEW tax email handler that omits `TAX_PLANNER` in its ctx silently no-ops the chip.

## Cross-references

- Tax-plans column dictionary: [../tables/tax.md](../tables/tax.md)
- MAP1 contract+payment flow (parallel structure): [contract-and-payment.md](contract-and-payment.md)
- BoldSign webhook detail: [boldsign-webhook.md](boldsign-webhook.md)
- Stripe webhook detail: [stripe-webhook.md](stripe-webhook.md)
- API action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
- Stripe + revshare: [../integrations/stripe.md](../integrations/stripe.md)
- BoldSign: [../integrations/boldsign.md](../integrations/boldsign.md)
- Gmail/Sheets/Drive: [../integrations/gmail.md](../integrations/gmail.md), [../integrations/google-sheets.md](../integrations/google-sheets.md), [../integrations/google-drive.md](../integrations/google-drive.md)
