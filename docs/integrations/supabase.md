# Supabase integration

Supabase hosts the Postgres database, the two edge functions, and two storage buckets. The frontend talks to the edge function (not directly to the DB). The edge function uses the **service-role key**, which bypasses RLS — so all access control is application-level.

Project: `ejpsprsmhpufwogbmxjv` ("VFO Showroom"), region `us-east-2`, Postgres 17.

## Env vars

| Var | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | edge functions | `https://ejpsprsmhpufwogbmxjv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | edge functions | Service-role JWT — used by both edge functions in `createClient(...)`. Bypasses RLS. |
| (frontend) anon key | hardcoded in [src/lib/api.js:2](src/lib/api.js) | Sent as `Authorization: Bearer <anon>` on every request. Per the live registry, both functions have `verify_jwt: false`, so the gateway does not enforce this. |

The frontend never has access to the service-role key.

## Edge function deployment

| Function | Slug | Live version | `verify_jwt` (registry) | Source |
|---|---|---|---|---|
| Admin / dispatcher | `vfo-admin-api` | v194 | `false` | `C:\vfo-edge-functions\supabase\functions\vfo-admin-api\index.ts` |
| BoldSign webhook | `boldsign-webhook` | v23 | `false` | `C:\vfo-edge-functions\supabase\functions\boldsign-webhook\index.ts` |

Local `config.toml` declares `verify_jwt = true` for both — but the live registry shows `false`. The local declaration is moot. Both functions implement their own auth (see [04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md)).

Function URLs:
- `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api`
- `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/boldsign-webhook`

## Database

51 public-schema tables. Full inventory in [../tables/](../tables/).

### RLS

Migration `enable_rls_all_tables` (2026-04-28) enables RLS on every public-schema table. Migration `add_missing_deny_policies` (2026-04-28) adds explicit deny policies. Effective access:

- **Anon** (frontend's hardcoded key): blocked from all reads/writes (RLS deny).
- **Service role** (edge function): bypasses all RLS — full access.

Therefore: every authorization decision is enforced in the edge-function dispatcher, not the database. See [04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md) for the role gates.

> **Out-of-scope for this map:** running `get_advisors` to verify RLS gaps. Migration names suggest comprehensive coverage but the `add_missing_deny_policies` migration title implies prior gaps existed.

### Migration history (15 migrations as of 2026-05-05)

```
20260427195314  create_ciq_tables
20260428202625  enable_rls_all_tables
20260428202652  lock_down_headshots_storage
20260428202920  hash_passcodes_and_cleanup_sessions
20260428203323  add_missing_deny_policies
20260428213351  auto_cleanup_expired_sessions
20260428222553  add_cascade_deletes_to_foreign_keys
20260429145002  create_member_program_notes
20260430163224  create_specialist_onboarding
20260501135928  add_widget_font_size
20260501140804  change_widget_font_size_to_integer
20260501191728  create_automation_pipeline_tables
20260504192141  create_notifications_table
20260504205804  add_extra_meeting_flag
20260505141059  create_agreement_templates_table
```

Local `supabase/migrations/` directory does **not exist** — migrations live remotely only. Schema changes are presumably authored via Supabase Studio or applied directly.

### Auto-cleanup of expired sessions

Migration `auto_cleanup_expired_sessions` (2026-04-28) presumably installs a periodic cleanup of `admin_sessions` rows past `expires_at`. The migration content was not inspected. The edge function does an *explicit* delete on a single row when it finds it expired during auth ([admin-api:2201](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — this is a runtime fallback regardless of any scheduled job.

## Storage

Two storage buckets used by edge function:

### `headshots`

Per-specialist headshot images. RLS-locked by migration `lock_down_headshots_storage` (2026-04-28).

| Action | Where | Path scheme |
|---|---|---|
| Upload | `upload_headshot` ([admin-api:2387](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) | `<filename>` (no folder structure) |

Public read: yes — the frontend builds URLs like `https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/<filename>` ([MemberPortal.jsx:10](src/pages/MemberPortal.jsx)). The bucket is configured as public despite the "lock_down" migration name; the migration likely restricts only WRITE not READ.

Filename is stored on `experts.headshot_image` as the bare filename (no path). The frontend URL-encodes when building the public URL.

### `member-vault`

Per-member private file storage. Each member's files live under `<plugin_member_number>/<filename>`. Accessed only via signed URLs (1-hour expiry).

| Action | Where | Behavior |
|---|---|---|
| `vault_list` | [admin-api:2615-2633](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | Lists files under `<member_number>/`, generates signed URLs (3600s expiry) for each |
| `vault_upload` | [admin-api:2640-2645](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | Uploads to `<member_number>/<filename>` (upsert) |
| `vault_delete` | [admin-api:2654](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | Deletes `<member_number>/<filename>` |

`config.toml` sets `file_size_limit = "50MiB"` for storage globally.

## CORS

The admin-api maintains a hardcoded allowlist:

```
ALLOWED_ORIGINS = [
  "https://jlathamert.github.io",
  "http://localhost:5173",
  "http://localhost:5174",
]
```

Set on every response. Adding a new frontend host (e.g., a custom domain) requires editing the function and redeploying.

## Migration practices

- The local `vfo-edge-functions` repo has no `supabase/migrations/` directory — migrations are authored remotely.
- The `vfo-react` repo has no migrations of its own.
- New schema changes must be tracked via the remote migration registry (visible via the MCP `list_migrations` call).

## Frontend storage usage (browser)

The frontend uses **`sessionStorage` only**, never `localStorage`. Keys:

| Key | Set by | Cleared by |
|---|---|---|
| `vfo_session` | login pages | `clearSession()` (sign-out, 401) |
| `adminActiveTab`, `adminMembersSection`, `adminSpecialistsSection`, `adminAutomationSection`, `adminSelectedMember`, `adminMemberFeatureTab` | AdminPortal | login pages reset some; `sessionStorage.clear()` on ClientDetail signout |
| `memberActiveTab` | MemberPortal | MemberLogin resets |

`sessionStorage` clears on tab close. There is no "remember me" — every tab close = login again.

## Frontend `Authorization` header

Set on `callApi` requests as `Bearer <hardcoded anon key>` — see [04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md). Public-token pages (`/decide`, `/pay`) omit the header entirely; the function accepts the unauthenticated POST because `verify_jwt: false`.

## Cross-references

- Auth model: [../architecture/04-auth-and-sessions.md](../architecture/04-auth-and-sessions.md)
- Edge functions: [../architecture/03-edge-functions.md](../architecture/03-edge-functions.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
- Tables index: [../tables/README.md](../tables/README.md)
