import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

export default function PftFtDecidePage() {
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
        body: JSON.stringify({ action: 'automation_PFT_ftresponse', token, decision: dec }),
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
      if (data.existing_decision) {
        setDecision(data.existing_decision)
        setStatus('already_submitted')
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
    return { icon: '⏳', color: '#0095ff', title: 'Processing your response…', message: 'Please wait, do not close this page.' }
  }
  if (status === 'already_submitted') {
    return { icon: 'ℹ️', color: '#0095ff', title: 'Already Received', message: "We've already received your response — no further action is needed. Thank you!" }
  }
  if (status === 'error') {
    return { icon: '⚠️', color: '#ef4444', title: 'Something Went Wrong', message: error || 'An unexpected error occurred.' }
  }
  if (decision === 'confirm') {
    return { icon: '✓', color: '#16a34a', title: 'Thank You!', message: "We're delighted you'd like to move forward. Our team will be in touch shortly to begin your onboarding." }
  }
  return { icon: '✓', color: '#16a34a', title: 'Thank You', message: "Thanks for letting us know — we'll be in touch to arrange another meeting." }
}

const containerStyle = { fontFamily: '"Inter", sans-serif', background: '#ffffff', color: '#243757', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }
const cardStyle = { textAlign: 'center', maxWidth: '480px', padding: '48px 32px' }
const iconCircleStyle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const titleStyle = { fontSize: '24px', fontWeight: 700, color: '#16264a', marginBottom: '12px' }
const messageStyle = { fontSize: '15px', color: '#4e6087', lineHeight: 1.6 }
