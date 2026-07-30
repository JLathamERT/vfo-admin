import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { fileSizeError } from '../../lib/fileUpload'
import { VaultRowsSkeleton } from '../shared/Skeleton'
import RequestDocsButton from '../shared/RequestDocsButton'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf'
const fmtSize = (n) => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`

// Admin Vault tab. Two sections:
//  - Sensitive (tax returns): every admin sees titles; only allowlisted admins
//    (canView) can open/add/delete/SHARE (server-gated).
//  - General Documentation: all admins can view/add/delete/share.
// Each manageable file can be SHARED with specialists (Feature A): the specialist
// then sees it in their portal's "Shared with Me" tab. Revoke any time.
export default function ClientVaultTab({ clientId, sectionStyle, specialists = [], readOnly = false, recipientName, recipientFirst }) {
  const [sensitive, setSensitive] = useState([])
  const [canView, setCanView] = useState(false)
  const [general, setGeneral] = useState([])
  const [ert, setErt] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  // Sharing — one open share panel at a time, keyed `${bucket}|${path}`.
  const [shareKey, setShareKey] = useState(null)
  const [shares, setShares] = useState([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [tax, gen, ertRes] = await Promise.all([
        callApi('vault_tax_list', { client_id: clientId }),
        callApi('vault_gen_list', { client_id: clientId }),
        callApi('admin_ert_list', { entity: 'client', key: clientId }),
      ])
      setSensitive(tax.files || []); setCanView(!!tax.can_view)
      setGeneral(gen.files || [])
      setErt(ertRes.ert || [])
    } catch (e) { setError(e.message || 'Could not load vault') }
    setLoading(false)
  }
  useEffect(() => { load() }, [clientId])

  // The ERT/VFOS section is routed through the unified admin_ert_* actions
  // ({ entity, key }); the sensitive/general sections use their { client_id }
  // handlers. paramsFor picks the right shape per section.
  const paramsFor = (sec) => sec.key === 'ert' ? { entity: 'client', key: clientId } : { client_id: clientId }

  async function view(sec, path) {
    try { const d = await callApi(sec.actions.download, { ...paramsFor(sec), path }); if (d.url) window.open(d.url, '_blank', 'noopener') }
    catch (e) { setError(e.message || 'Could not open document') }
  }
  async function remove(sec, path) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    try { await callApi(sec.actions.delete, { ...paramsFor(sec), path }); load() }
    catch (e) { setError(e.message || 'Could not delete') }
  }
  async function handleFiles(sec, fileList) {
    const list = Array.from(fileList || [])
    if (!list.length) return
    setBusy(sec.key); setError('')
    for (const file of list) {
      const tooBig = fileSizeError(file)
      if (tooBig) { setError(tooBig); continue }
      try {
        const d = await callApi(sec.actions.upload, { ...paramsFor(sec), filename: file.name })
        if (!d.signed_url) throw new Error(d.error || 'Could not start upload')
        const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file)
        const put = await fetch(d.signed_url, { method: 'PUT', headers: { 'x-upsert': 'true' }, body: fd })
        if (!put.ok) throw new Error('Upload failed')
      } catch (e) { setError(e.message || 'Upload failed') }
    }
    setBusy(''); load()
  }

  // ─── Sharing ───
  async function fetchShares(bucket, path) {
    const d = await callApi('doc_shares_list', { bucket, object_path: path })
    setShares(d.shares || [])
  }
  async function toggleShare(bucket, path) {
    const key = `${bucket}|${path}`
    if (shareKey === key) { setShareKey(null); return }
    setShareKey(key); setShares([]); setSharesLoading(true); setError('')
    try { await fetchShares(bucket, path) }
    catch (e) { setError(e.message || 'Could not load shares') }
    setSharesLoading(false)
  }
  async function grant(bucket, path, expertId) {
    if (!expertId) return
    setShareBusy(true); setError('')
    try { await callApi('doc_share_grant', { bucket, object_path: path, client_id: clientId, expert_id: [Number(expertId)] }); await fetchShares(bucket, path) }
    catch (e) { setError(e.message || 'Could not share') }
    setShareBusy(false)
  }
  async function revoke(bucket, path, shareId) {
    setShareBusy(true); setError('')
    try { await callApi('doc_share_revoke', { share_id: shareId }); await fetchShares(bucket, path) }
    catch (e) { setError(e.message || 'Could not revoke') }
    setShareBusy(false)
  }

  const SECTIONS = [
    {
      key: 'sensitive', title: 'Sensitive Documents', sub: '(tax returns)', files: sensitive, canManage: canView, bucket: 'client-tax-returns', canRequestDocs: true,
      blurb: canView
        ? 'Stored in a private vault. You have access to view, add, remove and share these documents.'
        : 'Stored in a private vault. You can see what has been uploaded, but only authorized tax staff can open or share these documents.',
      actions: { download: 'vault_tax_download', delete: 'vault_tax_delete', upload: 'vault_tax_admin_upload_url' },
    },
    {
      key: 'general', title: 'General Documentation', sub: '', files: general, canManage: true, bucket: 'client-documents', canRequestDocs: true,
      blurb: 'Everyday client documents. All admins can view, add, remove and share these.',
      actions: { download: 'vault_gen_download', delete: 'vault_gen_delete', upload: 'vault_gen_upload_url' },
    },
    {
      key: 'ert', title: 'ERT/VFOS Documentation', sub: '', files: ert, canManage: true, bucket: 'client-ert-docs', noShare: true,
      blurb: 'ERT / VFO documents for this client. Only admins can add or remove; the client can only view them in their portal. Signed agreements land here automatically once paid.',
      actions: { download: 'admin_ert_download', delete: 'admin_ert_delete', upload: 'admin_ert_upload_url' },
    },
  ]

  const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--vfo-ink-2)', background: '#dce7fb', border: '1px solid var(--vfo-border-mid)', borderRadius: '999px', padding: '3px 6px 3px 11px' }

  return (
    <>
      {error && <div style={{ color: '#e74c3c', fontWeight: 500, fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
      {SECTIONS.map(sec => (
        <div key={sec.key} style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{sec.title} {sec.sub && <span style={{ textTransform: 'none', fontSize: '12px' }}>{sec.sub}</span>}</div>
          <p style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginBottom: '16px' }}>{sec.blurb}</p>

          {sec.canRequestDocs && sec.canManage && !readOnly && (
            <RequestDocsButton entityType="client" entityKey={clientId} section={sec.key} recipientName={recipientName} recipientFirst={recipientFirst} />
          )}

          {loading ? <VaultRowsSkeleton rows={2} /> : (
            <>
              {sec.files.length === 0 && <div style={{ color: 'var(--vfo-muted)', fontSize: '13px', marginBottom: '14px' }}>No documents uploaded yet.</div>}
              {sec.files.map(f => {
                const key = `${sec.bucket}|${f.path}`
                const open = shareKey === key
                const sharedIds = new Set(shares.map(s => String(s.expert_id)))
                return (
                  <div key={f.path} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-tint-deep)', borderRadius: open ? '8px 8px 0 0' : '8px' }}>
                      <span style={{ fontSize: '14px' }}>{sec.canManage ? '📄' : '🔒'}</span>
                      <span style={{ fontSize: '13px', color: 'var(--vfo-ink-2)', flex: 1 }}>{f.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>{fmtSize(f.size)}</span>
                      {sec.canManage ? (
                        <>
                          <button onClick={() => view(sec, f.path)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600, cursor: 'pointer' }}>View</button>
                          {!readOnly && !sec.noShare && <button onClick={() => toggleShare(sec.bucket, f.path)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(18,94,204,0.4)', background: open ? 'rgba(18,94,204,0.22)' : 'rgba(18,94,204,0.1)', color: '#125ecc', fontWeight: 600, cursor: 'pointer' }}>Share</button>}
                          {!readOnly && <button onClick={() => remove(sec, f.path)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', fontWeight: 600, cursor: 'pointer' }}>Delete</button>}
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--vfo-muted)', fontStyle: 'italic' }}>locked</span>
                      )}
                    </div>
                    {open && (
                      <div style={{ padding: '12px 14px', background: '#f7faff', border: '1px solid var(--vfo-tint-deep)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', fontWeight: 600, marginBottom: '8px' }}>Shared with specialists</div>
                        {sharesLoading ? <div style={{ fontSize: '12px', color: 'var(--vfo-muted)' }}>Loading…</div> : (
                          <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                              {shares.length === 0 && <span style={{ fontSize: '12px', color: 'var(--vfo-muted)', fontStyle: 'italic' }}>Not shared with anyone yet.</span>}
                              {shares.map(s => (
                                <span key={s.share_id} style={chipStyle}>
                                  {s.expert_name || `Specialist #${s.expert_id}`}
                                  {s.viewed && <span title="Opened by the specialist" style={{ color: '#1f9d55', fontWeight: 700 }}>✓</span>}
                                  <button onClick={() => revoke(sec.bucket, f.path, s.share_id)} disabled={shareBusy} title="Revoke access" style={{ border: 'none', background: 'transparent', color: '#e74c3c', cursor: shareBusy ? 'default' : 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>✕</button>
                                </span>
                              ))}
                            </div>
                            <select value="" disabled={shareBusy} onChange={e => grant(sec.bucket, f.path, e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--vfo-border-mid)', background: 'var(--vfo-card)', color: 'var(--vfo-ink-2)', minWidth: '230px', cursor: 'pointer' }}>
                              <option value="">+ Share with a specialist…</option>
                              {specialists.filter(e => !sharedIds.has(String(e.id))).map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {sec.canManage && !readOnly && (
                <label style={{ display: 'block', textAlign: 'center', cursor: 'pointer', marginTop: '14px', padding: '18px', borderRadius: '8px', border: '1px dashed var(--vfo-border-mid)', background: 'var(--vfo-tint)' }}>
                  <input type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={e => { handleFiles(sec, e.target.files); e.target.value = '' }} />
                  <span style={{ fontSize: '13px', color: 'var(--vfo-muted)' }}>{busy === sec.key ? 'Uploading…' : '+ Add document'}</span>
                </label>
              )}
            </>
          )}
        </div>
      ))}
    </>
  )
}
