import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf'
const fmtSize = (n) => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`

// Admin Vault tab. Two sections:
//  - Sensitive (tax returns): every admin sees titles; only allowlisted admins
//    (canView) can open/add/delete (server-gated).
//  - General Documentation: all admins can view/add/delete.
export default function ClientVaultTab({ clientId, sectionStyle }) {
  const [sensitive, setSensitive] = useState([])
  const [canView, setCanView] = useState(false)
  const [general, setGeneral] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [tax, gen] = await Promise.all([
        callApi('vault_tax_list', { client_id: clientId }),
        callApi('vault_gen_list', { client_id: clientId }),
      ])
      setSensitive(tax.files || []); setCanView(!!tax.can_view)
      setGeneral(gen.files || [])
    } catch (e) { setError(e.message || 'Could not load vault') }
    setLoading(false)
  }
  useEffect(() => { load() }, [clientId])

  async function view(actions, path) {
    try { const d = await callApi(actions.download, { client_id: clientId, path }); if (d.url) window.open(d.url, '_blank', 'noopener') }
    catch (e) { setError(e.message || 'Could not open document') }
  }
  async function remove(actions, path) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    try { await callApi(actions.delete, { client_id: clientId, path }); load() }
    catch (e) { setError(e.message || 'Could not delete') }
  }
  async function handleFiles(sec, actions, fileList) {
    const list = Array.from(fileList || [])
    if (!list.length) return
    setBusy(sec); setError('')
    for (const file of list) {
      try {
        const d = await callApi(actions.upload, { client_id: clientId, filename: file.name })
        if (!d.signed_url) throw new Error(d.error || 'Could not start upload')
        const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file)
        const put = await fetch(d.signed_url, { method: 'PUT', headers: { 'x-upsert': 'true' }, body: fd })
        if (!put.ok) throw new Error('Upload failed')
      } catch (e) { setError(e.message || 'Upload failed') }
    }
    setBusy(''); load()
  }

  const SECTIONS = [
    {
      key: 'sensitive', title: 'Sensitive Documents', sub: '(tax returns)', files: sensitive, canManage: canView,
      blurb: canView
        ? 'Stored in a private vault. You have access to view, add and remove these documents.'
        : 'Stored in a private vault. You can see what has been uploaded, but only authorized tax staff can open these documents.',
      actions: { download: 'vault_tax_download', delete: 'vault_tax_delete', upload: 'vault_tax_admin_upload_url' },
    },
    {
      key: 'general', title: 'General Documentation', sub: '', files: general, canManage: true,
      blurb: 'Everyday client documents. All admins can view, add and remove these.',
      actions: { download: 'vault_gen_download', delete: 'vault_gen_delete', upload: 'vault_gen_upload_url' },
    },
  ]

  return (
    <>
      {error && <div style={{ color: '#e74c3c', fontWeight: 500, fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
      {SECTIONS.map(sec => (
        <div key={sec.key} style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{sec.title} {sec.sub && <span style={{ textTransform: 'none', fontSize: '12px' }}>{sec.sub}</span>}</div>
          <p style={{ fontSize: '12px', color: '#697a9c', marginBottom: '16px' }}>{sec.blurb}</p>

          {loading ? <div style={{ color: '#4e6087', fontSize: '13px' }}>Loading…</div> : (
            <>
              {sec.files.length === 0 && <div style={{ color: '#697a9c', fontSize: '13px', marginBottom: '14px' }}>No documents uploaded yet.</div>}
              {sec.files.map(f => (
                <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f7f9fc', border: '1px solid #ebf0f8', borderRadius: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{sec.canManage ? '📄' : '🔒'}</span>
                  <span style={{ fontSize: '13px', color: '#243757', flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: '11px', color: '#697a9c' }}>{fmtSize(f.size)}</span>
                  {sec.canManage ? (
                    <>
                      <button onClick={() => view(sec.actions, f.path)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600, cursor: 'pointer' }}>View</button>
                      <button onClick={() => remove(sec.actions, f.path)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    </>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#697a9c', fontStyle: 'italic' }}>locked</span>
                  )}
                </div>
              ))}
              {sec.canManage && (
                <label style={{ display: 'block', textAlign: 'center', cursor: 'pointer', marginTop: '14px', padding: '18px', borderRadius: '8px', border: '1px dashed #c7d4e8', background: '#f8fafd' }}>
                  <input type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={e => { handleFiles(sec.key, sec.actions, e.target.files); e.target.value = '' }} />
                  <span style={{ fontSize: '13px', color: '#4e6087' }}>{busy === sec.key ? 'Uploading…' : '+ Add document'}</span>
                </label>
              )}
            </>
          )}
        </div>
      ))}
    </>
  )
}
