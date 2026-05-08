# Google Sheets integration

Used by exactly one action — `automation_CONTRACT_revshare` ([admin-api:1248](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)). The handler reads from two Google Sheets to verify Tracy's manual reconciliation before paying out a member's revenue share via Stripe Transfer.

## Env vars

Reuses the Gmail OAuth grant — same `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN`. The same access token from `oauth2.googleapis.com/token` is presented as `Authorization: Bearer <token>` to Sheets API.

## Sheets read

### 1. Revenue Master (`MASTER_SHEET_ID`)

Hardcoded ID: `1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0` ([admin-api:1324](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

Endpoint:
```
GET https://sheets.googleapis.com/v4/spreadsheets/<MASTER_SHEET_ID>?includeGridData=true&ranges=Home%20Page!A1:I200
```

Tab name: `"Home Page"`. Range: `A1:I200`.

Schema (inferred from code):

| Column | Used as |
|---|---|
| A | `client_ref` (e.g., `VFO-XYZ-001`) — match key |
| I | A **hyperlink cell** pointing to the per-client / per-batch sheet |

The handler scans rows for one whose `formattedValue` in column A matches `pipeline_map1.client_ref`, then extracts the `hyperlink` field from the column-I cell and parses out the spreadsheet ID with regex `/spreadsheets\/d\/([a-zA-Z0-9-_]+)/` ([line 1341](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

If no match: handler returns `{pending: true, reason: "Client ref not found in Revenue Master"}` and does not fail. Pipeline stays `"Pending"` — Tracy is expected to add the row later.

### 2. Per-batch sheet (resolved dynamically)

The hyperlink in Master col I points to a per-batch Google Sheet (one sheet per batch of clients). Once resolved:

**Endpoint 2a — list tabs:**
```
GET https://sheets.googleapis.com/v4/spreadsheets/<batchSheetId>
```
The handler scans `batchMeta.sheets` for a tab whose title matches:
- contains `client_ref`
- contains a 4-digit number (regex `/\d{4}/`)
- does NOT contain `"account"` (case-insensitive)

If no match: returns `{pending: true, reason: "No matching tab in batch sheet"}`.

**Endpoint 2b — read input data:**
```
GET https://sheets.googleapis.com/v4/spreadsheets/<batchSheetId>/values/<tabName>!G7:O200
```

Schema (inferred from code at [lines 1390-1414](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)):

| Sheet col | Index in array | Used as |
|---|---|---|
| G | 0 | Row label (e.g., `"Member Contribution"`) |
| H | 1 | (read but unused in observed code) |
| I | 2 | Receipt number — match against `pipeline_map1.rec{N}_number` |
| J | 3 | Expected payment amount (must match `expectedPayment` within $0.01) |
| K | 4 | Split component 1 |
| L | 5 | Split component 2 |
| M | 6 | Split component 3 |
| N | 7 | Split component 4 |
| O | 8 | Split component 5 |

**Verification rule:** the receipt row is "verified" when `colI == receiptNumber && abs(colJ - expectedPayment) < 0.01 && abs(colK+L+M+N+O - colJ) < 0.01`. If no row passes verification, returns `{pending: true, reason: "Tracy's numbers not yet verified"}`.

**Member contribution row:** the handler also scans for any row where col G is exactly `"Member Contribution"` and reads its col J as `memberContributionAmount`. This is used (on payment 1 only) to deduct from the member's revenue share before paying out.

## Auth

`Authorization: Bearer <access_token>` from `https://oauth2.googleapis.com/token` refresh. Read-only — no Sheets writes are observed in the codebase.

## Failure modes (observed)

The handler has many `pending: true` early-exit paths but no auto-retry. Once Tracy fixes the sheet, the action must be re-invoked manually (the trigger mechanism is itself unknown — see [orchestration-files.md](../architecture/06-orchestration-files.md)).

## Frontend touch-points

None.

## Hardcoded values

| Value | Where |
|---|---|
| `MASTER_SHEET_ID = "1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0"` | [admin-api:1324](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) |
| `"Home Page"` tab + range `A1:I200` | line 1326 |
| Per-batch range `G7:O200` | line 1373 |
| Tab-name match: `\d{4}` and not containing `"account"` | line 1364 |

## Open questions

- The `Home Page` sheet schema is observable only through the handler's column references. There may be other columns (B-H) used elsewhere that this code doesn't read.
- The 4-digit-number tab-name pattern suggests batch sheets are organized by year/month — but this is inference, not confirmed.
- No code in the repo writes to either sheet. Tracy's reconciliation is purely external.

## Cross-references

- `_revshare` action: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
- Pipeline rev-share fields: [../tables/pipeline.md](../tables/pipeline.md)
