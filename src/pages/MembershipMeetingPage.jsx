import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'
import DecisionConfirmCard from '../components/shared/DecisionConfirmCard'

// Public /membership-meeting?token= page. The renewal-notice email (sent 30 days
// before a membership plan renews) carries a "Schedule a meeting" button here.
//
// Nothing is recorded on load: corporate mail scanners open every link in an
// email, so the page only checks the token is present and renders the
// show-then-confirm card (gotcha #290). The request is POSTed on the click.

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

export default function MembershipMeetingPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('confirm')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Invalid link — missing required parameters.')
      setStatus('error')
      return
    }
    setStatus('confirm')
  }, [])

  function handleConfirm() {
    setStatus('processing')
    submitRequest()
  }

  async function submitRequest() {
    const token = searchParams.get('token')
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'membership_renewal_meeting_request',
          token,
        }),
      })
      const data = await res.json()
      if (data.already) { setStatus('already_submitted'); return }
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setError('Unable to connect. Please try again later.')
      setStatus('error')
    }
  }

  if (status === 'confirm') {
    return (
      <TokenShell maxWidth={520}>
        <DecisionConfirmCard
          title="Membership renewal meeting"
          message="Click below to request a meeting about your upcoming membership renewal. Our team will reach out to schedule a time."
          buttonLabel="Request a meeting"
          buttonColor="#125ecc"
          onConfirm={handleConfirm}
        />
      </TokenShell>
    )
  }

  const view = getView(status, error)
  return (
    <TokenShell maxWidth={520}>
      <div style={cardStyle}>
        <div style={{ ...iconCircleStyle, background: view.color + '20' }}>
          <span style={{ fontSize: '32px', lineHeight: 1 }}>{view.icon}</span>
        </div>
        <h1 style={titleStyle}>{view.title}</h1>
        <p style={messageStyle}>{view.message}</p>
      </div>
    </TokenShell>
  )
}

function getView(status, error) {
  if (status === 'processing') {
    return { icon: '⏳', color: '#0095ff', title: 'Sending your request…', message: 'Please wait, do not close this page.' }
  }
  if (status === 'already_submitted') {
    return { icon: 'ℹ️', color: '#0095ff', title: 'Already Received', message: "We've already received your meeting request — our team will be in touch to schedule your meeting." }
  }
  if (status === 'error') {
    return { icon: '⚠️', color: '#ef4444', title: 'Something Went Wrong', message: error || 'An unexpected error occurred. Please contact us.' }
  }
  return { icon: '✓', color: '#16a34a', title: 'Request received', message: 'Request received — our team will be in touch to schedule your meeting.' }
}

const cardStyle = { textAlign: 'center', padding: '12px 0' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const messageStyle = { fontSize: '15px', color: 'var(--vfo-muted)', lineHeight: 1.6 }
