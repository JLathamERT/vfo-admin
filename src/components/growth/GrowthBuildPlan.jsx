import { useState } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { NAVY, inputStyle, cardStyle, accentStrip, miniLabel, NumBadge, Radios, GrowthNeed, StepNav } from './ui'

const LEVELS = [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]
const fieldGroup = { background: '#f7f9fc', border: '1px solid #e9eef8', borderRadius: '10px', padding: '11px 16px' }

export default function GrowthBuildPlan({ memberNumber, bundle, reload, onNavigate }) {
  const onePage = (bundle.actions || [])
    .filter(a => a.g3_status === 'one_page_plan')
    .sort((a, b) => a.action_number - b.action_number)
  const [rows, setRows] = useState(() => onePage.map(a => ({
    id: a.id, action_number: a.action_number, action_text: a.action_text || '',
    owned_by: a.owned_by || '', assisted_by: a.assisted_by || '',
    value_level: a.value_level || 'medium', effort_level: a.effort_level || 'medium',
  })))
  const [saving, setSaving] = useState(false)

  if (!bundle.score) return <GrowthNeed text="Complete Scoring Growth first." cta="Go to Scoring Growth" onClick={() => onNavigate('gp_score')} />
  if (!onePage.length) return <GrowthNeed text="No actions are in the One Page Plan yet — complete Prioritize Growth Actions first." cta="Go to Prioritize Growth Actions" onClick={() => onNavigate('gp_prioritize')} />

  function update(id, patch) { setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)) }

  async function save(target) {
    setSaving(true)
    try {
      await callApi('growth_plan_save_actions', {
        member_number: memberNumber,
        updates: rows.map(r => ({ id: r.id, owned_by: r.owned_by, assisted_by: r.assisted_by, value_level: r.value_level, effort_level: r.effort_level })),
      })
      await reload()
      onNavigate(target)
    } catch (e) { alert(e?.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <TrackHero
        eyebrow="Growth Plan"
        title="Build One Page Growth Plan"
        meta={<>Assign ownership and rate each action's value and effort.</>}
      />
      {rows.map((r, i) => (
        <div key={r.id} style={cardStyle}>
          <div style={accentStrip} />
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <NumBadge n={i + 1} />
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: NAVY, lineHeight: 1.5, paddingTop: '3px' }}>{r.action_text}</div>
            </div>
            <div style={{ paddingLeft: '34px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                  <div style={miniLabel}>Owned By</div>
                  <input value={r.owned_by} onChange={e => update(r.id, { owned_by: e.target.value })} placeholder="Name" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                  <div style={miniLabel}>Assisted By</div>
                  <input value={r.assisted_by} onChange={e => update(r.id, { assisted_by: e.target.value })} placeholder="Name" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={fieldGroup}>
                  <div style={miniLabel}>Value</div>
                  <div style={{ display: 'flex', gap: '14px' }}><Radios name={`v_${r.id}`} value={r.value_level} onChange={v => update(r.id, { value_level: v })} options={LEVELS} /></div>
                </div>
                <div style={fieldGroup}>
                  <div style={miniLabel}>Effort</div>
                  <div style={{ display: 'flex', gap: '14px' }}><Radios name={`e_${r.id}`} value={r.effort_level} onChange={v => update(r.id, { effort_level: v })} options={LEVELS} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <StepNav onBack={() => save('gp_prioritize')} onNext={() => save('gp_onepage')} nextLabel="View One Page Plan →" busy={saving} />
    </div>
  )
}
