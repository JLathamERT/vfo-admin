# Frontend shell

The frontend is a single Vite + React 18 + react-router-dom v6 SPA. No state library — each top-level page does its own load via [callApi](src/lib/api.js) and passes data down via props. There is **no shared context provider** — components re-fetch on mount.

Built and deployed as a static site to GitHub Pages at `https://jlathamert.github.io/vfo-portal/` (per [package.json:9](package.json) — `gh-pages -d dist`).

## Routes ([src/App.jsx](src/App.jsx))

| Path | Page | Auth | Purpose |
|---|---|---|---|
| `/` | [RolePicker](src/pages/RolePicker.jsx) | none | Two buttons: Admin / Member, navigates to login |
| `/admin/login` | [AdminLogin](src/pages/AdminLogin.jsx) | none | `admin_login` form |
| `/member/login` | [MemberLogin](src/pages/MemberLogin.jsx) | none | `member_login` form |
| `/admin` | [AdminPortal](src/pages/AdminPortal.jsx) | admin session | Top-level admin shell — Members / Specialists / Automation tabs |
| `/admin/client/:clientId` | [ClientDetail](src/pages/ClientDetail.jsx) | admin session | Client deep-dive (admin variant) |
| `/member` | [MemberPortal](src/pages/MemberPortal.jsx) | member session | Top-level member shell |
| `/member/client/:clientId` | [ClientDetail](src/pages/ClientDetail.jsx) | member session | Client deep-dive (member variant — `readOnly`) |
| `/decide` | [DecidePage](src/pages/DecidePage.jsx) | URL token | `automation_PCADMIN_finaldecision` token-link landing page |
| `/pay` | [PayPage](src/pages/PayPage.jsx) | URL token | `automation_CONTRACT_loadpayment` + Stripe checkout redirect |
| `*` | redirect to `/` | — | Catch-all |

## Top-level shells

### `AdminPortal.jsx` ([src/pages/AdminPortal.jsx](src/pages/AdminPortal.jsx)) — 281 lines

| Aspect | Detail |
|---|---|
| Auth check | line 79: `!session \|\| session.role !== 'admin'` → `navigate('/admin/login')` |
| Initial load | line 85: `callApi('load_data')` — populates `allExperts`, `allMembers`, `allExclusionMap`, `ecoMap`, `ciqMap` |
| Header | line 198-220: hover-style title, `NotificationBell`, session name, conditional Admin Editor (superadmin only), Settings, Sign Out |
| Nav model | Three `NavDropdown` components (lines 228-245): **Members**, **Specialists**, **Automation** |
| Active tab/section state | tracked in both React state AND `sessionStorage` (keys `adminActiveTab`, `adminMembersSection`, etc.) so refresh preserves location |
| Body routing | lines 256-273: `activeTab === 'specialists'` → SpecialistsPanel; `'members'` → MembersPanel; `'automation' && automationSection === 'map1_pipeline'` → AutomationPanel; `'automation' && automationSection === 'email_templates'` → EmailTemplatesPanel |

**Members dropdown items (line 158-173):**
- Advisors → Search Advisors / Add Advisor
- Accountants → Search Accountants / Add Accountant

**Specialists dropdown items (line 175-184):**
- Search Specialists / Add Specialist / Onboarding

**Automation dropdown items (line 186-194):**
- MAP 1 Pipeline / Email Templates

**Modal-style overlays:**
- `showEditor` (Admin Editor — superadmin only): mounts [AdminEditor](src/components/admin/AdminEditor.jsx) — manages `allowed_admins`
- `showSettings`: mounts [AdminSettings](src/components/admin/AdminSettings.jsx) — calls `update_my_passcode`

> **Note:** `MembersPanel` has 3 sections (`search_advisors`, `add_advisor`, `search_accountants`) per [MembersPanel.jsx:22-36](src/components/admin/MembersPanel.jsx). It internally branches: accountants render a placeholder, advisors render `AdvisorsPanel` with `initialTab` derived from `section`. There is no separate accountants UI implemented — flagged.

#### AdminPortal `callApi` chain

