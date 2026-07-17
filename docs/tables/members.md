# Members tables

The "member" entity in this system = an advisor or accountant (not the end client). They log into the Member Portal, manage their own clients, and run programs.

## `members`

The advisor/accountant roster. PK is `member_number` (text), not an integer — used as the foreign-key target across most tables.

| Column | Type | Notes |
|---|---|---|
| `member_number` | text | pk |
| `first_name` / `last_name` | text | |
| `member_type` | text | The product/service tier, e.g. `"Implementation"`, `"Catalyst"`, `"Fusion A"`, `"VFO Reconciliation (Free)"` — NOT advisor-vs-accountant (that's `member_category`). Drives portal/UI behavior. |
| `member_category` | text | `'advisor'` \| `'accountant'` \| NULL (CHECK-constrained). Added 2026-05-29 (gotcha #48). The durable advisor-vs-accountant tag — replaces the old `ACCOUNTANT_TYPES`/`onboarding_id` heuristic. NULL = uncategorized (incl. corporate `<parent>-C<n>` members, which stay out of the integer numbering buckets). With `advisor_model` it forms the 4 numbering buckets used by `nextMemberNumber()`. Backfill: onboarding FKs → their category, the 20 legacy advisors → `advisor`. Drives the member-side Revenue-Decision hide + the admin AccountantsPanel/AdvisorsPanel filters. |
| `elite_status` | text | default `'Active'`. Status field. **Since v535 (2026-07-02), `Lost`/`Removed` also blocks `member_login` (403; the `member_logins` row is kept — flip back to Active to restore access, gotcha #171).** |
| `advisor_model` | text | `'Legacy Model'` or `'New Model'`. Added 2026-05-26 (Phase 5 advisor onboarding). All 19 pre-existing rows backfilled to `'Legacy Model'`. New rows from `automation_ADVISOR_createmember` get `'New Model'`; manual Add Advisor rows take whichever the admin picks (required, no default). Surfaced in the Search Advisors list as the 5th column. Second axis of the numbering buckets (with `member_category`). |
| `onboarding_id` | bigint | nullable FK → `advisor_onboarding(id)` `ON DELETE SET NULL`, partial index on non-null. Added 2026-05-26 (Phase 5). Set by `automation_ADVISOR_createmember`; remains NULL for legacy/manual advisors. Lets you trace a `members` row back to its onboarding record. |
| `accountant_onboarding_id` | bigint | nullable FK → `accountant_onboarding(id)` `ON DELETE SET NULL`. Added 2026-05-28 (Accountant Onboarding pipeline). Set by `automation_ACCOUNTANT_createmember`; remains NULL for advisors and manually-added accountants. Lets you trace a `members` row back to its accountant onboarding record. |
| `join_date` / `renewal_date` / `leave_date` | date | |
| `suspended` | boolean | default `false`. Status field — the admin's MANUAL toggle only. |
| `membership_suspended` | boolean | default `false`. Set/cleared ONLY by membership-billing automation (sweep + webhook); displays show "Suspended" when EITHER flag is true (gotcha #240). |
| `paused` | boolean | default `false`. Status field. |
| `revenue_decision` | text | Whether they share revenue (`'Revenue Share'` / `'Money Mapping'`). Accountants have NONE — `add_member_full` and `automation_ACCOUNTANT_createmember` leave it NULL when `member_category='accountant'` (gotcha #48). |
| `stripe_account_id` | text | **Stripe Connect ID** — used by `automation_CONTRACT_revshare` for Transfers. |
| `primary_relationship` / `advisor_engagement` | text | |
| `connected_member_number` | text | fk → `members.member_number` (SET NULL). Self-referencing — links a junior member to a senior. |
| `connection_type` | text | Advisor-only revenue-share tier (e.g. `'5% - Regular Advisor'`). Accountants don't use it — the Edit-Profile dropdown + the details-view pill are hidden when `member_category='accountant'` (2026-06-18). |
| `trading_name` | text | nullable. Added 2026-06-18. **"Company Name"** (UI label; the column name stays `trading_name`). Shown/editable on **accountant AND advisor** profiles (2026-07-14 — was accountant-only) — the Add-Accountant form + Edit Profile + profile details + the member's own portal. Auto-filled on onboarding create from the New-Model-Sale modal's `sale_company_name` (`advisor`/`accountant/create-member.ts`). Inserted by `add_member_full`, persisted by `member_profile_save` (passthrough upsert), returned by `load_data`. |
| `email` | text | |
| `notes` | text | |
| `headshot_image` | text | nullable. Added 2026-07-10. **Member profile headshot** — stores just the filename; the image lives in the public `headshots` bucket (shared with `experts.headshot_image`), rendered as `<HEADSHOT_SUPABASE>/<encoded filename>`. Admin-managed only (mirrors specialists): uploaded via `upload_headshot` + cropped by `ImageCropModal`, persisted by `member_profile_save` (passthrough upsert). Surfaced on the admin `TrackHero` avatar + member-portal hero via `load_data` (must be whitelisted there — gotcha #207). |
| `bio` | text | nullable. Added 2026-07-10. Member biography (long-form), shown full-width on the admin + portal profile. Admin-edited via `member_profile_save`. |
| `website_url` | text | nullable. Added 2026-07-10. Member website; rendered as a clickable link (bare domains get `https://` prepended). Admin-edited via `member_profile_save`. Auto-filled on advisor/accountant onboarding create from the New-Model-Sale modal's `sale_website` (2026-07-14). |
| `assigned_msm` | text | Member-Servicing-Manager identifier. |
| `engagement_level` | text | nullable. Admin-set engagement rating shown/editable on the **Member Overview** tab: `highly_engaged` / `reasonably_engaged` / `somewhat_engaged` / `disengaged` (or null = not set). Saved via `member_save_engagement`. Added 2026-07-01. |
| `vfo_certified_date` / `vfo_accredited_date` | date | |
| `ciq_enabled` | boolean | not null, default `false`. **CIQ "can start new CIQs" gate** for this member (admin toggle "Allow Member to Start New CIQs"). Members always *view* their CIQs regardless; this only gates *starting* new ones (enforced frontend + in `ciq_create`/`ciq_add_client_and_create`). Repurposed 2026-06-18 — previously hid the whole CIQ tab. |
| `ciq_vfos_managed` | boolean | not null, default `true`. CIQ behavior toggle — when on, the One Page Plan shows "Powered by VFO Services". |
| `created_at` | timestamptz | default `now()` |

**Status fields:** `elite_status`, `suspended` (manual), `membership_suspended` (automation), `paused`, `ciq_enabled`.
**Automation fields:** `stripe_account_id` (revshare), `ciq_enabled` (CIQ start-new gate) / `ciq_vfos_managed` (CIQ "Powered by VFO Services" label).

**Touched by:** `load_data`, `add_member`, `add_member_full`, `save_member`, `delete_member`, `member_profile_load`, `member_profile_save`, `upload_headshot` (profile headshot → `headshots` bucket), `automation_CONTRACT_revshare`. Frontend: [MembersPanel.jsx](src/components/admin/MembersPanel.jsx), [MemberPortal.jsx](src/pages/MemberPortal.jsx).

**Roster size:** 556 rows as of 2026-06-18 — the 21 originals + **535 active advisors/accountants bulk-imported** from the legacy Google Sheets (gotcha #140; side-effect-free, OLD numbers preserved). **Member-number suffixes seen in live data** (all non-integer PKs, preserved verbatim, skipped by `nextMemberNumber()`): `-J<n>` legacy joint/secondary advisor · `-C<n>` Corporate Member · `-FC<n>` Free Corporate Member · `-FCL<n>` Free Corporate Member (Legacy) · `-TA<n>` accountant Team Member under a parent firm · `-NRA`/`-NRB` VFO Reconciliation (Free) sub-records · `-F<n>`/`-FF<n>` Free Catalyst/Fusion.

---

## `member_number_baselines`

Admin-controlled starting member numbers per (`member_category` × `advisor_model`) bucket. Added 2026-05-29 (gotcha #48). Read by the `nextMemberNumber()` helper (`utils/member-number.ts`) ONLY when a bucket has no existing integer-numbered members — the baseline becomes the first number assigned. An empty bucket with no baseline row is a hard-block: the helper returns an actionable error rather than guessing a start range.

| Column | Type | Notes |
|---|---|---|
| `member_category` | text | not null, `'advisor'` or `'accountant'` (CHECK). Part of PK. |
| `advisor_model` | text | not null, `'Legacy Model'` or `'New Model'` (CHECK). Part of PK. |
| `baseline` | bigint | not null. First number assigned when the bucket is empty. |

PK: (`member_category`, `advisor_model`). Seeded 2026-05-29: `advisor`/`New Model`=60000, `accountant`/`New Model`=30000, `accountant`/`Legacy Model`=90000. `advisor`/`Legacy Model` has 20 existing members so it self-derives (max+1) and needs no baseline row.

**Touched by:** the `nextMemberNumber()` helper, invoked from `add_member_full`, `automation_ADVISOR_createmember`, `automation_ACCOUNTANT_createmember`.

---

## `member_plugin_settings`

Per-member website-widget configuration. PK `plugin_member_number` is a separate identifier from `member_number` — though many tables FK to `plugin_member_number` (specifically `member_logins`, `gc_*`, `member_exclusions`).

| Column | Type | Notes |
|---|---|---|
| `plugin_member_number` | text | pk |
| `name` | text | |
| `type` | text | |
| `manage_key` | text | not null. Used as URL-safe identifier in widget embed. |
| `primary_color` / `bg_color` / `text_color` / `accent_color` / `card_text_color` | text | Theme colors. Defaults: `'#d4af37'`, `'#0a1628'`, `'#ffffff'`, `'#1a2744'`, `'#ffffff'`. |
| `last_initial_only` | boolean | default `false`. Privacy toggle. |
| `display_mode` | text | default `'filter'` |
| `font` | text | default `'Playfair Display'` |
| `show_count` / `show_search` | boolean | default `true` |
| `website_enabled` | boolean | default `false`. Status field — gates whether the public widget is live AND whether the member-portal "Website Plugin" tab is shown (tab hidden + page un-rendered when `false`). **Admin-controlled only** — the member-side enable toggle was removed; the `MemberWebsitePlugin` enable toggle renders only when `isAdmin`, so only the admin Members panel can flip it. |
| `widget_font_size` | integer | default `14`. (Migration `change_widget_font_size_to_integer` indicates this was previously text.) |

**Touched by:** `load_data`, `save_member` (settings payload), `member_profile_save`. Frontend: [MemberWebsitePlugin.jsx](src/components/shared/MemberWebsitePlugin.jsx).

---

## `member_type_history`

Audit trail of `member_type` changes.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | pk |
| `member_number` | text | fk → `members.member_number` (CASCADE) |
| `old_type` / `new_type` | text | |
| `changed_at` | timestamptz | default `now()` |
| `changed_by` | text | |

**Touched by:** Any handler that changes `members.member_type` (currently `member_profile_save`).

---

## `member_exclusions`

Per-member list of `experts` they want excluded from their ecosystem (effectively a blocklist for the website widget / specialist matching).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | pk |
| `member_number` | text | fk → `member_plugin_settings.plugin_member_number` (CASCADE). Note: links to plugin number, not main `members.member_number`. |
| `expert_id` | bigint | fk → `experts.id` (CASCADE) |

**Touched by:** `load_data`, `load_exclusions`, `save_member`. Frontend: [MembersPanel.jsx:550](src/components/admin/MembersPanel.jsx).
