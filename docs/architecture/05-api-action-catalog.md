# API action catalog (`vfo-admin-api`)

All **128 actions** dispatched by `vfo-admin-api` in v196. The post-refactor catalog cites file paths (not line numbers — line numbers shift across handler edits). Action names and behavior are byte-equivalent to v194.

Format: action · `file` · tables read / written · chains / external. Table prefix `pipeline_map1` is shortened to `pmap1` and `pipeline_sandbox_config` to `psbx_cfg` for brevity. All file references are relative to `C:\vfo-edge-functions\supabase\functions\vfo-admin-api\`.

> **Pre-refactor count.** v194 had 130 dispatch references. Phase 6 mechanical removed two: the duplicate `msm_update_client` registration (always unreachable) and the dead `automation_CONTRACT_stripewebhook` handler (doubly unreachable). The current count is 3 logins + 9 PUBLIC_HANDLERS + 116 AUTH_HANDLERS = **128**.

---

## Webhooks (header / body-shape gated, no `action` field)

| Trigger | File | R | W | Chains |
|---|---|---|---|---|
| Stripe webhook (`stripe-signature` header) — `checkout.session.completed` (GC) | `router/webhooks.ts` | `gc_balances` | `gc_balances`, `gc_transactions` | — |
| Stripe webhook — `checkout.session.completed` (MAP1 first payment) | `router/webhooks.ts` | `pmap1`, `psbx_cfg` | `pmap1` (pay1_status, payment_method_type, acct_last4, card_processing_fee, pay1-4_date, confirmation_status) | `automation_CONTRACT_confirmationemail`, `automation_CONTRACT_invoicereceipt` (card only) · Stripe `GET /v1/payment_intents/{id}` |
| Stripe webhook — `payment_intent.succeeded` | `router/webhooks.ts` | `pmap1` | `pmap1` (`payN_status`) | `automation_CONTRACT_invoicereceipt` |
| BoldSign webhook (embedded — `body.event.eventType`) | `router/webhooks.ts` | `pmap1` | `pmap1` (c17/c18) | **none — the standalone `boldsign-webhook` function chains; this one does not** |

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
| `automation_CONTRACT_revshare` | `actions/pipeline/contract-revshare.ts` | `pmap1`, `clients`, `members`, `psbx_cfg` | `pmap1`(recN_rev_share/_paid/_email_sent, member_contrib_status, c24_email_sent) | Google Sheets (Master + batch sheet) read · Stripe `POST /v1/transfers` to `members.stripe_account_id` · 1-2 Gmail drafts (member rev-share + Tracy intro email on payment 1) |
| `automation_CONTRACT_confirmationemail` | `actions/pipeline/contract-confirmation-email.ts` | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1`(confirmation_status='Sent') | Gmail draft to client |
| `automation_CONTRACT_invoicereceipt` | `actions/pipeline/contract-invoice-receipt.ts` | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates`, `document_numbers` | `pmap1`(invoice_number, invoice_drive_id, recN_number/_drive_id/_email_sent), `document_numbers` (insert) | html2pdf.app (×2) · Google Drive (find/create folder, upload ×2) · Gmail draft with PDF attachments |

> **Removed in Phase 6 mechanical:** `automation_CONTRACT_stripewebhook` — was a doubly-dead handler (real Stripe events caught by signature header; synthetic-action assignment in index.ts was unreachable from dispatch). v196 returns 401/400 for explicit calls; no real caller invokes this action by name.

---

## Authed handlers (`AUTH_HANDLERS` in `router/dispatch.ts`)

All dispatched AFTER `middleware/auth.ts::authenticate()` validates body.token. Some take `auth: AuthContext` as 4th param.

### Bootstrap

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_data` | `actions/data/load-data.ts` | `experts`, `vfo_ecosystem_assignments`, `ciq_assignments`, `member_plugin_settings`, `member_exclusions`, `members` | — | — |

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
| `tax_start_plan` | `actions/tax/start-plan.ts` | — | `client_tax_plans` | — |
| `tax_load_progress` | `actions/tax/load-progress.ts` | `client_tax_progress` | — | — |
| `tax_save_task` | `actions/tax/save-task.ts` | — | `client_tax_progress` (upsert) | — |
| `tax_load_specialists` | `actions/tax/load-specialists.ts` | `client_tax_specialists` | — | — |
| `tax_add_specialist` | `actions/tax/add-specialist.ts` | — | `client_tax_specialists` | — |

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
| `automation_load_email_templates` | `actions/email-templates/load.ts` | `email_templates` | — | — |
| `automation_save_email_template` | `actions/email-templates/save.ts` | — | `email_templates` | — |
| `member_load_pipeline` | `actions/pipeline/member-load-pipeline.ts` | `pmap1` | — | — |

### Notifications

| Action | File | R | W | Chains |
|---|---|---|---|---|
| `load_notifications` (uses auth) | `actions/notifications/load.ts` | `notifications` (filtered by recipient = session.email \| 'admin' \| 'all', read=false) | — | — |
| `mark_notification_read` | `actions/notifications/mark-read.ts` | — | `notifications.read=true` | — |

---

## Notes & oddities

1. **`automation_CONTRACT_stripewebhook` was removed in Phase 6 mechanical.** It was doubly-dead: real Stripe events had the `stripe-signature` header and were caught by the webhook block; the synthetic-action assignment in `index.ts` (also removed) was unreachable from dispatch because the `action` const was destructured before the mutation. v196 returns 401 (no token) or 400 "Unknown action" (with token) for explicit calls.
2. **The duplicate `msm_update_client` handler was removed in Phase 6 mechanical.** Same effect achieved via Map dedupe in `router/dispatch.ts`.
3. **The embedded BoldSign webhook handler in `router/webhooks.ts::maybeHandleBoldSignWebhook` does not chain downstream**, only the standalone `boldsign-webhook` function does. Live BoldSign webhook target should be confirmed (only the standalone function will trigger `automation_CONTRACT_ceocountersign` / `_stripecustomer`).
4. **Action gating is enforced in two places**, both via `constants/role-gates.ts`:
   - `ADMIN_ONLY_ACTIONS` array — explicit allowlist of mutations admins may call. Member callers get 403.
   - `MEMBER_SCOPED_ACTIONS` array — explicit list where `member_number` is overwritten with the caller's own.
   Actions not in either list are accessible to both roles without scoping. Notable examples: `add_client_note`, `update_client_note`, `delete_client_note`, `gc_redeem`, `ciq_*`, `tax_*`, `coaching_*`. Their security relies on every payload requiring an `id` or `client_id` that the caller already owns — application-level rather than role-level.
5. **`document_numbers` sequence is not strongly serialized** — `automation_CONTRACT_invoicereceipt` does `SELECT count(*) FROM document_numbers WHERE type=...` then increments. Concurrent invocations could collide. Pre-existing; not a refactor regression.
6. **Three handlers take `req` as a 4th parameter** (`automation_PIPFU_decision`, `automation_PCADMIN_pricing`, `automation_PCADMIN_extrameeting`) so the chain `fetch()` can forward `req.headers.get("Authorization")` to the chained `automation_CONTRACT_sendagreement` action. This preservation is required by the refactor safety rule "never convert server-to-server chain calls from HTTP fetches to direct function calls" — see `.refactor-resume.md` for context.
