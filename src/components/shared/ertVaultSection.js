// The "ERT/VFOS Documentation" third vault section. It is admin-managed and
// READ-ONLY for the member/client/specialist:
//   • Owner (portal) side  → ertReadOnlySection(): View only. Its files come
//     from the shared vault list (which now returns an `ert` array) and open via
//     the shared download (which routes section='ert'). No upload / Remove.
//   • Admin side → ertAdminSection(entity, key): full add / view / remove,
//     routed through the unified admin_ert_* actions keyed by { entity, key }.
//     Drop it into a VaultSections `sections` array; the file LIST is served by
//     that VaultSections' `actions.list` (vault_list / specialist_vault_admin_list
//     already return `ert`, or admin_ert_list for the bespoke client admin tab).

const ERT_TITLE = 'ERT/VFOS Documentation'

const ERT_ADMIN_ACTIONS = {
  download: 'admin_ert_download',
  uploadUrl: 'admin_ert_upload_url',
  delete: 'admin_ert_delete',
}

// Owner / portal view — view only.
export function ertReadOnlySection() {
  return {
    key: 'ert',
    title: ERT_TITLE,
    hint: 'Documents provided by your VFO / ERT team. You can view these; only your VFO team can add or remove them.',
    readOnly: true,
  }
}

// Admin view — routed through admin_ert_* with { entity, key }.
//
// canManage (2026-08-13) narrows ADD/REMOVE to the ERT-manager allowlist (Jake
// and Tray — constants/ert-access.ts, surfaced to the frontend as the login's
// is_ert_manager flag). Every other admin still gets the section and the View
// button; they just lose Remove and "+ Add document". Passing readOnly here is
// what does that, because VaultSections renders View unconditionally and gates
// only Remove + upload on readOnly. The server enforces this independently in
// admin_ert_upload_url / admin_ert_delete — this is UI, not the boundary.
export function ertAdminSection(entity, key, ownerNoun = 'person', canManage = true) {
  return {
    key: 'ert',
    title: ERT_TITLE,
    hint: canManage
      ? `ERT / VFO documents for this ${ownerNoun}. Only admins can add or remove; the ${ownerNoun} can only view them.`
      : `ERT / VFO documents for this ${ownerNoun}. You can view these; only authorized VFO staff can add or remove them.`,
    actions: ERT_ADMIN_ACTIONS,
    params: { entity, key },
    readOnly: !canManage,
  }
}
