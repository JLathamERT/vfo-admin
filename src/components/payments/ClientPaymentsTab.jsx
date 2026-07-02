import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'
import { Skeleton } from '../shared/Skeleton'
import PaymentsTable from './PaymentsTable'
import PaymentsHeader from './PaymentsHeader'

// Read-only Payments tab for a client (admin view). Aggregates their MAP 1, Tax and
// PIP Meetings payments via client_payments_load. Member-paid-on-behalf rows are
// flagged inside PaymentsTable.
export default function ClientPaymentsTab({ clientId, sectionStyle }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [clientId])

  async function load() {
    setLoading(true); setError(null)
    try {
      const d = await callApi('client_payments_load', { client_id: clientId })
      setData(d)
    } catch (e) {
      setError(e?.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const titleStyle = { fontSize: '17px', fontWeight: 800, color: 'var(--vfo-heading)', margin: '0 0 16px', fontFamily: 'Inter, sans-serif' }

  if (loading) {
    return (
      <div style={sectionStyle}>
        <Skeleton width={140} height={22} />
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1, 2].map(i => <Skeleton key={i} width="100%" height={42} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={sectionStyle}>
        <h3 style={titleStyle}>Payments</h3>
        <div style={{ marginTop: '12px', padding: '14px 16px', background: '#fdecea', border: '1px solid #f7c4bd', borderRadius: '10px', color: '#b42318', fontSize: '13px' }}>
          {error}
        </div>
      </div>
    )
  }

  const rows = data?.rows || []

  return (
    <div style={sectionStyle}>
      <PaymentsHeader personType="client" personRef={clientId} />
      <PaymentsTable rows={rows} emptyText="No payments recorded for this client yet." />
    </div>
  )
}
