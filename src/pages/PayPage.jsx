import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'

export default function PayPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setError('Invalid payment link.'); setStatus('error'); return }
    loadPaymentData(token)
  }, [])

  async function loadPaymentData(token) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation_CONTRACT_loadpayment', token }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); setStatus('error'); return }
      setData(d)
      setStatus('ready')
    } catch {
      setError('Failed to load payment details.')
      setStatus('error')
    }
  }

  async function handleChoice(method) {
    setStatus('redirecting')
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation_CONTRACT_stripecheckout', token: searchParams.get('token'), method }),
      })
      const d = await res.json()
      if (d.url) { window.location.href = d.url; return }
      setError(d.error || 'Failed to create checkout session.')
      setStatus('error')
    } catch {
      setError('Failed to initiate payment.')
      setStatus('error')
    }
  }

  const containerStyle = { minHeight: '100vh', background: '#0f1f3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: '24px' }
  const cardStyle = { background: '#1a2f5a', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', border: '1px solid rgba(255,255,255,0.1)' }

  if (status === 'loading') return (
    <div style={containerStyle}>
      <div style={{ color: '#8bacc8', fontSize: '16px' }}>Loading payment details...</div>
    </div>
  )

  if (status === 'error') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ color: '#e74c3c', fontSize: '16px', textAlign: 'center' }}>{error}</div>
      </div>
    </div>
  )

  if (status === 'redirecting') return (
    <div style={containerStyle}>
      <div style={{ color: '#8bacc8', fontSize: '16px' }}>Redirecting to Stripe...</div>
    </div>
  )

  const cardAmount = (data.payment_amount + data.payment_amount * 0.029 + 0.30).toFixed(2)
  const achAmount = data.payment_amount.toFixed(2)

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: '#fff', marginBottom: '8px' }}>VFO SERVICES</div>
          <div style={{ fontSize: '14px', color: '#8bacc8' }}>Complete Your Payment</div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '16px', marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', marginBottom: '4px' }}>Payment {data.payment_x} of {data.payment_y} — {data.service_level} Membership</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>${Number(data.payment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '12px', color: '#5a8ab5', marginTop: '4px' }}>{data.client_name}</div>
        </div>

        <div style={{ fontSize: '13px', color: '#8bacc8', marginBottom: '16px', textAlign: 'center' }}>Choose your payment method:</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => handleChoice('ach')} style={{ padding: '16px', borderRadius: '10px', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.08)', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>Bank Transfer (ACH)</div>
            <div style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600' }}>${Number(achAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} — No fee</div>
            <div style={{ fontSize: '11px', color: '#8bacc8', marginTop: '4px' }}>3-5 business days to process</div>
          </button>

          <button onClick={() => handleChoice('card')} style={{ padding: '16px', borderRadius: '10px', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.08)', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>Credit / Debit Card</div>
            <div style={{ fontSize: '13px', color: '#5b9fe6', fontWeight: '600' }}>${Number(cardAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} — includes 2.9% + $0.30 fee</div>
            <div style={{ fontSize: '11px', color: '#8bacc8', marginTop: '4px' }}>Instant processing</div>
          </button>
        </div>

        <div style={{ fontSize: '11px', color: '#5a8ab5', textAlign: 'center', marginTop: '24px' }}>
          🔒 Secure payment powered by Stripe. We never see or store your payment details.
        </div>
      </div>
    </div>
  )
}