import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf'

// Admin view of a specialist's vault (the documents in their
// specialist-documents/<expert_id>/ folder). Shown on the Vault tab of the
// Search Specialists detail. Admins can view, add, and remove documents.
export default function SpecialistAdminVault({ expertId }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await callApi('specialist_vault_admin_list', { expert_id: expertId })
      setFiles(d.general || [])
    } catch (e) { setError(e.message || 'Could not load vault') }
    setLoading(false)
  }
  useEffect(() => { if (expertId) load() }, [expertId])

  async function view(path) {
    try {
      const d = await callApi('specialist_vault_admin_download', { expert_id: expertId, path })
      if (d.url) window.open(d.url, '_blank', 'noopener')
    } catch (e) { setError(e.message || 'Could not open document') }
  }

  async function handleFiles(fileList) {
    const list = Array.from(fileList || [])
    if (!list.length) return
    setBusy(true); setError('')
    for (const file of list) {
      try {
        const d = await callApi('specialist_vault_admin_upload_url', { expert_id: expertId, filename: file.name })
        if (!d.signed_url) throw new Error(d.error || 'Could not start upload')
        const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file)
        const put = await fetch(d.signed_url, { method: 'PUT', headers: { 'x-upsert': 'true' }, body: fd })
        if (!put.ok) throw new Error('Upload failed')
      } catch (e) { setError(e.message || 'Upload failed') }
    }
    setBusy(false); load()
  }

  async function remove(path) {
    if (!window.confirm('Remove this document?')) return
    try { await callApi('specialist_vault_admin_delete', { expert_id: expertId, path }); load() }
    catch (e) { setError(e.message || 'Could not remove') }
  }

  const fmtSize = (n) => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`

  return (
    <div style={{ background: '#eef2f9', border: '1px solid #ebf0f8', borderRadius: '12px', padding: '22px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#16264a' }}>General Documentation</div>
      <p style={{ fontSize: '12px', color: '#4e6087', marginBottom: '16px' }}>Documents in this specialist's portal vault (Due Diligence files + anything they've added). You can add or remove documents here.</p>
      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
      {loading ? (
        <div style={{ color: '#4e6087', fontSize: '13px' }}>Loading…</div>
      ) : (
        <>
          {files.length === 0 && <div style={{ color: '#697a9c', fontSize: '13px', marginBottom: '12px' }}>No documents yet.</div>}
          {files.map(f => (
            <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#ffffff', border: '1px solid #ebf0f8', borderRadius: '8px', marginBottom: '8px' }}>
              <span>📄</span>
              <span style={{ fontSize: '13px', color: '#243757', flex: 1 }}>{f.name}</span>
              <span style={{ fontSize: '11px', color: '#697a9c' }}>{fmtSize(f.size)}</span>
              <button onClick={() => view(f.path)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600, cursor: 'pointer' }}>View</button>
              <button onClick={() => remove(f.path)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
          <label style={{ display: 'block', textAlign: 'center', cursor: busy ? 'wait' : 'pointer', marginTop: '10px', padding: '16px', borderRadius: '8px', border: '1px dashed #c7d4e8', background: '#eef2f9' }}>
            <input type="file" multiple accept={ACCEPT} disabled={busy} style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
            <span style={{ fontSize: '13px', color: '#4e6087' }}>{busy ? 'Uploading…' : '+ Add document'}</span>
          </label>
        </>
      )}
    </div>
  )
}
