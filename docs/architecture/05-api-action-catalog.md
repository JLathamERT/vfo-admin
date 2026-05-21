# API action catalog (`vfo-admin-api`)

All **162 actions** dispatched by `vfo-admin-api` (MAP1 baseline of 134 + 28 tax handlers — 17 from Phases 1–5c + `automation_TAX_revshare`, `automation_TAX_refund`, `automation_TAX_revshare_sweep` from Phase 6 + `automation_TAX_implementdecision`, `automation_TAX_charge_implementation`, `automation_TAX_implementfinaldecision`, `automation_TAX_implementation_receipt` from Phase 7 + `automation_TAX_postreviewdecision`, `automation_TAX_postreviewclientdecision` from the Tax 4 post-review redesign + `automation_TAX_save_meeting_date` from the Tax 5 meeting-date nudge + `automation_TAX_depositrefund`, `tax_save_deposit_pi` from the Tax Planning alignment session — see [../flows/tax-planning.md](../flows/tax-planning.md)). The post-refactor catalog cites file paths (not line numbers — line numbers shift across handler edits). Action names and behavior are byte-equivalent to v194 except for explicit follow-up changes noted in entries below.

Format: action · `file` · tables read / written · chains / external. Table prefix `pipeline_map1` is shortened to `pmap1` and `pipeline_sandbox_config` to `psbx_cfg` for brevity. All file references are relative to `C:\vfo-edge-functions\supabase\functions\vfo-admin-api\`.

> **Pre-refactor count.** v194 had 130 dispatch references. Phase 6 mechanical removed two: the duplicate `msm_update_client` registration (always unreachable) and the dead `automation_CONTRACT_stripewebhook` handler (doubly unreachable). After that the total was 128. `feature/revshare-automation` added `automation_CONTRACT_revshare_sweep` to PUBLIC_HANDLERS. `fix/webhook-symmetric-secrets` added `save_sandbox_config` to AUTH_HANDLERS. `claude/elegant-bassi-06d14b` added `automation_CONTRACT_chargescheduled_sweep` to PUBLIC_HANDLERS. `feature/map1-check-payment` added `automation_CONTRACT_checkreminder_sweep` to PUBLIC_HANDLERS plus `automation_CONTRACT_paidbycheck` and `automation_CONTRACT_checkcleared` to AUTH_HANDLERS. **Current count is 3 logins + 12 PUBLIC_HANDLERS + 119 AUTH_HANDLERS = 134.**

---

## Webhooks (header / body-shape gated, no `action` field)

| Trigger | File | R | W | Chains |
|---|---|---|---|---|
| Stripe webhook (`stripe-signature` header) — `checkout.session.completed` (GC) | `router/webhooks.ts` | `gc_balances` | `gc_balances`, `gc_transactions` | — |
| Stripe webhook — `checkout.session.completed` (MAP1 first payment) | `router/webhooks.ts` | `pmap1`, `psbx_cfg` | `pmap1` (pay1_status, payment_method_type, acct_last4, card_processing_fee, pay1-4_date, confirmation_status) | `automation_CONTRACT_confirmationemail`, `automation_CONTRACT_invoicereceipt` (card only) · Stripe `GET /v1/payment_intents/{id}` |
| Stripe webhook — `payment_intent.succeeded` | `router/webhooks.ts` | `pmap1`, `client_tax_plans` (fallback if MAP1 miss) | `pmap1` (`payN_status`) OR `client_tax_plans` (`retainer_status='succeeded'` if ACH cleared) | `automation_CONTRACT_invoicereceipt` OR `automation_TAX_invoicereceipt` |
| Stripe webhook — `checkout.session.completed` (Tax retainer, after MAP1 miss) | `router/webhooks.ts` | `client_tax_plans`, `psbx_cfg`(pipeline=`TAX`) | `client_tax_plans` (retainer_status, payment_method_type, acct_last4, card_processing_fee, retainer_date, retainer_payment_intent_id, retainer_confirmation_status='Confirmation Needed') | `automation_TAX_confirmationemail` + `automation_TAX_invoicereceipt` (card only) · Stripe `GET /v1/payment_intents/{id}` |
| BoldSign webhook (embedded — `body.event.eventType`) | `router/webhooks.ts` | `pmap1`, `client_tax_plans` (fallback if MAP1 miss) | `pmap1` (c17/c18) OR `client_tax_plans` (client_signed, ceo_signed) | **Tax branch chains** `automation_TAX_ceocountersign` (on client signed) and `automation_TAX_stripecustomer` (on Completed). MAP1 branch unchanged. |
| BoldSign webhook (standalone — `boldsign-webhook` function, separate URL) | `boldsign-webhook/index.ts` | `pmap1`, `client_tax_plans` (fallback) | same as above | same chain pattern. Live URL per BoldSign dashboard config. **MUST deploy with `--no-verify-jwt`.** |

---

## Auth (no token required)

These three are dispatched inline in `index.ts` BEFORE webhook detection (pre-webhook ordering preserved verbatim from baseline).

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `admin_login` | `actions/auth/admin-login.ts` | `allowed_admins` | `admin_sessions` | — |
| `member_login` | `actions/auth/member-login.ts` | `member_logins`, `member_plugin_settings`, `members` | `admin_sessions` | — |
| `login` (legacy) | `actions/auth/login.ts` | `allowed_admins` | `admin_sessions` | — |

---

## Public-token automation (`PUBLIC_HANDLERS` in `router/dispatch.ts`)

These sit BEFORE the auth gate. Triggered either by user-facing token links (`/decide`, `/pay`) or by server-to-server chain calls authenticated via `SUPABASE_SERVICE_ROLE_KEY`.

| Action | File | R | W | Chains / external |
|---|---|---|---|---|
| `automation_PCADMIN_finaldecision` | `actions/pipeline/pcadmin-final-decision.ts` | `pmap1`(by c15_token), `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1`(c15_final_decision, c15_service_level), `notifications` | Gmail draft (decline email if "No") |
| `automation_CONTRACT_ceocountersign` | `actions/pipeline/contract-ceo-countersign.ts` | `pmap1`, `clients`, `psbx_cfg`, `email_templates` | — | BoldSign `GET /v1/document/getEmbeddedSignLink` (3 retries) · Gmail draft to CEO |
| `automation_CONTRACT_stripecustomer` | `actions/pipeline/contract-stripe-customer.ts` | `pmap1`, `clients`, `psbx_cfg` | `pmap1`(stripe_customer_id, checkout_token) | Stripe `POST /v1/customers` · `automation_CONTRACT_paymentemail` |
| `automation_CONTRACT_paymentemail` | `actions/pipeline/contract-payment-email.ts` | `pmap1`, `clients`, `psbx_cfg`, `email_templates` | — | Gmail draft to client with `/pay?token=...` link |
| `automation_CONTRACT_loadpayment` | `actions/pipeline/contract-load-payment.ts` | `pmap1`(by checkout_token), `clients` | — | — |
| `automation_CONTRACT_stripecheckout` | `actions/pipeline/contract-stripe-checkout.ts` | `pmap1`(by checkout_token), `psbx_cfg` | — | Stripe `POST /v1/checkout/sessions` (returns redirect URL) |
| `automation_CONTRACT_revshare` | `actions/pipeline/contract-revshare.ts` | `pmap1`, `clients`, `members`, `psbx_cfg` | `pmap1`(recN_rev_share/_paid/_email_sent, member_contrib_status, c24_email_sent) | Google Sheets (Master + batch sheet) read · Stripe `POST /v1/transfers` to `members.stripe_account_id` · 1-2 Gmail drafts (member rev-share + Tracy intro email on payment 1). Duplicate guard skips only on resolved state (`rev_paid` in Yes/Money Mapping/N/A) — Failed and Pending re-attempt on next call. Triggered by Stripe webhook chain + daily sweep (see `_revshare_sweep`). |
| `automation_CONTRACT_revshare_sweep` | `actions/pipeline/contract-revshare-sweep.ts` | `pmap1` (scans rec1-4 across all rows) | — (chains, no direct writes) | Chains `automation_CONTRACT_revshare` for every unresolved rec1-4 (NULL / Pending / previously-Failed). Service-role auth required (401 otherwise). Triggered by daily pg_cron job (`supabase/cron/revshare-sweep.sql`, 02:00 UTC). |
| `automation_CONTRACT_chargescheduled_sweep` | `actions/pipeline/contract-chargescheduled-sweep.ts` | `pmap1` (filter: `pay1_status='succeeded'` + `payN_date <= today` for N in 2-4; skips already-succeeded/processing/pending/declined/auth_required), `psbx_cfg`, `clients` (on failure) | `pmap1` (`payN_status` only on failure → `'declined'` / `'auth_required'`), `notifications` (on failure) | Stripe `GET /v1/customers/{cus}/payment_methods` + `POST /v1/payment_intents` (off_session, Idempotency-Key per `{client_id, N, UTC date}`) · Gmail draft to client on failure with a fresh `/pay` link. Service-role auth required (401 otherwise). Triggered by daily pg_cron job (`supabase/cron/chargescheduled-sweep.sql`, 03:00 UTC). On success the DB write + invoicereceipt + revshare chains all happen via the existing `payment_intent.succeeded` webhook branch — this handler does not write success state. Failed states (declined/auth_required) are NOT retried by the sweep; recovery is client-driven via the emailed `/pay` link. |
| `automation_CONTRACT_checkreminder_sweep` | `actions/pipeline/contract-check-reminder-sweep.ts` | `pmap1` (filter: `payment_method_type='check'` + `payment_plan='Quarterly'` + `pay1_status='succeeded'`; for N in 2-4: `payN_date` in [today, today+7] AND `payN_status != 'succeeded'` AND `payN_reminder_sent=false`), `clients`, `psbx_cfg`, `email_templates` (`CONTRACT_checkreminder\|check`) | `pmap1` (`pay{N}_reminder_sent=true` on successful draft only) | Google OAuth token refresh · Gmail draft to client with check mailing address and due date. Service-role auth required (401 otherwise). Triggered by daily pg_cron job (`supabase/cron/check-reminder-sweep.sql`, 04:00 UTC). On Gmail draft failure, reminder_sent stays false so the next day retries. |
| `automation_CONTRACT_confirmationemail` | `actions/pipeline/contract-confirmation-email.ts` | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1`(confirmation_status='Sent') | Gmail draft to client |
| `automation_CONTRACT_invoicereceipt` | `actions/pipeline/contract-invoice-receipt.ts` | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates`, `document_numbers` | `pmap1`(invoice_number, invoice_drive_id, recN_number/_drive_id/_email_sent), `document_numbers` (insert) | html2pdf.app (×2) · Google Drive (find/create folder, upload ×2) · Gmail draft with PDF attachments |
| `automation_TAX_finaldecision` | `actions/tax/final-decision.ts` | `client_tax_plans`(by tax_token), `clients`, `members`, `psbx_cfg`(pipeline=`TAX`), `email_templates` | `client_tax_plans`(tax_final_decision), `notifications` | Gmail draft (decline email if "No"). Triggered from public `/tax-decide` page. |
| `automation_TAX_ceocountersign` | `actions/tax/ceo-countersign.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX), `email_templates` | — | BoldSign `getEmbeddedSignLink` for CEO (3 retries) · Gmail draft to Anton. Triggered from BoldSign webhook (client signed). |
| `automation_TAX_stripecustomer` | `actions/tax/stripe-customer.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX) | `client_tax_plans`(stripe_customer_id, checkout_token) | Stripe `POST /v1/customers` (always new — NOT reused from MAP1) · chains `automation_TAX_paymentemail`. Triggered from BoldSign Completed webhook. |
| `automation_TAX_paymentemail` | `actions/tax/payment-email.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX), `email_templates`(`TAX_paymentemail\|Yes`, filtered `active=true`) | `client_tax_plans.payment_email_sent_at = NOW()` | Gmail draft to client with `/tax-pay?token=<>` link. The `payment_email_sent_at` write is the sweep base for the 48h reminder (`TAX_payment_reminder`) and 96h PF call-the-client notification driven by `automation_TAX_revshare_sweep`. |
| `automation_TAX_loadpayment` | `actions/tax/load-payment.ts` | `client_tax_plans`(by checkout_token), `clients` | — | Public-fetch from `/tax-pay` page. Returns client_name, payment_label, payment_amount. |
| `automation_TAX_stripecheckout` | `actions/tax/stripe-checkout.ts` | `client_tax_plans`(by checkout_token: retainer_status, retainer_amount, implementation_amount, implementation_charge_status, stripe_customer_id), `psbx_cfg`(TAX) | — | Stripe `POST /v1/checkout/sessions`. **Branches by plan state**: (a) `retainer_status` NULL → retainer flow: amount=`retainer_amount`, product "Retainer", `metadata.payment_kind='retainer'`, includes `payment_intent_data[setup_future_usage]=off_session` so the card is saved for later off-session implementation charge. (b) `retainer_status='succeeded'` AND `implementation_charge_status IN (declined, auth_required, manual_required)` → implementation-retry flow: amount=`implementation_amount`, product "Implementation Fee", `metadata.payment_kind='implementation'`, **no** `setup_future_usage`. (c) any other resolved state → `"Payment already completed"` error. Returns Stripe URL. |
| `automation_TAX_confirmationemail` | `actions/tax/confirmation-email.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX), `email_templates` (`TAX_confirmationemail\|<variant>`) | `client_tax_plans`(`retainer_confirmation_status` OR `implementation_confirmation_status` = 'Sent', based on `payment_kind`) | Gmail draft to client. **Accepts `payment_kind` body param** (`'retainer'` default OR `'implementation'`). Retainer kind chooses template variant by `payment_method_type` (`\|card` / `\|ach` / `\|check`); implementation kind uses single `\|implementation` template regardless of method (`[CARD_FEE_TEXT]` and `[PROCESSING_TIME]` substitutions still branch on method). Idempotent on the corresponding `*_confirmation_status='Sent'`. |
| `automation_TAX_invoicereceipt` | `actions/tax/invoice-receipt.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), `email_templates`(`TAX_invoicereceipt_email\|retainer`), `document_numbers` | `client_tax_plans`(retainer_invoice_number, retainer_receipt_number, drive_ids, retainer_invoice_email_sent, retainer_receipt_status), `document_numbers`(insert) | Inline `generateTaxInvoiceHTML()` + `generateTaxReceiptHTML()` (NOT in `utils/html-templates.ts` — kept tax-local). html2pdf.app (×2) · Google Drive (find/create folder, upload ×2) · Gmail draft with PDF attachments. **MIME built with conditional CC/BCC pushes — never empty string in header array.** |

