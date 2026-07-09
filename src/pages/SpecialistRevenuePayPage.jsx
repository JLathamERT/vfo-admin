import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Public, no-login page reached from the specialist's "Payment request" email.
// ACH-only: there is no method choice — once the request loads (and isn't already
// paid), the page goes straight to the Stripe ACH checkout.
export default function SpecialistRevenuePayPage() {
  const [searchParams] = useSearchParams()
  const kind = searchParams.get('kind')
  const isRecurring = kind === 'recurring'
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
        body: JSON.stringify({ action: isRecurring ? 'specialist_revenue_recurring_pay_load' : 'specialist_revenue_pay_load', token }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); setStatus('error'); return }
      setData(d)
      if (isRecurring) {
        if (d.canceled) { setStatus('recurring_canceled'); return }
        if (d.already_active) { setStatus('recurring_active'); return }
        setStatus('ready')
        return
      }
      if (d.already_paid) { setStatus('done'); return }
      // ACH-only, but land on a review screen instead of auto-redirecting —
      // Stripe's back button returns here, and an auto-redirect would loop.
      setStatus('ready')
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
        body: JSON.stringify(isRecurring
          ? { action: 'specialist_revenue_recurring_checkout', token: searchParams.get('token') }
          : { action: 'specialist_revenue_checkout', token: searchParams.get('token'), method }),
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

  if (status === 'recurring_active') return (
    <TokenShell maxWidth={520}>
      <div style={messageCardStyle}>
        <div style={{ ...iconCircleStyle, background: 'rgba(34,197,94,0.15)' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>✓</span>
        </div>
        <h1 style={titleStyle}>Recurring Payment Active</h1>
        <p style={subtitleStyle}>Your recurring payment is already set up — no action needed.</p>
      </div>
    </TokenShell>
  )

  if (status === 'recurring_canceled') return (
    <TokenShell maxWidth={520}>
      <div style={messageCardStyle}>
        <div style={{ ...iconCircleStyle, background: '#6b728020' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>—</span>
        </div>
        <h1 style={titleStyle}>Plan Cancelled</h1>
        <p style={subtitleStyle}>This recurring payment plan has been cancelled.</p>
      </div>
    </TokenShell>
  )

  if (isRecurring) {
    const monthlyFmt = `$${(Number(data?.monthly_amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const dayOrd = ordinal(data?.charge_day)
    return (
      <TokenShell maxWidth={520}>
        <div style={messageCardStyle}>
          <h1 style={titleStyle}>Recurring Specialist Payment</h1>
          <p style={subtitleStyle}>Recurring payment authorization for VFO Services (working with ERT){data?.specialist_name ? ` for ${data.specialist_name}` : ''}.</p>
          <div style={{ fontSize: '34px', fontWeight: 800, color: 'var(--vfo-heading)', margin: '18px 0 6px' }}>{monthlyFmt}<span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--vfo-muted)' }}> / mo</span></div>
          <p style={{ ...subtitleStyle, marginBottom: '24px' }}>Billed automatically by ACH on the {dayOrd} of each month. First charge on the next {dayOrd} after setup.</p>
          <button type="button" onClick={() => handleChoice('ach')}
            style={{ padding: '14px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Set up recurring ACH payment
          </button>
        </div>
      </TokenShell>
    )
  }

  const amountFmt = `$${(Number(data?.gross_amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <TokenShell maxWidth={520}>
      <div style={messageCardStyle}>
        <h1 style={titleStyle}>Specialist Payment</h1>
        <p style={subtitleStyle}>Payment request from VFO Services (working with ERT){data?.specialist_name ? ` for ${data.specialist_name}` : ''}.</p>
        <div style={{ fontSize: '34px', fontWeight: 800, color: 'var(--vfo-heading)', margin: '18px 0 6px' }}>{amountFmt}</div>
        <p style={{ ...subtitleStyle, marginBottom: '24px' }}>Paid by ACH bank transfer — no processing fee. You will be taken to Stripe's secure page to link your bank account and authorize the payment.</p>
        <button type="button" onClick={() => handleChoice('ach')}
          style={{ padding: '14px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Continue to secure payment
        </button>
      </div>
    </TokenShell>
  )
}

function ordinal(n) {
  const v = Number(n) || 0
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`
}

const messageCardStyle = { textAlign: 'center', padding: '12px 0' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const subtitleStyle = { fontSize: '14px', color: 'var(--vfo-muted)' }
