import VaultSections from '../shared/VaultSections'

const CLIENT_VAULT_ACTIONS = {
  list: 'client_vault_list',
  uploadUrl: 'client_vault_upload_url',
  download: 'client_vault_download',
  delete: 'client_vault_delete',
  uploadNotify: 'client_vault_upload_notify',
}

export default function ClientVault() {
  return <VaultSections actions={CLIENT_VAULT_ACTIONS} />
}
