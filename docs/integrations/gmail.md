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

### Shared draft helper + RFC 2047 subject encoding (`utils/gmail-draft.ts`)

The newer handlers (Specialist Onboarding chain, the Phase D card-update email, the New Model Sale team email) build drafts via the shared [`utils/gmail-draft.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/gmail-draft.ts) helpers — `getGmailAccessToken()` (the token-refresh pattern above) + `draftGmail({to, subject, htmlBody, cc, bcc, attachments})` (builds the RFC 2822 raw message, single-part or multipart-with-PDF, and POSTs `drafts.create`).

`draftGmail` runs the **subject** through an **RFC 2047 encoded-word** helper, `encodeHeaderWord()` ([gmail-draft.ts:21-25](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/gmail-draft.ts)):

```ts
function encodeHeaderWord(s: string): string {
  if (/^[\x00-\x7F]*$/.test(s)) return s;            // pure-ASCII → unchanged
  const b64 = btoa(unescape(encodeURIComponent(s))); // UTF-8 bytes → base64
  return `=?UTF-8?B?${b64}?=`;                        // RFC 2047 encoded-word
}
```

Email headers are ASCII-only, so a non-ASCII subject (e.g. an em dash "—") would otherwise arrive as mojibake (`â€"`) in the client. ASCII subjects pass through byte-identical; only non-ASCII ones get wrapped. **Only the subject is encoded** — the HTML *body* already declares `Content-Type: text/html; charset=UTF-8` and carries UTF-8 directly. The older inline single-part pattern above does **not** apply this (it predates the helper); subjects there are assumed ASCII.

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
ccEmails  = isSandbox ? [] : dedupeEmails([<member email, PF email, ...extra_cc>, ...tplCc])
bccEmails = dedupeEmails(tplBcc)   // from the template's bcc_list; [] in sandbox
```

In sandbox mode, ALL emails go to a single `pipeline_sandbox_config.sandbox_email` with no CC/BCC.

**Recipients are template-driven too (2026-07-03).** `email_templates.to_list` / `cc_list` / `bcc_list` hold a mix of raw emails and UPPERCASE role tokens (`CLIENT`, `MEMBER`, `ASSIGNED_PF`, `SPECIALIST`, `ADVISOR`, `ACCOUNTANT`, `TAX_PLANNER` (added 2026-07-22 — the plan's allocated tax planner, resolved from `tax_planner_id` via `taxPlannerEmail`; chip label "Tax Planner" via `ROLE_LABELS`; a tax handler MUST pass `TAX_PLANNER` in its `resolveTemplateRecipients` ctx or the chip silently no-ops — gotcha #266; sandbox suppresses all Cc so it is only observable live), `TEAM_MEMBER`, `TEAM` = every `allowed_admins` row, `RECIPIENT` = the handler's built-in target), edited as chips in the Email Templates tab. Every templated handler resolves them per-send via `utils/email-recipients.ts resolveTemplateRecipients(supabase, tmpl, ctx, isSandbox, sandboxEmail)` — the handler supplies `ctx` (which email each token means for THIS send); tokens with no ctx value are skipped; an empty resolved To falls back to `ctx.RECIPIENT`, so an email can never go unaddressed; sandbox still reroutes everything to the sandbox address with no Cc/Bcc. The old hardcoded counterparty Cc arrays (member/PF/tracy@vfo-services.com) were REMOVED from handlers — that routing now lives in the seeded template config (migration `email_templates_recipient_seeds`). Per-client `extra_cc` is still appended in the handlers that had it. The legacy `templateRecipients()` remains only for unwired hardcoded emails.

**Draft vs Send is template-driven (2026-07-03).** Every templated email is created as a Gmail **draft first**, then — only if that template's `email_templates.send_mode` is `true` (the Draft/Send toggle in the Email Templates tab) — immediately dispatched via Gmail `drafts.send` by [`utils/email-delivery.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/email-delivery.ts). Inline-MIME handlers call `gmailDraftFetch(supabase, accessToken, encodedRaw, pipeline, templateName)` (fetch-compatible: returns a `Response` carrying the draft-create status/body); `draftGmail()` callers pass `sendMode: { supabase, pipeline, templateName }`. A failed `drafts.send` leaves the draft in Drafts (nothing is lost); a missing template row = draft-only. `send_mode` defaults to `false` everywhere, so behavior is unchanged until a toggle is flipped. Sandbox rerouting happens upstream of delivery, so send mode is safe to test in sandbox. New emails MUST route through this layer — see gotcha #181.