The portal itself only fires `load_data` (line 85). All deeper actions are fired by the panels it renders:
- `MembersPanel` → `add_member_full`, `save_member`, `delete_member`, `member_profile_load/save`, `gc_*`, `member_program_notes_*`, `load_member_login`, `create/update_member_login` ([MembersPanel.jsx:207, 292, 300, 313, 550, 615-617, 628, 716, 727, 737, 742, 747](src/components/admin/MembersPanel.jsx))
- `SpecialistsPanel` → `save_specialist`, `delete_specialist`, `upload_headshot` ([SpecialistsPanel.jsx:115, 123, 135](src/components/admin/SpecialistsPanel.jsx))
- `AutomationPanel` → `automation_load_pipelines`, `automation_load_pipeline_data`, `save_sandbox_config` ([AutomationPanel.jsx](src/components/admin/AutomationPanel.jsx)) — **read-only view of pipeline rows**, plus a clickable mode badge in the header that calls `save_sandbox_config` to toggle the MAP1 sandbox/live mode. The pipeline-row mutations themselves come from inside ClientDetail's MAP1 tab.
- `EmailTemplatesPanel` → `automation_load_email_templates`, `automation_save_email_template` ([EmailTemplatesPanel.jsx:18, 40](src/components/admin/EmailTemplatesPanel.jsx))
- `AdminEditor` → `load_admins`, `create_admin`, `delete_admin` ([AdminEditor.jsx:17, 35, 44](src/components/admin/AdminEditor.jsx))
- `AdminSettings` → `update_my_passcode` ([AdminSettings.jsx:19](src/components/admin/AdminSettings.jsx))
- `NotificationBell` → `load_notifications` (every 30s), `mark_notification_read` ([NotificationBell.jsx:28, 41](src/components/NotificationBell.jsx))

### `MemberPortal.jsx` ([src/pages/MemberPortal.jsx](src/pages/MemberPortal.jsx)) — 349 lines (incl. inline subcomponents)

| Aspect | Detail |
|---|---|
| Auth check | line 27: `!session \|\| session.role !== 'member'` → `/member/login` |
| Initial load | lines 33-37: parallel fetch of `load_data`, `msm_load_programs`, `msm_load_enabled_programs` |
| Tabs | Static: Profile, MSM Tracking (dropdown), Specialists, Showroom, Website, CIQ, Growth Plan, GC, Vault. **Dynamic** subset of MSM Tracking dropdown: only programs the member has enabled (`member_program_enabled.enabled = true`) |
| Tab → component map | lines 115-145 |
| Hardcoded program-name → tab-key mapping | line 59: `PROGRAM_KEYS = {'VFO Holistic Planning': 'msm_holistic', 'Partnership Fast Track': 'msm_partnership', 'VFO Tax Planning': 'msm_tax', 'Advanced Coaching': 'msm_coaching'}`. Adding a new program in `programs` table would require a code change to surface as a tab. |

#### Member tabs and their components

| Tab key | Label | Mounts | Top-level callApi calls |
|---|---|---|---|
| `profile` | Profile | inline `MemberProfile` | (data already in `memberData`) |
| `msm_home` | MSM Home | [MemberMSMTracking](src/components/member/MemberMSMTracking.jsx) (with `activeTab='msm_home'`) | `msm_load_programs`, `msm_load_enrollments`, `msm_load_enabled_programs`, `msm_load_meetings` ([lines 27-30](src/components/member/MemberMSMTracking.jsx)) |
| `msm_holistic` / `msm_partnership` / `msm_tax` / `msm_coaching` | per-program views | same component, conditional rendering | additional: `msm_load_training_track`, `msm_load_training_progress`, `msm_load_clients`, `msm_load_client_track`, `msm_load_client_progress`, `member_load_pipeline`, `coaching_load_meetings`, `coaching_load_renewals` ([lines 42-43, 223-224, 375, 482-484, 711, 788](src/components/member/MemberMSMTracking.jsx)) |
| `specialists` | Specialists | inline `MemberSpecialists` | `save_member` (saves exclusions) ([line 211](src/pages/MemberPortal.jsx)) |
| `showroom` | Showroom | inline `ComingSoon` | — |
| `website` | Website Plugin | [MemberWebsitePlugin](src/components/shared/MemberWebsitePlugin.jsx) | `save_member` ([line 33](src/components/shared/MemberWebsitePlugin.jsx)) |
| `ciq` | CIQ | [MemberCIQ](src/components/shared/MemberCIQ.jsx) | `ciq_load_settings`, `member_profile_save`, `ciq_load_list`, `load_member_contacts`, `msm_load_member_clients`, `ciq_create`, `ciq_add_client_and_create`, `ciq_load`, `ciq_load_priorities`, `ciq_load_priority_snapshots`, `ciq_save`, `ciq_complete`, `ciq_save_priorities`, `ciq_save_priority_snapshot` ([14 calls — see lines 40, 51, 64-65, 76, 90, 101, 112-114, 131, 144-145, 425-432](src/components/shared/MemberCIQ.jsx)) |
| `growthplan` | Growth Plan | inline `ComingSoon` | — |
| `gc` | GC Marketplace | [MemberGCMarketplace](src/components/member/MemberGCMarketplace.jsx) | `gc_load_balance`, `gc_load_transactions`, `gc_load_services`, `gc_create_checkout`, `gc_redeem` ([lines 28-29, 40, 47, 55](src/components/member/MemberGCMarketplace.jsx)) |
| `vault` | The Vault | [MemberVault](src/components/shared/MemberVault.jsx) | `vault_list`, `vault_upload`, `vault_delete` ([lines 14, 30, 40](src/components/shared/MemberVault.jsx)) |

