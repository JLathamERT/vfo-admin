import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'

export default function MemberVault({ memberNumber }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  useEffect(() => { loadFiles() }, [memberNumber])

  async function loadFiles() {
    try {
      const data = await callApi('vault_list', { member_number: memberNumber })
      setFiles(data.files || [])
    } catch (err) { console.error(err) }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await callApi('vault_upload', { member_number: memberNumber, filename: file.name, file_base64: base64, content_type: file.type })
      setStatusType('success'); setStatus('File uploaded!')
      setTimeout(() => setStatus(''), 4000)
      loadFiles()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
    finally { setUploading(false) }
  }

  async function deleteFile(filename) {
    try {
      await callApi('vault_delete', { member_number: memberNumber, filename })
      loadFiles()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>The Vault</div>
        <p style={{ color: '#8bacc8', fontSize: '13px', marginBottom: '20px' }}>Upload and manage your files. Drag and drop or click to upload.</p>
        <label style={{ display: 'block', border: '2px dashed rgba(255,255,255,0.25)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '20px' }}>
          <p style={{ color: '#8bacc8', fontSize: '14px', marginBottom: '8px' }}>Drag files here or click to browse</p>
          <p style={{ color: '#5a8ab5', fontSize: '12px' }}>Max 50MB per file</p>
          <input type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
        </label>
        {uploading && <p style={{ color: '#8bacc8', fontSize: '14px' }}>Uploading...</p>}
        {status && <p style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px' }}>{status}</p>}
      </div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Your Files</div>
        {files.length === 0
          ? <p style={{ color: '#5a8ab5', fontSize: '14px' }}>No files uploaded yet.</p>
          : files.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: '14px', color: '#fff' }}>{f.name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', color: '#8bacc8', fontSize: '12px', textDecoration: 'none' }}>Download</a>
                <button onClick={() => deleteFile(f.name)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}