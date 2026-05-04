import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
 
const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'
 
export default function DecidePage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')
  const [error, setError] = useState('')
  const [decision, setDecision] = useState('')
  const [serviceLevel, setServiceLevel] = useState('')
 
  useEffect(() => {
    processDecision()
  }, [])
 
  async function processDecision() {
    const token = searchParams.get('token')
    const dec = searchParams.get('decision')
    const level = searchParams.get('serviceLevel')
    const clientRef = searchParams.get('clientRef')
 
    if (!token || !dec) {
      setError('Invalid link — missing required parameters.')
      setStatus('error')
      return
    }
 
    setDecision(dec)
    setServiceLevel(level || '')
 
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'automation_PCADMIN_finaldecision',
          token,
          decision: dec,
          service_level: level || null,
          client_ref: clientRef || null,
        }),
      })
      const data = await res.json()
 
      if (!res.ok) {
        if (data.existing_decision) {
          setDecision(data.existing_decision)
          setStatus('already_recorded')
        } else {
          setError(data.error || 'Something went wrong.')
          setStatus('error')
        }
        return
      }
 
      setStatus('success')
    } catch (err) {
      setError('Unable to connect. Please try again later.')
      setStatus('error')
    }
  }
 
  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a1929 0%, #162d4a 50%, #1e3a5f 100%)',
    fontFamily: 'DM Sans, sans-serif',
    padding: '20px',
  }
 
  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '48px 40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
  }
 
  const iconSize = { fontSize: '48px', marginBottom: '20px' }
 
  function getMessage() {
    if (status === 'processing') {
      return (
        <>
          <div style={{ ...iconSize, color: '#5b9fe6' }}>...</div>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Processing your response...</h2>
          <p style={{ color: '#8bacc8', fontSize: '14px' }}>Please wait, do not close this page.</p>
        </>
      )
    }
 
    if (status === 'already_recorded') {
      return (
        <>
          <div style={{ ...iconSize, color: '#f59e0b', fontWeight: '700' }}>—</div>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Response Already Recorded</h2>
          <p style={{ color: '#8bacc8', fontSize: '14px' }}>Your decision was already submitted. No further action is needed.</p>
        </>
      )
    }
 
    if (status === 'error') {
      return (
        <>
          <div style={{ ...iconSize, color: '#e74c3c', fontWeight: '700' }}>X</div>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Something Went Wrong</h2>
          <p style={{ color: '#ff6b6b', fontSize: '14px' }}>{error}</p>
        </>
      )
    }
 
    if (decision === 'Yes') {
      return (
        <>
          <div style={{ ...iconSize, color: '#27ae60', fontWeight: '700' }}>OK</div>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Thank You!</h2>
          <p style={{ color: '#8bacc8', fontSize: '14px', lineHeight: '1.6' }}>
            Your decision to proceed{serviceLevel ? ` with the ${serviceLevel} Membership` : ''} has been recorded.
            <br /><br />
            Your Proactive Facilitator will be in touch shortly with the next steps.
          </p>
        </>
      )
    }
 
    if (decision === 'No') {
      return (
        <>
          <div style={{ ...iconSize, color: '#e74c3c', fontWeight: '700' }}>OK</div>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Thank You</h2>
          <p style={{ color: '#8bacc8', fontSize: '14px', lineHeight: '1.6' }}>
            We understand your decision not to proceed at this time.
            <br /><br />
            Should you ever wish to reconsider, please don't hesitate to reach out to your Proactive Facilitator or Member Advisor.
          </p>
        </>
      )
    }
 
    if (decision === 'ExtraMeeting') {
      return (
        <>
          <div style={{ ...iconSize, color: '#5b9fe6', fontWeight: '700' }}>OK</div>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Thank You!</h2>
          <p style={{ color: '#8bacc8', fontSize: '14px', lineHeight: '1.6' }}>
            Your request for an additional meeting has been recorded.
            <br /><br />
            Your Proactive Facilitator will be in touch shortly to arrange a convenient time.
          </p>
        </>
      )
    }
  }
 
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff', letterSpacing: '1px' }}>VFO SERVICES</span>
        </div>
        {getMessage()}
      </div>
    </div>
  )
}