> **Member-side `automation_*` reach:** members hit only one automation action — `member_load_pipeline` (read-only), invoked from `MemberMSMTracking.jsx:484`. They do not trigger `automation_PIP1_*`, `_PCADMIN_*`, or `_CONTRACT_*` directly. Those are admin-only (gated server-side).

### `ClientDetail.jsx` ([src/pages/ClientDetail.jsx](src/pages/ClientDetail.jsx)) — 384 lines

A **dual-mode** page rendered by both `/admin/client/:clientId` and `/member/client/:clientId`. The `isMember = location.pathname.startsWith('/member')` flag at [line 55](src/pages/ClientDetail.jsx) cascades through the entire tree as `readOnly={isMember}`.

| Aspect | Detail |
|---|---|
| Auth check | line 59: `!session` → `/admin/login` (see [04-auth-and-sessions.md](04-auth-and-sessions.md) for inconsistency note — should branch on isMember) |
| Initial load (lines 63-78) | parallel: `msm_load_client_home({client_id, enrollment_id})`, `load_data`. Then sequential admin-only: `load_client_notes` |
| Tabs | branched on `program?.name`: |
|  | • Partnership Fast Track → "PFT Engagement Process" only |
|  | • VFO Tax Planning → "Tax Priorities" only |
|  | • else → MAP 1 / Regular Priorities / Tax Priorities (all three) |
| Profile dropdown | admin: dropdown with Profile + Edit Profile; member: Profile only (line 130-132) |
| Mutations from ClientHome | `update_client_note`, `delete_client_note`, `msm_update_client` (status, PF assignment) (lines 169, 177, 185, 198) |
| Mutations from ClientDetails | `msm_update_client` (name/email/phone), `msm_add_client_contact`, `msm_delete_client_contact` (lines 306, 316, 325) |

#### ClientDetail child components

| Component | Render condition | Top-level actions |
|---|---|---|
| `ClientHome` | `activeTab === 'home'` | inline (notes + status + PF) |
| `ClientDetails` | `activeTab === 'details' && !isMember` | inline (edit profile, contacts) |
| [ClientTrackViewV2](src/components/admin/map1/ClientTrackViewV2.jsx) | `activeTab === 'map1' && program` | the MAP1 phase tracker — see flow detail below |
| [PFTEngagementTrack](src/components/admin/pft/PFTEngagementTrack.jsx) | `activeTab === 'pft'` | `msm_load_client_track`, `msm_load_client_progress`, `msm_save_client_task` |
| [RegularPrioritiesTab](src/components/admin/regular/RegularPrioritiesTab.jsx) | `activeTab === 'regular'` | `msm_load_priority_*`, `msm_save_priority_task` |
| [TaxPrioritiesTab](src/components/admin/tax/TaxPrioritiesTab.jsx) | `activeTab === 'tax'` | `tax_load_*`, `tax_save_task`, `tax_add_specialist` |

## MAP1 / contract / payment UI flow

The MAP1 contract-and-payment chain is the most complex frontend flow. It is **driven from inside `ClientDetail`'s MAP1 tab** ([ClientTrackViewV2.jsx](src/components/admin/map1/ClientTrackViewV2.jsx) — 42KB). [AutomationPanel](src/components/admin/AutomationPanel.jsx) is a read-only observer of pipeline rows; its only write is the sandbox/live-mode toggle in the panel header.

### Where UI mutations happen