**Internal CC/BCC is template-driven (Email Templates Phase 2, 2026-06-01).** Across all 5 pipelines, every send-handler sources its internal CC/BCC from `email_templates.cc_list` / `bcc_list` (jsonb) via `utils/email-recipients.ts` — `templateRecipients(tmpl, isSandbox)` (returns `{cc:[],bcc:[]}` in sandbox) + `dedupeEmails()` (trims/dedupes, **drops non-email junk** — kills the `extra_cc="[]"` "Invalid Cc header" bug). The **counterparty** CC (member/PF, plus `tracy@vfo-services.com` hardcoded on MAP 1 + Tax invoice/receipt) stays in the handler; the template's `cc_list` is **additive**. The internal `aanderson@elitert.com` + `platham@elitert.com` BCC, previously hardcoded per handler, now comes entirely from each template's `bcc_list` (28 templates seed it; all other bcc_lists + every cc_list are `[]`). The `ceoEmail = "aanderson@elitert.com"` in `*/ceo-countersign.ts` + `*/send-agreement.ts` is a BoldSign **signer** address, unrelated. Templates are editable from the admin Email Templates tab; a handler's `.select()` must include `cc_list, bcc_list` or the BCC silently drops. The `automation_CONTRACT_sendagreement` flow still appends `pipeline_map1.extra_cc` (comma-separated, from the PIPDecisionForm). The inline member-confirmation emails in `*/revshare.ts` keep their hardcoded BCC (no `email_templates` row). See GOTCHAS.md gotcha #53.

### Internal "New Model Sale" team email (2026-06-15)

One automation email breaks the counterparty-CC pattern: when an advisor/accountant is created (the final onboarding step), [`utils/new-model-sale-email.ts`](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/utils/new-model-sale-email.ts) `sendNewModelSaleEmail()` drafts an **internal** notification sourced from the `TEAM` / `new_model_sale` template. Routing differs from every other email:

- **To** = the template's `to_list` (jsonb) column — a configurable list of internal addresses, editable from the Email Templates tab. Drafts go directly **TO each** address; **no Cc, no Bcc**.
- In **sandbox** (the onboarding pipeline's `pipeline_sandbox_config`) it drafts to the sandbox address only (falling back to `jlatham@elitert.com`), so test runs never email the real team.
- **Send-once:** atomically claims `<table>.new_model_sale_email_sent_at` before drafting (idempotent create-member retry can't double-draft); the stamp is rolled back if the draft fails. Never throws — a failure here must not block member creation.
- Builds via `draftGmail` / `getGmailAccessToken` (same `utils/gmail-draft.ts` helpers as other handlers); placeholders include `[MEMBER_NAME]`, `[MEMBER_FIRST_NAME]`, `[MEMBER_NUMBER]`, `[MEMBER_EMAIL]`, `[AGREEMENT_NAME]`, `[SELECTED_PLANS]`, `[PAYMENT_PLAN]`, `[INVOICE_NUMBER]`, `[TRANSITION_DATE]`, `[MSM_NAME]` (first name of the MSM pick), `[CLOSER]`, `[SETTER]`, `[INTRODUCED_BY]`, `[MEMBER_INTRODUCTION]`, conditional `[COMPANY_BULLET]` / `[WEBSITE_BULLET]` (rendered only when the optional Company/Website fields were filled), and `[SKOOL_BULLET]` — the Skool-invitation line, **built in code and differing by pipeline** (accountant → "FAC and the VFO Community"; advisor → "the Catalyst Community"). `[AGREEMENT_NAME]` for accountants is partnership-branched **(Direct)** / **(Advisor)**. Because the Skool line and MSM/member-first-name substitutions live in `new-model-sale-email.ts`, the `TEAM/new_model_sale` template body carries a bare `[SKOOL_BULLET]` placeholder — a draft rendered by a backend build that predates these substitutions would show the literal token.

## Email-template substitution

All automation emails use HTML templates from the [`email_templates`](../tables/documents.md) table, keyed on `(pipeline, template_name)`. Templates known to exist:

| `template_name` | Used by |
|---|---|
| `PIP1_reconfirmation\|Yes` / `\|No` | `automation_PIP1_reconfirmationemail`, `automation_PCADMIN_extrameeting` (No) |
| `PCADMIN_followup\|Undecided` / `\|No` | `automation_PIPFU_decision` |
| `CONTRACT_agreementsent\|Yes` | `automation_CONTRACT_sendagreement` |
| `CONTRACT_ceocountersign\|Yes` | `automation_CONTRACT_ceocountersign` |
| `CONTRACT_paymentemail\|Yes` | `automation_CONTRACT_paymentemail` |
| `CONTRACT_confirmationemail\|card` / `\|ach` / `\|check` | `automation_CONTRACT_confirmationemail`. **The `\|card` variant is no longer sent automatically** (2026-07-26): a card payment 1 is receipt-only, so only `\|ach` and `\|check` are drafted by the automation. The row is kept for reference + manual resend. The same rule retires the automatic use of `TAX_confirmationemail\|card`, `ADVISOR_payment_confirmation\|card`, `ACCOUNTANT_payment_confirmation\|card`, `SPECIALIST_bg_confirmation\|card`, `SPECIALIST_lic_confirmation\|card` and `MEMBERSHIP_confirmation\|card`; `PIP_confirmation` and `SPECREV_payment_confirmation` are single-variant templates that are now ACH-only. See [stripe.md](stripe.md#purchase-email-policy--system-wide-2026-07-26-v663). |
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
