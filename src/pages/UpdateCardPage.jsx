import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Public, no-login page reached from the admin-initiated "change payment method"
// email. Lists the person's reusable payments; each can be updated independently
// (different card/bank per item). The new method is entered on Stripe's hosted
// setup page (mode:'setup', no charge) — we never see the card/bank numbers.
export default function UpdateCardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const justUpdated = searchParams.get('updated') === '1'
  const [status, setStatus] = useState('loading') // loading | ready | error | redirecting
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!token) { setError('This update link is invalid.'); setStatus('error'); return }
    load(token)
  }, [])

  async function load(tok) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'payments_loadcardupdate', token: tok }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); setStatus('error'); return }
      setData(d)
      setStatus('ready')
    } catch {
      setError('Failed to load your payment details.')
      setStatus('error')
    }
  }

  async function choose(engagement, method) {
    setStatus('redirecting')
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payments_cardupdate_checkout',
          token,
          pipeline: engagement.pipeline,
          row_id: engagement.row_id,
          method,
        }),
      })
      const d = await res.json()
      if (d.url) { window.location.href = d.url; return }
      setError(d.error || 'Could not start the update.')
      setStatus('error')
    } catch {
      setError('Could not start the update.')
      setStatus('error')
    }
  }

  if (status === 'loading') return (
    <TokenShell>
      <p style={{ color: 'var(--vfo-muted)', fontSize: '15px', textAlign: 'center', margin: 0 }}>Loading your payment details…</p>
    </TokenShell>
  )

  if (status === 'redirecting') return (
    <TokenShell>
      <p style={{ color: 'var(--vfo-muted)', fontSize: '15px', textAlign: 'center', margin: 0 }}>Redirecting to Stripe…</p>
    </TokenShell>
  )

  if (status === 'error') return (
    <TokenShell maxWidth={520}>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ ...iconCircle, background: '#ef444420' }}><span style={{ fontSize: '28px', lineHeight: 1 }}>⚠️</span></div>
        <h1 style={titleStyle}>Something went wrong</h1>
        <p style={subtitleStyle}>{error}</p>
      </div>
    </TokenShell>
  )

  const engagements = data?.engagements || []

  return (
    <TokenShell maxWidth={560}>
      <div style={{ width: '100%' }}>
        <div style={{ ...iconCircle, width: '64px', height: '64px', background: 'rgba(34,197,94,0.15)' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>🔒</span>
        </div>
        <h1 style={{ ...titleStyle, fontSize: '22px', textAlign: 'center', marginBottom: '6px' }}>Update Payment Method</h1>
        {data?.person_name && (
          <p style={{ ...subtitleStyle, textAlign: 'center', marginBottom: '20px' }}>{data.person_name}</p>
        )}

        {justUpdated && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '12px', color: '#0f7a3d', fontSize: '13.5px', textAlign: 'center' }}>
            ✓ Your payment method was updated. You can update another below, or simply close this page.
          </div>
        )}

        {engagements.length === 0 ? (
          <p style={{ ...subtitleStyle, textAlign: 'center', marginTop: '12px' }}>
            There are no payments on file to update right now. If you think this is a mistake, just reply to the email we sent you.
          </p>
        ) : (
          <>
            <p style={{ ...subtitleStyle, textAlign: 'center', marginBottom: '20px', fontSize: '13px', color: 'var(--vfo-muted)' }}>
              Choose a payment below and enter your new card or bank details on Stripe's secure page.
            </p>
            {engagements.map((e) => (
              <EngagementCard key={e.id} engagement={e} onChoose={choose} />
            ))}
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

function EngagementCard({ engagement, onChoose }) {
  const e = engagement
  const current = e.current_method
    ? `Currently ${e.current_method === 'ach' ? 'bank account' : 'card'}${e.current_last4 ? ` ••${e.current_last4}` : ''}`
    : 'No method on file'
  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '4px', fontSize: '15px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{e.label}</div>
      {e.for_client_name && (
        <div style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', marginBottom: '2px' }}>For {e.for_client_name}</div>
      )}
      <div style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', marginBottom: '14px' }}>{current}</div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button style={choiceBtn} onClick={() => onChoose(e, 'card')}>Use a Card</button>
        <button style={{ ...choiceBtn, background: 'var(--vfo-card)', color: '#125ecc', border: '1.5px solid #125ecc' }} onClick={() => onChoose(e, 'ach')}>Use a Bank Account</button>
      </div>
    </div>
  )
}

const iconCircle = {
  width: '72px', height: '72px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
}
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const subtitleStyle = { fontSize: '14px', color: 'var(--vfo-muted)', margin: 0 }
const cardStyle = {
  border: '2px solid var(--vfo-border)', borderRadius: '16px', padding: '20px 22px', marginBottom: '14px',
}
const choiceBtn = {
  background: '#125ecc', color: '#fff', border: '1.5px solid #125ecc', borderRadius: '10px',
  padding: '10px 18px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const securityNote = {
  textAlign: 'center', color: 'var(--vfo-muted)', fontSize: '12px', marginTop: '24px', lineHeight: 1.6,
}