> **Removed in Phase 6 mechanical:** `automation_CONTRACT_stripewebhook` — was a doubly-dead handler (real Stripe events caught by signature header; synthetic-action assignment in index.ts was unreachable from dispatch). The function returns 401/400 for explicit calls; no real caller invokes this action by name.

---

## Authed handlers (`AUTH_HANDLERS` in `router/dispatch.ts`)

All dispatched AFTER `middleware/auth.ts::authenticate()` validates body.token. Some take `auth: AuthContext` as 4th param.

### Bootstrap

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_data` | `actions/data/load-data.ts` | `experts`, `vfo_ecosystem_assignments`, `ciq_assignments`, `member_plugin_settings`, `member_exclusions`, `members`, `pipeline_sandbox_config` (MAP 1 row) | — | Response shape: `{experts, ecosystems, ciq, members, exclusions, sandbox_config}`. |

### Specialists (admin-only mutations)

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `save_specialist` | `actions/specialists/save.ts` | — | `experts`, `vfo_ecosystem_assignments` (delete+insert), `ciq_assignments` (delete+insert). On **insert** (no `editing_id`), also renormalizes `experts.sort_order` for every row to its 1-based alphabetical position by `name`. **Edit** branch does not touch `sort_order`. | — |
| `save_specialist_order` | `actions/specialists/save-order.ts` | — | `experts.sort_order` | — |
| `delete_specialist` | `actions/specialists/delete.ts` | — | `member_exclusions`, `vfo_ecosystem_assignments`, `ciq_assignments`, `experts` (delete chain) | — |
| `upload_headshot` | `actions/specialists/upload-headshot.ts` | — | Supabase storage `headshots` bucket | — |

> **Removed in Phase 6 mechanical:** `delete_specialist` previously also targeted `vfo_assignments` (a non-existent table) — that line was deleted; the silent no-op is gone.

### Members

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `save_member` | `actions/members/save.ts` | — | `member_plugin_settings`, `member_exclusions` (delete+insert) | — |
| `load_exclusions` | `actions/members/load-exclusions.ts` | `member_exclusions` | — | — |
| `add_member` | `actions/members/add.ts` | — | `member_plugin_settings` | — |
| `delete_member` | `actions/members/delete.ts` | — | `member_plugin_settings` (delete; cascades) | — |
| `add_member_full` | `actions/members/add-full.ts` | — | `member_plugin_settings`, `members`, optional `member_logins` | — |
| `member_profile_load` | `actions/members/profile-load.ts` | `members` | — | — |
| `member_profile_save` (uses auth) | `actions/members/profile-save.ts` | `members` (old type for history) | `members`, `member_type_history` (on type change) | — |

### Admins (uses auth)

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_admins` | `actions/admins/load.ts` | `allowed_admins` | — | — |
| `create_admin` | `actions/admins/create.ts` | — | `allowed_admins` (with hashed passcode) | — |
| `delete_admin` | `actions/admins/delete.ts` | — | `allowed_admins` (delete) | — |
| `update_my_passcode` | `actions/admins/update-passcode.ts` | — | `allowed_admins.passcode` (re-hashed) | — |

