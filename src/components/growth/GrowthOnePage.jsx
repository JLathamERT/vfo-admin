import { TrackHero } from '../shared/TrackKit'
import { NAVY, INK, MUTED, cardStyle, accentStrip, GrowthNeed, StepNav } from './ui'

// Rows top→bottom = High/Medium/Low Value; cols left→right = Low/Medium/High Effort
// (matches the legacy matrix orientation: top-left = high value / low effort).
const VALUE_ROWS = [{ key: 'high', label: 'High Value' }, { key: 'medium', label: 'Medium Value' }, { key: 'low', label: 'Low Value' }]
const EFFORT_COLS = [{ key: 'low', label: 'Low Effort' }, { key: 'medium', label: 'Medium Effort' }, { key: 'high', label: 'High Effort' }]

// Blue gradient scale across the 9 quadrants: deepest at high-value/high-effort
// (top-right) → lightest at low-value/low-effort (bottom-left).
const V_WEIGHT = { high: 2, medium: 1, low: 0 }
const E_WEIGHT = { high: 2, medium: 1, low: 0 }
const CELL_BLUES = ['#e3edfc', '#c3d9f7', '#94bbef', '#5b93e4', '#2f6fd6']
function cellBg(vKey, eKey) {
  const d = (V_WEIGHT[vKey] ?? 1) + (E_WEIGHT[eKey] ?? 1)
  return CELL_BLUES[d]
}

export default function GrowthOnePage({ bundle, onNavigate }) {
  if (!bundle.score) return <GrowthNeed text="Complete Scoring Growth first." cta="Go to Scoring Growth" onClick={() => onNavigate('gp_score')} />

  const op = (bundle.actions || [])
    .filter(a => a.g3_status === 'one_page_plan')
    .sort((a, b) => a.action_number - b.action_number)
  if (!op.length) return <GrowthNeed text="No actions are in the One Page Plan yet — complete the earlier steps first." cta="Go to Build One Page Plan" onClick={() => onNavigate('gp_build')} />

  // Single shared 1..N numbering by priority — used in the matrix and both tables.
  const numbered = op.map((a, i) => ({ ...a, num: i + 1 }))
  const news = numbered.filter(a => a.g3_action_type === 'new')
  const ongoing = numbered.filter(a => a.g3_action_type !== 'new')

  const dateStr = new Date(bundle.score.completed_at || bundle.score.created_at)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <TrackHero eyebrow="Growth Plan" title="One Page Growth Plan" meta={<>Plan for the road ahead · <strong style={{ color: '#243757' }}>{dateStr}</strong></>} />

      <div style={cardStyle}>
        <div style={accentStrip} />
        <div style={{ padding: '20px' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '540px' }}>
              <Matrix items={numbered} />
            </div>
          </div>
        </div>
      </div>

      <ActionTable title="New Action Items" rows={news} />
      <ActionTable title="Ongoing Action Items" rows={ongoing} />
      <StepNav onBack={() => onNavigate('gp_build')} />
    </div>
  )
}

function Matrix({ items }) {
  const cols = '120px repeat(3, 1fr)'
  const last = VALUE_ROWS.length - 1
  return (
    <div style={{ border: '1px solid #cdddf5', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: '#fff' }}>
        <div style={{ borderBottom: '1px solid #e9eef8' }} />
        {EFFORT_COLS.map(c => (
          <div key={c.key} style={{ ...colHeader, borderBottom: '1px solid #e9eef8' }}>{c.label}</div>
        ))}
      </div>
      {VALUE_ROWS.map((vr, ri) => (
        <div key={vr.key} style={{ display: 'grid', gridTemplateColumns: cols }}>
          <div style={{ ...rowHeader, background: '#fff', borderBottom: ri < last ? '1px solid #e9eef8' : 'none' }}>{vr.label}</div>
          {EFFORT_COLS.map((ec, ci) => {
            const cellItems = items.filter(a => (a.value_level || 'medium') === vr.key && (a.effort_level || 'medium') === ec.key)
            return (
              <div key={ec.key} style={{ ...matrixCell, background: cellBg(vr.key, ec.key), borderLeft: ci === 0 ? '1px solid #e9eef8' : '1px solid rgba(255,255,255,0.5)', borderBottom: ri < last ? '1px solid rgba(255,255,255,0.5)' : 'none' }}>
                {cellItems.map(a => <MatrixDot key={a.id} num={a.num} />)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Dots must stand out on any quadrant shade. White fill now (navy number, faint
// navy ring); when Accountability Mode passes a `color`, the fill becomes that
// bright status color with a white ring so it still pops on the blue cells.
function MatrixDot({ num, color }) {
  const filled = !!color
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%',
      background: color || '#ffffff',
      color: filled ? '#ffffff' : NAVY,
      fontWeight: 800, fontSize: '14px', fontFamily: 'Inter, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: filled ? '2px solid #ffffff' : '2px solid rgba(0,41,115,0.18)',
      boxShadow: '0 2px 8px rgba(0,20,60,0.40)',
    }}>{num}</div>
  )
}

function ActionTable({ title, rows }) {
  return (
    <div style={cardStyle}>
      <div style={accentStrip} />
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: NAVY, marginBottom: rows.length ? '10px' : 0 }}>{title}</div>
        {rows.length === 0
          ? <div style={{ fontSize: '12.5px', color: MUTED }}>None.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                <thead>
                  <tr>
                    <th style={th(40)}>#</th>
                    <th style={th()}>Action</th>
                    <th style={th(150)}>Owned By</th>
                    <th style={th(150)}>Assisted By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => (
                    <tr key={a.id}>
                      <td style={{ ...td, fontWeight: 700, color: NAVY }}>{a.num}</td>
                      <td style={td}>{a.action_text}</td>
                      <td style={td}>{a.owned_by || '—'}</td>
                      <td style={td}>{a.assisted_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}

const colHeader = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: NAVY, textAlign: 'center', padding: '11px 8px' }
const rowHeader = { fontSize: '11px', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right', padding: '0 12px' }
const matrixCell = { minHeight: '80px', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', alignItems: 'center', alignContent: 'center' }
const th = (w) => ({ textAlign: 'left', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#7c8aa6', padding: '6px 10px', borderBottom: '2px solid #eef2f9', width: w ? `${w}px` : 'auto' })
const td = { fontSize: '13px', color: INK, padding: '9px 10px', borderBottom: '1px solid #eef2f9', verticalAlign: 'top', lineHeight: 1.45 }
