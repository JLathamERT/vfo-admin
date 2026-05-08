# Notifications

In-portal notification feed. The bell icon at the top of `AdminPortal` ([NotificationBell.jsx](src/components/NotificationBell.jsx)) reads from this table; every `automation_*` handler that completes a meaningful step inserts a row.

## `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `recipient` | text | not null. Routing key — typically a member email or `'admin'`. |
| `client_id` | integer | fk → `clients.id` (NO ACTION) |
| `pipeline` | text | Pipeline name (e.g., `"map1"`). Drives "go to client detail" deep link. |
| `title` | text | not null |
| `message` | text | |
| `link` | text | Frontend route the bell can navigate to. |
| `read` | boolean | default `false`. Status field. |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `load_notifications`, `mark_notification_read`. Inserted by virtually every `automation_*` handler (every "X happened, tell the admin" point).

**Frontend:** [NotificationBell.jsx:28-41](src/components/NotificationBell.jsx) loads on mount and on Mark All Read marks every unread notification as read with one round-trip per notification (parallelized via `Promise.all`).
