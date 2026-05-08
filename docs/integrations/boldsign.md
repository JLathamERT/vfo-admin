# BoldSign integration

BoldSign is the e-signature provider for the MAP1 membership agreement. The flow is two-signer ordered: **client first, then CEO (Anton Anderson)**. Embedded signing links (not BoldSign-hosted email links) are used so the client and CEO see the document in iframes within the VFO automation emails.

## Env vars

| Var | Purpose |
|---|---|
| `BOLDSIGN_API_KEY` | Live API key |
| `BOLDSIGN_API_KEY_SANDBOX` | Sandbox API key. Selected when `pipeline_sandbox_config.sandbox_mode=true` for "MAP 1" |

Sandbox sends to `pipeline_sandbox_config.sandbox_email` instead of the real client/CEO. The CEO email override only applies to BoldSign signer setup; downstream Gmail drafts to the CEO use the same sandbox email.

## API endpoints used

| BoldSign API | When | Where (admin-api) |
|---|---|---|
| `POST /v1/document/send` | Submit a signed agreement | line 4772 (`automation_CONTRACT_sendagreement`) |
| `GET /v1/document/getEmbeddedSignLink?documentId=...&signerEmail=...` | Get an iframe-able sign link for a specific signer | lines 788, 4790 |

Auth header: `X-API-KEY: <BOLDSIGN_API_KEY>`.

## Send-agreement flow ([`automation_CONTRACT_sendagreement`](../architecture/05-api-action-catalog.md))

[Lines 4584-4945](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts):

