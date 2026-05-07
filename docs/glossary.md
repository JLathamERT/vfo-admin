# Glossary

Acronyms and domain terms used across the codebase and this documentation. Definitions are inferred from context where not stated explicitly in the code; uncertain inferences are flagged.

## Business / domain terms

| Term | Stands for | Notes |
|---|---|---|
| **VFO** | Virtual Family Office | Industry term — a coordinated team-of-experts service model. Used in product naming (`VFO Services`, `VFO Holistic Planning`, etc.). |
| **VFO Services** | The product / company brand. | The `From:` line on `automation_CONTRACT_sendagreement` emails. |
| **MAP1** / **MAP 1** | Member Advisor Program — Pipeline 1 | The single-row in `pipelines` table. Drives the `pipeline_map1` automation. The system was designed to support multiple pipelines (`automation_load_pipeline_data` reads `table_name` dynamically from `pipelines`) but only MAP1 exists. |
| **PIP** | (Inferred) Planning & Investment Plan, or Personalized Initial Plan | Used in `PIP1_reconfirmation` email template, `PIPDecisionForm` component, `automation_PIP1_*` and `automation_PIPFU_*` actions. **Definition not stated in code** — flagged. |
| **PIPFU** | PIP Follow-Up | The decision phase after the initial PIP meeting. Action: `automation_PIPFU_decision`. |
| **PCADMIN** | Proactive Coordinator Admin (inferred) | The "AI-PC" sign-off in automation emails reads `Proactive Coordinator`. PCADMIN is the admin-side action prefix for that role's workflow. Actions: `automation_PCADMIN_finaldecision`, `automation_PCADMIN_pricing`, `automation_PCADMIN_extrameeting`. |
| **AI-PC** | (Inferred) AI Proactive Coordinator, or "Anonymous Initials — Proactive Coordinator" | Email signature block on most automation emails. Literal text used: `<strong>AI-PC</strong><br>Proactive Coordinator`. **Whether this is a person, role, or AI persona is not clear from the code.** Flagged. |
| **PF** | Planning Facilitator | Per-client assigned role. Stored in `clients.assigned_pf` and `pipeline_map1.pf`. Hardcoded list in [admin-api:163-167](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) covers Evan Anderson, Bridger Silvester, Lindsay Morris. |
| **PFT** | Partnership Fast Track | A program type. Drives ClientDetail's tab branching (PFT-only view vs MAP1+Regular+Tax view). Component: [PFTEngagementTrack.jsx](src/components/admin/pft/PFTEngagementTrack.jsx). |
| **MSM** | Member Servicing Manager | The role that manages member relationships. ~32 `msm_*` actions. Stored in `members.assigned_msm`, `member_enrollments.assigned_msm`. |
| **CIQ** | Client Intake Questionnaire | A survey + ranked-priorities workflow run by members against their clients. ~14 `ciq_*` actions. See [flows/ciq.md](flows/ciq.md). |
| **CEO** | Chief Executive Officer | Hardcoded as `aanderson@elitert.com` in code. Second signer on every BoldSign agreement. |
| **GC** | Growth Credits (inferred from product copy) | Marketplace credits. Tables: `gc_balances`, `gc_redemptions`, `gc_services`, `gc_transactions`. The Stripe checkout product description reads `<amount> Growth Credits`. |
| **D&B** | Details & Benefits | Public-facing marketing copy for specialists. Stored in `experts.D&B_*` columns. |

## Service-tier terms

| Term | Notes |
|---|---|
| **Lite Membership** | Cheapest tier. 1 PIP meeting included. |
| **Core Membership** | Mid tier. 4 PIP meetings included. |
| **Max Membership** | Top tier. PIP meeting count is configurable per-client. |

These appear in `pipeline_map1.service_level`, `c15_service_level`, `lite_membership` / `core_membership` / `max_membership` (pricing snapshots), and as agreement template keys in `agreement_templates.service_level`.

## Pipeline stage codes

