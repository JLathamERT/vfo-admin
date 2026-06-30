import VaultSections from './VaultSections'

// The member vault now mirrors the client vault: Tax Documents + General
// sections, signed-URL uploads. `memberNumber` scopes every request (the member
// portal passes the session member; the admin member view passes the selected
// member's number).
const MEMBER_VAULT_ACTIONS = {
  list: 'vault_list',
  uploadUrl: 'vault_upload_url',
  download: 'vault_download',
  delete: 'vault_delete',
}

export default function MemberVault({ memberNumber }) {
  return <VaultSections actions={MEMBER_VAULT_ACTIONS} params={{ member_number: memberNumber }} />
}
