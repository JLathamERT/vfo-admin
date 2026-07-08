import { useState } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { StepNav, cardStyle, inputStyle, eyebrowLabel, INK, MUTED } from './ui'
import { getGrowthConfig, FOUR_WAYS_PRINCIPLES } from './constants'

// "4 Ways to Grow a Business" — the big-picture-focus questionnaire that precedes
// Scoring Growth. Admin/MSM picks the member's type, ranks the four growth
// focuses (1–4 or N/A, a true ranking — no number reused), answers a conditional
// question, and gets a priority-ordered summary. Content is variant-driven
// (advisor / accountant). Persisted per member via growth_plan_save_four_ways.

// Apply any locked-to-N/A rows for the chosen type (advisor Type 3).
function effectivePriorities(memberType, priorities, focuses) {
  const eff = { ...priorities }
  if (memberType === 'type3') {
    for (const f of focuses) if (f.lockedForType3) eff[f.key] = 'na'
  }
  return eff
}

export default function Growth4Ways({ memberNumber, bundle, reload, onNavigate, variant }) {
  const cfg = getGrowthConfig(variant)
  const focuses = cfg.fourWaysFocuses
  const conditional = cfg.fourWaysConditional
  const saved = bundle.four_ways || null
  const [memberType, setMemberType] = useState(saved?.member_type || '')
  const [priorities, setPriorities] = useState(() => ({ ...(saved?.priorities || {}) }))
  const [conditionalAnswer, setConditionalAnswer] = useState(saved?.accountant_interest || '')
  const [saving, setSaving] = useState(false)

  const eff = effectivePriorities(memberType, priorities, focuses)
  const triggerRank = eff[conditional.triggerKey]
  const showConditional = triggerRank === 1 || triggerRank === 2
  const conditionalOptions = showConditional ? conditional.optionsFor(memberType) : []

  function setPriority(key, val) { setPriorities(p => ({ ...p, [key]: val })) }
  function pickType(val) { setMemberType(val) }

  // Continue saves this section, then advances — no separate Save button.
  async function saveAndContinue() {
    if (!memberType) { alert('Select a type to continue.'); return }
    setSaving(true)
    try {
      await callApi('growth_plan_save_four_ways', {
        member_number: memberNumber,
        member_type: memberType,
        priorities: eff,
        accountant_interest: showConditional ? conditionalAnswer : '',
      })
      await reload()
      onNavigate('gp_score')
    } catch (e) { alert(e?.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  // Focuses given a numeric rank, in priority order (ties break by focus order).
  const ranked = focuses
    .map((f, i) => ({ f, i, rank: eff[f.key] }))
    .filter(r => typeof r.rank === 'number')
    .sort((a, b) => a.rank - b.rank || a.i - b.i)

  return (
    <div>
      <TrackHero eyebrow="Growth Plan" title="4 Ways to Grow a Business" />

      {/* Principles */}
      <div style={cardStyle}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)' }} />
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '13.5px', color: INK, fontWeight: 700, lineHeight: 1.5 }}>
            The Growth Plan is built around the principles of 4 Ways to Grow Business Profits
          </div>
          <ol style={{ margin: '14px 0 0', paddingLeft: '22px', color: INK }}>
            {FOUR_WAYS_PRINCIPLES.map((p, i) => (
              <li key={i} style={{ fontSize: '13.5px', lineHeight: 1.9 }}>{p}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* Member type */}
      <div style={cardStyle}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #125ecc 0%, #0a85e8 100%)' }} />
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--vfo-heading)', letterSpacing: '-0.01em' }}>{cfg.typeLabel}</div>
          <div style={{ fontSize: '12.5px', color: MUTED, margin: '6px 0 12px' }}>{cfg.typeHelper}</div>
          <select value={memberType} onChange={e => pickType(e.target.value)} style={{ ...inputStyle, minWidth: '240px' }}>
            <option value="">{cfg.typePlaceholder}</option>
            {cfg.memberTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Priority order */}
      {memberType ? (
        <div style={cardStyle}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #125ecc 0%, #0a85e8 100%)' }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--vfo-heading)', letterSpacing: '-0.01em' }}>Your Priority Order</div>
            <div style={{ fontSize: '12.5px', color: MUTED, margin: '6px 0 6px' }}>Rank each focus 1–4 (or mark N/A). Each number can be used only once.</div>
            {focuses.map(f => {
              const locked = memberType === 'type3' && f.lockedForType3
              // A true ranking — numbers already used on OTHER focuses are disabled here.
              const taken = new Set(focuses.filter(o => o.key !== f.key).map(o => eff[o.key]).filter(v => typeof v === 'number'))
              return (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '13px 0', borderTop: '1px solid var(--vfo-tint)' }}>
                  <div style={{ fontSize: '13.5px', color: INK, lineHeight: 1.4, flex: '1 1 260px' }}>{f.row}</div>
                  <PriorityPicker value={eff[f.key]} onChange={v => setPriority(f.key, v)} disabled={locked} takenNumbers={taken} />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: '30px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>
          Select a type above to set the priority order.
        </div>
      )}

      {/* Conditional question */}
      {memberType && showConditional && (
        <div style={{ ...cardStyle, border: '1px solid #cfe0ff' }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #0a85e8 0%, #002973 100%)' }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: '13.5px', color: INK, marginBottom: '12px', lineHeight: 1.5 }}>
              {conditional.question}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {conditionalOptions.map(o => {
                const on = conditionalAnswer === o.value
                return (
                  <button key={o.value} onClick={() => setConditionalAnswer(o.value)} style={segBtnStyle(on, false)}>{o.label}</button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={cardStyle}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 55%, #0a85e8 100%)' }} />
        <div style={{ padding: '22px 24px' }}>
          <div style={eyebrowLabel}>Growth Plan Big Picture Focus in Summary</div>
          <div style={{ fontSize: '12.5px', color: MUTED, margin: '6px 0 4px' }}>This produces a summary of the above answers.</div>
          {ranked.length === 0 ? (
            <div style={{ fontSize: '13px', color: MUTED, marginTop: '14px' }}>Rank at least one focus above to see the summary.</div>
          ) : (
            <div style={{ marginTop: '16px' }}>
              {ranked.map(({ f, rank }, idx) => (
                <div key={f.key} style={{ display: 'flex', gap: '14px', alignItems: 'baseline', padding: '14px 0', borderTop: idx > 0 ? '1px solid var(--vfo-tint)' : 'none' }}>
                  <div style={{ ...eyebrowLabel, whiteSpace: 'nowrap', minWidth: '150px', color: '#0095ff' }}>GROWTH FOCUS - Priority {rank}</div>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--vfo-heading)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>{f.title}</div>
                    {f.sub && <div style={{ fontSize: '12.5px', color: MUTED, marginTop: '3px', lineHeight: 1.4 }}>{f.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <StepNav
        onNext={saveAndContinue}
        nextLabel="Continue to Scoring →"
        busy={saving}
        secondary={!memberType && <span style={{ fontSize: '12px', color: MUTED }}>Select a type to continue.</span>}
      />
    </div>
  )
}

function segBtnStyle(on, disabled) {
  return {
    minWidth: '40px', padding: '8px 14px', borderRadius: '8px',
    border: on ? 'none' : '1px solid var(--vfo-border-strong)',
    background: on ? 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)' : 'var(--vfo-card)',
    color: on ? '#fff' : (disabled ? 'var(--vfo-faint)' : 'var(--vfo-muted)'),
    fontWeight: on ? 700 : 600, fontSize: '13px', fontFamily: 'Inter, sans-serif',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled && !on ? 0.5 : 1,
  }
}

function PriorityPicker({ value, onChange, disabled, takenNumbers }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4].map(n => {
        const off = disabled || (takenNumbers && takenNumbers.has(n) && value !== n)
        return <button key={n} disabled={off} onClick={() => onChange(n)} style={segBtnStyle(value === n, off)}>{n}</button>
      })}
      <button disabled={disabled} onClick={() => onChange('na')} style={segBtnStyle(value === 'na', disabled)}>N/A</button>
    </div>
  )
}
