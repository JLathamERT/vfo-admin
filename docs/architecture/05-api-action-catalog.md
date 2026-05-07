# API action catalog (`vfo-admin-api`)

All ~125 actions dispatched by `vfo-admin-api/index.ts`. Counted from grep: 130 distinct `if (action === "X")` matches in the file (3 of which are `msm_update_client` duplicates / never-reached — see notes).

Format: action · `file:line` · tables read / written · chains / external. Table prefix `pipeline_map1` is shortened to `pmap1` and `pipeline_sandbox_config` to `psbx_cfg` for brevity.

All file references are to `C:\vfo-edge-functions\supabase\functions\vfo-admin-api\index.ts`.

---

## Webhooks (header / body-shape gated, no `action` field)

| Trigger | Lines | R | W | Chains |
|---|---|---|---|---|
| Stripe webhook (`stripe-signature` header) — `checkout.session.completed` (GC) | 270-288 | `gc_balances` | `gc_balances`, `gc_transactions` | — |
| Stripe webhook — `checkout.session.completed` (MAP1 first payment) | 290-392 | `pmap1`, `psbx_cfg` | `pmap1` (pay1_status, payment_method_type, acct_last4, card_processing_fee, pay1-4_date, confirmation_status) | `automation_CONTRACT_confirmationemail`, `automation_CONTRACT_invoicereceipt` (card only) · Stripe `GET /v1/payment_intents/{id}` |
| Stripe webhook — `payment_intent.succeeded` | 394-438 | `pmap1` | `pmap1` (`payN_status`) | `automation_CONTRACT_invoicereceipt` |
| BoldSign webhook (embedded — `body.event.eventType`) | 544-583 | `pmap1` | `pmap1` (c17/c18) | **none — the standalone `boldsign-webhook` function chains; this one does not** |

---

## Auth (no token required)

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `admin_login` | 454-477 | `allowed_admins` | `admin_sessions` | — |
| `member_login` | 480-512 | `member_logins`, `member_plugin_settings`, `members` | `admin_sessions` | — |
| `login` (legacy) | 515-537 | `allowed_admins` | `admin_sessions` | — |

---

## Public-token automation (token in body, no session)

These sit above the auth gate. Triggered either by user-facing token links (`/decide`, `/pay`) or by server-to-server chain calls authenticated via `SUPABASE_SERVICE_ROLE_KEY`.

| Action | Lines | R | W | Chains / external |
|---|---|---|---|---|
| `automation_PCADMIN_finaldecision` | 586-742 | `pmap1`(by c15_token), `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1`(c15_final_decision, c15_service_level), `notifications` | Gmail draft (decline email if "No") |
| `automation_CONTRACT_ceocountersign` | 745-858 | `pmap1`, `clients`, `psbx_cfg`, `email_templates` | — | BoldSign `GET /v1/document/getEmbeddedSignLink` (3 retries) · Gmail draft to CEO |
| `automation_CONTRACT_stripecustomer` | 861-936 | `pmap1`, `clients`, `psbx_cfg` | `pmap1`(stripe_customer_id, checkout_token) | Stripe `POST /v1/customers` · `automation_CONTRACT_paymentemail` |
| `automation_CONTRACT_paymentemail` | 939-1050 | `pmap1`, `clients`, `psbx_cfg`, `email_templates` | — | Gmail draft to client with `/pay?token=...` link |
| `automation_CONTRACT_loadpayment` | 1053-1083 | `pmap1`(by checkout_token), `clients` | — | — |
| `automation_CONTRACT_stripecheckout` | 1086-1153 | `pmap1`(by checkout_token), `psbx_cfg` | — | Stripe `POST /v1/checkout/sessions` (returns redirect URL) |
| `automation_CONTRACT_stripewebhook` | 1156-1245 | `pmap1`, `psbx_cfg` | `pmap1`(pay1_status, payment_method_type, acct_last4) | Stripe payment_intents read. **Likely dead code** — Stripe webhooks hit the signature-gated handler at line 222 first. |
| `automation_CONTRACT_revshare` | 1248-1657 | `pmap1`, `clients`, `members`, `psbx_cfg` | `pmap1`(recN_rev_share/_paid/_email_sent, member_contrib_status, c24_email_sent) | Google Sheets (Master + batch sheet) read · Stripe `POST /v1/transfers` to `members.stripe_account_id` · 1-2 Gmail drafts (member rev-share + Tracy intro email on payment 1) |
| `automation_CONTRACT_confirmationemail` | 1660-1809 | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1`(confirmation_status='Sent') | Gmail draft to client |
| `automation_CONTRACT_invoicereceipt` | 1812-2188 | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates`, `document_numbers` | `pmap1`(invoice_number, invoice_drive_id, recN_number/_drive_id/_email_sent), `document_numbers` (insert) | html2pdf.app (×2) · Google Drive (find/create folder, upload ×2) · Gmail draft with PDF attachments |

