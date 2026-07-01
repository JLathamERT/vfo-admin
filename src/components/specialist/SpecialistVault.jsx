import VaultSections from '../shared/VaultSections'

// The specialist vault now mirrors the client vault: a General section (which
// also holds the Due Diligence files copied in on go-live) plus a Tax Documents
// section the specialist can add to after logging in.
const SPECIALIST_VAULT_ACTIONS = {
  list: 'specialist_vault_list',
  uploadUrl: 'specialist_vault_upload_url',
  download: 'specialist_vault_download',
  delete: 'specialist_vault_delete',
}

export default function SpecialistVault() {
  return <VaultSections actions={SPECIALIST_VAULT_ACTIONS} />
}
