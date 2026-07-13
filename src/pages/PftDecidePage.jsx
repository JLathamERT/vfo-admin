import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Public token page for the PFT "Undecided" decision email. The client clicks
// VFO Fast Track / VFO Associate / No in the email and lands here; the choice is
// read from the URL and recorded via automation_PFT_undecided_response.
export default function PftDecidePage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')
  const [error, setError] = useState('')
  const [choice, setChoice] = useState('')

  useEffect(() => { processDecision() }, [])

  async function processDecision() {
    const token = searchParams.get('token')
    const ch = searchParams.get('choice')

    if (!token || !ch) {
      setError('Invalid link — missing required parameters.')
      setStatus('error')
      return
    }
    setChoice(ch)

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation_PFT_undecided_response', token, choice: ch }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.existing_decision) {
          setChoice(data.existing_decision)
          setStatus('already_submitted')
        } else {
          setError(data.error || 'Something went wrong.')
          setStatus('error')
        }
        return
      }
      if (data.existing_decision) {
        setChoice(data.existing_decision)
        setStatus('already_submitted')
        return
      }
      setStatus('success')
    } catch (_err) {
      setError('Unable to connect. Please try again later.')
      setStatus('error')
    }
  }

  const view = getView(status, choice, error)

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

function getView(status, choice, error) {
  if (status === 'processing') {
    return { icon: '⏳', color: '#0095ff', title: 'Processing your response…', message: 'Please wait, do not close this page.' }
  }
  if (status === 'already_submitted') {
    return { icon: 'ℹ️', color: '#0095ff', title: 'Already Received', message: "We've already received your response — no further action is needed. Thank you!" }
  }
  if (status === 'error') {
    return { icon: '⚠️', color: '#ef4444', title: 'Something Went Wrong', message: error || 'An unexpected error occurred.' }
  }
  if (choice === 'no') {
    return { icon: '✓', color: '#16a34a', title: 'Thank You', message: "Thanks for letting us know. We appreciate you taking the time to explore the Partnership Fast Track with us." }
  }
  return { icon: '✓', color: '#16a34a', title: 'Thank You!', message: "We're delighted you'd like to move forward. Our team will be in touch shortly to begin your onboarding." }
}

const cardStyle = { textAlign: 'center', padding: '12px 0' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const messageStyle = { fontSize: '15px', color: 'var(--vfo-muted)', lineHeight: 1.6 }
