import { useState } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { INK, MUTED, GREEN, cardStyle, accentStrip, pillOutline, GrowthNeed, StepNav } from './ui'
import { CATEGORY_LABELS } from './constants'

const DROP = '#c2502f'

// Parking Garage — actions parked at G2 (g2_status='park') or G3 (g3_status='park').
// Send one back to Potential to re-prioritize it, or drop it for good. Both are
// just growth_plan_save_actions writes (logged as a 'parking_moved' audit event).
export default function GrowthParking({ memberNumber, bundle, reload, onNavigate, role = 'admin' }) {
  const isAdmin = role === 'admin'
  const score = bundle.score
  const acctOn = !!score?.accountability_mode
  const canEdit = isAdmin || acctOn // members may only add/drop while accountability is on
  const [busyId, setBusyId] = useState(null)

  if (!score) return <GrowthNeed text="Complete Scoring Growth first." cta="Go to Scoring Growth" onClick={() => onNavigate('gp_score')} />

  const parked = (bundle.actions || [])
    .filter(a => a.g2_status === 'park' || a.g3_status === 'park')
    .sort((a, b) => a.action_number - b.action_number)

  async function move(a, patch) {
    setBusyId(a.id)
    try {
      await callApi('growth_plan_save_actions', {
        member_number: memberNumber,
        event: 'parking_moved',
        updates: [{ id: a.id, ...patch }],
      })
      await reload()
    } catch (e) { alert(e?.message || 'Failed to update') }
    finally { setBusyId(null) }
  }

  return (
    <div>
      <TrackHero eyebrow="Growth Plan" title="Parking Garage" meta={isAdmin ? <>Actions you parked for later — send one back to Potential to re-prioritize it, or drop it for good.</> : <>Actions parked for later — add one back to your plan, or drop it.</>} />
      <div style={cardStyle}>
        <div style={accentStrip} />
        <div style={{ padding: '18px 20px' }}>
          {parked.length === 0
            ? <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>{isAdmin ? <>Nothing parked. Park an action in <strong>Possible Growth Actions</strong> or <strong>Prioritize Growth Actions</strong> and it will show up here.</> : 'Nothing parked.'}</div>
            : parked.map(a => (
              <div key={a.id} style={{ padding: '14px 0', borderTop: '1px solid #eef2f9', display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: '220px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#9aa6bf', marginBottom: '4px' }}>{CATEGORY_LABELS[a.category] || a.category}</div>
                  <div style={{ fontSize: '13.5px', color: INK, lineHeight: 1.5 }}>{a.action_text}</div>
                </div>
                {canEdit ? (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {isAdmin
                      ? <button disabled={busyId === a.id} onClick={() => move(a, { g2_status: 'potential', g3_status: '' })} style={{ ...pillOutline, borderColor: GREEN, color: GREEN, opacity: busyId === a.id ? 0.6 : 1 }}>↩ Move to Potential</button>
                      : <button disabled={busyId === a.id} onClick={() => move(a, { g3_status: 'one_page_plan', g2_status: 'potential' })} style={{ ...pillOutline, borderColor: GREEN, color: GREEN, opacity: busyId === a.id ? 0.6 : 1 }}>↩ Add to Plan</button>}
                    <button disabled={busyId === a.id} onClick={() => move(a, { g2_status: 'drop', g3_status: '' })} style={{ ...pillOutline, borderColor: DROP, color: DROP, opacity: busyId === a.id ? 0.6 : 1 }}>Drop</button>
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: '#9aa6bf', flexShrink: 0, paddingTop: '8px' }}>Read-only until accountability is on</span>
                )}
              </div>
            ))}
        </div>
      </div>
      <StepNav onBack={() => onNavigate('gp_onepage')} />
    </div>
  )
}