The `pipeline_map1` table uses `c##_*` column prefixes for each MAP1 lifecycle stage. The code numbers are visible only in the column names; their canonical meanings are not stated in code or comments. Listed here in the order they advance:

| Code | Stage | Driven by |
|---|---|---|
| `c81_decision`, `c81_email_sent` | PIP 1 reconfirmation | `automation_PIP1_reconfirmationemail` |
| `c13_decision` | PIP follow-up decision | `automation_PIPFU_decision` |
| `c14_email_sent`, `c14_followup1_sent`, `c14_followup2_sent` | PCADMIN follow-up email | `automation_PIPFU_decision` (Undecided/No path) |
| `c15_token`, `c15_final_decision`, `c15_service_level`, `c15_via_extra_meeting` | PCADMIN final decision | `automation_PCADMIN_finaldecision` (via `/decide` link) |
| `c16_sent` | Agreement sent to BoldSign | `automation_CONTRACT_sendagreement` |
| `c17_client_signed`, `c17_followup_sent_date`, `c17_followup1_sent`, `c17_followup2_sent` | Client signed agreement | `boldsign-webhook` |
| `c18_ceo_signed` | CEO countersigned | `boldsign-webhook` |
| `c24_email_sent` | Tracy intro email sent (after first payment + revenue share) | `automation_CONTRACT_revshare` |

> **Note on numbering:** the codes are `c81`, `c13`, `c14`, `c15`, `c16`, `c17`, `c18`, `c24` — they are not sequential, and there are gaps (no `c1`-`c12`, no `c19`-`c23`). The `c81` is the first stage in the lifecycle but uses the highest number. **Pattern of numbering is not explained anywhere in code.** Likely refers to phase + task numbers in the broader VFO process documentation external to this repo.

## Status / decision values

These string values appear in pipeline columns. Only two are DB-CHECK-constrained; the rest are convention.

| Field | Observed values |
|---|---|
| `c81_decision` | `'Yes'`, `'No'` |
| `c81_email_sent` | `'No'`, `'Yes'`, `'Skipped'` |
| `c13_decision` | `'Yes'`, `'Undecided'`, `'No'` |
| `c14_email_sent` | `'No'`, `'Yes'` |
| `c15_final_decision` | `'Yes'`, `'No'`, `'ExtraMeeting'` |
| `c15_service_level` / `service_level` | `'Lite'`, `'Core'`, `'Max'` |
| `c16_sent` | `'No'`, `'Yes'` |
| `c17_client_signed`, `c18_ceo_signed` | `'No'`, `'Yes'` |
| `pay1_status` … `pay4_status` | `'processing'`, `'succeeded'` |
| `payment_method_type` | `'card'`, `'ach'`, `'check'`, `'unknown'` |
| `payment_plan` | `'1 Time Payment'`, `'Quarterly'` |
| `confirmation_status` | `'Confirmation Needed'`, `'Sent'` |
| `recN_status` | (varies, e.g., `'pending'`) |
| `recN_rev_share` | `'Pending'`, `'Completed - Revenue Share'`, `'Completed - Money Mapping'` |
| `recN_rev_paid` | `'Yes'`, `'Failed'`, `'Money Mapping'`, `'N/A — No Share Due'` |
| `member_contrib_status` | `'Pending'`, `'Applied'` |
| `client_ciqs.status` | `'draft'`, `'completed'` (DB CHECK constrained) |
| `ciq_priorities.decision` | `'drop'`, `'park'`, `'prioritize'` (DB CHECK constrained) |
| `clients.status` | `'pending'`, `'active'`, `'lost'` (UI-defined) |
| `members.elite_status` | `'Active'` default; other values not enumerated |
| `members.revenue_decision` | `'Revenue Share'`, `'Money Mapping'` (read in revshare logic) |
| `coaching_meetings.status` | `'scheduled'` default; others UI-defined |
| `client_priority_tracks.status` | `'live'` default; e.g., `'archived'` |
| `client_tax_plans.status` | `'live'` default |
| `gc_redemptions.status` | `'pending'` default; e.g., `'fulfilled'`, `'rejected'` |
| `specialist_onboarding.status` | `'active'` default; others UI-defined |

