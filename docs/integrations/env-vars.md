# Environment variable inventory

Complete list of secrets and config-vars referenced by the edge functions, with which actions/integrations consume each. No `.env` files are committed; values live in Supabase function secrets.

## Edge-function env vars

Confirmed via `Deno.env.get(...)` audit of `vfo-admin-api/index.ts` and `boldsign-webhook/index.ts`.

### Supabase

| Var | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | both edge functions | Project URL — `https://ejpsprsmhpufwogbmxjv.supabase.co`. Used to construct chain-call URLs and as the `createClient` arg. |
| `SUPABASE_SERVICE_ROLE_KEY` | both edge functions | Service-role JWT for `createClient`. Bypasses RLS. Also presented as `Authorization: Bearer ...` on server-to-server chain calls. |

### Stripe

| Var | Required by | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `automation_CONTRACT_stripecustomer`, `automation_CONTRACT_stripecheckout`, `automation_CONTRACT_stripewebhook`, `automation_CONTRACT_revshare`, Stripe webhook handler, `gc_create_checkout` | Live mode |
| `STRIPE_SECRET_KEY_SANDBOX` | same as above except `gc_create_checkout` | Test-mode key. Selected when `pipeline_sandbox_config.sandbox_mode=true` for `MAP 1`. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification ([admin-api:228](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) | Single secret covers both live and test events. |

> **Note:** `gc_create_checkout` only reads `STRIPE_SECRET_KEY` — no sandbox path for GC purchases.

### BoldSign

| Var | Required by | Notes |
|---|---|---|
| `BOLDSIGN_API_KEY` | `automation_CONTRACT_sendagreement`, `automation_CONTRACT_ceocountersign` | Live mode |
| `BOLDSIGN_API_KEY_SANDBOX` | same | Sandbox |

### Google (Gmail + Sheets + Drive)

A single OAuth refresh token covers all three Google APIs.

| Var | Required by | Notes |
|---|---|---|
| `GMAIL_CLIENT_ID` | every handler that creates a Gmail draft, reads Sheets, or uploads to Drive | OAuth client ID |
| `GMAIL_CLIENT_SECRET` | same | OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | same | Long-lived refresh token. Single token; granted scopes must cover `gmail.compose`, `spreadsheets.readonly`, and `drive` (or sub-scope). Scope detail not in repo. |
| `GOOGLE_DRIVE_FOLDER_ID` | `automation_CONTRACT_invoicereceipt` only | Parent folder ID under which per-client subfolders are created |

> **Naming inconsistency:** the variable is `GMAIL_CLIENT_ID` etc. but it's actually the **Google** OAuth client used for Gmail + Sheets + Drive. Renaming would break the deployed function; documented as-is.

### PDF generation

| Var | Required by | Notes |
|---|---|---|
| `HTML2PDF_API_KEY` | `automation_CONTRACT_invoicereceipt` (×2 — invoice and receipt PDFs), `automation_CONTRACT_sendagreement` | API key for `https://api.html2pdf.app/v1/generate`. Third-party HTML→PDF service. |

## Frontend env vars

Vite-style (`import.meta.env`):

| Var | Used by | Purpose |
|---|---|---|
| `VITE_API_URL` | [DecidePage.jsx:4](src/pages/DecidePage.jsx) only | Override for the edge function URL. Falls back to hardcoded `https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api`. |

> **Inconsistency:** [PayPage.jsx:4](src/pages/PayPage.jsx) hardcodes the same URL with no env-var fallback. [src/lib/api.js:1](src/lib/api.js) also hardcodes. Only DecidePage honors the env var.

The hardcoded **anon key** is in [src/lib/api.js:2](src/lib/api.js) — not an env var. Rotating the anon key requires editing source + redeploying. The Supabase URL is similarly hardcoded.

## What's hardcoded that *could* be env vars

This list is observational, not prescriptive — these values currently live in source.

| Constant | Where | Value |
|---|---|---|
| `SUPERADMIN_EMAIL` | [admin-api:159](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `jlatham@elitert.com` |
| CEO email | several places, see [03-edge-functions.md](../architecture/03-edge-functions.md) | `aanderson@elitert.com` |
| Tracy reconciliation email | [admin-api:1626](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `tnmiller@elitert.com` |
| Tracy invoice CC | [admin-api:2104](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `tracy@vfo-services.com` |
| BCC list | many places | `aanderson@elitert.com`, `platham@elitert.com` |
| `From:` for sendagreement | [admin-api:4916](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `aipc@vfo-services.com` |
| `MASTER_SHEET_ID` | [admin-api:1324](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0` |
| BoldSign `BrandId` | [admin-api:4765](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `f6b2e092-73a4-438e-b786-ebd20e472732` |
| Pay-page URL prefix | [admin-api:980, 1119, 4237](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `https://jlathamert.github.io/vfo-portal/pay?token=...` |
| Stripe success URL | [admin-api:1120](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `https://www.vfo-services.com/payment-successful/` |
| GC success/cancel URLs | [admin-api:2815-2816](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `https://jlathamert.github.io/vfo-portal/?gc_success=1` and `/` |
| Frontend ANON_KEY | [src/lib/api.js:2](src/lib/api.js) | (committed JWT) |
| Hardcoded debug Gmail draft ID | [admin-api:2170](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts) | `r-8771745882155742140` (likely vestigial debug code) |

## Action → env vars matrix

Quick "what does this action need?" lookup:

| Action / handler | Env vars required |
|---|---|
| `admin_login`, `member_login`, `login`, plus all CRUD reads | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Stripe webhook handler ([admin-api:222](C:/vfo-edge-functions/supabase/functions/vfo-admin-api/index.ts)) | `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` (or sandbox), `SUPABASE_*` |
| `automation_PCADMIN_finaldecision` (No path only) | `GMAIL_*`, `SUPABASE_*` |
| `automation_PCADMIN_pricing`, `automation_PCADMIN_extrameeting` (Yes path) | `SUPABASE_*` (then chains) |
| `automation_PCADMIN_extrameeting` (No path) | `GMAIL_*`, `SUPABASE_*` |
| `automation_PIP1_reconfirmationemail` | `GMAIL_*`, `SUPABASE_*` |
| `automation_PIPFU_decision` (Undecided/No path) | `GMAIL_*`, `SUPABASE_*` |
| `automation_CONTRACT_sendagreement` | `BOLDSIGN_API_KEY` (or sandbox), `HTML2PDF_API_KEY`, `GMAIL_*`, `SUPABASE_*` |
| `automation_CONTRACT_ceocountersign` | `BOLDSIGN_API_KEY` (or sandbox), `GMAIL_*`, `SUPABASE_*` |
| `automation_CONTRACT_stripecustomer` | `STRIPE_SECRET_KEY` (or sandbox), `SUPABASE_*` |
| `automation_CONTRACT_paymentemail` | `GMAIL_*`, `SUPABASE_*` |
| `automation_CONTRACT_loadpayment` | `SUPABASE_*` |
| `automation_CONTRACT_stripecheckout` | `STRIPE_SECRET_KEY` (or sandbox), `SUPABASE_*` |
| `automation_CONTRACT_confirmationemail` | `GMAIL_*`, `SUPABASE_*` |
| `automation_CONTRACT_invoicereceipt` | `HTML2PDF_API_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, `GMAIL_*`, `SUPABASE_*` |
| `automation_CONTRACT_revshare` | `STRIPE_SECRET_KEY` (or sandbox), `GMAIL_*` (Sheets+Gmail), `SUPABASE_*` |
| `gc_create_checkout` | `STRIPE_SECRET_KEY` (no sandbox), `SUPABASE_*` |
| `boldsign-webhook` (standalone) | `SUPABASE_*` only — chains into admin-api which carries the rest |

## Cross-references

- Per-integration deep-dives:
  - [stripe.md](stripe.md)
  - [boldsign.md](boldsign.md)
  - [gmail.md](gmail.md)
  - [google-sheets.md](google-sheets.md)
  - [google-drive.md](google-drive.md)
  - [supabase.md](supabase.md)
- Edge function structure: [../architecture/03-edge-functions.md](../architecture/03-edge-functions.md)
- Sandbox-mode mechanics: [../tables/pipeline.md#pipeline_sandbox_config](../tables/pipeline.md)