### Member logins

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_member_login` | `actions/member-logins/load.ts` | `member_logins` | — | — |
| `load_my_login` (uses auth) | `actions/member-logins/load-mine.ts` | `member_logins` | — | — |
| `create_member_login` | `actions/member-logins/create.ts` | — | `member_logins` (hashed) | — |
| `update_member_login` | `actions/member-logins/update.ts` | — | `member_logins` | — |

### Vault (Supabase Storage)

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `vault_list` | `actions/vault/list.ts` | storage `member-vault` (list) | — | — |
| `vault_upload` | `actions/vault/upload.ts` | — | storage `member-vault` (upload) | — |
| `vault_delete` | `actions/vault/delete.ts` | — | storage `member-vault` (delete) | — |

---

### Gift credits (GC marketplace)

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `gc_load_services` | `actions/gc/load-services.ts` | `gc_services` | — | — |
| `gc_load_balance` | `actions/gc/load-balance.ts` | `gc_balances` | — | — |
| `gc_load_transactions` | `actions/gc/load-transactions.ts` | `gc_transactions` | — | — |
| `gc_load_redemptions` | `actions/gc/load-redemptions.ts` | `gc_redemptions`, `gc_services` | — | — |
| `gc_load_all_redemptions` | `actions/gc/load-all-redemptions.ts` | `gc_redemptions`, `gc_services`, `member_plugin_settings` | — | — |
| `gc_redeem` | `actions/gc/redeem.ts` | `gc_balances`, `gc_services` | `gc_redemptions`, `gc_balances`, `gc_transactions` | — |
| `gc_add_credits` | `actions/gc/add-credits.ts` | `gc_balances` | `gc_balances`, `gc_transactions` | — |
| `gc_update_redemption` | `actions/gc/update-redemption.ts` | — | `gc_redemptions.status` | — |
| `gc_manage_service` | `actions/gc/manage-service.ts` | — | `gc_services` (insert/update/delete) | — |
| `gc_create_checkout` (Stripe-helper adopter) | `actions/gc/create-checkout.ts` | — | — | Stripe `POST /v1/checkout/sessions` (metadata: member_number, credits). **Webhook fulfills via `router/webhooks.ts` Stripe handler.** |

---

### MSM (Member Servicing Manager) — programs / clients / tracking

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `msm_load_programs` | `actions/msm/load-programs.ts` | `programs` | — | — |
| `msm_load_enrollments` | `actions/msm/load-enrollments.ts` | `member_enrollments` | — | — |
| `msm_enroll_member` | `actions/msm/enroll-member.ts` | — | `member_enrollments` | — |
| `msm_update_enrollment` | `actions/msm/update-enrollment.ts` | — | `member_enrollments` | — |
| `msm_load_training_track` | `actions/msm/load-training-track.ts` | `program_training_phases`, `program_training_tasks` | — | — |
| `msm_load_training_progress` | `actions/msm/load-training-progress.ts` | `member_training_progress` | — | — |
| `msm_save_training_task` | `actions/msm/save-training-task.ts` | — | `member_training_progress` (upsert) | — |
| `msm_load_meetings` | `actions/msm/load-meetings.ts` | `member_meetings` | — | — |
| `msm_log_meeting` | `actions/msm/log-meeting.ts` | — | `member_meetings` | — |
| `msm_delete_meeting` | `actions/msm/delete-meeting.ts` | — | `member_meetings` (delete) | — |
| `msm_load_clients` | `actions/msm/load-clients.ts` | `clients`, `client_enrollments` | — | — |
| `msm_load_member_clients` | `actions/msm/load-member-clients.ts` | `clients` | — | — |
| `msm_add_client` | `actions/msm/add-client.ts` | — | `clients`, `client_enrollments`, optional `client_contacts` | — |
| `msm_link_existing_client` | `actions/msm/link-existing-client.ts` | — | `client_enrollments` | — |
| `msm_update_client` | `actions/msm/update-client.ts` | — | `clients` | — |
| `msm_load_client_track` | `actions/msm/load-client-track.ts` | `program_client_phases`, `program_client_tasks` | — | — |
| `msm_load_client_progress` | `actions/msm/load-client-progress.ts` | `client_progress` | — | — |
| `msm_save_client_task` | `actions/msm/save-client-task.ts` | — | `client_progress` (upsert) | — |
| `msm_load_client_home` | `actions/msm/load-client-home.ts` | `clients`, `client_contacts`, `member_enrollments`, `programs`, `client_enrollments` | — | — |
| `msm_add_client_contact` | `actions/msm/add-client-contact.ts` | — | `client_contacts` | — |
| `msm_delete_client_contact` | `actions/msm/delete-client-contact.ts` | — | `client_contacts` (delete) | — |
| `msm_load_priority_tracks` | `actions/msm/load-priority-tracks.ts` | `client_priority_tracks` | — | — |
| `msm_load_regular_phases` | `actions/msm/load-regular-phases.ts` | `program_client_phases` | — | — |
| `msm_add_priority_track` | `actions/msm/add-priority-track.ts` | — | `client_priority_tracks` | — |
| `msm_update_priority_status` | `actions/msm/update-priority-status.ts` | — | `client_priority_tracks.status` | — |
| `msm_load_priority_progress` | `actions/msm/load-priority-progress.ts` | `priority_progress` | — | — |
| `msm_save_priority_task` | `actions/msm/save-priority-task.ts` | — | `priority_progress` (upsert) | — |
| `msm_load_client_detail` | `actions/msm/load-client-detail.ts` | `clients`, `member_enrollments`, `programs` | — | — |
| `msm_load_enabled_programs` | `actions/msm/load-enabled-programs.ts` | `member_program_enabled` | — | — |
| `msm_toggle_program` | `actions/msm/toggle-program.ts` | — | `member_program_enabled` (upsert) | — |
| `msm_update_assigned_msm` | `actions/msm/update-assigned-msm.ts` | — | `members.assigned_msm` | — |

> **Removed in Phase 6 mechanical:** the duplicate `msm_update_client` handler (formerly `update-client-dup.ts`) was deleted. The original second `if (action === "msm_update_client")` block at baseline line 2427 was always unreachable because the first dispatch returned. Map dedupe in `router/dispatch.ts` accomplishes the same effect — only one registration of `msm_update_client` (pointing at `update-client.ts`).

---

### Coaching

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `coaching_load_meetings` | `actions/coaching/load-meetings.ts` | `coaching_meetings` | — | — |
| `coaching_log_meeting` | `actions/coaching/log-meeting.ts` | — | `coaching_meetings` | — |
| `coaching_update_meeting` | `actions/coaching/update-meeting.ts` | — | `coaching_meetings` | — |
| `coaching_delete_meeting` | `actions/coaching/delete-meeting.ts` | — | `coaching_meetings` (delete) | — |
| `coaching_load_renewals` | `actions/coaching/load-renewals.ts` | `coaching_renewals` | — | — |
| `coaching_process_renewal` (uses auth) | `actions/coaching/process-renewal.ts` | — | `coaching_renewals` | — |

### Tax

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `tax_load_plans` | `actions/tax/load-plans.ts` | `client_tax_plans` | — | — |
| `tax_start_plan` | `actions/tax/start-plan.ts` | — | `client_tax_plans` (client_id + optional `program_id`) | — |
| `tax_load_progress` | `actions/tax/load-progress.ts` | `client_tax_progress` | — | — |
| `tax_save_task` | `actions/tax/save-task.ts` | — | `client_tax_progress` (upsert) | — |
| `tax_save_deposit_pi` | `actions/tax/save-deposit-pi.ts` | — | `client_tax_plans` (deposit_payment_intent_id), `client_tax_progress` (Deposit Paid status='Completed') | — (Setup phase Deposit Paid task. Extracts last `pi_...` substring defensively against paste-over; also accepts Stripe dashboard URLs containing `/payments/pi_...`) |
| `tax_load_specialists` | `actions/tax/load-specialists.ts` | `client_tax_specialists` | — | — |
| `tax_add_specialist` | `actions/tax/add-specialist.ts` | — | `client_tax_specialists` | — |
| `automation_TAX_depositrefund` | `actions/tax/deposit-refund.ts` | `client_tax_plans` (deposit_payment_intent_id), `clients`, `members`, `psbx_cfg`(TAX) | `client_tax_plans` (deposit_refund_id, deposit_refund_amount, deposit_refund_date, deposit_refund_status, deposit_refund_email_sent), `notifications` | Stripe `GET /v1/payment_intents/<id>` (amount lookup) · Stripe `POST /v1/refunds` (full amount) · Gmail draft confirmation to client. Fires from Setup-phase "Send refund" button, only when Tax Plan Greenlight = Stop AND deposit_payment_intent_id is set. Idempotent on deposit_refund_status='succeeded'. |

### Client notes

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_client_notes` | `actions/client-notes/load.ts` | `client_notes` | — | — |
| `add_client_note` | `actions/client-notes/add.ts` | — | `client_notes` | — |
| `update_client_note` | `actions/client-notes/update.ts` | — | `client_notes` | — |
| `delete_client_note` | `actions/client-notes/delete.ts` | — | `client_notes` (delete) | — |

