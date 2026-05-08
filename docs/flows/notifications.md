# Notifications flow

The portal's bell-icon notification feed. A small, simple flow: handlers insert rows; the bell polls and displays; click marks read; admin actions clear them in bulk.

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

The only handler in the codebase that inserts notifications is `automation_PCADMIN_finaldecision` ([admin-api:705-738](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Two cases:

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

No other handler inserts notifications. Status changes elsewhere in the system (CIQ, MSM, contracts) do **not** generate notifications.

## Step 3 — Mark read (single)

**Handler:** `mark_notification_read({notification_id})` ([NotificationBell.jsx:41](src/components/NotificationBell.jsx) → [admin-api:4569-4578](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). UPDATEs `notifications.read=true` for one id.

## Step 4 — Bulk clear (per-client, by handlers)

Two handlers clear all unread notifications for a `client_id` after the admin completes a follow-up:

| Handler | Where | Effect |
|---|---|---|
| `automation_PCADMIN_pricing` | [admin-api:4398-4402](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `UPDATE notifications SET read=true WHERE client_id=<id> AND read=false` |
| `automation_PCADMIN_extrameeting` | [admin-api:4559-4563](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | same |

This avoids leaving the "client chose Yes" notification in the bell after the admin actually completes the pricing form.

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