| Step in the chain | UI surface | Component | callApi action |
|---|---|---|---|
| **C81 — PIP 1 reconfirmation** | MAP1 tab, Phase 1 task with `task_code` matching the c81 dropdown | [ClientTrackViewV2.jsx:85](src/components/admin/map1/ClientTrackViewV2.jsx) | `automation_PIP1_reconfirmationemail` |
| **C13 — PIP follow-up decision** | Inline form rendered for the c13 task | [PIPDecisionForm.jsx:107](src/components/admin/map1/PIPDecisionForm.jsx) | `automation_PIPFU_decision` (preceded by `msm_save_client_task` to record the c13 task as completed) |
| **C15 — PCADMIN final decision** | The client clicks a button in their email, lands on `/decide` | [DecidePage.jsx:33](src/pages/DecidePage.jsx) | `automation_PCADMIN_finaldecision` (raw `fetch`, no session — token-authed) |
| **PCADMIN pricing form** | Inline form on the c-task whose status flips to a "needs pricing" state | [PFPricingForm.jsx:19](src/components/admin/map1/PFPricingForm.jsx) | `automation_PCADMIN_pricing` |
| **PCADMIN extra-meeting outcome** | Inline form for the extra-meeting follow-up | [PFExtraMeetingForm.jsx:21](src/components/admin/map1/PFExtraMeetingForm.jsx) | `automation_PCADMIN_extrameeting` |
| **C16 — agreement send** | *not directly user-triggered.* Auto-chained from `automation_PIPFU_decision` (Yes + grossServiceValue), `automation_PCADMIN_pricing`, and `automation_PCADMIN_extrameeting` (Yes) — server-to-server | server side | `automation_CONTRACT_sendagreement` |
| **C17/C18 — sign events** | none — driven by BoldSign webhook | server side | (webhook → `automation_CONTRACT_ceocountersign` if standalone) |
| **Stripe customer + payment email** | server-to-server chain after both signed | server side | `automation_CONTRACT_stripecustomer` → `automation_CONTRACT_paymentemail` |
| **Pay** | The client clicks the email link, lands on `/pay` | [PayPage.jsx:19, 39](src/pages/PayPage.jsx) | `automation_CONTRACT_loadpayment` then `automation_CONTRACT_stripecheckout` (raw `fetch`, no session) |
| **Stripe checkout/payment_intent webhooks** | none — Stripe → admin-api signature-gated handler | server side | (chains `automation_CONTRACT_confirmationemail`, `_invoicereceipt`) |
| **Rev share** | not yet observed in UI. Mechanism is admin-api line 1248 `automation_CONTRACT_revshare`. **Open question:** what triggers it? It is NOT chained from the Stripe webhook handlers above; it appears to require a manual or external trigger. Not seen called from the frontend. |

### What `AutomationPanel` shows

Read-only observer of `pipeline_map1` rows. Renders a stage badge derived from the row's column state via `getCurrentStage()` ([AutomationPanel.jsx:30-45](src/components/admin/AutomationPanel.jsx)) — cascading checks of c-codes, `pay1_status`, `invoice_number`, `rec1_status`, `c24_email_sent`. The stage map is:

```
c81 → c13 → c14 → c15 → c16 → c17 → c18 → payment → confirmation → invoice → receipts → revshare → complete
                                                                                     ↘ closed (if c13_decision='No' && c14_email_sent='Yes')
```

The expanded-row view ([AutomationPanel.jsx:88-260](src/components/admin/AutomationPanel.jsx)) reads the same `pipeline_map1` row and renders 8 "Step" cards corresponding to PIP-1, PIP-Follow-Up, Follow-Up Email, Final Decision, Contract, Payment, Invoice & Receipts, Revenue Share.

### Token-link UX pages

| Page | URL pattern | Source token | Behavior |
|---|---|---|---|
| `/decide` | `?token=<c15_token>&decision=<Yes\|No\|ExtraMeeting>&serviceLevel=<Lite\|Core\|Max>&clientRef=<...>` | `pipeline_map1.c15_token` | Pure side-effect page — fires one POST and renders an outcome screen. No further interaction. Idempotency handled server-side via `existing_decision` response. |
| `/pay` | `?token=<checkout_token>` | `pipeline_map1.checkout_token` | Two-step: (1) `automation_CONTRACT_loadpayment` returns client name + amount; (2) user picks ACH or Card → `automation_CONTRACT_stripecheckout` returns Stripe URL → `window.location.href` redirect. Stripe success URL is hardcoded `https://www.vfo-services.com/payment-successful/` — leaves the SPA. |

> **Inconsistency:** The card-fee math in [PayPage.jsx:76](src/pages/PayPage.jsx) — `(payment_amount + payment_amount * 0.029 + 0.30).toFixed(2)` — is the *naive* fee (added on top), but the server-side card calculation in [actions/pipeline/contract-stripe-checkout.ts](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/actions/pipeline/contract-stripe-checkout.ts) uses the gross-up formula `Math.round((baseAmount + 0.30) / (1 - 0.029) * 100)`. The two differ by a few cents on the fee component. The displayed amount is informational; the actual Stripe charge uses the gross-up formula.

## Cross-references

- Action catalog: [05-api-action-catalog.md](05-api-action-catalog.md)
- Edge-function dispatcher and chain rules: [03-edge-functions.md](03-edge-functions.md)
- Auth: [04-auth-and-sessions.md](04-auth-and-sessions.md)
- Pipeline column dictionary: [../tables/pipeline.md](../tables/pipeline.md)
- Member CIQ deep-dive (Phase E): forthcoming `flows/ciq.md`
- Contract flow end-to-end (Phase E): forthcoming `flows/contract-and-payment.md`