---

### CIQ

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `ciq_load_list` | `actions/ciq/load-list.ts` | `client_ciqs`, `clients` | — | — |
| `ciq_create` | `actions/ciq/create.ts` | — | `client_ciqs` | — |
| `ciq_add_client_and_create` | `actions/ciq/add-client-and-create.ts` | — | `clients`, optional `client_contacts`, `client_ciqs` | — |
| `ciq_load` | `actions/ciq/load.ts` | `client_ciqs`, `ciq_answers` | — | — |
| `ciq_save` | `actions/ciq/save.ts` | — | `ciq_answers` (upsert) | — |
| `ciq_complete` | `actions/ciq/complete.ts` | — | `client_ciqs.status='completed'`, `client_ciqs.completed_at` | — |
| `load_member_contacts` | `actions/ciq/member-contacts.ts` | `clients`, `client_contacts` | — | — |
| `ciq_load_priorities` | `actions/ciq/load-priorities.ts` | `ciq_priorities` | — | — |
| `ciq_save_priorities` | `actions/ciq/save-priorities.ts` | — | `ciq_priorities` (upsert) | — |
| `ciq_complete_priorities` | `actions/ciq/complete-priorities.ts` | — | `client_ciqs.priorities_completed_at` | — |
| `ciq_save_priority_snapshot` | `actions/ciq/save-priority-snapshot.ts` | — | `ciq_priority_snapshots` | — |
| `ciq_load_priority_snapshots` | `actions/ciq/load-priority-snapshots.ts` | `ciq_priority_snapshots` | — | — |
| `ciq_load_settings` | `actions/ciq/load-settings.ts` | `members.ciq_enabled, ciq_vfos_managed` | — | — |

