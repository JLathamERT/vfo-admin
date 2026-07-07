import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import SandboxModeToggle from './SandboxModeToggle'
import { NAVY, BLUE, money, RequestRow, MarkReceivedButton } from './specialistRevenueShared'
import { TableSkeleton } from '../shared/Skeleton'

// Automation → VFO Specialist Revenue. One row per specialist payment request, with
// where-everything-is-at status and a Retry-payout action. Sandbox toggle shares the
// MAP 1 row (the same toggle that controls the Connect accounts + transfers).

export default function SpecialistRevenueAutomationPanel() {
  const [requests, setRequests] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(null)
  const [retryMsg, setRetryMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('specialist_revenue_load')
      if (res?.error) { setError(res.error); return }
      setRequests(res.requests || [])
      setSandboxConfig(res.sandbox_config || { sandbox_mode: false })
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function retry(requestId) {
    setRetrying(requestId); setRetryMsg('')
    try {
      const res = await callApi('specialist_revenue_retry_payout', { request_id: requestId })
      if (res?.error) { setRetryMsg(res.error); return }
      setRetryMsg(`Payout run — sent ${res.sent}, money mapping ${res.money_mapping}, awaiting Connect ${res.awaiting}, failed ${res.failed}.`)
      await load()
    } catch (e) {
      setRetryMsg(e?.message || 'Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  const stats = useMemo(() => {
    const total = requests.length
    const received = requests.filter(r => r.payment_status === 'received').length
    const awaiting = requests.filter(r => ['requested', 'processing', 'pending'].includes(r.payment_status)).length
    let pendingLines = 0
    requests.forEach(r => (r.lines || []).forEach(l => {
      if (['pending', 'awaiting_connect', 'failed'].includes(l.payout_status) && r.payment_status === 'received') pendingLines++
    }))
    return { total, received, awaiting, pendingLines }
  }, [requests])

  const wrap = { padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const statBox = (label, value, color) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>{label}</div>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', padding: '20px 22px', marginBottom: '20px', boxShadow: 'var(--vfo-shadow-card)' }}>
        <div style={{ height: '4px', borderRadius: '99px', background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, #0a85e8 100%)`, marginBottom: '16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '10.5px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 4px' }}>Automation Pipeline</p>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>VFO Specialist Revenue</h2>
          </div>
          {sandboxConfig && (
            <SandboxModeToggle
              pipeline="MAP 1"
              label="VFO Specialist Revenue (shares MAP 1 mode)"
              sandboxConfig={sandboxConfig}
              onChange={setSandboxConfig}
              note="This toggle flips the shared MAP 1 Stripe mode — it also affects MAP 1 / member revenue share, since they use the same Stripe Connect accounts."
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: '36px', marginTop: '18px' }}>
          {statBox('Total', stats.total, 'var(--vfo-heading)')}
          {statBox('Received', stats.received, '#16a34a')}
          {statBox('Awaiting payment', stats.awaiting, '#e06717')}
          {statBox('Payouts pending', stats.pendingLines, '#b45309')}
        </div>
      </div>

      {retryMsg && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', marginBottom: '14px' }}>{retryMsg}</div>
      )}

      {loading && <TableSkeleton cols={[2, 1, 1, 1]} rows={2} />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && requests.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>No specialist payment requests yet.</div>
      )}
      {!loading && !error && requests.map(r => (
        <RequestRow key={r.id} request={r} actions={({ request }) => {
          if (request.payment_status === 'pending') {
            return <MarkReceivedButton request={request} onDone={load} />
          }
          const received = request.payment_status === 'received'
          const hasOpen = (request.lines || []).some(l => ['pending', 'awaiting_connect', 'failed'].includes(l.payout_status))
          return (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button disabled={!received || !hasOpen || retrying === request.id} onClick={() => retry(request.id)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${BLUE}`, background: (!received || !hasOpen) ? 'var(--vfo-tint)' : 'var(--vfo-card)', color: (!received || !hasOpen) ? 'var(--vfo-faint)' : BLUE, fontWeight: 600, fontSize: '13px', cursor: (!received || !hasOpen) ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {retrying === request.id ? 'Retrying…' : 'Retry payout'}
              </button>
              {!received && <span style={{ fontSize: '12px', color: 'var(--vfo-faint)' }}>Payouts run once the specialist's payment is received.</span>}
              {received && !hasOpen && <span style={{ fontSize: '12px', color: 'var(--vfo-faint)' }}>All recipients resolved.</span>}
            </div>
          )
        }} />
      ))}
    </div>
  )
}
