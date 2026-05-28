import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

export default function MemberSetupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setError('Invalid setup link — missing token.'); setStatus('error'); return }
    loadSetup(token)
  }, [])

  async function loadSetup(token) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation_ADVISOR_loadloginsetup', token }),
      })
      const d = await res.json()
      if (d.state === 'ready') { setData(d); setStatus('ready'); return }
      if (d.state === 'already_setup') { setStatus('already_setup'); return }
      setError(d.error || 'This setup link is no longer valid.')
      setStatus('error')
    } catch {
      setError('Unable to connect. Please try again later.')
      setStatus('error')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (passcode.length < 6) { setError('Passcode must be at least 6 characters.'); return }
    if (passcode !== confirm) { setError('Passcodes do not match.'); return }

    setSubmitting(true)
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'automation_ADVISOR_submitloginsetup',
          token: searchParams.get('token'),
          passcode,
        }),
      })
      const d = await res.json()
      if (d.success) {
        navigate('/member/login', { state: { email: d.email, fromSetup: true } })
        return
      }
      if (d.state === 'already_setup') { setStatus('already_setup'); return }
      setError(d.error || 'Something went wrong. Please try again.')
    } catch {
      setError('Unable to connect. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') return (
    <div style={containerStyle}>
      <p style={{ color: '#94a3b8', fontSize: '15px' }}>Loading…</p>
    </div>
  )

  if (status === 'error') return (
    <div style={containerStyle}>
      <div style={messageCardStyle}>
        <div style={{ ...iconCircleStyle, background: '#ef444420' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>⚠️</span>
        </div>
        <h1 style={titleStyle}>Setup Link Error</h1>
        <p style={subtitleStyle}>{error}</p>
      </div>
    </div>
  )

  if (status === 'already_setup') return (
    <div style={containerStyle}>
      <div style={messageCardStyle}>
        <div style={{ ...iconCircleStyle, background: 'rgba(59,130,246,0.20)' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>ℹ️</span>
        </div>
        <h1 style={titleStyle}>Login Already Set Up</h1>
        <p style={subtitleStyle}>You already have a login for the member portal. Click below to sign in.</p>
        <button
          onClick={() => navigate('/member/login')}
          style={primaryButtonStyle}
        >
          Go to Login
        </button>
      </div>
    </div>
  )

  return (
    <div style={containerStyle}>
      <div style={pageContainerStyle}>
        <h1 style={{ ...titleStyle, fontSize: '22px', textAlign: 'center', marginBottom: '32px' }}>Set Up Your Member Portal Login</h1>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>Email</label>
          <input value={data.email} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />

          <label style={{ ...labelStyle, marginTop: '16px' }}>Passcode (min 6 characters)</label>
          <input
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: '16px' }}>Confirm Passcode</label>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            style={inputStyle}
          />

          {error && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, marginTop: '24px', opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Setting up…' : 'Set up my login'}
          </button>
        </form>

        <p style={securityNoteStyle}>
          After setup, you'll be taken to the member login page to sign in with your new passcode.
        </p>
      </div>
    </div>
  )
}

const containerStyle = { fontFamily: '"DM Sans", sans-serif', background: '#0a1628', color: '#e2e8f0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }
const pageContainerStyle = { maxWidth: '480px', width: '100%' }
const messageCardStyle = { textAlign: 'center', maxWidth: '480px', padding: '48px 32px' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '12px' }
const subtitleStyle = { fontSize: '14px', color: '#94a3b8', lineHeight: 1.6 }
const formStyle = { display: 'flex', flexDirection: 'column' }
const labelStyle = { fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }
const inputStyle = { padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', fontFamily: 'inherit' }
const primaryButtonStyle = { padding: '12px 24px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' }
const securityNoteStyle = { textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px', lineHeight: 1.6 }