---

## Bootstrap

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_data` | 2278-2326 | `experts`, `vfo_ecosystem_assignments`, `ciq_assignments`, `member_plugin_settings`, `member_exclusions`, `members` | — | — |

---

## Specialists (admin-only mutations)

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `save_specialist` | 2329-2358 | — | `experts`, `vfo_ecosystem_assignments` (delete+insert), `ciq_assignments` (delete+insert) | — |
| `save_specialist_order` | 2361-2370 | — | `experts.sort_order` | — |
| `delete_specialist` | 2372-2381 | — | `experts` (delete) | — |
| `upload_headshot` | 2383-2392 | — | Supabase storage `headshots` bucket | — |

## Members (admin)

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `save_member` | 2394-2412 | — | `member_plugin_settings`, `member_exclusions` (delete+insert) | — |
| `load_exclusions` | 2414-2423 | `member_exclusions` | — | — |
| `add_member` | 2425-2459 | — | `member_plugin_settings` | — |
| `delete_member` | 2461-2477 | — | `member_plugin_settings` (delete; cascades) | — |
| `add_member_full` | 3384-3415 | — | `member_plugin_settings`, `members`, optional `member_logins` | — |
| `member_profile_load` | 3152-3163 | `members` | — | — |
| `member_profile_save` | 3350-3382 | `members` (old type for history) | `members`, `member_type_history` (on type change) | — |

## Admins

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_admins` | 2479-2488 | `allowed_admins` | — | — |
| `create_admin` | 2490-2512 | — | `allowed_admins` (with hashed passcode) | — |
| `delete_admin` | 2514-2525 | — | `allowed_admins` (delete) | — |
| `update_my_passcode` | 2527-2550 | — | `allowed_admins.passcode` (re-hashed) | — |