## People / external roles

These names/emails appear hardcoded in the codebase:

| Name | Email | Role |
|---|---|---|
| Anton Anderson | `aanderson@elitert.com` | CEO. Hardcoded BoldSign signer 2 + BCC on most automation emails. |
| Jake Latham | `jlatham@elitert.com` | Superadmin. Hardcoded `SUPERADMIN_EMAIL`. |
| (named "P. Latham"?) | `platham@elitert.com` | BCC on most automation emails (alongside `aanderson`). |
| Tracy Miller | `tnmiller@elitert.com` | "VFO Liaison." Recipient of the intro email after payment 1 (sent by `automation_CONTRACT_revshare`). |
| (Tracy Miller, separate?) | `tracy@vfo-services.com` | CC'd on every `automation_CONTRACT_invoicereceipt` email. **Whether this is the same person as `tnmiller@elitert.com` is not clear from code** — flagged. |
| Evan Anderson | `eanderson@vfo-services.com` | PF |
| Bridger Silvester | `bsilvester@vfo-services.com` | PF |
| Lindsay Morris | `lmorris@vfo-services.com` | PF (in `getPfEmail()` map but not in the [ClientDetail.jsx:227-228](src/pages/ClientDetail.jsx) PF dropdown) |
| (No email; team list only) | — | Sarah Freitas, Rachael, Tracy Miller, Evan Anderson — `TEAM_MEMBERS` const at [ClientDetail.jsx:11](src/pages/ClientDetail.jsx) |

> The "AI-PC" / "Proactive Coordinator" role appears in every automation email signature but is not tied to a specific person in the codebase. The email "From:" address `aipc@vfo-services.com` (used only by `automation_CONTRACT_sendagreement`) suggests it may be a shared inbox or AI-driven coordinator persona. **Definition not stated.** Flagged.

## Technical terms

| Term | Notes |
|---|---|
| **Edge function** | A Deno-based serverless function deployed to Supabase. Two of them in this system. |
| **RLS** | Row-Level Security in Postgres. Enabled on all public tables; bypassed by service-role key. |
| **Anon key** | Public Supabase JWT used as a default `Authorization: Bearer` header by the frontend. Hardcoded in [src/lib/api.js](src/lib/api.js). |
| **Service-role key** | Privileged Supabase JWT used by edge functions. Bypasses RLS. Never exposed to frontend. |
| **Sandbox mode** | Per-pipeline toggle on `pipeline_sandbox_config`. When `true`, automation emails route to `sandbox_email`, and Stripe/BoldSign use sandbox keys. |
| **Embedded sign link** | A BoldSign URL that opens in an iframe (vs an emailed BoldSign-hosted link). Used so the client / CEO sign within VFO's own email layout. |
| **Server-to-server chain** | One automation handler invoking another via `fetch` against the same edge function URL with `Authorization: Bearer <SERVICE_ROLE_KEY>`. Routes to public-token actions, bypassing the user-session gate. |
| **Token-link page** | A frontend page (`/decide`, `/pay`) that takes a token in the URL query string and uses raw `fetch` (no session) to call public actions on the edge function. |
| **html2pdf.app** | Third-party HTML→PDF generation service. Called from `automation_CONTRACT_invoicereceipt` and `automation_CONTRACT_sendagreement`. |
| **Stripe Connect** | Stripe's marketplace feature where the platform makes Transfers to connected merchant accounts. Used for revenue share payouts to members. Each member's account ID is in `members.stripe_account_id`. |
| **gh-pages** | GitHub Pages static hosting. The deploy target for `vfo-react`. Path prefix is `/vfo-portal/`. |

## Cross-references

- Pipeline column-by-column: [tables/pipeline.md](tables/pipeline.md)
- Stage transitions: [flows/contract-and-payment.md](flows/contract-and-payment.md)
- Action handlers: [architecture/05-api-action-catalog.md](architecture/05-api-action-catalog.md)