### Member program notes

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_member_program_notes` | `actions/member-program-notes/load.ts` | `member_program_notes` | — | — |
| `add_member_program_note` | `actions/member-program-notes/add.ts` | — | `member_program_notes` | — |
| `update_member_program_note` | `actions/member-program-notes/update.ts` | — | `member_program_notes` | — |
| `delete_member_program_note` | `actions/member-program-notes/delete.ts` | — | `member_program_notes` (delete) | — |

### Specialist onboarding

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_onboardings` | `actions/onboarding/load-list.ts` | `specialist_onboarding` | — | — |
| `create_onboarding` | `actions/onboarding/create.ts` | — | `specialist_onboarding` | — |
| `load_onboarding` | `actions/onboarding/load.ts` | `specialist_onboarding`, `specialist_onboarding_progress`, `specialist_onboarding_meetings`, `specialist_onboarding_votes` | — | — |
| `save_onboarding_progress` | `actions/onboarding/save-progress.ts` | — | `specialist_onboarding_progress` (upsert) | — |
| `save_onboarding_meeting` | `actions/onboarding/save-meeting.ts` | — | `specialist_onboarding_meetings` | — |
| `save_onboarding_vote` | `actions/onboarding/save-vote.ts` | — | `specialist_onboarding_votes` (upsert) | — |
| `update_onboarding` | `actions/onboarding/update.ts` | — | `specialist_onboarding` | — |

---

### Pipeline / automation (admin-only authed)

