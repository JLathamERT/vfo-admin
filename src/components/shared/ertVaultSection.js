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

// Admin view — full manage, routed through admin_ert_* with { entity, key }.
export function ertAdminSection(entity, key, ownerNoun = 'person') {
  return {
    key: 'ert',
    title: ERT_TITLE,
    hint: `ERT / VFO documents for this ${ownerNoun}. Only admins can add or remove; the ${ownerNoun} can only view them.`,
    actions: ERT_ADMIN_ACTIONS,
    params: { entity, key },
  }
}
