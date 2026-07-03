# Notifications

In-portal notification feed. The bell icon at the top of `AdminPortal` AND the admin variant of `/admin/client/:id` ([NotificationBell.jsx](src/components/NotificationBell.jsx)) reads from `notifications`. **As of 2026-07-03 every insert routes through `utils/notify.ts notifyByRule(supabase, ruleKey, {...})`** — the `notification_rules` row for that key can override recipients, disable the notification, or (sweep tiers) change the delay. Full per-notification audit: [NOTIFICATION_AUDIT.md](../NOTIFICATION_AUDIT.md). Gotchas #176–#180.

## `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `recipient` | text | not null. Routing key. `actions/notifications/load.ts` filters `recipient = session.email OR 'admin' OR 'all'` — so a value is any login email (member OR admin; e.g. `tnmiller@elitert.com` for Tracy on SPECIALIST notifications, gotcha #60), `'admin'` (all admins), or `'all'`. A recipient email with no matching login row is stored but never shown. Recipient resolution (assigned-PF / team-member / assigned-admin lookups, plus any Notification Editor override) happens inside `notifyByRule` before insert. |
| `client_id` | integer | fk → `clients.id` (NO ACTION) |
| `pipeline` | text | Pipeline name (e.g., `"MAP 1"`). Rendered as a chip in the bell row. |
| `title` | text | not null. The bell row shows ONLY the title (single line, ellipsized) — write who+what into it. |
| `message` | text | Shown in the row's hover tooltip (not inline — 2026-07-03 compact restyle). |
| `link` | text | Frontend route the bell navigates to on row click (must be real — gotcha #18). |
| `read` | boolean | default `false`. Status field. |
| `dismissible` | boolean | default `true`. `true` = FYI (green Done button; row click also dismisses). `false` = action-required: NO Done button, sorted to the top with an orange ACTION pill, excluded from "Mark all read", and **`mark_notification_read` refuses it server-side (gotcha #179)** — it clears only when the completing handler (e.g. `automation_TAX_pricing`, `create-member`, reviewer-notes saves, `clearJakeFailure`) writes `read=true` directly. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `load_notifications`, `mark_notification_read` (FYI-only). Inserted ONLY via `notifyByRule` (raw inserts are a regression — gotcha #176).

## `notification_rules` *(new 2026-07-03; deny-all RLS)*

One row per notification (and per sweep reminder-email tier), edited in **Admin Portal → Automation → Notification Editor** (`NotificationEditorPanel.jsx`; actions `notification_rules_load` / `notification_rules_save`, ADMIN_ONLY + `TAB_ACTIONS.automation`). 130 rows across 10 areas.

| Column | Type | Notes |
|---|---|---|
| `key` | text | pk — the ruleKey passed to `notifyByRule` / `getRuleConfig` (e.g. `MAP1_pcadmin_decision_yes`, `TAX_tax3_payment_stalled`) |
| `area` | text | Editor grouping ("MAP 1", "Tax", …, "Uploads", "Payment Failure Alerts") |
| `label` / `description` / `trigger_note` | text | Human-readable what/when |
| `kind` | text | `'bell'` or `'email'` — email rows gate a sweep reminder-email's timing/on-off only; their recipient overrides are ignored (gotcha #177; wording lives in Email Templates) |
| `action_required` | boolean | Display-only badge; the CODE's `dismissible` flag is authoritative |
| `recipients` | jsonb | Override list — emails, `'admin'`, `'all'`, or dynamic tokens `ASSIGNED_PF` / `TEAM_MEMBER` / `ASSIGNED_ADMIN` (resolved per event). **null = use the code default** |
| `default_recipients` | jsonb | The code default, for display + reset |
| `delay_days` / `default_delay_days` | numeric | Sweep tiers only (defaults 2 email / 4 bell / 14 check-uncleared / 7 check-lookahead); null default = instant, not delay-editable |
| `enabled` | boolean | `false` suppresses the notification / skips the sweep tier (BEFORE its idempotency stamp). Deleting a row does NOT disable — gotcha #178 |
| `sort` | integer | Order within the area |

**Frontend:** [NotificationBell.jsx](src/components/NotificationBell.jsx) polls every 30s + listens for `vfo:notifications-changed`. Compact rows (2026-07-03): action-required sorted first with orange left bar + ACTION pill, single-line title, pipeline chip + date meta, full title+message on hover; header shows "N need action"; badge turns orange when anything needs action.
