# Notifications

In-portal notification feed. The bell icon at the top of `AdminPortal` AND the admin variant of `/admin/client/:id` ([NotificationBell.jsx](src/components/NotificationBell.jsx)) reads from `notifications`. **As of 2026-07-03 every insert routes through `utils/notify.ts notifyByRule(supabase, ruleKey, {...})`** — the `notification_rules` row for that key can override recipients, disable the notification, or (sweep tiers) change the delay. **One documented exception (2026-07-10): the personal-reminder sweep inserts directly** (user-authored reminders have no rule key — gotcha #213). Full per-notification audit: [NOTIFICATION_AUDIT.md](../NOTIFICATION_AUDIT.md). Gotchas #176–#180, #212–#213.

**Full-page Notifications view (2026-07-10):** the bell's **View all** opens `NotificationsPage.jsx` (admin portal `activeTab='notifications'`, `/admin?tab=notifications` — available to EVERY admin, not tab-granted). Two scopes — **Current** (unread) and **Archive** (read; retained 90 days then hard-deleted by the daily `automation_NOTIFICATIONS_purge` cron, jobid 15) — each filterable by kind (All / Action required / FYI / Reminders), newest/oldest sort, 50-per-page pagination, and checkbox bulk clear (`mark_notifications_read`, dismissible + recipient-scoped rows only). Reminder rows (`pipeline='REMINDER'`) have a reserved violet left bar + REMINDER pill in both the bell and the page. "Clearing" anywhere only flips `read=true` — rows are deleted only by the purge cron.

## `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `recipient` | text | not null. Routing key. `actions/notifications/load.ts` filters `recipient = session.email OR 'admin' OR 'all'` — so a value is any login email (member OR admin; e.g. `tnmiller@elitert.com` for Tracy on SPECIALIST notifications, gotcha #60), `'admin'` (all admins), or `'all'`. A recipient email with no matching login row is stored but never shown. Recipient resolution (assigned-PF / team-member / assigned-admin lookups, plus any Notification Editor override) happens inside `notifyByRule` before insert. |
| `client_id` | integer | fk → `clients.id` (NO ACTION) |
| `pipeline` | text | Pipeline name (e.g., `"MAP 1"`). Rendered as a chip in the bell row. |
| `title` | text | not null. The bell row shows ONLY the title (single line, ellipsized) — write who+what into it. |
| `message` | text | Shown in the row's hover tooltip (not inline — 2026-07-03 compact restyle). |
| `link` | text | Frontend route the bell navigates to on row click (must be real — gotcha #18, **and real *for that recipient's portal***). `notifyByRule` accepts an optional `links` map (lowercase recipient email → link) applied per row, so one event can give a tax planner `/tax-planner/client/<id>?program=<n>` while admins keep `/admin/client/<id>?tab=tax` — gotcha #292. |
| `read` | boolean | default `false`. Status field. |
| `dismissible` | boolean | default `true`. `true` = FYI (green Done button; row click also dismisses). `false` = action-required: NO Done button, sorted to the top with an orange ACTION pill, excluded from "Mark all read", and **`mark_notification_read` refuses it server-side (gotcha #179)** — it clears only when the completing handler (e.g. `automation_TAX_pricing`, `create-member`, reviewer-notes saves, `clearJakeFailure`) writes `read=true` directly. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `load_notifications`, `mark_notification_read` (FYI-only), `load_notifications_page` (paginated, incl. read rows), `mark_notifications_read` (bulk FYI clear), `automation_REMINDER_sweep` (direct insert — the documented #176 exception), `automation_NOTIFICATIONS_purge` (deletes read rows >90d). All other inserts ONLY via `notifyByRule` (raw inserts are a regression — gotcha #176).

## `personal_reminders` *(new 2026-07-10; deny-all RLS)*

Self-scheduled admin reminders (Notifications page → Reminders sub-tab). Per-admin: `reminder_create`/`reminder_load`/`reminder_delete` are ADMIN_ONLY and always scoped to `auth.session.email` (never a body email). Delivered by `automation_REMINDER_sweep` (cron `reminder-sweep-5min`, jobid 14) as a dismissible bell row (`pipeline='REMINDER'`, link `/admin?tab=notifications`) within ~5 minutes of `fire_at`.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk, identity |
| `recipient_email` | text | not null — the authoring admin's login email (also the bell recipient) |
| `message` | text | not null, max 500 chars (validated in `reminder_create`) |
| `fire_date` / `fire_time` | date / text | The chosen wall-clock (`HH:MM` 24h) in the chosen zone — kept for display |
| `timezone` | text | IANA zone (validated via `Intl.DateTimeFormat`) |
| `fire_at` | timestamptz | The resolved absolute instant — computed in Deno by `utils/timezone.ts zonedTimeToUtc` (two-pass Intl offset technique, DST-safe); must be in the future at create time |
| `fired_at` | timestamptz | null = upcoming (cancellable); stamped ONLY after a successful bell insert so transient failures retry |
| `created_at` | timestamptz | default `now()` |

## `notification_rules` *(new 2026-07-03; deny-all RLS)*

One row per notification (and per sweep reminder-email tier), edited in **Admin Portal → Automation → Notification Editor** (`NotificationEditorPanel.jsx`; actions `notification_rules_load` / `notification_rules_save`, ADMIN_ONLY + `TAB_ACTIONS.automation`). Edited over time across 10+ areas. **NEW 2026-07-22 (migration `20260722130000`, +8 rows):** a new **`Tax Planners`** area with SIX planner bells — `TAX_planner_allocated`, `TAX_planner_returns_uploaded`, `TAX_planner_hlm_ready`, `TAX_planner_post_meeting`, `TAX_planner_decision2_ready`, `TAX_planner_impl_decision_ready` — all with `default_recipients '["ALLOCATED_TAX_PLANNER"]'` as a PLACEHOLDER (the real planner email is resolved per-call from the plan's `tax_planner_id` and passed directly by `notifyAllocatedPlanner`, `utils/tax-planner-notify.ts`); PLUS two `Tax`-area sweep tiers for the click-only Tax 4 Continue ladder — `TAX_postreview_continue_reminder_email` (email, delay 2) + `TAX_postreview_continue_stalled` (bell, delay 4). Prior newest: `TAX_returns_received` (area Uploads, FYI bell → Tracy/Tray, added 2026-07-15). **NEWEST 2026-07-23 (migration `20260723120000`, +2 rows):** `TAX_additional_info_received` (area Uploads, FYI bell → Tracy/Tray, sort 12 — fires when a client uploads while a "Request additional information" email is outstanding, any program) + `TAX_planner_additional_info_uploaded` (area Tax Planners, FYI bell → the allocated planner, sort 26 — the SEVENTH planner bell, `default_recipients '["ALLOCATED_TAX_PLANNER"]'` placeholder resolved per-call by `notifyAllocatedPlanner`). **NEWEST 2026-07-23 evening (migration `20260723210000_impl_charged_bells`, +2 rows):** `TAX_planner_impl_charged` (area Tax Planners, FYI bell → the allocated planner, sort 27 — the EIGHTH planner bell, `["ALLOCATED_TAX_PLANNER"]` placeholder resolved per-call by `notifyAllocatedPlanner`) + `TAX_impl_charged_pf` (area Tax, FYI bell → `["ASSIGNED_PF"]`, sort 40) — both fire from `actions/tax/implementation-receipt.ts` once the implementation fee is charged and the receipt completes (`implementation_receipt_status='Sent'`); the PF bell is SKIPPED when the plan has no resolvable assigned-PF email. **NEWEST 2026-07-27 (DML only, no migration — the departed-staffer reroute, gotcha #291):** the four Tax client-decision bells `TAX_impl_client_proceed` / `TAX_impl_client_decline` / `TAX_postreview_client_proceed` / `TAX_postreview_client_refund` had their `default_recipients` retargeted from Tim Gacsy to `["ASSIGNED_PF","TAX_PLANNER"]`; `TAX_tax4_decision_needed` to those plus Tracy; `SPECIALIST_stage4_tax_risk_notes` to Tracy. No live `recipients` override named Tim. Code-side the real recipients are resolved per-call by `taxDecisionRecipients` (`utils/tax-notify.ts`) and passed as `defaultRecipients`, with `dynamic: { ASSIGNED_PF, TAX_PLANNER }` so an Editor token override resolves too.

| Column | Type | Notes |
|---|---|---|
| `key` | text | pk — the ruleKey passed to `notifyByRule` / `getRuleConfig` (e.g. `MAP1_pcadmin_decision_yes`, `TAX_tax3_payment_stalled`) |
| `area` | text | Editor grouping ("MAP 1", "Tax", …, "Uploads", "Payment Failure Alerts") |
| `label` / `description` / `trigger_note` | text | Human-readable what/when |
| `kind` | text | `'bell'` or `'email'` — email rows gate a sweep reminder-email's timing/on-off only; their recipient overrides are ignored (gotcha #177; wording lives in Email Templates) |
| `action_required` | boolean | Display-only badge; the CODE's `dismissible` flag is authoritative |
| `recipients` | jsonb | Override list — emails, `'admin'`, `'all'`, or dynamic tokens `ASSIGNED_PF` / `TEAM_MEMBER` / `ASSIGNED_ADMIN` / `TAX_PLANNER` / `ALLOCATED_TAX_PLANNER` (resolved per event — **note the last two name the same concept but are NOT interchangeable; pass whichever token the rule itself carries**, gotcha #291). **null = use the code default** |
| `default_recipients` | jsonb | The code default, for display + reset |
| `delay_days` / `default_delay_days` | numeric | Sweep tiers only (defaults 2 email / 4 bell / 14 check-uncleared / 7 check-lookahead); null default = instant, not delay-editable |
| `enabled` | boolean | `false` suppresses the notification / skips the sweep tier (BEFORE its idempotency stamp). Deleting a row does NOT disable — gotcha #178 |
| `sort` | integer | Order within the area |

**Frontend:** [NotificationBell.jsx](src/components/NotificationBell.jsx) polls every 30s + listens for `vfo:notifications-changed`. Compact rows (2026-07-03): action-required sorted first with orange left bar + ACTION pill, single-line title, pipeline chip + date meta, full title+message on hover; header shows "N need action"; badge turns orange when anything needs action. **2026-07-22 (gotcha #267):** the row-click handler now marks-read + removes the row locally BEFORE navigating (two bell instances share a click path — portal header + `ClientDetail` header — so navigating first let the destination bell's mount-load resurrect the just-clicked row); dropdown widened 380→480px with wrapping titles; "View all" is hidden for `tax_planner` sessions (it routes to `/admin`).
