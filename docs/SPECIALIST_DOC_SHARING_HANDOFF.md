# Specialist Document Sharing — Build Handoff

**Status:** SPEC ONLY — not built. This doc fully specifies the next feature.
**Author:** prepared 2026-06-18 at the end of the security-remediation session (branch `claude/determined-booth-b568b1`).

---

## 1. The goal (in the client's words)

Let our team share **specific client tax documents** with **individual specialists**, viewable **inside the portal** — no emailing or downloading documents around. Concretely:

1. A client uploads a secure document (already works today).
2. A team member who can view that document **picks one or more specialists** and shares **that specific document** with them.
3. The specialist logs into their portal and gets a new **"Shared with Me"** tab: a **list of clients** → click a client → see **only the documents specifically shared with them** for that client → view each **in-portal** (never downloaded/emailed).

## 2. Decisions already locked by the client (do NOT re-litigate)

- **Per-DOCUMENT sharing**, NOT per-client. (Sharing client X's "2023 return" does NOT grant access to client X's other files.)
- **Revoke**: a team member can un-share any document from a specialist at any time.
- **Audit log**: record every share, revoke, AND every view (who / what / when) — this feeds the firm's compliance story.
- Specialist UI is a top-level **"Shared with Me"** tab: clients list → client → that client's shared-with-me documents.

## 3. What already exists (reuse these — do NOT rebuild)

- **Private buckets** (verified `public=false`, zero public storage policies → backend/service-role only): `client-tax-returns` (sensitive tax returns), `client-documents` (general). Files namespaced `"<client_id>/<rand>_<filename>"`.
- **Client upload** (signed upload URLs): public token page `/tax-upload` (`vault_tax_upload_url`, keyed on `clients.tax_upload_token`) + logged-in client `client_vault_upload_url` (section `sensitive`/`general`).
- **Admin view** (the exact signed-URL pattern to copy): `actions/.../vault_tax_download` mints a **300-second** signed download URL. Tax returns are allowlist-gated by `isTaxAdmin()` in `supabase/functions/vfo-admin-api/constants/tax-access.ts` (currently Jake / Tray / Paul — Tim Gacsy was removed 2026-07-21 after leaving). Any admin can list titles (`vault_tax_list`); only the allowlist can open/upload/delete.
- **Specialist portal** already exists end-to-end: `specialist_login` → session in `admin_sessions`, role `specialist`, `auth.callerSpecialistId` = `experts.id`. Specialists are fenced to `SPECIALIST_ALLOWED_ACTIONS` (`constants/role-gates.ts`) and today can only touch their OWN vault (`specialist_vault_list/upload_url/download/delete`, scoped to `callerSpecialistId`). **Mirror this scoping exactly.**
- **Specialist ↔ client link** (for the picker / sanity checks): `experts` (the specialist list), `specialist_logins` (`expert_id`), `client_tax_specialists` (`tax_plan_id`, `expert_id`), `client_tax_plans.implementing_specialist_id`.
- **The C2 ownership-guard pattern to copy**: `supabase/functions/vfo-admin-api/utils/client-ownership.ts` (`denyIfNotOwnClient`) — every specialist action must verify the caller actually owns/was-granted the thing, keyed on the **session** id, never a body value.

## 4. Proposed data model (2 new tables — RLS DENY-ALL from creation)

> **Lesson from this session (C1/H1): create every new table with RLS enabled + a `"Deny all access" USING(false)` policy in the SAME migration, then verify with an anon-key probe.** The whole DB is service-role-only; never leave a table reachable by the public anon key.