## Member logins

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_member_login` | 2552-2563 | `member_logins` | — | — |
| `load_my_login` | 2565-2574 | `member_logins` | — | — |
| `create_member_login` | 2576-2596 | — | `member_logins` (hashed) | — |
| `update_member_login` | 2598-2610 | — | `member_logins` | — |

## Vault (Supabase Storage)

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `vault_list` | 2612-2635 | storage `member-vault` (list) | — | — |
| `vault_upload` | 2637-2648 | — | storage `member-vault` (upload) | — |
| `vault_delete` | 2650-2658 | — | storage `member-vault` (delete) | — |

---

## Gift credits (GC marketplace)

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `gc_load_services` | 2660-2669 | `gc_services` | — | — |
| `gc_load_balance` | 2671-2682 | `gc_balances` | — | — |
| `gc_load_transactions` | 2684-2696 | `gc_transactions` | — | — |
| `gc_load_redemptions` | 2698-2710 | `gc_redemptions`, `gc_services` | — | — |
| `gc_load_all_redemptions` | 2712-2721 | `gc_redemptions`, `gc_services`, `member_plugin_settings` | — | — |
| `gc_redeem` | 2723-2747 | `gc_balances`, `gc_services` | `gc_redemptions`, `gc_balances`, `gc_transactions` | — |
| `gc_add_credits` | 2749-2767 | `gc_balances` | `gc_balances`, `gc_transactions` | — |
| `gc_update_redemption` | 2769-2789 | — | `gc_redemptions.status` | — |
| `gc_manage_service` | 2791-2804 | — | `gc_services` (insert/update/delete) | — |
| `gc_create_checkout` | 2806-2838 | — | — | Stripe `POST /v1/checkout/sessions` (metadata: member_number, credits). **Webhook fulfills via Stripe handler at line 270.** |

---

## MSM (Member Servicing Manager) — programs / clients / tracking

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `msm_load_programs` | 2840-2849 | `programs` | — | — |
| `msm_load_enrollments` | 2851-2861 | `member_enrollments` | — | — |
| `msm_enroll_member` | 2863-2889 | — | `member_enrollments` | — |
| `msm_update_enrollment` | 2891-2906 | — | `member_enrollments` | — |
| `msm_load_training_track` | 2908-2922 | `program_training_phases`, `program_training_tasks` | — | — |
| `msm_load_training_progress` | 2924-2934 | `member_training_progress` | — | — |
| `msm_save_training_task` | 2936-2960 | — | `member_training_progress` (upsert) | — |
| `msm_load_meetings` | 2962-2973 | `member_meetings` | — | — |
| `msm_log_meeting` | 2975-2985 | — | `member_meetings` | — |
| `msm_delete_meeting` | 2987-2994 | — | `member_meetings` (delete) | — |
| `msm_load_clients` | 2996-3007 | `clients`, `client_enrollments` | — | — |
| `msm_load_member_clients` | 3009-3016 | `clients` | — | — |
| `msm_add_client` | 3018-3063 | — | `clients`, `client_enrollments`, optional `client_contacts` | — |
| `msm_link_existing_client` | 3065-3077 | — | `client_enrollments` | — |
| `msm_update_client` | 3079-3095 | — | `clients` | — |
| `msm_load_client_track` | 3097-3112 | `program_client_phases`, `program_client_tasks` | — | — |
| `msm_load_client_progress` | 3114-3124 | `client_progress` | — | — |
| `msm_save_client_task` | 3126-3150 | — | `client_progress` (upsert) | — |
| `msm_load_client_home` | 3165-3214 | `clients`, `client_contacts`, `member_enrollments`, `programs`, `client_enrollments` | — | — |
| `msm_update_client` (duplicate) | 3216-3222 | — | — | **Dead code — first match at 3079 returns before this block is reached.** |
| `msm_add_client_contact` | 3224-3230 | — | `client_contacts` | — |
| `msm_delete_client_contact` | 3232-3238 | — | `client_contacts` (delete) | — |
| `msm_load_priority_tracks` | 3240-3246 | `client_priority_tracks` | — | — |
| `msm_load_regular_phases` | 3248-3254 | `program_client_phases` | — | — |
| `msm_add_priority_track` | 3256-3262 | — | `client_priority_tracks` | — |
| `msm_update_priority_status` | 3264-3270 | — | `client_priority_tracks.status` | — |
| `msm_load_priority_progress` | 3272-3278 | `priority_progress` | — | — |
| `msm_save_priority_task` | 3280-3292 | — | `priority_progress` (upsert) | — |
| `msm_load_client_detail` | 3294-3318 | `clients`, `member_enrollments`, `programs` | — | — |
| `msm_load_enabled_programs` | 3320-3326 | `member_program_enabled` | — | — |
| `msm_toggle_program` | 3328-3339 | — | `member_program_enabled` (upsert) | — |
| `msm_update_assigned_msm` | 3341-3348 | — | `members.assigned_msm` (or `member_enrollments`) | — |

---

## Coaching

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `coaching_load_meetings` | 3417-3424 | `coaching_meetings` | — | — |
| `coaching_log_meeting` | 3426-3435 | — | `coaching_meetings` | — |
| `coaching_update_meeting` | 3437-3448 | — | `coaching_meetings` | — |
| `coaching_delete_meeting` | 3450-3457 | — | `coaching_meetings` (delete) | — |
| `coaching_load_renewals` | 3459-3466 | `coaching_renewals` | — | — |
| `coaching_process_renewal` | 3468-3475 | — | `coaching_renewals` | — |

## Tax

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `tax_load_plans` | 3477-3484 | `client_tax_plans` | — | — |
| `tax_start_plan` | 3486-3493 | — | `client_tax_plans` | — |
| `tax_load_progress` | 3495-3502 | `client_tax_progress` | — | — |
| `tax_save_task` | 3504-3534 | — | `client_tax_progress` (upsert) | — |
| `tax_load_specialists` | 3536-3543 | `client_tax_specialists` | — | — |
| `tax_add_specialist` | 3545-3551 | — | `client_tax_specialists` | — |

## Client notes

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_client_notes` | 3553-3558 | `client_notes` | — | — |
| `add_client_note` | 3560-3565 | — | `client_notes` | — |
| `update_client_note` | 3567-3572 | — | `client_notes` | — |
| `delete_client_note` | 3574-3580 | — | `client_notes` (delete) | — |

