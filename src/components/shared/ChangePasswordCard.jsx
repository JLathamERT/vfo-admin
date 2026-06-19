import { useState } from 'react'
import { callApi } from '../../lib/api'

// Self-service change-passcode card for the specialist + client portals. The
// action (specialist_update_login / client_update_login) is scoped server-side
// to the caller's own session — the body carries only the new passcode.
export default function ChangePasswordCard({ action }) {
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function save() {
    if (passcode.length < 6) { setMsg({ ok: false, text: 'Passcode must be at least 6 characters.' }); return }
    if (passcode !== confirm) { setMsg({ ok: false, text: 'Passcodes do not match.' }); return }
    setBusy(true); setMsg(null)
    try {
      const d = await callApi(action, { passcode })
      if (d.success) { setMsg({ ok: true, text: 'Passcode updated.' }); setPasscode(''); setConfirm('') }
      else setMsg({ ok: false, text: d.error || 'Could not update.' })
    } catch (e) { setMsg({ ok: false, text: e.message || 'Could not update.' }) }
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', background: '#fff', border: '1px solid #e9eef8', borderRadius: '16px', padding: '24px' }}>
      <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Change Passcode</div>
      <label style={labelStyle}>New Passcode (min 6 characters)</label>
      <input value={passcode} onChange={e => setPasscode(e.target.value)} type="password" autoComplete="new-password" style={inputStyle} />
      <label style={{ ...labelStyle, marginTop: '14px' }}>Confirm Passcode</label>
      <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" autoComplete="new-password" style={inputStyle} />
      {msg && <p style={{ fontSize: '13px', marginTop: '12px', marginBottom: 0, color: msg.ok ? '#1f9d55' : '#d93025' }}>{msg.text}</p>}
      <button onClick={save} disabled={busy} style={{ marginTop: '18px', padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Update Passcode'}</button>
    </div>
  )
}

const labelStyle = { fontSize: '13px', color: '#4e6087', marginBottom: '6px', fontWeight: 500, display: 'block' }
const inputStyle = { padding: '12px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
