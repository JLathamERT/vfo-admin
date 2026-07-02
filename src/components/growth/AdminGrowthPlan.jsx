import { useState, useEffect, useCallback } from 'react'
import { callApi } from '../../lib/api'
import GrowthScoring from './GrowthScoring'
import GrowthActions from './GrowthActions'
import GrowthPrioritize from './GrowthPrioritize'
import GrowthBuildPlan from './GrowthBuildPlan'
import GrowthOnePage from './GrowthOnePage'
import GrowthHistory from './GrowthHistory'
import { GP_STEPS } from './constants'

// Container for the Advisor Growth Plan tab in the admin member-detail view.
// Loads the member's current plan bundle once, then routes the active sub-tab
// (G1–G5 / Growth History) to its view. `onNavigate(stepKey)`
// lets a sub-view advance the outer tab (e.g. G2 "Prioritize" → G3).
export default function AdminGrowthPlan({ member, activeStep, onNavigate }) {
  const memberNumber = member?.plugin_member_number
  const memberName = member?.name
  const [bundle, setBundle] = useState({ score: null, actions: [], partnerships: [] })
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!memberNumber) return
    try {
      const res = await callApi('growth_plan_load', { member_number: memberNumber })
      setBundle({ score: res.score || null, actions: res.actions || [], partnerships: res.partnerships || [] })
      setError('')
    } catch (e) {
      setError(e?.message || 'Failed to load growth plan')
    } finally {
      setInitialLoading(false)
    }
  }, [memberNumber])

  useEffect(() => { setInitialLoading(true); reload() }, [reload])

  let step = activeStep && activeStep.startsWith('gp_') ? activeStep : 'gp_score'
  // Parking Garage is no longer a standalone tab — it lives in the One Page Plan.
  if (step === 'gp_parking') step = 'gp_onepage'

  if (initialLoading) return <GpMsg text="Loading growth plan…" />
  if (error) return <GpMsg text={error} retry={reload} />

  const common = { memberNumber, memberName, bundle, reload, onNavigate }

  switch (step) {
    case 'gp_score':
      return <GrowthScoring key={memberNumber} {...common} />
    case 'gp_actions':
      return <GrowthActions key={memberNumber} {...common} />
    case 'gp_prioritize':
      return <GrowthPrioritize key={memberNumber} {...common} />
    case 'gp_build':
      return <GrowthBuildPlan key={memberNumber} {...common} />
    case 'gp_onepage':
      return <GrowthOnePage key={memberNumber} {...common} />
    case 'gp_history':
      return <GrowthHistory key={memberNumber} {...common} />
    default: {
      const label = (GP_STEPS.find(s => s.key === step) || {}).label || 'Growth Plan'
      return <GpMsg text={`${label} — coming in the next build phase.`} />
    }
  }
}

function GpMsg({ text, retry }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vfo-muted)', fontSize: '14px' }}>
      {text}
      {retry && (
        <div style={{ marginTop: '12px' }}>
          <button onClick={retry} style={{ padding: '6px 16px', borderRadius: '999px', border: '1px solid #125ecc', background: 'transparent', color: '#125ecc', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Retry</button>
        </div>
      )}
    </div>
  )
}