---

## CIQ

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `ciq_load_list` | 3582-3593 | `client_ciqs`, `clients` | — | — |
| `ciq_create` | 3595-3606 | — | `client_ciqs` | — |
| `ciq_add_client_and_create` | 3608-3639 | — | `clients`, optional `client_contacts`, `client_ciqs` | — |
| `ciq_load` | 3641-3659 | `client_ciqs`, `ciq_answers` | — | — |
| `ciq_save` | 3661-3673 | — | `ciq_answers` (upsert) | — |
| `ciq_complete` | 3675-3685 | — | `client_ciqs.status='completed'`, `client_ciqs.completed_at` | — |
| `load_member_contacts` | 3687-3702 | `clients`, `client_contacts` | — | — |
| `ciq_load_priorities` | 3704-3713 | `ciq_priorities` | — | — |
| `ciq_save_priorities` | 3715-3727 | — | `ciq_priorities` (upsert) | — |
| `ciq_complete_priorities` | 3729-3738 | — | `client_ciqs.priorities_completed_at` | — |
| `ciq_save_priority_snapshot` | 3740-3749 | — | `ciq_priority_snapshots` | — |
| `ciq_load_priority_snapshots` | 3751-3758 | `ciq_priority_snapshots` | — | — |
| `ciq_load_settings` | 3760-3767 | `members.ciq_enabled, ciq_vfos_managed` | — | — |

## Member program notes

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_member_program_notes` | 3769-3777 | `member_program_notes` | — | — |
| `add_member_program_note` | 3779-3785 | — | `member_program_notes` | — |
| `update_member_program_note` | 3787-3793 | — | `member_program_notes` | — |
| `delete_member_program_note` | 3795-3802 | — | `member_program_notes` (delete) | — |

## Specialist onboarding

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_onboardings` | 3804-3808 | `specialist_onboarding` | — | — |
| `create_onboarding` | 3810-3816 | — | `specialist_onboarding` | — |
| `load_onboarding` | 3818-3829 | `specialist_onboarding`, `specialist_onboarding_progress`, `specialist_onboarding_meetings`, `specialist_onboarding_votes` | — | — |
| `save_onboarding_progress` | 3831-3837 | — | `specialist_onboarding_progress` (upsert) | — |
| `save_onboarding_meeting` | 3839-3845 | — | `specialist_onboarding_meetings` | — |
| `save_onboarding_vote` | 3847-3853 | — | `specialist_onboarding_votes` (upsert) | — |
| `update_onboarding` | 3855-3866 | — | `specialist_onboarding` | — |

---

