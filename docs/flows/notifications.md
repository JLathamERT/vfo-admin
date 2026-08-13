# Notifications flow

The portal's bell-icon notification feed. A small, simple flow: handlers insert rows; the bell polls and displays; click marks read; admin actions clear them in bulk.

> **2026-07-10 additions (see [tables/notifications.md](../tables/notifications.md) for full detail):** the bell now has a **View all** link to a full-page Notifications view (`NotificationsPage.jsx`, `/admin?tab=notifications`, every admin) with **Current** (unread) / **Archive** (read) scopes, All/Action/FYI/**Reminders** kind filters, pagination, and bulk clear (`load_notifications_page` / `mark_notifications_read`). Read rows are hard-deleted after 90 days by the daily `automation_NOTIFICATIONS_purge` cron (jobid 15) — so the old "rows accumulate forever / hard LIMIT 20" caveats below are bounded now. Admins can also self-schedule **personal reminders** (`personal_reminders` table; delivered every 5 minutes by `automation_REMINDER_sweep`, cron jobid 14, via a DIRECT insert — the one documented exception to the notifyByRule rule; pipeline `REMINDER`, violet styling). Gotchas #212–#213.

> Pipelines that emit notifications: `MAP 1`, `TAX`, `ADVISOR_ONBOARDING`, `ACCOUNTANT_ONBOARDING`, `PIP`. Each pipeline uses a distinct `link` value pointing back at the relevant admin section so a click lands the admin on the right page (e.g. accountant onboarding notifications link to `/admin?tab=accountants&section=accountant_onboarding&onboarding=<id>`, opening that record directly). **CORRECTED 2026-08-13 — the list above is incomplete:** `VAULT` (two rules), `REMINDER`, `SPECIALIST` and `MIGRATION` also emit.
>
> **Advisor/Accountant onboarding route to the chosen "Team Member Responsible," not the shared `admin` bell** (2026-06-15). Each onboarding now carries an `onboarding_team_member` name (Stage-1 dropdown). `constants/onboarding-team.ts::teamMemberRecipient(name)` maps that name → the person's `@elitert.com` login email (the bell filters on `session.email`), falling back to `'admin'` when unset/unmapped. See the dedicated subsection below.

> **TAX notification links carry program context** (added this session). All 12 tax notification `link`s append `&program=${plan.program_id}` to the `/admin/client/<id>?tab=tax` deep-link. Without it, a client enrolled in BOTH VFO Holistic (program 1) and VFO Tax Planning (program 4) opened their DEFAULT enrollment (Holistic) instead of the program the notification was about. `ClientDetail.jsx` reads `?program=` and passes it to `msm_load_client_home`, which resolves the matching enrollment before falling back to `clients.enrollment_id`. MAP1/PFT/Advisor/Accountant links are unaffected (single default program).

## Data model

Single table: [`notifications`](../tables/notifications.md). Key columns:
- `recipient` (text): routing key — typically `'admin'`, an email, or `'all'`.
- `client_id`, `pipeline`, `title`, `message`, `link`.
- `read` (boolean, default `false`).

## Frontend display

[NotificationBell.jsx](src/components/NotificationBell.jsx) is mounted in [AdminPortal.jsx:203](src/pages/AdminPortal.jsx) (admin only — not in MemberPortal).

```
useEffect(() => {
  loadNotifications()
  setInterval(loadNotifications, 30000)   // poll every 30s
}, [])
```

The bell renders a count badge + dropdown of titles. Click an item → navigates to `notification.link` (typically `/admin/client/<id>?tab=map1`). "Mark all read" iterates over all visible notifications and calls `mark_notification_read` for each in parallel.

## Step 1 — Load (filtered, server-side)

**Handler:** `load_notifications` ([NotificationBell.jsx:28](src/components/NotificationBell.jsx) → [admin-api:4364-4374](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Returns up to 20 unread notifications matching the caller. Filter: `recipient = session.email OR recipient = 'admin' OR recipient = 'all'`. Sorted by `created_at DESC`.

```sql
SELECT * FROM notifications
WHERE (recipient = '<session.email>' OR recipient = 'admin' OR recipient = 'all')
  AND read = false
ORDER BY created_at DESC
LIMIT 20
```

> **Note:** for member sessions, `recipient = session.email` would match notifications addressed to the member's email. But no observed handler inserts notifications with a member's email as recipient — current notification inserts all use `recipient='admin'` (see Step 2). Members likely see an empty bell. The bell is also not mounted in MemberPortal anyway.

## Step 2 — Insertion points

> **Stale-claim correction (2026-06-09):** the line below — "the only handler that inserts is `automation_PCADMIN_finaldecision`" — is **wrong**. Many handlers across MAP 1 / TAX / Advisor / Accountant / PFT / Specialist insert notifications. For the **complete TAX inventory** (every insert + clear across Tax 3/4/5, recipient, dismissible, how cleared, plus the email-only nag ladders), see [tax-planning.md § Notification inventory (TAX pipeline)](tax-planning.md#notification-inventory-tax-pipeline--audit-2026-06-09). The MAP 1 example below is retained as an illustration only.

The original MAP 1 insertion example, `automation_PCADMIN_finaldecision` ([admin-api:705-738](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Two cases:

- Decision = `Yes` (with chosen service level):
  ```
  recipient: 'admin'
  client_id: <id>
  pipeline:  'MAP 1'
  title:     "<Client name> chose <Service level>"
  message:   "<Client name> selected <Service level> Membership — complete the pricing form"
  link:      "/admin/client/<id>?tab=map1"
  ```
- Decision = `ExtraMeeting`:
  ```
  recipient: 'admin'
  client_id: <id>
  pipeline:  'MAP 1'
  title:     "<Client name> requested extra meeting"
  message:   "<Client name> wants an additional meeting before deciding"
  link:      "/admin/client/<id>?tab=map1"
  ```

Beyond this MAP1 example, the TAX / Advisor / Accountant / PFT pipelines also insert notifications. Recipient routing varies: TAX routes per-person via `utils/tax-notify.ts`; **Advisor/Accountant onboarding route to the chosen Team Member** (see subsection below); the rest use `recipient='admin'` (plus, for the Tax 4 reminder below, specific staff emails). Status changes elsewhere in the system (CIQ, MSM, contracts) do **not** generate notifications.

### Tax 4 "Client decision 1 needed" reminder (action-required, in-app)

Replaced the old daily nudge email. The `tax-revshare-sweep-daily` cron (02:30 UTC) raises **ONE persistent action-required in-app notification** (`dismissible:false`, rule `TAX_tax4_decision_needed`) per plan when `tax4_meeting_date < today` AND `post_review_decision IS NULL`. **Recipients as of 2026-07-27 (v664): the client's assigned PF + the plan's allocated tax planner + Tracy** `tnmiller@elitert.com`, deduped, Tracy always present so the list is never empty (it previously went to departed Tim Gacsy + Tracy — gotcha #291):

```
recipient: <assigned PF login> / <allocated planner email> / 'tnmiller@elitert.com'
           (one row each)
pipeline:  'TAX'
title:     "Client decision 1 needed — <client>"
link:      "/admin/client/<id>?tab=tax&program=<program_id>"
           ...except the PLANNER's row, link-overridden via the `links` map to
           "/tax-planner/client/<id>?program=<program_id||1>"   (gotcha #292)
dismissible: false
```

Fired once per plan (guarded by `client_tax_plans.tax4_meeting_reminder_last_sent_at`). **Cleared** by `actions/tax/postreview-decision.ts` (`.ilike("title","Client decision 1 needed%")`) when any Tax 4 `Client decision 1` is recorded.

### TAX pipeline — no shared `admin` bell (rerouted 2026-06-09; recipients re-cut 2026-07-27)

Every TAX notification routes to a specific person via [`utils/tax-notify.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/tax-notify.ts) — none use `recipient:'admin'`. Tax 3 / Setup-phase → **assigned PF** (`taxPfRecipients`, **Tracy** fallback — `TAX_OWNERS` is `[TRACY_EMAIL]` alone since Tim Gacsy left); Tax 4/5 client-decision FYIs → **assigned PF + the allocated tax planner** (`taxDecisionRecipients`, Tracy fallback, planner row link-overridden into the planner portal); the meeting nudge → **PF + planner + Tracy**; the Tax 4/5 96h "reach out" escalations → **assigned PF**. Gotchas #291 (the four-layer departed-staffer checklist) + #292 (the per-recipient `links` map). Full per-notification inventory: [tax-planning.md § Notification inventory](tax-planning.md#notification-inventory-tax-pipeline--audit-2026-06-09).

### Advisor / Accountant onboarding — route to the "Team Member Responsible" (2026-06-15)

Each `advisor_onboarding` / `accountant_onboarding` row carries an `onboarding_team_member` name (Stage-1 dropdown). [`constants/onboarding-team.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/constants/onboarding-team.ts) `teamMemberRecipient(name)` maps it to that person's login email, or `'admin'` when unset/unmapped. The seven mapped names (Rachael Hopson, Ian Welham, Anton Anderson, Paul Latham, Seth Hartford, Evan Anderson, Bridger Silvester — the last two added 2026-07-14) mirror the frontend's `SALES_TEAM_NAMES`. Which onboarding notifications use it:

| Insert point | Recipient | Notes |
|---|---|---|
| Client clicked **Yes** (`*/client-decision.ts`) | **team member** | "<name> clicked Yes on the advisor/accountant-onboarding email" |
| Client clicked **No** (`*/client-decision.ts`) | **team member** | "<name> clicked No on the …-onboarding email" — rerouted alongside the Yes click (2026-06-15) |
| Client clicked **Request Additional Meeting** (`*/client-decision.ts`, `decision='ExtraMeeting'`) | **team member** | **action-required** (`dismissible:false`), rules `ADVISOR_extra_meeting_requested` / `ACCOUNTANT_extra_meeting_requested` (recipient token `TEAM_MEMBER`; added 2026-07-14). Title "Extra meeting requested…"; link deep-links to the onboarding record. **Cleared** by the extra-meeting outcome handler (see the extra-meeting subsection below). |
| 96h stall escalations (`*/sweep.ts`, `addAdvisorNotif`/`addAccountantNotif`) | **team member** | the three-stall 96h notices (Undecided / agreement / payment) — formerly `admin` |
| **NEW** "Ready to create" action-required (`*/invoice-receipt.ts`) | **team member** | `dismissible:false`; `title: "Ready to create <name> — onboarding complete"`. Fired when payment + invoice/receipt are done so the Stage-3 "Create Advisor/Accountant" button is available. **Cleared** by `*/create-member.ts` (`.like("title","Ready to create%")`) once the member is created. |
| CEO-countersign FYI (`*/ceo-countersign.ts`) | `admin` (unchanged) | not rerouted this session |

(The sweep's 14-day implicit-No auto-decline updates the row + chains the decline email but inserts **no** notification. A `final_decision='ExtraMeeting'` parked at the decision stage suppresses both that auto-decline and the decision-stall reminders.)

### Advisor / Accountant onboarding — extra-meeting mechanism (2026-07-14)

Mirrors MAP 1's extra-meeting flow, on BOTH onboarding pipelines. The original Undecided decision email and all three sweep reminder emails carry a blue **"Request Additional Meeting"** button (the `/advisor-decide` | `/accountant-decide` token URL with `decision=ExtraMeeting`; the sweeps mint a `decision_token` via `ensureDecisionToken()` for straight-Yes rows that never had one, omitting the button if minting fails). Flow: client clicks the button → `automation_ADVISOR_clientdecision` / `automation_ACCOUNTANT_clientdecision` derives the stage from row state (`payment_link_sent_at`→`'payment'`, else `agreement_sent_at`→`'signing'`, else `'decision'`), stamps `extra_meeting_requested_at` / `extra_meeting_stage` (nulls `extra_meeting_completed_at` on repeat requests), and at the decision stage also parks `final_decision='ExtraMeeting'` → fires the action-required `TEAM_MEMBER` bell (above). The admin books/holds the meeting, then records the outcome via `automation_ADVISOR_extrameeting` / `automation_ACCOUNTANT_extrameeting`; every outcome path clears the bell (by pipeline + `dismissible=false` + `read=false` + `link LIKE '%onboarding=<id>%'` — onboarding notifications have no `client_id`).

### Cross-pipeline: Tracy "client has paid" FYI (repurposed 2026-06-30; sheet check removed 2026-07-01)

[`utils/revshare-tracy-notify.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/revshare-tracy-notify.ts) `notifyTracyClientPaid()` — an FYI (dismissable, deduped once per payment) to **Tracy** (`tnmiller@`) that a client has paid and the case is cleared to proceed, fired once per payment from MAP 1 (`contract-revshare.ts`, with the client's chosen priorities) and Tax (`revshare.ts`), **independent of any rev-share sheet**. The old `notifyTracyRevShareNeeded()` ("enter the split into the VFO Services - Private Info sheet", fired on the Tracy-sheet `pending` branch) was repurposed to this — the Tracy Revenue-Master cross-check that produced the `pending` branch was removed (gotcha #164). No auto-clear.

### Cross-pipeline: Tracy planner-vault-drop FYI (2026-08-13, v738)

[`utils/vault-planner-notify.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/vault-planner-notify.ts) `notifyPlannerVaultDrop()` — rule **`VAULT_planner_document_added`**, pipeline **`VAULT`**, recipient `tnmiller@elitert.com` (Tracy), `dismissible: true`, link `/admin/client/<client_id>?tab=vault`. Fired from **both** planner-reachable signed-upload-url minters: `actions/vault/tax-admin-upload-url.ts` (Sensitive Documents) and `actions/vault/gen-upload-url.ts` (General Documentation).

Title: `<Planner Full Name> dropped a document in <Client First Last>'s vault`. Message adds the filename and the section label.

**Three properties differ from every other bell in this doc and are the reason it has its own section:**

1. **It fires at signed-URL MINT time, not on the upload.** The browser PUTs the file straight to storage, so the minter is the only backend touchpoint — a PUT that then fails leaves one slightly early bell. Accepted deliberately for an FYI; the alternative is no signal at all.
2. **No dedupe.** Every document drop is its own bell (contrast the Tracy "client has paid" and Jake failure FYIs, which dedupe).
3. **Admin uploads are excluded in CODE, not by a rule setting.** `resolveCallerPlanner` checks `allowed_admins` **before** `tax_planner_logins`, so an admin who also holds a planner login resolves to `null` and fires nothing — mirroring `middleware/auth.ts`'s role precedence.

FYI only: **no clear site, and its title is NOT load-bearing** — it sits outside the tax-track title-prefix clearing chain described above. Live-tested three ways on v738: Team Member → General fires, Tax Planner → Sensitive fires, admin → silent. Gotcha **#393**.

### Cross-pipeline: Jake payment/transfer-failure alerts (2026-06-09)

[`utils/notify-jake-failure.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/notify-jake-failure.ts) `notifyJakeFailure()` — an alert (deduped) to **`jlatham@elitert.com`** on every detectable money-movement failure, IN ADDITION to any existing notification: revshare Connect-transfer failed (MAP 1/Tax/PIP), MAP 1 quarterly off-session charge failed, Tax implementation charge failed, Specialist bg + license payment failed (`router/webhooks.ts`). **Expanded 2026-06-15** to also cover ACH first-payment bounces (`checkout.session.async_payment_failed`, all pipelines), failed first-payment PaymentIntents (broadened beyond Specialist), Specialist license lapse/cancel (`customer.subscription.updated`/`deleted`), chargebacks (`charge.dispute.*`), refunds + failed refunds (`charge.refunded` / `refund.*`), and rev-share clawbacks (`transfer.reversed`). Gained an `actionRequired` flag (non-dismissible) + `clearJakeFailure`/`clearJakeFailuresContaining` auto-clear — action-required + auto-clear for rev-share/license/disputes, dismissible FYI for the rest.

## Step 3 — Mark read (single)

**Handler:** `mark_notification_read({notification_id})` ([NotificationBell.jsx:41](src/components/NotificationBell.jsx) → [admin-api:4569-4578](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). UPDATEs `notifications.read=true` for one id.

## Step 4 — Bulk clear (per-client, by handlers)

Two handlers clear all unread notifications for a `client_id` after the admin completes a follow-up:

| Handler | Where | Effect |
|---|---|---|
| `automation_PCADMIN_pricing` | [admin-api:4398-4402](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `UPDATE notifications SET read=true WHERE client_id=<id> AND read=false` |
| `automation_PCADMIN_extrameeting` | [admin-api:4559-4563](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | same |

This avoids leaving the "client chose Yes" notification in the bell after the admin actually completes the pricing form.

> **The narrower, and now more common, form is a TITLE-PREFIX clear.** An action-required row (`dismissible=false`) is refused by `mark_notification_read` (#179), so its completing handler must write `read=true` itself — and where several such bells can coexist for one client, the write is scoped by **pipeline + `client_id` + `dismissible=false` + `read=false` + `title ILIKE '<prefix>%'`** rather than by client alone. The **tax-track hand-off chain** is the largest instance: **seven fixed prefixes cleared from seven handlers** (`allocate-planner`, `save-task`, `ready-for-tax3`, `deposit-refund`, `save-assess-form`, `presentation-sweep`, plus the two vault fire sites' shared prefix), which makes those titles load-bearing strings — reword one without moving its clear and the bell becomes permanent. **The authoritative prefix → clear-site map lives in [`utils/tax-review-bell.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/tax-review-bell.ts)'s header**, which also owns the clear helpers every one of those handlers calls. Two consequences worth internalising: **a bell whose instruction is already satisfied is never minted** (nothing would clear it), and **a rule row's `action_required` column does not create or remove this behaviour** — only the call site's `dismissible:false` does. See [tax-planning.md § In-app notification CLEARS](tax-planning.md#in-app-notification-clears-targeted-update-readtrue) and gotcha **#357**.

## Tables touched

- **Read:** `notifications`.
- **Written:** `notifications` (insert + read flag updates).

## Downstream chains

**None.** Notifications are purely informational.

## Auth

- `load_notifications` is in `ADMIN_ONLY_ACTIONS` ([admin-api:2249](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — only admins can read.
- `mark_notification_read` is in `ADMIN_ONLY_ACTIONS` — only admins can mark.
- The handler that *inserts* (`automation_PCADMIN_finaldecision`) is public-token-authed (no session required), so the insertion is gated by knowing a valid `c15_token`.

## Failure modes

1. **Polling load on expired session** — every 30s the bell calls `load_notifications`. If the admin's session expired since the page loaded, the next poll returns 401 → triggers global redirect → admin gets bumped to login mid-session. Documented in [04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md).
2. **Mark all read race** — the "Mark all read" UI iterates with `Promise.all(notifications.map(n => callApi('mark_notification_read', ...)))`. With 20 items that's 20 parallel HTTP requests. If any one fails, the bell still clears in UI but the row stays unread server-side. Refresh would re-surface it.
3. **No dedup** — multiple `Yes` decisions for the same client (e.g., admin re-runs the flow, or test data) insert duplicate notifications. The bell shows them all.
4. **Hardcoded LIMIT 20** — if more than 20 unread notifications accumulate (which would imply admin neglect), the oldest are silently dropped from view. They still exist in the table; admin must mark some read to surface the rest.

## Open questions

1. **Member notifications** — the schema and `load_notifications` filter both contemplate per-email recipients, but no insertion path uses that. Was member-side notification a planned feature?
2. **Cleanup** — read notifications are never deleted. The table will grow indefinitely. No retention policy observed.

## Cross-references

- Notifications table: [../tables/notifications.md](../tables/notifications.md)
- The two handlers that insert/clear: [contract-and-payment.md](contract-and-payment.md#step-3a--client-clicks-decision-button-on-decide-undecided-path-only)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
