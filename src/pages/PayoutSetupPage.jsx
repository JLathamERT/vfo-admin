import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Public, no-login page reached from the 4 "Set Up Payment Details" payout emails
// (members, specialists, strategic groups, tax planning groups). The link is
// durable — on every visit the backend mints a FRESH Stripe account-onboarding
// link and we redirect to it, so a second click never dead-ends. Stripe's own
// mid-flow expiry loops back here (refresh_url) and gets a new link. We never see
// any bank/card details.
export default function PayoutSetupPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const justDone = searchParams.get('done') === '1'
  const [status, setStatus] = useState(justDone ? 'done' : (token ? 'redirecting' : 'error'))
  const [error, setError] = useState(token ? '' : 'This setup link is not valid. Please contact VFO Services for a new link.')

  useEffect(() => {
    if (justDone || !token) return
    go(token)
  }, [])

  async function go(tok) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_setup_link', token: tok }),
      })
      const d = await res.json()
      if (d.url) { window.location.replace(d.url); return }
      setError(d.error || 'This setup link is not valid. Please contact VFO Services for a new link.')
      setStatus('error')
    } catch {
      setError('Could not start the setup. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'done') return (
    <TokenShell maxWidth={520}>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <h1 style={titleStyle}>Payment details submitted</h1>
        <p style={subtitleStyle}>Thanks - your information was securely submitted to Stripe. You can close this page.</p>
      </div>
    </TokenShell>
  )
  if (status === 'error') return (
    <TokenShell maxWidth={520}>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <h1 style={titleStyle}>Something went wrong</h1>
        <p style={subtitleStyle}>{error}</p>
        <p style={{ ...subtitleStyle, marginTop: '10px', fontSize: '13px', color: 'var(--vfo-muted)' }}>
          If you keep seeing this message, reply to the setup email and we will send you a fresh link.
        </p>
      </div>
    </TokenShell>
  )
  return (
    <TokenShell>
      <p style={centerMuted}>Taking you to Stripe's secure payment setup...</p>
    </TokenShell>
  )
}

const centerMuted = { color: 'var(--vfo-muted)', fontSize: '15px', textAlign: 'center', margin: 0 }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const subtitleStyle = { fontSize: '14px', color: 'var(--vfo-muted)', margin: 0 }
