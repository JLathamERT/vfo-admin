# Notifications

In-portal notification feed. The bell icon at the top of `AdminPortal` ([NotificationBell.jsx](src/components/NotificationBell.jsx)) reads from this table; every `automation_*` handler that completes a meaningful step inserts a row.

## `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `recipient` | text | not null. Routing key. `actions/notifications/load.ts` filters `recipient = session.email OR 'admin' OR 'all'` — so a value is any login email (member OR admin; e.g. `tnmiller@elitert.com` for Tracy on SPECIALIST notifications, gotcha #60), `'admin'` (all admins), or `'all'`. A recipient email with no matching login row is stored but never shown. **Advisor/accountant onboarding notifications** route here via `constants/onboarding-team.ts` `teamMemberRecipient(onboarding_team_member)` — it maps the chosen Stage-1 team member's display name to that person's `@elitert.com` admin login email so the notification lands in *their* bell; it falls back to `'admin'` (shared bell) when no team member is set or the name has no mapping. |
| `client_id` | integer | fk → `clients.id` (NO ACTION) |
| `pipeline` | text | Pipeline name (e.g., `"map1"`). Drives "go to client detail" deep link. |
| `title` | text | not null |
| `message` | text | |
| `link` | text | Frontend route the bell can navigate to. |
| `read` | boolean | default `false`. Status field. |
| `dismissible` | boolean | default `true`. Controls whether the bell shows a green Done button. FYI notifications (`true`) → admin clicks Done to mark read + remove from bell. Action-required notifications (`false`, e.g., Tax 3 Yes → pricing form, Tax 3 ExtraMeeting → schedule meeting; and — **added 2026-06-15** — the advisor/accountant "Ready to create … — onboarding complete" notice inserted by `automation_ADVISOR_invoicereceipt` / `automation_ACCOUNTANT_invoicereceipt` once payment + invoice are done) have no Done button — they clear only when admin completes the underlying action (e.g., `automation_TAX_pricing` marks all unread TAX notifs for the client as read on submit; the onboarding one clears when the Create Advisor/Accountant step runs). |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `load_notifications`, `mark_notification_read`. Inserted by virtually every `automation_*` handler (every "X happened, tell the admin" point).

**Frontend:** [NotificationBell.jsx](src/components/NotificationBell.jsx) loads on mount. Per-row Done button (dismissible only) marks that single notification read + filters it from the local list. "Mark all read" button at the top marks every unread notification read in parallel. Row click navigates to `link` without marking read — admin clears via Done button or by completing the underlying action.
