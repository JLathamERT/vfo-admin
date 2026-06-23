import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Public, no-login page reached from the migration "set up your payment method" email
// (clients moved off QBO who aren't on Stripe yet). They enter a card or bank on
// Stripe's hosted setup page (mode:'setup', NO charge); the card_update webhook then
// saves it so the engine can charge their scheduled payments. We never see the numbers.
export default function ConnectCardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const justDone = searchParams.get('done') === '1'
  const [status, setStatus] = useState('loading') // loading | ready | error | redirecting
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!token) { setError('This setup link is invalid.'); setStatus('error'); return }
    load(token)
  }, [])

  async function load(tok) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migration_connect_load', token: tok }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); setStatus('error'); return }
      setData(d)
      setStatus('ready')
    } catch {
      setError('Failed to load your details.')
      setStatus('error')
    }
  }

  async function choose(method) {
    setStatus('redirecting')
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migration_connect_checkout', token, method }),
      })
      const d = await res.json()
      if (d.url) { window.location.href = d.url; return }
      setError(d.error || 'Could not start the setup.')
      setStatus('error')
    } catch {
      setError('Could not start the setup.')
      setStatus('error')
    }
  }

  if (status === 'loading') return (
    <TokenShell><p style={centerMuted}>Loading…</p></TokenShell>
  )
  if (status === 'redirecting') return (
    <TokenShell><p style={centerMuted}>Redirecting to Stripe…</p></TokenShell>
  )
  if (status === 'error') return (
    <TokenShell maxWidth={520}>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <h1 style={titleStyle}>Something went wrong</h1>
        <p style={subtitleStyle}>{error}</p>
      </div>
    </TokenShell>
  )

  const done = justDone || data?.done
  return (
    <TokenShell maxWidth={540}>
      <div style={{ width: '100%' }}>
        <h1 style={{ ...titleStyle, fontSize: '22px', textAlign: 'center', marginBottom: '6px' }}>Set Up Your Payment Method</h1>
        {data?.client_name && (
          <p style={{ ...subtitleStyle, textAlign: 'center', marginBottom: '20px' }}>{data.client_name} · {data.label}</p>
        )}

        {done ? (
          <div style={{ marginTop: '8px', padding: '16px 18px', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '12px', color: '#0f7a3d', fontSize: '14px', textAlign: 'center' }}>
            You're all set — your payment method is saved. Your scheduled payments will run automatically. You can close this page.
          </div>
        ) : (
          <>
            <p style={{ ...subtitleStyle, textAlign: 'center', marginBottom: '20px', fontSize: '13px', color: '#64748b' }}>
              Add the card or bank account for your VFO Services payments. There is no charge for setting this up.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button style={choiceBtn} onClick={() => choose('card')}>Use a Card</button>
              <button style={{ ...choiceBtn, background: '#fff', color: '#125ecc', border: '1.5px solid #125ecc' }} onClick={() => choose('ach')}>Use a Bank Account</button>
            </div>
          </>
        )}

        <p style={securityNote}>
          Your details are entered directly with Stripe.<br />
          VFO Services never sees or stores your card or bank information.
        </p>
      </div>
    </TokenShell>
  )
}

const centerMuted = { color: '#4e6087', fontSize: '15px', textAlign: 'center', margin: 0 }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: '#16264a', marginBottom: '12px' }
const subtitleStyle = { fontSize: '14px', color: '#4e6087', margin: 0 }
const choiceBtn = {
  background: '#125ecc', color: '#fff', border: '1.5px solid #125ecc', borderRadius: '10px',
  padding: '10px 18px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const securityNote = {
  textAlign: 'center', color: '#4e6087', fontSize: '12px', marginTop: '24px', lineHeight: 1.6,
}