```sql
-- A grant: specialist X may view document Y (one row per shared document).
create table public.document_shares (
  id            bigint generated always as identity primary key,
  bucket        text not null,                 -- 'client-tax-returns' | 'client-documents'
  object_path   text not null,                 -- the exact storage key: "<client_id>/<rand>_<file>"
  client_id     bigint not null references public.clients(id),
  expert_id     bigint not null references public.experts(id),
  granted_by    text not null,                 -- admin email
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,                   -- null = active
  revoked_by    text
);
create index idx_document_shares_expert on public.document_shares (expert_id) where revoked_at is null;
create index idx_document_shares_object on public.document_shares (bucket, object_path);
alter table public.document_shares enable row level security;
create policy "Deny all access" on public.document_shares for all to public using (false);

-- Append-only audit log (shares, revokes, AND views).
create table public.document_access_log (
  id          bigint generated always as identity primary key,
  bucket      text,
  object_path text,
  client_id   bigint,
  expert_id   bigint,                           -- the specialist, when relevant
  actor       text not null,                    -- email or "specialist:<expert_id>"
  action      text not null,                    -- 'granted' | 'revoked' | 'viewed'
  at          timestamptz not null default now()
);
create index idx_document_access_log_client on public.document_access_log (client_id, at desc);
alter table public.document_access_log enable row level security;
create policy "Deny all access" on public.document_access_log for all to public using (false);
```

## 5. Proposed backend actions (`vfo-admin-api`)

**Admin side** (gate to `isTaxAdmin` for `client-tax-returns`; ADMIN_ONLY for `client-documents` — confirm in §7):
- `doc_share_grant` — body: `{ bucket, object_path, client_id, expert_id[] }`. Inserts a `document_shares` row per specialist + logs `'granted'`.
- `doc_share_revoke` — sets `revoked_at`/`revoked_by` + logs `'revoked'`.
- `doc_shares_list` — current active grants for a given document (to render the "shared with" + revoke UI).

**Specialist side** (add to `SPECIALIST_ALLOWED_ACTIONS`; EVERY one scoped to `auth.callerSpecialistId`, never a body `expert_id`):
- `specialist_shared_clients` — distinct clients that have ≥1 active share for THIS specialist.
- `specialist_shared_docs` — body: `{ client_id }`; active shares for THIS specialist + that client (titles only).
- `specialist_shared_download` — body: `{ share_id }`; **verify** the share row's `expert_id === auth.callerSpecialistId` AND `revoked_at is null`, then mint a 300s signed URL for that `bucket`/`object_path` + log `'viewed'`. **This ownership check is the whole ballgame — copy the `denyIfNot…` pattern.**

## 6. Proposed frontend (`vfo-react`)

- **Admin** (in the client's vault / tax-docs view): per-document "Share with specialist" control = multi-select from the specialists list → `doc_share_grant`; below it, the list of who it's shared with + a **Revoke** button each (`doc_shares_list` / `doc_share_revoke`).
- **Specialist portal**: NEW top-level **"Shared with Me"** tab → client list (`specialist_shared_clients`) → click a client → document list (`specialist_shared_docs`) → click a doc → open the signed URL in-portal (`specialist_shared_download`). Model the tab on the existing specialist vault UI.

## 7. Open questions to confirm with the client BEFORE building

1. **Which buckets?** Tax returns only (`client-tax-returns`), or general docs (`client-documents`) too?
2. **Who can share?** For tax returns: only the `isTaxAdmin` allowlist (Jake/Tray/Paul), or any admin?
3. **Notify the specialist** when something is shared (email / in-portal bell), or silent?
4. **Specialist list source** for the picker — all `experts`, or only experts that have a `specialist_logins` row (can actually log in)?

## 8. Suggested phasing (stop + verify after each)

1. Migration (2 tables, RLS deny-all) → verify anon-key probe returns `*/0`.
2. Backend admin grant/revoke/list + specialist list/list/download (with the ownership guard) → `deno check` + curl smoke (a specialist token must get 403 on a `share_id` that isn't theirs).
3. Admin share UI.
4. Specialist "Shared with Me" tab.
5. Deploy (backend + frontend, explicit approval each) + live test: share a doc → specialist sees only that doc → revoke → specialist loses access → check the audit log captured grant/view/revoke.

## 9. Non-negotiable security rules (carried from this session)

- New tables: RLS deny-all in the creating migration; verify with anon-key probe.
- Specialist actions: scope on `auth.callerSpecialistId`, re-check the grant server-side, never trust a body `expert_id`/`share_id` blindly (this is the C2 IDOR lesson).
- Signed URLs only, short-lived (300s), private buckets only — nothing becomes public.
- Log every view for the compliance/audit story.
- Per-deploy explicit approval; run `deno check` + the pipeline smoke gate after backend changes.
