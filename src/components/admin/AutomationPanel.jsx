import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
 
const STAGE_LABELS = {
  c81: 'C8 — Initial Email',
  c13: 'C13 — PIP Decision',
  c14: 'C14 — Follow-up Email',
  c15: 'C15 — Final Decision',
  c16: 'C16 — Agreement Sent',
  c17: 'C17 — Client Signed',
  c18: 'C18 — CEO Signed',
  payment: 'Payment',
  confirmation: 'Confirmation',
  invoice: 'Invoice',
  receipts: 'Receipts',
  revshare: 'Rev Share',
  complete: 'Complete',
  closed: 'Closed'
}
 
const STAGE_COLORS = {
  c81: '#3b82f6', c13: '#8b5cf6', c14: '#f59e0b', c15: '#f59e0b',
  c16: '#6366f1', c17: '#6366f1', c18: '#6366f1',
  payment: '#ec4899', confirmation: '#14b8a6', invoice: '#14b8a6',
  receipts: '#14b8a6', revshare: '#22c55e', complete: '#22c55e', closed: '#ef4444'
}
 
function getCurrentStage(row) {
  if (row.c24_email_sent) return 'complete'
  if (row.c13_decision === 'No' && row.c14_email_sent === 'Yes') return 'closed'
  if (row.rec1_status || row.rec1_number) return 'receipts'
  if (row.invoice_number) return 'invoice'
  if (row.confirmation_status) return 'confirmation'
  if (row.pay1_status) return 'payment'
  if (row.c18_ceo_signed) return 'c18'
  if (row.c17_client_signed) return 'c17'
  if (row.c16_sent && row.c16_sent !== 'No') return 'c16'
  if (row.c15_final_decision) return 'c15'
  if (row.c14_email_sent && row.c14_email_sent !== 'No') return 'c14'
  if (row.c13_decision) return 'c13'
  if (row.c81_decision) return 'c81'
  return 'c81'
}
 
function SandboxBadge({ config }) {
  if (!config?.sandbox_mode) return null
  return (
    <span style={{
      padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.5px'
    }}>
      SANDBOX MODE
    </span>
  )
}
 
export default function AutomationPanel({ section }) {
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [pipelineData, setPipelineData] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
 
  useEffect(() => {
    loadPipelines()
  }, [])
 
  useEffect(() => {
    if (selectedPipeline) loadPipelineData(selectedPipeline)
  }, [selectedPipeline])
 
  async function loadPipelines() {
    try {
      const data = await callApi('automation_load_pipelines')
      setPipelines(data.pipelines || [])
      if (data.pipelines?.length > 0) {
        setSelectedPipeline(data.pipelines[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
 
  async function loadPipelineData(pipeline) {
    try {
      const data = await callApi('automation_load_pipeline_data', { table_name: pipeline.table_name })
      setPipelineData(data.rows || [])
      setSandboxConfig(data.sandbox_config || null)
    } catch (err) {
      setError(err.message)
    }
  }
 
  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>
 
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: '#fff', margin: 0 }}>
            Automation Pipeline
          </h2>
          <SandboxBadge config={sandboxConfig} />
        </div>
 
        {/* Pipeline selector */}
        {pipelines.length > 1 && (
          <select
            value={selectedPipeline?.id || ''}
            onChange={e => {
              const p = pipelines.find(p => p.id === parseInt(e.target.value))
              if (p) setSelectedPipeline(p)
            }}
            style={{
              padding: '8px 14px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)', color: '#fff',
              fontSize: '14px', fontFamily: 'DM Sans, sans-serif'
            }}
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>
 
      {error && <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
 
      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'TOTAL', value: pipelineData.length, color: '#fff' },
          { label: 'ACTIVE', value: pipelineData.filter(r => { const s = getCurrentStage(r); return s !== 'complete' && s !== 'closed' }).length, color: '#3b82f6' },
          { label: 'COMPLETE', value: pipelineData.filter(r => getCurrentStage(r) === 'complete').length, color: '#22c55e' },
          { label: 'CLOSED', value: pipelineData.filter(r => getCurrentStage(r) === 'closed').length, color: '#ef4444' },
          { label: 'SANDBOX', value: pipelineData.filter(r => r.sandbox).length, color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '14px 20px', minWidth: '100px'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#8bacc8', letterSpacing: '1px' }}>{stat.label}</div>
          </div>
        ))}
      </div>
 
      {/* Pipeline table */}
      {pipelineData.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px',
          background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <p style={{ color: '#8bacc8', fontSize: '15px', marginBottom: '8px' }}>No clients in pipeline yet</p>
          <p style={{ color: '#5a8ab5', fontSize: '13px' }}>Clients will appear here as they enter the automation flow</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['Client', 'Member', 'PF', 'Stage', 'Decision', 'Service', 'Payment', 'Updated'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left', fontSize: '10px',
                    color: '#5a8ab5', letterSpacing: '1px', textTransform: 'uppercase',
                    fontWeight: '600'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipelineData.map(row => {
                const stage = getCurrentStage(row)
                const stageColor = STAGE_COLORS[stage] || '#8bacc8'
                return (
                  <tr key={row.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px', fontSize: '14px', color: '#fff' }}>
                      <div>{row.client_name || row.client_ref || '—'}</div>
                      {row.sandbox && (
                        <span style={{ fontSize: '10px', color: '#f59e0b', fontStyle: 'italic' }}>sandbox</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>
                      {row.member_name || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>
                      {row.pf || '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '4px', fontSize: '11px',
                        fontWeight: '600', background: `${stageColor}18`,
                        color: stageColor, border: `1px solid ${stageColor}33`
                      }}>
                        {STAGE_LABELS[stage] || stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>
                      {row.c15_final_decision || row.c13_decision || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>
                      {row.service_level || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>
                      {row.pay1_status || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#5a8ab5' }}>
                      {row.updated_at ? row.updated_at.split('T')[0] : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}