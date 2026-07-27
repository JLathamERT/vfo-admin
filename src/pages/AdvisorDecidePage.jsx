import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TokenShell from '../components/shared/TokenShell'
import DecisionConfirmCard from '../components/shared/DecisionConfirmCard'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

export default function AdvisorDecidePage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('confirm')
  const [error, setError] = useState('')
  const [decision, setDecision] = useState(() => searchParams.get('decision') || '')

  useEffect(() => {
    const token = searchParams.get('token')
    const dec = searchParams.get('decision')

    if (!token || !dec) {
      setError('Invalid link — missing required parameters.')
      setStatus('error')
      return
    }
    setDecision(dec)
    setStatus('confirm')
  }, [])

  function handleConfirm() {
    setStatus('processing')
    processDecision()
  }

  async function processDecision() {
    const token = searchParams.get('token')
    const dec = searchParams.get('decision')

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'automation_ADVISOR_clientdecision',
          token,
          decision: dec,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.existing_decision) {
          setDecision(data.existing_decision)
          setStatus('already_submitted')
        } else {
          setError(data.error || 'Something went wrong.')
          setStatus('error')
        }
        return
      }
      setStatus('success')
    } catch (_err) {
      setError('Unable to connect. Please try again later.')
      setStatus('error')
    }
  }

  if (status === 'confirm') {
    const confirm = getConfirm(decision)
    return (
      <TokenShell maxWidth={520}>
        <DecisionConfirmCard {...confirm} onConfirm={handleConfirm} />
      </TokenShell>
    )
  }

  const view = getView(status, decision, error)

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

function getConfirm(decision) {
  if (decision === 'ExtraMeeting') {
    return {
      title: 'Please confirm your request',
      message: "You're about to request an additional meeting.",
      buttonLabel: 'Confirm — request a meeting',
      buttonColor: '#125ecc',
    }
  }
  if (decision === 'Yes') {
    return {
      title: 'Please confirm your decision',
      message: "You're about to confirm moving forward with your VFO onboarding.",
      buttonLabel: 'Confirm — move forward',
      buttonColor: '#16a34a',
    }
  }
  return {
    title: 'Please confirm your decision',
    message: "You're about to let us know you won't be moving forward at this time.",
    buttonLabel: 'Confirm my decision',
    buttonColor: '#64748b',
  }
}

function getView(status, decision, error) {
  if (status === 'processing') {
    return { icon: '⏳', color: '#0095ff', title: 'Processing your response…', message: 'Please wait, do not close this page.' }
  }
  if (status === 'already_submitted') {
    return { icon: 'ℹ️', color: '#0095ff', title: 'Already Received', message: "We've already received your decision — no further action is needed. Thank you!" }
  }
  if (status === 'error') {
    return { icon: '⚠️', color: '#ef4444', title: 'Something Went Wrong', message: error || 'An unexpected error occurred.' }
  }
  if (decision === 'ExtraMeeting') {
    return { icon: '✓', color: '#125ecc', title: 'Meeting Requested', message: 'Thank you — our team will be in touch to arrange an additional meeting.' }
  }
  if (decision === 'Yes') {
    return { icon: '✓', color: '#16a34a', title: 'Thank You!', message: "We're excited to move forward. We'll be in touch shortly with the next steps." }
  }
  return { icon: '✓', color: '#16a34a', title: 'Thank You', message: "We appreciate you letting us know. If circumstances ever change, we'll be right here." }
}

const cardStyle = { textAlign: 'center', padding: '12px 0' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: 'var(--vfo-ink)', marginBottom: '12px' }
const messageStyle = { fontSize: '15px', color: 'var(--vfo-muted)', lineHeight: 1.6 }
