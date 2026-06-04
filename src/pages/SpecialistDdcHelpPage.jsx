import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

// Confirmation page for the "Request Help Completing Due Diligence Checklist"
// button in the Step 3 receipt email. Fires automation_SPECIALIST_ddchelp, which
// notifies Tracy. No form — one-click, then a thank-you.
export default function SpecialistDdcHelpPage() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState('loading') // loading | success | invalid

  useEffect(() => { submit() }, [])

  async function submit() {
    const token = searchParams.get('token')
    if (!token) { setState('invalid'); return }
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation_SPECIALIST_ddchelp', token }),
      })
      const d = await res.json()
      if (!res.ok || d.state === 'invalid' || !d.success) { setState('invalid'); return }
      setState('success')
    } catch { setState('invalid') }
  }

  if (state === 'loading') return (
    <div style={pageStyle}><div style={{ color: '#94a3b8', fontSize: '15px' }}>One moment…</div></div>
  )

  if (state === 'invalid') return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', maxWidth: '480px', padding: '48px 32px' }}>
        <div style={{ ...circle, background: '#ef444420' }}><span style={{ fontSize: '32px', lineHeight: 1 }}>⚠️</span></div>
        <h1 style={h1}>Link Not Valid</h1>
        <p style={p}>This link is invalid or has expired. Please contact your VFO representative.</p>
      </div>
    </div>
  )

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', maxWidth: '480px', padding: '48px 32px' }}>
        <div style={{ ...circle, background: '#22c55e20' }}><span style={{ fontSize: '32px', lineHeight: 1 }}>✓</span></div>
        <h1 style={h1}>Help Is On The Way</h1>
        <p style={p}>We've noted that you'd like some direction completing your Due Diligence Checklist. Tracy Miller will be in touch shortly to help.</p>
      </div>
    </div>
  )
}

const pageStyle = { fontFamily: '"DM Sans", sans-serif', background: '#0a1628', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }
const circle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '12px' }
const p = { fontSize: '15px', color: '#94a3b8', lineHeight: 1.6 }
