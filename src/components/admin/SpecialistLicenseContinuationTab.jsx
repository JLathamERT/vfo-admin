import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'

// Jake-only per-specialist tool: move an EXISTING specialist (already paying $99/mo on
// the old system) onto the portal's native $99/mo license subscription. Sends a secure
// /specialist-pay?kind=license link; the specialist enters card/ACH on Stripe and the
// existing license webhook chain takes over. Nothing is charged here.

const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
const sectionTitle = { fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', fontWeight: 700 }
const primaryBtn = (disabled) => ({ padding: '11px 26px', borderRadius: '8px', background: disabled ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600 })

function fmtDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(s) }
}

function StatusPill({ tone, label }) {
  const tones = {
    green: { bg: 'rgba(27,146,84,0.12)', fg: '#1b9254' },
    blue: { bg: 'rgba(18,94,204,0.10)', fg: '#125ecc' },
    amber: { bg: 'rgba(214,158,46,0.14)', fg: '#b7791f' },
    red: { bg: 'rgba(231,76,60,0.12)', fg: '#e74c3c' },
    grey: { bg: 'rgba(78,96,135,0.12)', fg: '#4e6087' },
  }
  const t = tones[tone] || tones.grey
  return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', background: t.bg, color: t.fg, fontSize: '12px', fontWeight: 700 }}>{label}</span>
}

export default function SpecialistLicenseContinuationTab({ expert }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function load() {
    setLoading(true); setErr(''); setMsg('')
    try {
      const d = await callApi('specialist_license_continuation_load', { expert_id: expert.id })
      setState(d)
    } catch (e) {
      setErr(e?.message || 'Failed to load license status.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { if (expert?.id) load() }, [expert?.id])

  async function send() {
    setBusy(true); setErr(''); setMsg(''); setConfirming(false)
    try {
      const d = await callApi('specialist_license_continuation_start', { expert_id: expert.id })
      setMsg(`License setup email drafted to ${d.to_email}${d.sandbox ? ' (sandbox)' : ''}. It's in Gmail Drafts — review and send.`)
      await load()
    } catch (e) {
      setErr(e?.message || 'Could not send the setup link.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div style={sectionStyle}><p style={{ color: '#4e6087', fontSize: '14px', margin: 0 }}>Loading license status…</p></div>

  const s = state || {}
  const status = s.payment_status || null
  const active = !!s.subscription_id && (status === 'succeeded' || status === 'processing')
  const linkSent = !!s.link_sent_at
  const noEmail = !s.expert_email

  // Status banner config
  let pill, summary
  if (active) {
    pill = <StatusPill tone={status === 'processing' ? 'blue' : 'green'} label={status === 'processing' ? 'Active — ACH clearing' : 'Active'} />
    const method = s.payment_method_type === 'ach' ? 'Bank (ACH)' : s.payment_method_type === 'card' ? 'Card' : '—'
    const last4 = s.acct_last4 ? ` ••••${s.acct_last4}` : ''
    summary = `$99/month · ${method}${last4} · last paid ${fmtDate(s.last_invoice_paid_at || s.payment_completed_at)}`
  } else if (status === 'past_due') {
    pill = <StatusPill tone="red" label="Past due" />
    summary = 'The recurring charge failed — resend the link so they can update their payment method.'
  } else if (status === 'canceled') {
    pill = <StatusPill tone="grey" label="Canceled" />
    summary = 'The subscription was canceled. Send a new setup link to restart it.'
  } else if (status === 'failed') {
    pill = <StatusPill tone="red" label="Payment failed" />
    summary = 'Their last attempt failed — resend the setup link.'
  } else if (linkSent) {
    pill = <StatusPill tone="amber" label="Awaiting payment" />
    summary = `Setup link sent ${fmtDate(s.link_sent_at)}. Waiting for the specialist to enter a payment method.`
  } else {
    pill = <StatusPill tone="grey" label="Not started" />
    summary = 'No license subscription yet. Send the setup link to move this specialist onto the portal.'
  }

  const btnLabel = active ? 'Subscription active' : (linkSent || status ? 'Resend Setup Link' : 'Send License Setup Link')

  return (
    <div>
      <div style={sectionStyle}>
        <div style={sectionTitle}>License Fee Continuation</div>
        <p style={{ fontSize: '14px', color: '#697a9c', marginTop: 0, marginBottom: '20px', lineHeight: 1.6 }}>
          Move <strong>{expert.name}</strong> onto the portal's native <strong>$99/month</strong> VFO Specialist license subscription.
          We'll draft an email with a secure payment link; once they enter a card or bank account, the portal bills them automatically each month.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {pill}
          {s.is_continuation && <span style={{ fontSize: '11px', color: '#94a3b8' }}>(continuation record)</span>}
        </div>
        <p style={{ fontSize: '13px', color: '#4e6087', margin: '0 0 20px', lineHeight: 1.6 }}>{summary}</p>

        {noEmail ? (
          <p style={{ fontSize: '13px', color: '#b7791f', background: 'rgba(214,158,46,0.10)', padding: '12px 14px', borderRadius: '10px', margin: 0 }}>
            This specialist has no email on file. Add one in <strong>Edit Profile</strong> first, then send the setup link.
          </p>
        ) : !confirming ? (
          <button disabled={active || busy} onClick={() => setConfirming(true)} style={primaryBtn(active || busy)}>
            {busy ? 'Working…' : btnLabel}
          </button>
        ) : (
          <div style={{ border: '1px solid #d6e0ee', borderRadius: '12px', padding: '16px', background: '#f7f9fc' }}>
            <p style={{ fontSize: '13px', color: '#16264a', marginTop: 0, marginBottom: '14px', lineHeight: 1.6 }}>
              Draft a <strong>$99/month license</strong> setup email to <strong>{s.expert_email}</strong>?
              No charge happens now — the specialist enters their own payment method on Stripe's secure page.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button disabled={busy} onClick={send} style={primaryBtn(busy)}>{busy ? 'Drafting…' : 'Draft email'}</button>
              <button disabled={busy} onClick={() => setConfirming(false)} style={{ padding: '11px 22px', borderRadius: '8px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            </div>
          </div>
        )}

        {msg && <p style={{ fontSize: '13px', color: '#1b9254', marginTop: '16px', marginBottom: 0 }}>{msg}</p>}
        {err && <p style={{ fontSize: '13px', color: '#e74c3c', marginTop: '16px', marginBottom: 0 }}>{err}</p>}
      </div>

      <div style={{ ...sectionStyle, background: '#f7f9fc' }}>
        <div style={sectionTitle}>Reminder</div>
        <p style={{ fontSize: '13px', color: '#697a9c', margin: 0, lineHeight: 1.6 }}>
          Once the specialist's portal subscription is active, cancel their existing $99/month charge on the old system so they aren't billed twice.
          To change a payment method on an active subscription, use the <strong>Payments</strong> tab.
        </p>
      </div>
    </div>
  )
}
