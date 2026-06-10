import { Fragment } from 'react'

// Purely presentational track-view kit — progress hero + phase badges.
// No API calls, no state, no business logic: callers pass display data only.

// Numbered circle for phase-card headers. done = green check, active = blue
// gradient number, pending = tinted grey number.
export function PhaseBadge({ number, state }) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  return (
    <div style={{
      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: 700, fontFamily: 'Inter, sans-serif', lineHeight: 1,
      background: isDone ? '#1b9254' : isActive ? 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)' : '#eef2f9',
      color: (isDone || isActive) ? '#ffffff' : '#4e6087',
      border: (isDone || isActive) ? 'none' : '1px solid #dde5f2',
      boxShadow: isActive ? '0 2px 8px rgba(18,94,204,0.28)' : 'none',
    }}>
      {isDone ? '✓' : number}
    </div>
  )
}

// Horizontal mini-stepper: one node per phase, connected by lines.
// steps: [{ label, state: 'done' | 'active' | 'pending' }]
function PhaseStepper({ steps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #eef2f9' }}>
      {steps.map((s, i) => {
        const isDone = s.state === 'done'
        const isActive = s.state === 'active'
        const lineDone = i > 0 && steps[i - 1].state === 'done'
        return (
          <Fragment key={i}>
            {i > 0 && <div style={{ flex: 1, height: '2px', borderRadius: '2px', background: lineDone ? 'rgba(27,146,84,0.4)' : '#e3eaf5', margin: '10px 4px 0', minWidth: '10px' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', maxWidth: '96px', flexShrink: 0 }}>
              <div style={{
                width: '21px', height: '21px', borderRadius: '50%', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, lineHeight: 1,
                background: isDone ? '#1b9254' : '#ffffff',
                border: isDone ? 'none' : isActive ? '2px solid #0a85e8' : '2px solid #dde5f2',
                color: isDone ? '#ffffff' : isActive ? '#125ecc' : '#9aa6bf',
                boxShadow: isActive ? '0 2px 8px rgba(18,94,204,0.22)' : 'none',
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <div style={{
                fontSize: '10px', fontWeight: 600, lineHeight: 1.25, textAlign: 'center',
                color: isActive ? '#125ecc' : isDone ? '#4e6087' : '#9aa6bf',
              }}>{s.label}</div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// Designed progress hero for track views: gradient accent strip, eyebrow +
// title, optional meta line, % + progress bar (when completed/total given),
// optional right-side action node, optional phase stepper.
export function TrackHero({ eyebrow, title, meta, action, completed, total, unitLabel = 'tasks completed', steps }) {
  const hasBar = typeof total === 'number' && total > 0
  const pct = hasBar ? Math.round(completed / total * 100) : 0
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', marginBottom: '20px', overflow: 'hidden' }}>
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 55%, #0a85e8 100%)' }} />
      <div style={{ padding: '18px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '200px', flex: 1 }}>
            {eyebrow && <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', color: '#0095ff', textTransform: 'uppercase', marginBottom: '5px' }}>{eyebrow}</div>}
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: '#002973', lineHeight: 1.15 }}>{title}</div>
            {meta && <div style={{ fontSize: '12.5px', color: '#4e6087', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{meta}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {hasBar && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', color: '#125ecc', lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', color: '#4e6087', marginTop: '5px', textTransform: 'uppercase' }}>{completed} / {total} {unitLabel}</div>
              </div>
            )}
            {action}
          </div>
        </div>
        {hasBar && (
          <div style={{ marginTop: '14px', height: '8px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #e3eaf5', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #125ecc 0%, #0a85e8 100%)', transition: 'width 0.3s' }} />
          </div>
        )}
        {steps && steps.length > 0 && <PhaseStepper steps={steps} />}
      </div>
    </div>
  )
}

// Designed header row for list views (e.g. "Tax Plans", "Regular Priorities"):
// navy title + count chip on the left, caller-provided action on the right.
export function ListHeader({ title, count, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em', color: '#002973' }}>{title}</span>
        {typeof count === 'number' && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>{count}</span>}
      </div>
      {action}
    </div>
  )
}
