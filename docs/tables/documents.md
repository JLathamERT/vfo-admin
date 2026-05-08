# Documents & templates tables

Three small tables, each underpinning one piece of the contract automation.

## `agreement_templates`

BoldSign template configuration per (service_level × payment_plan). Used by `automation_CONTRACT_sendagreement` to pick the right template, build the PDF body, and submit to BoldSign.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `service_level` | text | not null. e.g., `Lite` / `Core` / `Max`. |
| `payment_plan` | text | not null. e.g., `OneTime` / `Quarterly`. |
| `title` | text | not null. Template display name. |
| `html_body` | text | not null. HTML template with placeholder tokens (substituted before PDF render). |
| `boldsign_template_id` | text | not null. **BoldSign integration field.** Template ID in BoldSign — used as `templateId` parameter in `POST /v1/document/send`. |
| `field_map` | jsonb | not null. Maps placeholder keys → BoldSign field IDs. |
| `active` | boolean | default `true` |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `automation_CONTRACT_sendagreement` ([vfo-admin-api/index.ts:4584](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)).

---

## `email_templates`

Editable subject/body for outbound automation emails. Pipeline-scoped.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `pipeline` | text | not null. Pipeline key (e.g., `"map1"`). |
| `template_name` | text | not null. Template key (e.g., `"final_decision"`, `"payment_email"`, `"ceo_countersign"`). |
| `subject` | text | |
| `body` | text | HTML body with placeholder tokens. |
| `active` | boolean | default `true` |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `automation_load_email_templates`, `automation_save_email_template`, plus every `automation_*` handler that sends a Gmail draft (it pulls subject/body from this table). Frontend: [EmailTemplatesPanel.jsx](src/components/admin/EmailTemplatesPanel.jsx).

---

## `document_numbers`

Append-only sequence ledger. Each row reserves a number-of-type for a client, used as the source of truth for `pipeline_map1.invoice_number` and `pipeline_map1.rec1..rec4_number` so that numbers are unique and stable even across retries.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `type` | text | not null. e.g., `'invoice'`, `'receipt'`. |
| `number` | text | not null. The actual number assigned (formatted). |
| `client_id` | integer | not null. (No FK — soft reference to `clients.id`.) |
| `created_at` | timestamptz | default `now()` |

**Touched by:** `automation_CONTRACT_confirmationemail`, `automation_CONTRACT_invoicereceipt`, `automation_CONTRACT_revshare`.
