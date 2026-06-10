import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf'

// Mint a one-time signed upload url (token-gated), then PUT the bytes straight
// to the private client-tax-returns bucket. Mirrors the Specialist DDC pattern.
async function uploadFile(token, file) {
  const r1 = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vault_tax_upload_url', token, filename: file.name }),
  })
  const d1 = await r1.json()
  if (!r1.ok || !d1.success || !d1.signed_url) throw new Error(d1.error || 'Could not start upload')
  const fd = new FormData()
  fd.append('cacheControl', '3600')
  fd.append('', file)
  const put = await fetch(d1.signed_url, { method: 'PUT', headers: { 'x-upsert': 'true' }, body: fd })
  if (!put.ok) throw new Error('Upload failed — please try again')
  return { path: d1.path, name: file.name, size: file.size }
}

export default function TaxUploadPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [uploaded, setUploaded] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)

  async function handleFiles(fileList) {
    if (!token) { setError('This link is invalid or missing its token.'); return }
    const files = Array.from(fileList || [])
    if (!files.length) return
    setBusy(true); setError('')
    for (const file of files) {
      try {
        const ref = await uploadFile(token, file)
        setUploaded(u => [...u, ref])
      } catch (e) { setError(e.message || 'Upload failed') }
    }
    setBusy(false)
  }

  const card = { background: '#eef2f9', border: '1px solid #dde5f2', borderRadius: '12px', padding: '28px' }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fd', color: '#16264a', fontFamily: 'Inter, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '26px', marginBottom: '4px' }}>VFO Portal</div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '18px 0 6px' }}>Upload Your Tax Documents</h1>
        <p style={{ color: '#4e6087', fontSize: '14px', lineHeight: 1.5, marginBottom: '22px' }}>
          Your documents are stored securely in a private, encrypted vault — only authorized VFO tax staff can open them.
        </p>

        {!token ? (
          <div style={{ ...card, color: '#e74c3c' }}>This upload link is invalid or missing its token. Please use the link from your email.</div>
        ) : (
          <>
            <label
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
              style={{
                ...card, display: 'block', textAlign: 'center', cursor: 'pointer',
                borderStyle: 'dashed', borderColor: drag ? '#0095ff' : '#c7d4e8',
                background: drag ? 'rgba(0,149,255,0.08)' : '#eef2f9',
              }}
            >
              <input type="file" multiple accept={ACCEPT} style={{ display: 'none' }}
                onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{busy ? 'Uploading…' : 'Drop files here or click to choose'}</div>
              <div style={{ fontSize: '12px', color: '#4e6087' }}>PDF, Word, Excel or images</div>
            </label>

            {error && <div style={{ color: '#e74c3c', fontWeight: 500, fontSize: '13px', marginTop: '12px' }}>{error}</div>}

            {uploaded.length > 0 && (
              <div style={{ marginTop: '22px' }}>
                <div style={{ fontSize: '12px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Uploaded ({uploaded.length})</div>
                {uploaded.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(27,146,84,0.1)', border: '1px solid rgba(27,146,84,0.25)', borderRadius: '8px', marginBottom: '8px' }}>
                    <span style={{ color: '#1b9254' }}>✓</span>
                    <span style={{ fontSize: '13px' }}>{f.name}</span>
                  </div>
                ))}
                <p style={{ color: '#4e6087', fontSize: '13px', marginTop: '12px' }}>
                  Thank you — your tax documents have been received. You can close this page or add more files at any time using the same link.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