1. Loads `pipeline_map1` row (must have `gross_fee` set and `c16_sent !== 'Yes'`).
2. Loads `clients`, `client_enrollments` (to derive member), `members`.
3. Loads matching row from [`agreement_templates`](../tables/documents.md): keyed on `(service_level, payment_plan)`. Reads `html_body` (template HTML) + `field_map` (BoldSign form-field positions as JSONB) + `boldsign_template_id` (currently unused — see note).
4. Substitutes `[CLIENT_NAME]`, `[CLIENT_EMAIL]`, `[ANNUAL_FEE]`, `[CONTRIBUTION_NOTE]`, `[QUARTERLY_FEE]`, `[INITIAL_PAYMENT]`, `[NUM_PRIORITIES]`, `[NUM_MEETINGS]`, `[PAYMENT_2_DATE]`, `[PAYMENT_3_DATE]`, `[PAYMENT_4_DATE]` placeholders in the HTML body.
5. Generates a PDF via [html2pdf.app](#) (`HTML2PDF_API_KEY`).
6. Builds a multipart `FormData`:
   ```
   Title:               "<clientName> - VFO Membership Agreement"
   Message:             "Please review and sign your VFO Services Membership Agreement."
   EnableSigningOrder:  true
   DisableEmails:       true       ← BoldSign does NOT email the client; we send our own Gmail draft with the embedded link
   BrandId:             f6b2e092-73a4-438e-b786-ebd20e472732   (hardcoded)
   Signers:             <signer1 JSON>
   Signers:             <signer2 JSON>
   Files:               <PDF blob>
   ```
7. POSTs to `https://api.boldsign.com/v1/document/send` and reads `documentId` from the response.
8. Polls `getEmbeddedSignLink` for the **client signer** up to **5 times with 5-second waits** (lines 4787-4801). The loop is needed because BoldSign needs a moment to provision the embedded link after document creation.
9. Updates `pipeline_map1`: `c16_sent='Yes'`, `boldsign_doc_id=<documentId>`, `c17_client_signed='No'`, `c18_ceo_signed='No'`, `c17_followup_sent_date=<today>`.
10. Loads `email_templates` row `template_name='CONTRACT_agreementsent|Yes'` and creates a Gmail draft to the client with the embedded sign link substituted into `[ENGAGEMENT]`.

> **Important:** `agreement_templates.boldsign_template_id` is **read but not used** in the request. The handler builds form-fields manually from `field_map` instead of referencing the BoldSign-hosted template via `templateId`. The `boldsign_template_id` column may be vestigial. Flagged.

### Signer field structure

Built from `agreement_templates.field_map` JSONB:

**Signer 1 (client):**
- 2 textboxes: addr (page 1), phone (page 1) — positions hardcoded `(103, 255.5, 612, 17)` / `(103, 307.5, 612, 17)`
- 4 initials: `init1` … `init4` — positions from `field_map.init{1..4}`
- 1 signature: `clientSig`
- 1 textbox: `printName`
- 1 dateSigned: `clientDate`

**Signer 2 (CEO):**
- 1 signature: `ceo_sig`
- 1 dateSigned: `ceo_date`

CEO signer is hardcoded to `Anton Anderson` / `aanderson@elitert.com` ([line 4748](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

## Webhook handler

BoldSign-side configuration of the webhook URL is **outside this codebase** — flagged for the user to verify. Two possible URLs are present in the source:

1. **Standalone function**: `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/boldsign-webhook` ([file](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts))
2. **Embedded handler in admin-api**: `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api` (gated by `body.event?.eventType` — [admin-api line 544](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts))

> **Critical divergence:** Only the **standalone function** chains downstream into `automation_CONTRACT_ceocountersign` and `automation_CONTRACT_stripecustomer`. The embedded handler updates the same columns but does **not** chain. If BoldSign's webhook URL is configured to point at the admin-api endpoint instead of the standalone function, the contract → payment chain stalls after the client signs (no CEO countersign email gets created; no Stripe customer gets created). Confirm webhook URL with user during Phase E flow doc.

### Event handling

Both handlers listen for two `event.eventType` values:

| Event | Behavior |
|---|---|
| `Signed` (signer email matches CEO `aanderson@elitert.com`) | Set `c18_ceo_signed='Yes'` |
| `Signed` (any other signer email) | Set `c17_client_signed='Yes'`. Standalone version chains `automation_CONTRACT_ceocountersign`. |
| `Completed` | Set both `c17_client_signed='Yes'` and `c18_ceo_signed='Yes'`. Standalone version chains `automation_CONTRACT_stripecustomer`. |

The standalone function is idempotent on the client-signed path (`c17_client_signed === 'Yes'` → returns 200 OK without re-chaining) ([boldsign-webhook/index.ts:71](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts)).

The standalone webhook is **not** signature-verified — it accepts any POST that has a `event.eventType` and a recognizable `documentId`. BoldSign does support webhook secrets but none is configured.

## CEO countersign flow ([`automation_CONTRACT_ceocountersign`](../architecture/05-api-action-catalog.md))

Triggered by the standalone `boldsign-webhook` after client signs. [Lines 745-858](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts):

1. Validates `pipeline_map1.boldsign_doc_id` exists and `c18_ceo_signed !== 'Yes'`.
2. Polls `getEmbeddedSignLink` for `signerEmail = aanderson@elitert.com` (or sandbox email) up to **3 times with 2-second waits**.
3. Loads `email_templates` row `template_name='CONTRACT_ceocountersign|Yes'`.
4. Substitutes `[Client Name]`, `[Service Level]`, `[Total Fee]`, `[SIGNING_LINK]` placeholders.
5. Creates a Gmail draft to the CEO email with the embedded sign link. The CEO clicks → embedded BoldSign UI opens → CEO signs → BoldSign fires `Signed` (CEO email matches) → `c18_ceo_signed='Yes'` → `Completed` event eventually fires → `automation_CONTRACT_stripecustomer` chains.

## Hardcoded values

| Value | Where |
|---|---|
| `BrandId = "f6b2e092-73a4-438e-b786-ebd20e472732"` | [admin-api:4765](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) |
| CEO signer name `"Anton Anderson"` | [admin-api:4748](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) |
| CEO email `aanderson@elitert.com` | [admin-api:568, 782, 4725](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts), [boldsign-webhook:64](C:/vfo-edge-functions/supabase/functions/boldsign-webhook/index.ts) |
| `EnableSigningOrder: true` | Forces client → CEO order |
| `DisableEmails: true` | BoldSign does not email signers; VFO sends own Gmail drafts |

## Pipeline-table fields driven by BoldSign

- `boldsign_doc_id` — set by `_sendagreement`
- `c16_sent` — set by `_sendagreement` (`'Yes'`)
- `c17_client_signed`, `c18_ceo_signed` — set by webhook
- `c17_followup_sent_date` — set by `_sendagreement`
- `c17_followup1_sent`, `c17_followup2_sent` — referenced as columns but **no observed code writes to these flags**. May be set by an unimplemented reminder cron. Flagged.

## Frontend touch-points

None directly. The frontend never calls BoldSign — the entire integration lives in the edge function. The client interacts with BoldSign via:
- An embedded sign-link iframe served from the Gmail draft (`[ENGAGEMENT]` substituted to a BoldSign URL).
- The BoldSign-hosted iframe page itself.

## Cross-references

- Agreement templates table: [../tables/documents.md](../tables/documents.md)
- Pipeline columns set/read: [../tables/pipeline.md](../tables/pipeline.md)
- Action catalog: [../architecture/05-api-action-catalog.md](../architecture/05-api-action-catalog.md)
