import { useState, useEffect, useCallback } from 'react'
import { callApi } from '../../lib/api'
import GrowthOnePage from '../growth/GrowthOnePage'
import MemberAddPriority from './MemberAddPriority'

// Member-portal Growth Plan. The member sees their One Page Plan (G5) — read-only
// normally; once their coach turns on Accountability Mode, the per-row progress
// dropdowns become editable. They also get a Parking Garage where, under
// accountability, they can add a parked action back to their plan or drop it.
// All loaded self-scoped: the member's session scopes growth_plan_load.
export default function MemberGrowthPlan({ memberNumber }) {
  const [bundle, setBundle] = useState({ score: null, actions: [], partnerships: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('onepage')

  const reload = useCallback(async () => {
    try {
      const res = await callApi('growth_plan_load', {})
      setBundle({ score: res.score || null, actions: res.actions || [], partnerships: res.partnerships || [] })
      setError('')
    } catch (e) {
      setError(e?.message || 'Failed to load your Growth Plan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { setLoading(true); reload() }, [reload])

  if (loading) return <Msg text="Loading your Growth Plan…" />
  if (error) return <Msg text={error} />
  if (!bundle.score) return <Msg text="Your Growth Plan hasn't been set up yet — your coach will build it with you." />

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <TabBtn active={view === 'onepage'} onClick={() => setView('onepage')}>One Page Plan</TabBtn>
        <TabBtn active={view === 'add'} onClick={() => setView('add')}>Add a Priority</TabBtn>
      </div>
      {view === 'onepage'
        ? <GrowthOnePage role="member" memberNumber={memberNumber} bundle={bundle} reload={reload} onNavigate={() => {}} />
        : <MemberAddPriority memberNumber={memberNumber} bundle={bundle} reload={reload} />}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      fontSize: '13px', fontWeight: active ? 700 : 600,
      border: active ? 'none' : '1px solid #cdddf5',
      background: active ? 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)' : '#fff',
      color: active ? '#fff' : '#4e6087',
    }}>{children}</button>
  )
}

function Msg({ text }) {
  return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4e6087', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{text}</div>
}
