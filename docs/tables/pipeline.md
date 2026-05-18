# Pipeline tables

The automation core. `pipelines` is a registry of available pipeline tables; `pipeline_map1` is currently the only one (MAP 1 = "Member Advisor Program — Pipeline 1"). Every column starting with `c##_` represents a step in the workflow; the row's column values *are* the state machine.

## `pipelines`

Registry of pipeline kinds. The frontend [AutomationPanel.jsx:290](src/components/admin/AutomationPanel.jsx) uses `automation_load_pipelines` to enumerate, then `automation_load_pipeline_data` to read rows from the `table_name` column dynamically.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `name` | text | not null. Display name (e.g., `"MAP 1"`). |
| `description` | text | |
| `table_name` | text | not null. Physical table to query (`pipeline_map1`). |
| `active` | boolean | default `true` |
| `created_at` | timestamptz | default `now()` |

**Current rows:** 1 — `(1, "MAP 1", "Member Advisor Program - Pipeline 1", "pipeline_map1", true)`.

**Touched by:** `automation_load_pipelines`, `automation_load_pipeline_data`.

---

## `pipeline_map1`

The single most important automation table. One row per client journey through MAP1. ~80 columns. Column families:

### Identity / routing
| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `client_id` | integer | fk → `clients.id` (NO ACTION). |
| `client_ref` | text | Human-friendly ref (e.g., `"VFO-ABC-123"`). Mirrored from `clients.client_ref`. |
| `pf` | text | Assigned PF (Planning Facilitator). Used in step routing. |
| `tax_planner` | text | Optional tax planner assignment. |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |
| `sandbox` | boolean | default `false`. When `true`, automations route via sandbox keys (see `pipeline_sandbox_config`). |

### Stage C8 — Initial PCADMIN decision
| Column | Type | Status / Automation |
|---|---|---|
| `c81_decision` | text | Status field. Values include `"go"`, `"reschedule"`, `"undecided"`. |
| `c81_email_sent` | text | default `'No'`. **Automation field** — flipped to `'Yes'` after `automation_PCADMIN_finaldecision` sends email. |
| `followup_meeting_date` | date | |
| `undecided_reason` | text | |

### Stage C13/C14/C15 — PIP follow-up & decision
| Column | Type | Notes |
|---|---|---|
| `c13_decision` | text | Status field. |
| `current_priorities` / `parked_priorities` / `meeting_notes` | text | Free-form |
| `c14_email_sent` | text | default `'No'`. Set by `automation_PIP1_reconfirmationemail`. |
| `c14_followup_sent_date` | date | |
| `c14_followup1_sent` / `c14_followup2_sent` | boolean | default `false`. Likely cron/manual reminder flags. |
| `c15_token` | text | One-time token embedded in the `/decide?token=...` link emailed to client. |
| `c15_final_decision` | text | Status field. Set when client lands on `/decide` and submits via `automation_PCADMIN_finaldecision`. |
| `c15_service_level` | text | One of `Lite` / `Core` / `Max` (chosen on `/decide`). |
| `c15_via_extra_meeting` | boolean | default `false`. Flag set by `automation_PCADMIN_extrameeting`. |

### Pricing block (PCADMIN)
Set by `automation_PCADMIN_pricing` ([PFPricingForm.jsx:19](src/components/admin/map1/PFPricingForm.jsx)).
| Column | Type | Notes |
|---|---|---|
| `lite_membership` / `core_membership` / `max_membership` | text | Pricing snapshot for each tier. |
| `extra_cc` | text | Extra contribution / commission row. |
| `service_level` | text | Final service tier locked in. |
| `pip_meeting_count` | text | Number of PIP meetings included. |
| `gross_fee` | text | |
| `member_contribution` | text | |
| `net_invoice` | text | Client-owed total after member contribution. |
| `member_share` / `vfos_share` | text | Revenue split for downstream `automation_CONTRACT_revshare`. |
| `payment_plan` | text | `"OneTime"` or `"Quarterly"`. |

### Stage C16 / C17 / C18 — BoldSign agreement
| Column | Type | Status / Automation |
|---|---|---|
| `c16_sent` | text | default `'No'`. Set to `'Yes'` after `automation_CONTRACT_sendagreement` succeeds. |
| `boldsign_doc_id` | text | **BoldSign integration field.** ID of the document created by `automation_CONTRACT_sendagreement`. Indexed lookup target for `boldsign-webhook`. |
| `c17_client_signed` | text | Status field. `'Yes'` when client signs (set by webhook or admin-api duplicate handler). |
| `c17_followup_sent_date` | date | |
| `c17_followup1_sent` / `c17_followup2_sent` | boolean | default `false` |
| `c18_ceo_signed` | text | Status field. `'Yes'` when CEO countersigns. |

