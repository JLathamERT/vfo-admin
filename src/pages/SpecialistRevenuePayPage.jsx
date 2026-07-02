import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Public, no-login page reached from the specialist's "Payment request" email.
// ACH-only: there is no method choice — once the request loads (and isn't already
// paid), the page goes straight to the Stripe ACH checkout.
export default function SpecialistRevenuePayPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setError('Invalid payment link.'); setStatus('error'); return }
    loadPaymentData(token)
  }, [])

  async function loadPaymentData(token) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'specialist_revenue_pay_load', token }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); setStatus('error'); return }
      setData(d)
      if (d.already_paid) { setStatus('done'); return }
      // ACH-only: skip the decision page and head straight to Stripe.
      handleChoice('ach')
    } catch {
      setError('Failed to load payment details.')
      setStatus('error')
    }
  }

  async function handleChoice(method) {
    setStatus('redirecting')
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'specialist_revenue_checkout', token: searchParams.get('token'), method }),
      })
      const d = await res.json()
      if (d.url) { window.location.href = d.url; return }
      setError(d.error || 'Failed to create checkout session.')
      setStatus('error')
    } catch {
      setError('Failed to initiate payment.')
      setStatus('error')
    }
  }

  if (status === 'loading') return (
    <TokenShell>
      <p style={{ color: 'var(--vfo-muted)', fontSize: '15px', textAlign: 'center', margin: 0 }}>Loading payment details…</p>
    </TokenShell>
  )

  if (status === 'error') return (
    <TokenShell maxWidth={520}>
      <div style={messageCardStyle}>
        <div style={{ ...iconCircleStyle, background: '#ef444420' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>⚠️</span>
        </div>
        <h1 style={titleStyle}>Payment Error</h1>
        <p style={subtitleStyle}>{error}</p>
      </div>
    </TokenShell>
  )

  if (status === 'redirecting') return (
    <TokenShell>
      <p style={{ color: 'var(--vfo-muted)', fontSize: '15px', textAlign: 'center', margin: 0 }}>Redirecting to Stripe…</p>
    </TokenShell>
  )

  if (status === 'done') return (
    <TokenShell maxWidth={520}>
      <div style={messageCardStyle}>
        <div style={{ ...iconCircleStyle, background: 'rgba(34,197,94,0.15)' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>✓</span>
        </div>
        <h1 style={titleStyle}>Payment Received</h1>
        <p style={subtitleStyle}>This payment has already been received. Thank you — you can close this page.</p>
      </div>
    </TokenShell>
  )

  // ACH-only: any non-terminal state means we're on our way to Stripe.
  return (
    <TokenShell>
      <p style={{ color: 'var(--vfo-muted)', fontSize: '15px', textAlign: 'center', margin: 0 }}>Redirecting to Stripe…</p>
    </TokenShell>
  )
}

const messageCardStyle = { textAlign: 'center', padding: '12px 0' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const subtitleStyle = { fontSize: '14px', color: 'var(--vfo-muted)' }