## Pipeline / automation (admin-only)

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `automation_load_pipelines` | 3868-3876 | `pipelines` | — | — |
| `automation_load_pipeline_data` | 3879-3941 | dynamic table from `pipelines.table_name` (whitelisted to `pipeline_map1`), `clients`, `members`, `psbx_cfg` | — | — |
| `automation_PIP1_reconfirmationemail` | 3944-4074 | `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1` (insert new row), `pmap1.c81_email_sent='Yes'` | Gmail draft |
| `automation_PIPFU_decision` | 4077-4338 | `pmap1`, `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1` (insert if missing, plus c13_decision, current_priorities, parked_priorities, pricing fields, c14_email_sent, c15_token), `pmap1.c14_email_sent='Yes'` | Gmail draft (Undecided/No) · `automation_CONTRACT_sendagreement` (Yes + grossServiceValue) |
| `automation_PCADMIN_pricing` | 4377-4415 | — | `pmap1` (pricing fields), `notifications.read=true` | `automation_CONTRACT_sendagreement` |
| `automation_PCADMIN_extrameeting` | 4418-4566 | `clients`, `members`, `psbx_cfg`, `email_templates` | `pmap1` (c15_final_decision, c15_via_extra_meeting=true, pricing fields), `notifications.read=true` | `automation_CONTRACT_sendagreement` (Yes) · Gmail draft (No) |
| `automation_CONTRACT_sendagreement` | 4584-4945 | `pmap1`, `clients`, `client_enrollments`, `members`, `agreement_templates`, `psbx_cfg`, `email_templates` | `pmap1` (c16_sent='Yes', boldsign_doc_id, c17/c18='No', c17_followup_sent_date) | html2pdf.app · BoldSign `POST /v1/document/send` (multipart with PDF) · BoldSign `GET /v1/document/getEmbeddedSignLink` (5 retries) · Gmail draft to client |
| `automation_load_email_templates` | 4341-4349 | `email_templates` | — | — |
| `automation_save_email_template` | 4352-4361 | — | `email_templates` | — |
| `member_load_pipeline` | 4950-4959 | `pmap1` | — | — |

## Notifications

| Action | Lines | R | W | Chains |
|---|---|---|---|---|
| `load_notifications` | 4364-4374 | `notifications` (filtered by recipient = session.email \| 'admin' \| 'all', read=false) | — | — |
| `mark_notification_read` | 4569-4578 | — | `notifications.read=true` | — |

---

## Notes & oddities

1. **`msm_update_client` declared twice** — at line 3079 and 3216. The second is unreachable (the first matches and returns). The duplicate handler does nothing meaningful that the first doesn't already cover.
2. **`automation_CONTRACT_stripewebhook` is likely dead** — actual Stripe webhooks hit the `stripe-signature` block at line 222 first and return at line 440. Reaching line 1156 would require a forged event-shaped POST without a signature, which the function would also reject at the signature check.
3. **The embedded BoldSign webhook handler at line 544 does not chain downstream**, only the standalone `boldsign-webhook` function does. Live BoldSign webhook target should be confirmed (only the standalone function will trigger `automation_CONTRACT_ceocountersign` / `_stripecustomer`).
4. **Action gating is enforced in two places**:
   - `ADMIN_ONLY_ACTIONS` array (line 2226) — explicit allowlist of mutations admins may call. Member callers get 403.
   - `MEMBER_SCOPED_ACTIONS` array (line 2261) — explicit list where `member_number` is overwritten with the caller's own.
   Actions not in either list are accessible to both roles without scoping. Notable examples: `add_client_note`, `update_client_note`, `delete_client_note`, `gc_redeem`, `ciq_*`, `tax_*`, `coaching_*`. Their security relies on every payload requiring an `id` or `client_id` that the caller already owns — application-level rather than role-level.
5. **`document_numbers` sequence is not strongly serialized** — `automation_CONTRACT_invoicereceipt` does `SELECT count(*) FROM document_numbers WHERE type=...` then increments. Concurrent invocations could collide.
