import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Confirmation page for the specialist's response to the FINAL revenue sharing
// proposal (Exhibit A) carried in the Step 3 receipt email. decision=Approved or
// decision=Questions. Fires automation_SPECIALIST_revsharefinal, which notifies
// Tracy. Replaces the per-meeting rev-share decision that used to live in Stage 2.
export default function SpecialistRevShareFinalPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')
  const [response, setResponse] = useState('')

  useEffect(() => { run() }, [])

  async function run() {
    const token = searchParams.get('token')
    const decision = searchParams.get('decision')
    if (!token || !decision) { setStatus('error'); return }
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation_SPECIALIST_revsharefinal', token, decision }),
      })
      const data = await res.json()
      if (data.state === 'invalid') { setStatus('error'); return }
      if (data.state === 'already') { setResponse(data.response || ''); setStatus('already'); return }
      if (!res.ok || !data.success) { setStatus('error'); return }
      setResponse(data.response || '')
      setStatus('success')
    } catch { setStatus('error') }
  }

  const view = getView(status, response)
  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', maxWidth: '480px', padding: '48px 32px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: view.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <span style={{ fontSize: '32px', lineHeight: 1 }}>{view.icon}</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>{view.title}</h1>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.6 }}>{view.message}</p>
      </div>
    </div>
  )
}

function getView(status, response) {
  if (status === 'processing') return { icon: '⏳', color: '#3b82f6', title: 'Processing your response…', message: 'Please wait, do not close this page.' }
  if (status === 'error') return { icon: '⚠️', color: '#ef4444', title: 'Something Went Wrong', message: 'This link is invalid or has expired. Please contact your VFO representative.' }
  if (status === 'already') return { icon: 'ℹ️', color: '#3b82f6', title: 'Already Received', message: `We've already recorded your response${response ? ` (${response})` : ''} — no further action is needed. Thank you!` }
  if (response === 'Approved') return { icon: '✓', color: '#22c55e', title: 'Thank You!', message: 'Thank you for confirming you are happy with the revenue sharing proposal. It will be attached as Exhibit A in your final VFO Specialist Agreement, completed in Step 4.' }
  return { icon: '✓', color: '#22c55e', title: 'Thank You', message: "We've noted that you have further questions about the revenue sharing proposal. Tracy Miller will be in touch shortly to discuss before it's finalized." }
}

const pageStyle = { fontFamily: '"DM Sans", sans-serif', background: '#0a1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }
