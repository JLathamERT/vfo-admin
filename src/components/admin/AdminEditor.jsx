import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'

export default function AdminEditor({ onBack }) {
  const [admins, setAdmins] = useState([])
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPasscode, setNewPasscode] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAdmins() }, [])

  async function loadAdmins() {
    try {
      const data = await callApi('load_admins')
      setAdmins(data.admins || [])
    } catch (err) {
      showStatus('error', err.message)
    } finally {
      setLoading(false)
    }
  }

  function showStatus(type, msg) {
    setStatusType(type)
    setStatus(msg)
    setTimeout(() => setStatus(''), 4000)
  }

  async function createAdmin() {
    if (!newEmail || !newName || !newPasscode) { showStatus('error', 'All fields are required.'); return }
    try {
      await callApi('create_admin', { email: newEmail, name: newName, passcode: newPasscode })
      setNewEmail(''); setNewName(''); setNewPasscode('')
      showStatus('success', 'Admin created!')
      loadAdmins()
    } catch (err) { showStatus('error', err.message) }
  }

  async function deleteAdmin(email) {
    try {
      await callApi('delete_admin', { email })
      showStatus('success', 'Admin removed.')
      loadAdmins()
    } catch (err) { showStatus('error', err.message) }
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Add Admin</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" style={inputStyle} />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" style={inputStyle} />
          <input value={newPasscode} onChange={e => setNewPasscode(e.target.value)} placeholder="Passcode" style={inputStyle} />
        </div>
        <button onClick={createAdmin} style={{ padding: '10px 24px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
          Create Admin
        </button>
        {status && <p style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
      </div>

      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Current Admins</div>
        {loading && <p style={{ color: '#8bacc8', fontSize: '14px' }}>Loading...</p>}
        {admins.map(admin => (
          <div key={admin.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <span style={{ fontSize: '14px', color: '#fff' }}>{admin.name}</span>
              <span style={{ fontSize: '13px', color: '#8bacc8', marginLeft: '12px' }}>{admin.email}</span>
            </div>
            <button onClick={() => deleteAdmin(admin.email)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '12px', cursor: 'pointer' }}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}