These run AFTER the auth gate. The three handlers that take `req: Request` as a 4th param do so to forward `req.headers.get("Authorization")` when chaining to other admin-api actions over HTTP.

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `automation_load_pipelines` | `actions/pipeline/load-pipelines.ts` | `pipelines` | — | — |
| `automation_load_pipeline_data` | `actions/pipeline/load-pipeline-data.ts` | dynamic table from `pipelines.table_name` (whitelisted to `pipeline_map1`), `clients`, `members`, `psbx_cfg` | — | — |
| `automation_PIP1_reconfirmationemail` | `actions/pipeline/pip1-reconfirmation-email.ts` | `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1` (insert new row), `pmap1.c81_email_sent='Yes'` | Gmail draft |
| `automation_PIPFU_decision` (req-using) | `actions/pipeline/pipfu-decision.ts` | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1` (insert if missing, plus c13_decision, current_priorities, parked_priorities, pricing fields, c14_email_sent, c15_token), `pmap1.c14_email_sent='Yes'` | Gmail draft (Undecided/No) · `automation_CONTRACT_sendagreement` (Yes + grossServiceValue, HTTP fetch with forwarded Authorization) |
| `automation_PCADMIN_pricing` (req-using) | `actions/pipeline/pcadmin-pricing.ts` | — | `pmap1` (pricing fields), `notifications.read=true` | `automation_CONTRACT_sendagreement` (HTTP fetch with forwarded Authorization) |
| `automation_PCADMIN_extrameeting` (req-using) | `actions/pipeline/pcadmin-extra-meeting.ts` | `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1` (c15_final_decision, c15_via_extra_meeting=true, pricing fields), `notifications.read=true` | `automation_CONTRACT_sendagreement` (Yes — HTTP fetch with forwarded Authorization) · Gmail draft (No) |
| `automation_CONTRACT_sendagreement` | `actions/pipeline/contract-send-agreement.ts` | `pmap1`, `clients`, `client_enrollments`, `members`, `agreement_templates`, `psbx_cfg`, `email_templates` | `pmap1` (c16_sent='Yes', boldsign_doc_id, c17/c18='No', c17_followup_sent_date) | html2pdf.app · BoldSign `POST /v1/document/send` (multipart with PDF) · BoldSign `GET /v1/document/getEmbeddedSignLink` (5 retries) · Gmail draft to client |
| `automation_TAX_readyfortax3` | `actions/tax/ready-for-tax3.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), `email_templates`(`TAX_readyfortax3\|Yes\|No`) | `client_tax_plans`(ready_for_tax3_decision, ready_for_tax3_email_sent, sandbox) | Gmail draft with `[DECLINE_REASON]` substitution for No. Admin-triggered from Tax 2 "Ready for Tax 3?" task. |
| `automation_TAX_decision` (req-using) | `actions/tax/decision.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), `email_templates`(`TAX_decision_undecided`/`_decline`), Supabase Storage public PDF (Undecided only) | `client_tax_plans`(tax_decision + pricing/risk for Yes, potential_savings/initial_retainer/tax_token for Undecided, tax_decision_email_sent, **tax_decision_email_sent_at on Undecided** — required for the 48h/96h reminder sweep) | Gmail draft (No → decline; Undecided → buttons-email with PDF attachment from Supabase Storage `tax-agreements/tax-planning.pdf`). On Yes → chains `automation_TAX_sendagreement` (HTTP fetch + admin token in body.token). |
| `automation_TAX_sendagreement` | `actions/tax/send-agreement.ts` | `client_tax_plans`, `clients`, `members`, `agreement_templates`(pipeline=`TAX`), `psbx_cfg`(TAX), `email_templates`(`TAX_agreementsent\|Yes`) | `client_tax_plans`(agreement_sent='Yes', boldsign_doc_id, client_signed='No', ceo_signed='No', signed_followup_sent_date) | html2pdf.app · BoldSign `POST /v1/document/send` (multipart, 7-field signer config: addr+phone+clientSig+printName+clientDate for signer1; ceoSig+ceoDate for signer2) · BoldSign `getEmbeddedSignLink` (5 retries) · Gmail draft to client with `[ENGAGEMENT]` substitution. |
| `automation_TAX_pricing` (req-using) | `actions/tax/pricing.ts` | `client_tax_plans` | `client_tax_plans` (pricing fields), `notifications.read=true` | `automation_TAX_sendagreement` (HTTP fetch + admin token in body.token). Triggered when admin completes pricing form after Undecided→Yes path. |
| `automation_TAX_extrameeting` (req-using) | `actions/tax/extra-meeting.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), `email_templates`(`TAX_decision_decline` for No outcome) | `client_tax_plans` (tax_via_extra_meeting=true, pricing fields for Yes outcome, tax_final_decision='No' for No outcome), `notifications.read=true` | `automation_TAX_sendagreement` (Yes outcome — HTTP fetch + admin token) · Gmail draft (No outcome). |
| `automation_TAX_paidbycheck` | `actions/tax/paidbycheck.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX), `email_templates`(`TAX_paidbycheck\|check`) | `client_tax_plans`(payment_method_type='check', retainer_status='check_pending', retainer_date) | Gmail draft with mailing instructions. Admin-only — surfaced via "Pay via check" button in `TaxAutomationPanel` Payment step. |
| `automation_TAX_checkcleared` | `actions/tax/checkcleared.ts` | `client_tax_plans` | `client_tax_plans`(retainer_status='succeeded', retainer_confirmation_status='Confirmation Needed') | `automation_TAX_confirmationemail` + `automation_TAX_invoicereceipt` (service-role chain). Admin-only — "Mark check cleared" button. |
| `automation_load_tax_plans` | `actions/tax/load-automation-list.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX) | — | Admin-only. Returns all tax plans joined with client + member info for `TaxAutomationPanel.jsx`. |
| `automation_TAX_revshare` | `actions/tax/revshare.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), Tracy Revenue Master sheet + client batch sheet (Google Sheets) | `client_tax_plans`(`{retainer\|implementation}_rev_share`, `{retainer\|implementation}_rev_paid`, `{retainer\|implementation}_rev_email_sent`, `member_contrib_status='Applied'` retainer only) | Stripe `POST /v1/transfers` (Connect — to `member.stripe_account_id`) · Gmail draft to member (CC PF, BCC aanderson+platham, sandbox redirects). Takes `tax_plan_id` + `payment_kind` (`'retainer'` \| `'implementation'`) — single handler, column families branch by param. Idempotent on `*_rev_paid` resolved. PUBLIC — admin Tax 4 "Continue - Revenue Share" button fires directly; Phase 6c sweep re-fires with service-role for `pending`/`Failed` rows. |
| `automation_TAX_refund` | `actions/tax/refund.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX), `email_templates`(`TAX_refund_email\|Yes`) | `client_tax_plans`(refund_status, refund_id, refund_amount, refund_date, refund_email_sent, post_review_decision='Stop - Refund') | Stripe `POST /v1/refunds` (payment_intent=retainer_payment_intent_id, amount=retainer_amount BASE only — no card-fee gross-up) · Gmail draft to client (BCC aanderson+platham, sandbox drops). Hard guards: no PI (check payment) → 400; `retainer_rev_paid='Yes'` → 400 leak prevention. Idempotent on refund_status='succeeded'. Admin-only (ADMIN_ONLY_ACTIONS). Admin Tax 4 "Stop - Refund" button fires after confirm() dialog. |
| `automation_TAX_revshare_sweep` | `actions/tax/revshare-sweep.ts` | `client_tax_plans` (filtered by `*_receipt_number IS NOT NULL` AND `*_rev_paid NOT IN ('Yes','Money Mapping','N/A — No Share Due')` for both retainer and implementation kinds; ALSO drives the 48h/96h reminder + PF-notification timers for Tax 3 Undecided, Tax 3 signing, Tax 3 payment, Tax 4 post-review Undecided, and Tax 5 implementation Undecided flows; AND the Tax 4 meeting-date daily nudge to Tim Gacsy when `tax4_meeting_date IS NOT NULL AND post_review_decision IS NULL AND tax4_meeting_date < current_date`) | `client_tax_plans` (`*_reminder_sent_at`, `*_pf_notified_at` per flow; `tax4_meeting_reminder_last_sent_at` for the daily nudge); `notifications` (PF notif at 96h); fires off-session implementation charge at 24h for the Tax 5 Proceed lock-in | Chains `automation_TAX_revshare` per revshare candidate, `automation_TAX_charge_implementation` per Tax 5 24h Proceed lock-in. Drafts reminder emails inline (including the daily Tim-nudge `TAX_meeting_nudge\|Yes` to tgacsy@vfo-services.com CC tnmiller@vfo-services.com; one per UTC day per row, guarded by `last_sent_at < date_trunc('day', now())`). Service-role auth required (401 otherwise). Daily pg_cron job `tax-revshare-sweep-daily` at 02:30 UTC — between MAP1's 02:00 sweep and 03:00 chargescheduled sweep. Returns `{ok, swept, fired, post_review_actions, implementation_actions, tax3_actions, meeting_nudge_actions}`. |
| `automation_TAX_implementdecision` (AUTH, admin-only) | `actions/tax/implement-decision.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), `email_templates`(`TAX_implementdecision\|<decision>`) | `client_tax_plans`(`implementation_decision`, `implementation_token`, `implementation_decision_email_sent` (decision name), `implementation_decision_email_sent_at` — timestamp set on first send) | Drafts client email. Proceed → email with single "Decline implementation" button + 24h grace. Undecided → email with 2 buttons (Proceed/Decline) + 48h. Not Implementing → immediate decline email, no other side effects. Admin-only, fires from Tax 5b "Implementation decision" task buttons. **Charge no longer fires on Proceed pick — sweep auto-fires at 24h if client doesn't decline.** |
| `automation_TAX_charge_implementation` (PUBLIC) | `actions/tax/charge-implementation.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX) | `client_tax_plans`(`implementation_charge_status`, `implementation_payment_intent_id`, `implementation_charge_date`, `checkout_token` regenerated on failure) | Stripe `POST /v1/payment_intents` (off-session, confirm=true, against saved payment method from retainer PI; card grossed up, ACH at base; idempotency key `tax-impl-{plan}-{pi_suffix}-{date}`). On failure → fresh checkout_token, admin notification, Gmail draft to client with `/tax-pay` link. Called from sweep (24h Proceed lock) and from `automation_TAX_implementfinaldecision` (Undecided→Proceed). |
| `automation_TAX_implementfinaldecision` (PUBLIC, token) | `actions/tax/implement-final-decision.ts` | `client_tax_plans` (by `implementation_token`) | `client_tax_plans`(`implementation_final_decision` = 'Proceed' / 'Decline' / 'Auto-Locked'); `notifications` (admin) | Token-based handler called from `/tax-implement-decide?token=X&decision=Proceed\|Decline`. Proceed click → chains `automation_TAX_charge_implementation` via service-role. Decline click → drafts decline email. Inserts admin notification. Legacy Yes/No URL params still accepted (mapped to Proceed/Decline). |
| `automation_TAX_implementation_receipt` (PUBLIC) | `actions/tax/implementation-receipt.ts` | `client_tax_plans`, `clients`, `psbx_cfg`(TAX), `email_templates`(`TAX_invoicereceipt_email\|implementation`), `document_numbers` | `client_tax_plans`(`implementation_receipt_number`, `implementation_receipt_drive_id`, `implementation_receipt_status='Sent'`); `document_numbers` insert | Generates REC-... number, renders implementation receipt HTML via inline template, html2pdf → Drive upload (1 PDF, no invoice), Gmail draft with receipt PDF attached. Single template `TAX_invoicereceipt_email\|implementation` (no per-method variants — uses the existing `TAX_confirmationemail\|implementation` to handle ACH vs card wording). Fired from `payment_intent.succeeded` Stripe webhook when `metadata.payment_kind='implementation'`. |
| `automation_TAX_postreviewdecision` (AUTH, admin-only) | `actions/tax/postreview-decision.ts` | `client_tax_plans`, `clients`, `members`, `psbx_cfg`(TAX), `email_templates`(`TAX_postreview\|Continue\|Undecided`) | `client_tax_plans`(`post_review_decision`, `post_review_decision_token`, `post_review_decision_email_sent_at`) | Tax 4 dropdown handler. Continue - Revenue Share → email with single "Refund my retainer" button + 24h grace. Undecided → email with 2 buttons (Proceed/Refund) + 48h. Stop - Refund → chains `automation_TAX_refund` directly via service-role, no client email. Idempotent on `post_review_decision` set. |
| `automation_TAX_save_meeting_date` (AUTH, admin-only) | `actions/tax/save-meeting-date.ts` | `client_tax_plans` | `client_tax_plans.tax4_meeting_date` (date or NULL); also clears `tax4_meeting_reminder_last_sent_at` when date is cleared | No external calls, no chains. Takes `tax_plan_id` + `meeting_date` (YYYY-MM-DD or null/empty). Fires from the "Date Scheduled for High Level Meeting" task (`status_options='tax_meeting_date'`) at the top of Tax 4 - Tax Plan Review (above `Detailed tax plan presentation`). Once set + `post_review_decision IS NULL`, the daily `tax-revshare-sweep-daily` drafts a Gmail nudge to Tim Gacsy until Tim records the Tax 4 Client decision 1 (Continue / Undecided / Stop) — see `automation_TAX_revshare_sweep` row above. |
| `automation_TAX_postreviewclientdecision` (PUBLIC, token) | `actions/tax/postreview-client-decision.ts` | `client_tax_plans` (by `post_review_decision_token`) | `client_tax_plans.post_review_client_decision` = 'Proceed' / 'Refund' / 'Auto-Locked' (sweep-set); `notifications` (admin) | Token-based handler from `/tax-postreview-decide?token=X&decision=Proceed\|Refund`. Refund → chains `automation_TAX_refund` via service-role (which now accepts service-role bearer OR admin session token — moved from AUTH to PUBLIC with internal auth gate). Proceed → chains `automation_TAX_revshare`. Inserts admin notification either way. Rejects with `window_expired: true` if sweep already locked-in. |
| `save_sandbox_config` (extended) | `actions/pipeline/save-sandbox-config.ts` | — | `pipeline_sandbox_config` (matches `pipeline` param; defaults to `MAP 1` for backward compat). | Admin-only. Extended to accept `pipeline='TAX'` for the tax panel's sandbox toggle. |
| `automation_CONTRACT_paidbycheck` | `actions/pipeline/contract-paidbycheck.ts` | `pmap1` (checkout_token, pay1_status, payment_plan, net_invoice, service_level), `clients`, `psbx_cfg`, `email_templates` (`CONTRACT_paidbycheck\|check`) | `pmap1` (`payment_method_type='check'`, `pay1_status='check_pending'`, `pay1_date=today`; if Quarterly: `pay2/3/4_date = today + 91/182/273 days`) | Inline Gmail draft to client with check mailing address (non-fatal — email failure doesn't roll back DB writes). Admin-only (ADMIN_ONLY_ACTIONS). Triggered by the "Pay via check" button in AutomationPanel when `checkout_token` is set AND `pay1_status` is null. Side-effect: the existing `/pay` route is auto-rejected once `pay1_status` is truthy, so the Stripe path is blocked. |
| `automation_CONTRACT_checkcleared` | `actions/pipeline/contract-checkcleared.ts` | `pmap1` (payment_method_type, pay{N}_status for N in body) | `pmap1` (`pay{N}_status='succeeded'`; for N=1 also `confirmation_status='Confirmation Needed'`) | For N=1: `automation_CONTRACT_confirmationemail` · For all N: `automation_CONTRACT_invoicereceipt` (with payment_number) and `automation_CONTRACT_revshare` (with payment_number). All chains via HTTP fetch + service-role auth (refactor safety rule). Admin-only. Triggered by the "Check cleared P{N}" button in AutomationPanel after the bank actually clears the check. |
| `automation_load_email_templates` | `actions/email-templates/load.ts` | `email_templates` | — | — |
| `automation_save_email_template` | `actions/email-templates/save.ts` | — | `email_templates` | — |
| `save_sandbox_config` | `actions/pipeline/save-sandbox-config.ts` | — | `pipeline_sandbox_config` (MAP 1 row) — fields: `sandbox_mode`, `stripe_test_mode`, `boldsign_test_mode`, optional `sandbox_email` | — |
| `member_load_pipeline` | `actions/pipeline/member-load-pipeline.ts` | `pmap1` | — | — |

### Notifications

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_notifications` (uses auth) | `actions/notifications/load.ts` | `notifications` (filtered by recipient = session.email \| 'admin' \| 'all', read=false) | — | — |
| `mark_notification_read` | `actions/notifications/mark-read.ts` | — | `notifications.read=true` | — |

---

## Notes & oddities

1. **`automation_CONTRACT_stripewebhook` was removed in Phase 6 mechanical.** It was doubly-dead: real Stripe events had the `stripe-signature` header and were caught by the webhook block; the synthetic-action assignment in `index.ts` (also removed) was unreachable from dispatch because the `action` const was destructured before the mutation. The function returns 401 (no token) or 400 "Unknown action" (with token) for explicit calls.
2. **The duplicate `msm_update_client` handler was removed in Phase 6 mechanical.** Same effect achieved via Map dedupe in `router/dispatch.ts`.
3. **The embedded BoldSign webhook handler in `router/webhooks.ts::maybeHandleBoldSignWebhook` does not chain downstream**, only the standalone `boldsign-webhook` function does. Live BoldSign webhook target should be confirmed (only the standalone function will trigger `automation_CONTRACT_ceocountersign` / `_stripecustomer`).
4. **Action gating is enforced in two places**, both via `constants/role-gates.ts`:
   - `ADMIN_ONLY_ACTIONS` array — explicit allowlist of mutations admins may call. Member callers get 403.
   - `MEMBER_SCOPED_ACTIONS` array — explicit list where `member_number` is overwritten with the caller's own.
   Actions not in either list are accessible to both roles without scoping. Notable examples: `add_client_note`, `update_client_note`, `delete_client_note`, `gc_redeem`, `ciq_*`, `tax_*`, `coaching_*`. Their security relies on every payload requiring an `id` or `client_id` that the caller already owns — application-level rather than role-level.
5. **`document_numbers` sequence is not strongly serialized** — `automation_CONTRACT_invoicereceipt` does `SELECT count(*) FROM document_numbers WHERE type=...` then increments. Concurrent invocations could collide. Pre-existing; not a refactor regression.
6. **Three handlers take `req` as a 4th parameter** (`automation_PIPFU_decision`, `automation_PCADMIN_pricing`, `automation_PCADMIN_extrameeting`) so the chain `fetch()` can forward `req.headers.get("Authorization")` to the chained `automation_CONTRACT_sendagreement` action. This preservation is required by the refactor safety rule "never convert server-to-server chain calls from HTTP fetches to direct function calls" — see `.refactor-resume.md` for context.
