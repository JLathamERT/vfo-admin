import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

// Admin read-only view of a specialist's vault (the documents in their
// specialist-documents/<expert_id>/ folder). Shown on the Vault tab of the
// Search Specialists detail.
export default function SpecialistAdminVault({ expertId }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
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

  const fmtSize = (n) => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`

  return (
    <div style={{ background: '#eef2f9', border: '1px solid #ebf0f8', borderRadius: '12px', padding: '22px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#16264a' }}>General Documentation</div>
      <p style={{ fontSize: '12px', color: '#4e6087', marginBottom: '16px' }}>Documents in this specialist's portal vault (Due Diligence files + anything they've added).</p>
      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
      {loading ? (
        <div style={{ color: '#4e6087', fontSize: '13px' }}>Loading…</div>
      ) : files.length === 0 ? (
        <div style={{ color: '#697a9c', fontSize: '13px' }}>No documents yet.</div>
      ) : (
        files.map(f => (
          <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#ffffff', border: '1px solid #ebf0f8', borderRadius: '8px', marginBottom: '8px' }}>
            <span>📄</span>
            <span style={{ fontSize: '13px', color: '#243757', flex: 1 }}>{f.name}</span>
            <span style={{ fontSize: '11px', color: '#697a9c' }}>{fmtSize(f.size)}</span>
            <button onClick={() => view(f.path)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600, cursor: 'pointer' }}>View</button>
          </div>
        ))
      )}
    </div>
  )
}
