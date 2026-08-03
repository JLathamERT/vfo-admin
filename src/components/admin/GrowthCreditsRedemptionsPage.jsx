import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'
import { TableSkeleton } from '../shared/Skeleton'
import { MemberNameLink } from '../shared/personLinks'

// Growth Credits page (top-level admin tab, grantable per admin in the Admin
// Editor via the 'growth_credits' allowed_tabs key). The redemption fulfillment
// queue ONLY — packages/services/sandbox live in Automation & Config, and the
// money view lives in Accounting > Members > Growth Credits.

const NAVY = '#002973'

function fmtDate(s) {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(s) }
}

export default function GrowthCreditsRedemptionsPage() {
  const [redemptions, setRedemptions] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [sort, setSort] = useState('recent')
  const [confirmReject, setConfirmReject] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setError('')
    try {
      const res = await callApi('gc_load_all_redemptions')
      if (res?.error) { setError(res.error); return }
      setRedemptions(res.redemptions || [])
    } catch (e) { setError(e?.message || 'Failed to load') }
  }

  function flash(msg) { setStatus(msg); setTimeout(() => setStatus(''), 4000) }

  async function update(redemption_id, newStatus) {
    setBusy(true)
    try {
      await callApi('gc_update_redemption', { redemption_id, status: newStatus })
      flash(newStatus === 'fulfilled' ? 'Marked completed.' : 'Rejected — credits refunded to the member.')
      await load()
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setBusy(false)
      setConfirmReject(null)
    }
  }

  const memberOf = r => r.member_plugin_settings?.name || `Member ${r.member_number}`
  const serviceOf = r => r.gc_services?.name || `Service ${r.service_id}`

  const sortRows = (rows) => {
    const copy = [...rows]
    if (sort === 'member') {
      copy.sort((a, b) => memberOf(a).localeCompare(memberOf(b)) || new Date(b.created_at) - new Date(a.created_at))
    } else {
      copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    return copy
  }

  const pending = sortRows((redemptions || []).filter(r => r.status === 'pending'))
  const done = sortRows((redemptions || []).filter(r => r.status !== 'pending'))

  const card = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '22px', marginBottom: '20px' }
  const cardTitle = { fontSize: '15px', fontWeight: 700, color: 'var(--vfo-heading)', margin: '0 0 16px', paddingBottom: '8px', borderBottom: `2px solid ${NAVY}`, display: 'inline-block' }
  const pill = (active) => ({ padding: '7px 16px', background: active ? '#125ecc' : 'transparent', border: active ? 'none' : '1px solid var(--vfo-border-mid)', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : 'var(--vfo-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' })
  const rowGrid = { display: 'grid', gridTemplateColumns: '1.5fr 1.7fr 100px 120px 210px', gap: '10px', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid var(--vfo-border-soft)', fontSize: '13px', color: 'var(--vfo-ink)' }

  return (
    <div style={{ padding: '24px', maxWidth: '1050px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '10.5px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 4px' }}>Admin</p>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>Growth Credits</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--vfo-muted)' }}>Sort</span>
          <button style={pill(sort === 'recent')} onClick={() => setSort('recent')}>Most recent</button>
          <button style={pill(sort === 'member')} onClick={() => setSort('member')}>By member</button>
        </div>
      </div>

      {status && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', marginBottom: '14px' }}>{status}</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}

      <div style={card}>
        <div style={cardTitle}>Pending ({redemptions === null ? '…' : pending.length})</div>
        <p style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', margin: '0 0 14px' }}>Services members have redeemed credits for that have not been delivered yet. Check one off once the work is complete; rejecting refunds the credits.</p>
        {redemptions === null && !error && <TableSkeleton cols={[1.5, 1.7, 1, 1.2]} rows={3} />}
        {redemptions !== null && !error && (
          <div>
            <div style={{ ...rowGrid, padding: '6px 4px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>
              <span>Member</span><span>Service</span><span>Credits</span><span>Redeemed</span><span />
            </div>
            {pending.length === 0 && <div style={{ textAlign: 'center', padding: '28px', color: 'var(--vfo-faint)', fontSize: '13px' }}>No pending redemptions.</div>}
            {pending.map(r => (
              <div key={r.id} style={rowGrid}>
                <span><MemberNameLink memberNumber={r.member_number} style={{ fontWeight: 600 }}>{memberOf(r)}</MemberNameLink></span>
                <span>{serviceOf(r)}</span>
                <span style={{ color: 'var(--vfo-muted)' }}>{r.credits}</span>
                <span style={{ color: 'var(--vfo-muted)' }}>{fmtDate(r.created_at)}</span>
                <span style={{ display: 'flex', gap: '8px', justifySelf: 'end' }}>
                  <button onClick={() => update(r.id, 'fulfilled')} disabled={busy}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'rgba(22,163,74,0.14)', color: '#16a34a', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>Mark completed</button>
                  <button onClick={() => setConfirmReject(r)} disabled={busy}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: '#d93025', fontSize: '12.5px', cursor: busy ? 'default' : 'pointer' }}>Reject</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={cardTitle}>History</div>
        {redemptions === null && !error && <TableSkeleton cols={[1.5, 1.7, 1, 1.2]} rows={3} />}
        {redemptions !== null && !error && (
          <div>
            {done.length === 0 && <div style={{ textAlign: 'center', padding: '28px', color: 'var(--vfo-faint)', fontSize: '13px' }}>No completed or rejected redemptions yet.</div>}
            {done.map(r => (
              <div key={r.id} style={{ ...rowGrid, opacity: 0.65 }}>
                <span><MemberNameLink memberNumber={r.member_number}>{memberOf(r)}</MemberNameLink></span>
                <span>{serviceOf(r)}</span>
                <span style={{ color: 'var(--vfo-muted)' }}>{r.credits}</span>
                <span style={{ color: 'var(--vfo-muted)' }}>{fmtDate(r.created_at)}</span>
                <span style={{ justifySelf: 'end', padding: '3px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, background: r.status === 'fulfilled' ? 'rgba(22,163,74,0.12)' : 'rgba(217,48,37,0.12)', color: r.status === 'fulfilled' ? '#16a34a' : '#d93025' }}>{r.status === 'fulfilled' ? 'Completed' : 'Rejected'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmReject && (
        <div onClick={() => { if (!busy) setConfirmReject(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(9,14,26,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: '0 18px 50px rgba(9,14,26,0.35)', padding: '26px 28px', maxWidth: '440px', width: '100%' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '10px' }}>Reject redemption</div>
            <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Reject <strong>{serviceOf(confirmReject)}</strong> for <strong>{memberOf(confirmReject)}</strong>? The {confirmReject.credits} {confirmReject.credits === 1 ? 'credit' : 'credits'} will be refunded to their balance.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setConfirmReject(null)} disabled={busy}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: busy ? 'default' : 'pointer' }}>Cancel</button>
              <button onClick={() => update(confirmReject.id, 'rejected')} disabled={busy}
                style={{ padding: '8px 22px', borderRadius: '8px', border: 'none', background: '#d93025', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Rejecting…' : 'Reject & refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
