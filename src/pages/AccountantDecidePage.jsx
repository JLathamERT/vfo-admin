import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

export default function AccountantDecidePage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')
  const [error, setError] = useState('')
  const [decision, setDecision] = useState('')

  useEffect(() => { processDecision() }, [])

  async function processDecision() {
    const token = searchParams.get('token')
    const dec = searchParams.get('decision')

    if (!token || !dec) {
      setError('Invalid link — missing required parameters.')
      setStatus('error')
      return
    }
    setDecision(dec)

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'automation_ACCOUNTANT_clientdecision',
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

  const view = getView(status, decision, error)

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ ...iconCircleStyle, background: view.color + '20' }}>
          <span style={{ fontSize: '32px', lineHeight: 1 }}>{view.icon}</span>
        </div>
        <h1 style={titleStyle}>{view.title}</h1>
        <p style={messageStyle}>{view.message}</p>
      </div>
    </div>
  )
}

function getView(status, decision, error) {
  if (status === 'processing') {
    return { icon: '⏳', color: '#3b82f6', title: 'Processing your response…', message: 'Please wait, do not close this page.' }
  }
  if (status === 'already_submitted') {
    return { icon: 'ℹ️', color: '#3b82f6', title: 'Already Received', message: "We've already received your decision — no further action is needed. Thank you!" }
  }
  if (status === 'error') {
    return { icon: '⚠️', color: '#ef4444', title: 'Something Went Wrong', message: error || 'An unexpected error occurred.' }
  }
  if (decision === 'Yes') {
    return { icon: '✓', color: '#22c55e', title: 'Thank You!', message: "We're excited to move forward. We'll be in touch shortly with the next steps." }
  }
  return { icon: '✓', color: '#22c55e', title: 'Thank You', message: "We appreciate you letting us know. If circumstances ever change, we'll be right here." }
}

const containerStyle = { fontFamily: '"DM Sans", sans-serif', background: '#0a1628', color: '#e2e8f0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }
const cardStyle = { textAlign: 'center', maxWidth: '480px', padding: '48px 32px' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '12px' }
const messageStyle = { fontSize: '15px', color: '#94a3b8', lineHeight: 1.6 }
