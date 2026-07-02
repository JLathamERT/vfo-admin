import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { fileSizeError } from '../../lib/fileUpload'
import { VaultRowsSkeleton } from './Skeleton'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf'

// The standard two-section vault layout, shared by the client, specialist and
// member vaults so they all look identical. Callers can override `sections`
// (e.g. the admin specialist view uses more descriptive hints).
export const DEFAULT_VAULT_SECTIONS = [
  { key: 'sensitive', title: 'Tax Documents', hint: 'Tax returns and other confidential documents. Stored in a private, encrypted vault.' },
  { key: 'general', title: 'General Documentation', hint: 'Any other documents you would like to share with your VFO team.' },
]

// Reusable document vault. `actions` supplies the four callApi action names
// ({ list, uploadUrl, download, delete }); `params` is merged into every request
// (e.g. { member_number } for the member vault, {} for session-scoped vaults).
export default function VaultSections({ actions, params = {}, sections = DEFAULT_VAULT_SECTIONS }) {
  const [data, setData] = useState(() => Object.fromEntries(sections.map(s => [s.key, []])))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const paramsKey = JSON.stringify(params)

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await callApi(actions.list, { ...params })
      setData(Object.fromEntries(sections.map(s => [s.key, d[s.key] || []])))
    } catch (e) { setError(e.message || 'Could not load the vault') }
    setLoading(false)
  }
  useEffect(() => { load() }, [actions.list, paramsKey])

  async function handleFiles(section, fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setBusy(section); setError('')
    for (const file of files) {
      const tooBig = fileSizeError(file)
      if (tooBig) { setError(tooBig); continue }
      try {
        const d = await callApi(actions.uploadUrl, { ...params, section, filename: file.name })
        if (!d.signed_url) throw new Error(d.error || 'Could not start upload')
        const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file)
        const put = await fetch(d.signed_url, { method: 'PUT', headers: { 'x-upsert': 'true' }, body: fd })
        if (!put.ok) throw new Error('Upload failed')
      } catch (e) { setError(e.message || 'Upload failed') }
    }
    setBusy(''); load()
  }

  async function view(section, path) {
    try {
      const d = await callApi(actions.download, { ...params, section, path })
      if (d.url) window.open(d.url, '_blank', 'noopener')
    } catch (e) { setError(e.message || 'Could not open document') }
  }

  async function remove(section, path) {
    if (!window.confirm('Remove this document?')) return
    try { await callApi(actions.delete, { ...params, section, path }); load() }
    catch (e) { setError(e.message || 'Could not remove') }
  }

  const fmtSize = (n) => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`

  return (
    <div>
      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '14px' }}>{error}</div>}
      {sections.map(sec => (
        <div key={sec.key} style={{ background: 'var(--vfo-tint)', border: '1px solid var(--vfo-tint-deep)', borderRadius: '12px', padding: '22px', marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{sec.title}</div>
          <p style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginBottom: '16px' }}>{sec.hint}</p>

          {loading ? (
            <VaultRowsSkeleton rows={2} />
          ) : (
            <>
              {(data[sec.key] || []).length === 0 && <div style={{ color: 'var(--vfo-muted)', fontSize: '13px', marginBottom: '12px' }}>No documents yet.</div>}
              {(data[sec.key] || []).map(f => (
                <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-tint-deep)', borderRadius: '8px', marginBottom: '8px' }}>
                  <span>📄</span>
                  <span style={{ fontSize: '13px', color: 'var(--vfo-ink-2)', flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>{fmtSize(f.size)}</span>
                  <button onClick={() => view(sec.key, f.path)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600, cursor: 'pointer' }}>View</button>
                  <button onClick={() => remove(sec.key, f.path)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
              <label style={{ display: 'block', textAlign: 'center', cursor: busy === sec.key ? 'wait' : 'pointer', marginTop: '10px', padding: '16px', borderRadius: '8px', border: '1px dashed var(--vfo-border-mid)', background: 'var(--vfo-tint)' }}>
                <input type="file" multiple accept={ACCEPT} disabled={busy === sec.key} style={{ display: 'none' }} onChange={e => { handleFiles(sec.key, e.target.files); e.target.value = '' }} />
                <span style={{ fontSize: '13px', color: 'var(--vfo-muted)' }}>{busy === sec.key ? 'Uploading…' : '+ Add document'}</span>
              </label>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
