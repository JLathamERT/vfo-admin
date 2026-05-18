# Gmail integration

A single Google OAuth client (`GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` + `GMAIL_REFRESH_TOKEN`) authorizes access to **Gmail, Google Sheets, and Google Drive** APIs. Every automation that produces an email creates a **Gmail draft** (not a sent message) — a human still has to open the draft and click Send.

## Env vars

| Var | Purpose |
|---|---|
| `GMAIL_CLIENT_ID` | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Long-lived refresh token (offline access). Single token covers Gmail + Sheets + Drive scopes. |

The Gmail account behind the refresh token is **not visible from the codebase** — flagged. Drafts appear in whichever Gmail account holds the OAuth grant. Most automation code routes drafts via `From: VFO Services <aipc@vfo-services.com>` ([admin-api:4916](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) — only the `automation_CONTRACT_sendagreement` action sets the From header; other handlers omit it, defaulting to the OAuth account's primary address).

## Token refresh pattern

Used identically in **9 different handlers** in admin-api. The pattern is:

```ts
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GMAIL_CLIENT_ID!,
    client_secret: GMAIL_CLIENT_SECRET!,
    refresh_token: GMAIL_REFRESH_TOKEN!,
    grant_type: "refresh_token",
  }),
});
const accessToken = (await tokenRes.json()).access_token;
```

> **Inefficiency observation (not a correction):** every handler that sends an email refreshes the token from scratch — there is no caching, even within a single chained automation. A typical contract+payment+receipt flow refreshes the token 5+ times in serial. Tokens are valid for an hour but always discarded.

## API endpoints used

### Gmail

| Endpoint | Method | When | Where (admin-api) |
|---|---|---|---|
| `https://gmail.googleapis.com/gmail/v1/users/me/drafts` | POST | Create a Gmail draft | lines 690, 848, 1039, 1609, 1638, 1788, 2161, 4055, 4303, 4543, 4929 |
| `https://gmail.googleapis.com/gmail/v1/users/me/drafts/r-8771745882155742140?format=full` | GET | **Debug fetch** of a hardcoded draft ID | line 2170 |

> **Dev artifact:** [admin-api line 2170](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) reads back a draft with a hardcoded ID `r-8771745882155742140` immediately after creation, just to log the multipart structure. This appears to be leftover debug code — it always fetches the same (now-stale) draft. Flagged in [03-edge-functions.md](../architecture/03-edge-functions.md).

### Sheets and Drive

See [google-sheets.md](google-sheets.md) and [google-drive.md](google-drive.md). Both use the same access token from the same refresh.

## Draft message construction

All drafts are built as **RFC 2822 raw messages**, base64url-encoded into the `message.raw` field. Two patterns:

### Single-part HTML (most automation emails)

```ts
const headers = [
  `To: ${toEmail}`,
  ccEmails.length ? `Cc: ${ccEmails.join(", ")}` : "",
  bccEmails.length ? `Bcc: ${bccEmails.join(", ")}` : "",
  `Subject: ${emailSubject}`,
  "MIME-Version: 1.0",
  "Content-Type: text/html; charset=UTF-8",
].filter(Boolean).join("\r\n");

const rawEmail = `${headers}\r\n\r\n${emailBody}`;
const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
```

### Multipart with PDF attachments (`automation_CONTRACT_invoicereceipt`)

[Lines 2122-2159](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts):

```
Content-Type: multipart/mixed; boundary="vfo_boundary_<timestamp>"
--<boundary>
Content-Type: text/html; charset=UTF-8
<emailBody>
--<boundary>
Content-Type: application/pdf; name="<invoice>.pdf"
Content-Disposition: attachment; filename="<invoice>.pdf"
Content-Transfer-Encoding: base64
<base64 PDF>
--<boundary>
Content-Type: application/pdf; name="<receipt>.pdf"
Content-Disposition: attachment; filename="<receipt>.pdf"
Content-Transfer-Encoding: base64
<base64 PDF>
--<boundary>--
```

PDFs are fetched from Google Drive (via `?alt=media`) and inlined as base64 in the same multipart message — they're not just Drive links.

## Recipients pattern

Every automation email follows the same routing:

```
toEmail   = isSandbox ? sandboxEmail : <real recipient (typically client.email)>
ccEmails  = isSandbox ? [] : [<member email, PF email>]
bccEmails = isSandbox ? [] : ["aanderson@elitert.com", "platham@elitert.com"]
```

In sandbox mode, ALL emails go to a single `pipeline_sandbox_config.sandbox_email` with no CC/BCC.

The `automation_CONTRACT_sendagreement` flow additionally appends `pipeline_map1.extra_cc` to the CC list (comma-separated string from the PIPDecisionForm).

The `automation_CONTRACT_invoicereceipt` flow CCs `tracy@vfo-services.com` ([admin-api:2104](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) — the only place that hardcoded address is used.

## Email-template substitution

All automation emails use HTML templates from the [`email_templates`](../tables/documents.md) table, keyed on `(pipeline, template_name)`. Templates known to exist:

| `template_name` | Used by |
|---|---|
| `PIP1_reconfirmation\|Yes` / `\|No` | `automation_PIP1_reconfirmationemail`, `automation_PCADMIN_extrameeting` (No) |
| `PCADMIN_followup\|Undecided` / `\|No` | `automation_PIPFU_decision` |
| `CONTRACT_agreementsent\|Yes` | `automation_CONTRACT_sendagreement` |
| `CONTRACT_ceocountersign\|Yes` | `automation_CONTRACT_ceocountersign` |
| `CONTRACT_paymentemail\|Yes` | `automation_CONTRACT_paymentemail` |
| `CONTRACT_confirmationemail\|card` / `\|ach` / `\|check` | `automation_CONTRACT_confirmationemail` |
| `CONTRACT_invoicereceipt_email\|first` / `\|subsequent` | `automation_CONTRACT_invoicereceipt` |
| `CONTRACT_paidbycheck\|check` | `automation_CONTRACT_paidbycheck` (inline Gmail draft when admin clicks "Pay via check"). Body has a `[QUARTERLY_NOTE]` placeholder that the handler substitutes per payment plan (Quarterly: reminder-note sentence; OneTime: empty). |
| `CONTRACT_checkreminder\|check` | `automation_CONTRACT_checkreminder_sweep` (daily 04:00 UTC cron). `[Due Date]` substituted via `utils/format-date.ts::formatLongDate()`. |

The `pipeline` field is `"MAP 1"` for all of the above. No other pipelines exist yet.

The `automation_CONTRACT_revshare` handler does **not** use `email_templates` — it builds its email HTML inline ([admin-api:1580, 1583](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) and similarly inlines the Tracy intro email at [line 1624](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts).

### Standard placeholders

Across templates:
- `[Client Name]`, `[Client First]`, `[Member Name]`, `[PF Name]`, `[Meeting Attendees]`, `[Service Level]`
- `[Payment Amount]`, `[X]`, `[Y]` (e.g. "Payment 1 of 4"), `[Total Fee]`
- `[Receipt Number]`
- `[ENGAGEMENT]`, `[SIGNING_LINK]`, `[PAYMENT_LINK]` (HTML anchor tags substituted in)
- `[PRIORITIES]`, `[PARKED_PRIORITIES]`, `[MEMBERSHIP_OPTIONS]`, `[BUTTONS]` (HTML lists/buttons)
- `[CARD_FEE_TEXT]`, `[PROCESSING_TIME]`, `[CONTRIBUTION_NOTE]`, `[SERVICE_LEVEL_TEXT]`, `[SPECIALIST_INTRO]`, `[TAX_UPLOAD]`, `[UNDECIDED_REASON]`, `[Follow Up Meeting Date]`

A literal HTML signature is appended to most bodies (every handler builds the same `<p style="...">AI-PC<br>Proactive Coordinator</p>` block — search for `signature = '<p` in admin-api). Not stored in templates.

## Drafts vs. sent

Every email is a **draft**, never a sent message. A human (presumably someone with the OAuth account) opens Gmail, reviews the draft, and clicks Send. There is no `users.me/messages/send` call anywhere in the codebase.

## Frontend touch-points

None. The frontend never talks to Gmail.

## Cross-references

- Email templates table: [../tables/documents.md](../tables/documents.md)
- Sandbox config: [../tables/pipeline.md#pipeline_sandbox_config](../tables/pipeline.md)
- Action catalog (lists every handler that sends a draft): [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
