// Read-only pricing + revenue-split summary for a MAP 1 engagement, sitting directly
// under the MAP 1 hero. Mirrors the tax track's PricingSplitCard visually, but MAP 1 is
// simpler in three ways and deliberately does NOT share that component:
//   - two legs (member / VFO), no tax planner
//   - no split_type column on pipeline_map1, so no preset label to show
//   - N equal installments rather than a retainer + implementation pair
//
// No editing here — this only tells you what is going to happen. MAP 1 splits are set
// through the normal pricing flow or the Payment Continuation tool.
//
// Admin surface only; the caller gates it out of the member view. Tax planners never
// reach the MAP 1 tab at all.
//
// UNITS: member_share / vfos_share are dollars of the WHOLE engagement, and each
// installment pays share ÷ gross × installment — the same proration the payout engine
// (contract-revshare.ts) uses. The table shows the per-installment dollars.

const money = v => parseFloat(String(v ?? '0').replace(/[,$]/g, '')) || 0
const round2 = x => Math.round(x * 100) / 100
const fmt = n => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TERMINAL = ['Yes', 'Money Mapping', 'N/A — No Share Due']

function legNote(status, isHistoric) {
  if (isHistoric && status === 'N/A — No Share Due') return 'settled on old system'
  if (!status) return ''
  if (status === 'Yes') return 'paid'
  if (status === 'Money Mapping') return 'money mapping'
  if (status === 'N/A — No Share Due') return 'no share due'
  if (status === 'Failed') return 'failed — retrying'
  if (status === 'Pending') return 'in progress'
  return String(status).toLowerCase()
}

function noteColor(status) {
  if (status === 'Yes') return '#1b9254'
  if (status === 'Failed') return '#b9451d'
  return 'var(--vfo-muted)'
}

const label = { fontSize: '11px', color: 'var(--vfo-muted)' }
const value = { fontSize: '13px', color: 'var(--vfo-ink)', fontWeight: 600 }
const th = { textAlign: 'right', padding: '6px 8px', color: 'var(--vfo-muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--vfo-border-soft)' }
const td = { padding: '7px 8px', textAlign: 'right', color: 'var(--vfo-ink)', borderBottom: '1px solid var(--vfo-border-soft)' }

export default function Map1PricingSplitCard({ plan, expanded, onToggle }) {
  const net = money(plan?.net_invoice)
  const grossRaw = money(plan?.gross_fee)
  const gross = grossRaw > 0 ? grossRaw : net
  const hasPricing = net > 0

  const isQuarterly = plan?.payment_plan === 'Quarterly'
  const n = isQuarterly ? 4 : 1
  const perInstalment = n > 0 ? round2(net / n) : net

  const memberRaw = plan?.member_share == null || plan?.member_share === '' ? null : money(plan.member_share)
  const vfosRaw = plan?.vfos_share == null || plan?.vfos_share === '' ? null : money(plan.vfos_share)
  const stratRaw = plan?.strategic_partner_share == null || plan?.strategic_partner_share === '' ? null : money(plan.strategic_partner_share)

  // Same proration as the payout engine, applied identically to every leg.
  const portion = raw => (raw == null ? null : (gross > 0 ? round2((raw / gross) * perInstalment) : round2(raw / n)))

  const isHistoric = !!plan?.legacy_source

  const rows = [
    { key: 'member', name: 'Member', per: portion(memberRaw) },
    ...(stratRaw ? [{ key: 'strat', name: 'Strategic partner', per: portion(stratRaw) }] : []),
    { key: 'vfos', name: 'VFO Services', per: portion(vfosRaw) },
  ]

  const instalments = Array.from({ length: n }, (_, i) => i + 1)
  const paidCount = instalments.filter(i => TERMINAL.includes(plan?.[`rec${i}_rev_paid`])).length

  const summary = hasPricing
    ? `${fmt(net)} · ${isQuarterly ? `Quarterly, ${paidCount}/${n} settled` : 'Paid in full'}${plan?.service_level ? ` (${plan.service_level})` : ''}`
    : 'No pricing entered yet'

  return (
    <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border)', borderRadius: '10px', padding: '9px 14px', marginBottom: '14px', fontFamily: 'Inter, sans-serif' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--vfo-muted)', fontSize: '9px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vfo-heading)' }}>Pricing &amp; revenue split</span>
        <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>{summary}</span>
        {isHistoric && (
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Migrated</span>
        )}
      </div>

      {expanded && !hasPricing && (
        <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '10px' }}>No pricing entered for this engagement yet.</div>
      )}

      {expanded && hasPricing && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px 20px', marginBottom: '14px' }}>
            <div>
              <div style={label}>Net invoice</div>
              <div style={value}>{fmt(net)}</div>
              <div style={{ fontSize: '10px', color: 'var(--vfo-muted)' }}>{plan?.service_level || 'No service level'}</div>
            </div>
            {grossRaw > 0 && (
              <div>
                <div style={label}>Gross fee</div>
                <div style={value}>{fmt(grossRaw)}</div>
                <div style={{ fontSize: '10px', color: 'var(--vfo-muted)' }}>shares are dollars of this</div>
              </div>
            )}
            <div>
              <div style={label}>Payment plan</div>
              <div style={value}>{isQuarterly ? '4 quarterly installments' : 'Paid in full'}</div>
              <div style={{ fontSize: '10px', color: 'var(--vfo-muted)' }}>{isQuarterly ? `${fmt(perInstalment)} each` : ''}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: `${180 + n * 100}px` }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Pays out to</th>
                  {instalments.map(i => (
                    <th key={i} style={th}>{n > 1 ? `Inst. ${i}` : 'Payment'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key}>
                    <td style={{ padding: '7px 8px', color: 'var(--vfo-ink)', borderBottom: '1px solid var(--vfo-border-soft)' }}>{r.name}</td>
                    {instalments.map(i => {
                      // Only the member leg carries a per-installment payout status;
                      // the VFO and strategic figures are informational.
                      const status = r.key === 'member' ? plan?.[`rec${i}_rev_paid`] : null
                      const note = legNote(status, isHistoric)
                      return (
                        <td key={i} style={td}>
                          {r.per == null ? '—' : fmt(r.per)}
                          {note && <div style={{ fontSize: '10px', color: noteColor(status) }}>{note}</div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isHistoric && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--vfo-muted)' }}>
              Migrated from the old system. Installments settled there pay out nothing here; the split applies to every installment still to be charged.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
