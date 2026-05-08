# Google Drive integration

Used by exactly one action — `automation_CONTRACT_invoicereceipt` ([admin-api:1812](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). Generated invoice and receipt PDFs are uploaded to a per-client folder under a configured parent folder, and the Drive file IDs are written back to `pipeline_map1.invoice_drive_id` / `pipeline_map1.recN_drive_id`.

## Env vars

| Var | Purpose |
|---|---|
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | Same OAuth grant as Gmail — single refresh token covers Drive scope |
| `GOOGLE_DRIVE_FOLDER_ID` | Parent folder ID under which per-client folders are created |

## API endpoints used

| Drive API | Method | When | Where (admin-api) |
|---|---|---|---|
| `https://www.googleapis.com/drive/v3/files?q=...&fields=files(id)` | GET | Find existing client folder | line 1972 |
| `https://www.googleapis.com/drive/v3/files` | POST | Create per-client folder if missing | line 1980 |
| `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id` | POST | Upload PDF | line 1997 |
| `https://www.googleapis.com/drive/v3/files/<id>?alt=media` | GET | Download PDF for Gmail attachment | line 2108 |

Auth header: `Authorization: Bearer <access_token>` from `oauth2.googleapis.com/token`.

## Per-client folder lookup

[Lines 1971-1987](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts):

```
folderName = "<first_name> <last_name> - <client_ref>"
```

The handler:
1. Searches Drive for a folder with that exact name in `GOOGLE_DRIVE_FOLDER_ID` parent.
2. If found, uses its ID.
3. If not, creates a new folder with `mimeType: 'application/vnd.google-apps.folder'` and parent set to `GOOGLE_DRIVE_FOLDER_ID`.

> **Concurrency note:** if two `_invoicereceipt` calls run in parallel for the same client, both could pass the "not found" check and create duplicate folders. Not currently observed but theoretically possible.

> **Inconsistency:** if the client's name later changes (`first_name` / `last_name` updated), a subsequent run will look for a folder with the *new* name and create a new one, leaving prior PDFs orphaned in the old folder. The `client_ref` part of the name does not change, but it's not the lookup discriminator.

## Upload format

Each PDF is uploaded as a multipart `multipart/related` request with two parts:
1. JSON metadata: `{ name, parents: [clientFolderId] }`
2. The PDF bytes with `Content-Type: application/pdf`

PDF filenames:
- Invoice: `<invoiceNumber>.pdf` (e.g., `INV-VFO-XYZ-001-0042.pdf`)
- Receipt: `<receiptNumber>.pdf` (e.g., `REC-VFO-XYZ-001-0103.pdf`)

The Drive file ID returned in the response is written back to:
- `pipeline_map1.invoice_drive_id` (only on payment 1)
- `pipeline_map1.rec{N}_drive_id` (every payment)

## Re-download for email attachments

After upload, the handler immediately re-downloads each PDF (lines 2107-2119) to base64-encode it for inclusion in the Gmail multipart MIME body. Drive is acting as both a permanent store **and** an intermediate buffer for the Gmail attachment — the bytes traverse the network three times (PDF generator → Drive → Drive → Gmail).

## Permissions

Whoever holds the OAuth grant has full read/write access to:
- `GOOGLE_DRIVE_FOLDER_ID` and everything under it
- Plus any other folders the OAuth scope grants — likely the entire Drive of the OAuth account, depending on the granted scope. **Scope is not declarable from the codebase** — the OAuth client setup is external. Flagged.

## Sandbox behavior

`automation_CONTRACT_invoicereceipt` does NOT branch on sandbox mode for Drive uploads. Sandbox PDFs go to the same parent folder as live PDFs. The only sandbox-aware piece is the email recipient list. Worth noting that sandbox testing pollutes the production Drive folder.

## Frontend touch-points

None. The Drive file IDs (`invoice_drive_id`, `rec{N}_drive_id`) are stored in `pipeline_map1` but not surfaced in the frontend — `AutomationPanel` does not link to them, and no UI displays a "Download Invoice" button.

## Cross-references

- Pipeline columns: [../tables/pipeline.md](../tables/pipeline.md)
- `_invoicereceipt` action: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
- Gmail attachment construction: [gmail.md](gmail.md)