### Payment block — Stripe
| Column | Type | Status / Automation |
|---|---|---|
| `stripe_customer_id` | text | **Stripe integration field.** Created by `automation_CONTRACT_stripecustomer`. |
| `checkout_token` | text | One-time token used in `/pay?token=...` link. |
| `payment_method_type` | text | `"card"` / `"ach"` / `"check"`. `check` set by `automation_CONTRACT_paidbycheck`; card/ach set by the Stripe webhook handler. |
| `card_processing_fee` | text | Computed when `payment_method_type='card'`. NULL for check/ach. |
| `pay1_followup_sent_date` | date | |
| `pay1_followup1_sent` / `pay1_followup2_sent` | boolean | default `false` (unimplemented — no code writes these). |
| `pay2_reminder_sent` / `pay3_reminder_sent` / `pay4_reminder_sent` | boolean | default `false`. Written `true` by `automation_CONTRACT_checkreminder_sweep` after successful Gmail draft. Only meaningful for check clients. |
| `stripe_bank_token` | text | |
| `bank_token` | text | |
| `acct_last4` | text | Last-4 captured from Stripe PaymentIntent expansion. NULL for check. |
| `pay1_status` … `pay4_status` | text | Status fields. Stripe path: `"succeeded"` / `"processing"` (ACH in-flight) / `"declined"` / `"auth_required"`. Check path: `"check_pending"` (admin clicked Paid via check, waiting for bank to clear) → `"succeeded"` (admin clicked Check cleared P{N}). |
| `pay1_date` … `pay4_date` | date | Set by Stripe webhook for card/ach (today + 91/182/273 for P2-4), or by `automation_CONTRACT_paidbycheck` for check P1 (same +91/182/273 schedule). |

### Stage C24+ — Confirmation & receipts
| Column | Type | Notes |
|---|---|---|
| `confirmation_status` | text | |
| `invoice_number` | text | Sequential — pulled from `document_numbers`. |
| `invoice_drive_id` | text | Google Drive file ID for stored PDF (write target during `automation_CONTRACT_confirmationemail`). |
| `invoice_email_sent` | boolean | default `false` |
| `rec1_number` … `rec4_number` | text | Receipt numbers per payment. |
| `rec1_status` … `rec4_status` | text | Status fields. |
| `rec1_drive_id` … `rec4_drive_id` | text | Google Drive IDs. |
| `rec1_email_sent` … `rec4_email_sent` | boolean | default `false` |
| `member_contrib_status` | text | |
| `c24_email_sent` | boolean | default `false` |

### Revenue share (per receipt)
Written by `automation_CONTRACT_revshare`.
| Column | Type | Notes |
|---|---|---|
| `rec1_rev_share` … `rec4_rev_share` | text | Computed share amount. |
| `rec1_rev_paid` … `rec4_rev_paid` | text | Status field: paid via Stripe Transfers + Sheets writeback. |
| `rec1_rev_email_sent` … `rec4_rev_email_sent` | boolean | default `false` |

**Touched by (admin-api actions, all in `vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts`):**
`automation_PCADMIN_finaldecision`, `automation_PCADMIN_pricing`, `automation_PCADMIN_extrameeting`, `automation_PIP1_reconfirmationemail`, `automation_PIPFU_decision`, `automation_CONTRACT_sendagreement`, `automation_CONTRACT_ceocountersign`, `automation_CONTRACT_stripecustomer`, `automation_CONTRACT_paymentemail`, `automation_CONTRACT_loadpayment`, `automation_CONTRACT_stripecheckout`, `automation_CONTRACT_stripewebhook`, `automation_CONTRACT_confirmationemail`, `automation_CONTRACT_invoicereceipt`, `automation_CONTRACT_revshare`, `automation_load_pipeline_data`, `member_load_pipeline`, `boldsign-webhook`.

**Touched by (frontend):** [AutomationPanel.jsx](src/components/admin/AutomationPanel.jsx), [ClientTrackViewV2.jsx](src/components/admin/map1/ClientTrackViewV2.jsx), [PIPDecisionForm.jsx](src/components/admin/map1/PIPDecisionForm.jsx), [PFPricingForm.jsx](src/components/admin/map1/PFPricingForm.jsx), [PFExtraMeetingForm.jsx](src/components/admin/map1/PFExtraMeetingForm.jsx), [DecidePage.jsx](src/pages/DecidePage.jsx), [PayPage.jsx](src/pages/PayPage.jsx).

---

## `pipeline_sandbox_config`

Per-pipeline sandbox/live toggle. Read at the top of every automation handler to decide whether to use `STRIPE_SECRET_KEY` vs `STRIPE_SECRET_KEY_SANDBOX` and `BOLDSIGN_API_KEY` vs `BOLDSIGN_API_KEY_SANDBOX`.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `pipeline` | text | not null. Pipeline name key (e.g., `"map1"`). |
| `sandbox_mode` | boolean | default `true`. Master toggle. |
| `sandbox_email` | text | Email override — when set, automation emails go here instead of the real client. |
| `stripe_test_mode` | boolean | default `true` |
| `boldsign_test_mode` | boolean | default `true` |
| `created_at` | timestamptz | default `now()` |

**Touched by:** read by every `automation_*` handler. Frontend reads/writes via `automation_load_pipelines` payload.
