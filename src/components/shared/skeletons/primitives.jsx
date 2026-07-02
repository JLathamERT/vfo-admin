// Skeleton primitives — the building blocks every page skeleton composes.
// All colors come from the --vfo-* palette so skeletons render correctly in
// both light and dark mode. The shimmer itself is the .vfo-skeleton class in
// index.css.

export function Skeleton({ width = '100%', height = 16, style = {}, className = '' }) {
  return <span className={`vfo-skeleton ${className}`} style={{ width, height, ...style }} />
}

export function SkeletonText({ lines = 3, width = '100%', spacing = 8, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : width} height={14} />
      ))}
    </div>
  )
}

export function SkeletonRow({ withPill = true, withDate = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)' }}>
      <Skeleton width={8} height={8} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <Skeleton width="60%" height={14} style={{ flex: 1 }} />
      {withPill && <Skeleton width={70} height={20} style={{ borderRadius: '999px' }} />}
      {withDate && <Skeleton width={55} height={12} />}
    </div>
  )
}

// The standard freshened section card (white 16px-radius card w/ soft shadow).
export function CardShell({ children, pad = 24, style = {} }) {
  return (
    <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: pad, marginBottom: '16px', ...style }}>
      {children}
    </div>
  )
}

export function SkeletonCard({ rows = 3, title = true }) {
  return (
    <CardShell>
      {title && <Skeleton width="40%" height={16} style={{ marginBottom: '16px' }} />}
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </CardShell>
  )
}

export function SkeletonStats({ count = 3 }) {
  return (
    <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', paddingLeft: '24px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <Skeleton width={36} height={28} />
          <Skeleton width={64} height={10} />
        </div>
      ))}
    </div>
  )
}

// Mirrors TrackHero / PanelHero: gradient accent strip, eyebrow, big navy
// title, optional meta line, optional stat row and right-side action slot.
export function HeroSkeleton({ stats = 0, action = true, meta = true, progress = false }) {
  return (
    <CardShell pad={0} style={{ overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 55%, #0a85e8 100%)' }} />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: '220px' }}>
            <Skeleton width={110} height={10} />
            <Skeleton width={250} height={24} />
            {meta && <Skeleton width={190} height={12} />}
          </div>
          {action && <Skeleton width={130} height={34} style={{ borderRadius: '999px' }} />}
        </div>
        {progress && <Skeleton width="100%" height={8} style={{ borderRadius: '99px', marginTop: '16px' }} />}
        {stats > 0 && (
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginTop: '18px' }}>
            {Array.from({ length: stats }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Skeleton width={34} height={24} />
                <Skeleton width={62} height={9} />
              </div>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  )
}

// Mirrors ListHeader: big title + count chip, optional action on the right.
export function ListHeaderSkeleton({ action = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Skeleton width={140} height={24} />
        <Skeleton width={44} height={20} style={{ borderRadius: '999px' }} />
      </div>
      {action && <Skeleton width={120} height={34} style={{ borderRadius: '8px' }} />}
    </div>
  )
}

// Search input + filter pill + sort select (the standard list toolbar).
export function SearchFilterSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <Skeleton width="100%" height={42} style={{ flex: 1, borderRadius: '10px' }} />
      <Skeleton width={84} height={36} style={{ borderRadius: '999px', flexShrink: 0 }} />
      <Skeleton width={150} height={36} style={{ borderRadius: '8px', flexShrink: 0 }} />
    </div>
  )
}

// Generic grid table: header strip, N data rows, optional navy totals row.
// cols is either a number or an array of relative widths (e.g. [2,1,1,1]).
export function TableSkeleton({ cols = 5, rows = 3, totals = false, card = true }) {
  const widths = Array.isArray(cols) ? cols : Array.from({ length: cols }).map(() => 1)
  const grid = widths.map(w => `${w}fr`).join(' ')
  const body = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '11px 18px', background: 'var(--vfo-input)', borderBottom: '2px solid var(--vfo-border)', alignItems: 'center' }}>
        {widths.map((_, i) => <Skeleton key={i} width="55%" height={10} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '13px 18px', borderBottom: '1px solid var(--vfo-border-soft)', alignItems: 'center' }}>
          {widths.map((_, i) => <Skeleton key={i} width={i === 0 ? '80%' : '60%'} height={13} />)}
        </div>
      ))}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '13px 18px', background: 'var(--vfo-tint)', alignItems: 'center' }}>
          {widths.map((_, i) => <Skeleton key={i} width={i === 0 ? '40%' : '50%'} height={13} />)}
        </div>
      )}
    </>
  )
  if (!card) return <div>{body}</div>
  return <CardShell pad={0} style={{ overflow: 'hidden' }}>{body}</CardShell>
}

// A stack of simple section cards (generic profile-ish tab).
export function ProfileTabSkeleton({ sections = 3 }) {
  return (
    <div>
      {Array.from({ length: sections }).map((_, i) => (
        <CardShell key={i} style={{ marginBottom: '20px' }}>
          <Skeleton width={120} height={11} style={{ marginBottom: '16px' }} />
          <Skeleton width="35%" height={20} />
        </CardShell>
      ))}
    </div>
  )
}

// A public token-page card body (title, a few lines, a button) — used by the
// /pay, /decide, setup and form pages while the token loads.
export function TokenFormSkeleton() {
  return (
    <div style={{ padding: '8px 0' }}>
      <Skeleton width={200} height={22} style={{ marginBottom: '14px' }} />
      <SkeletonText lines={3} />
      <Skeleton width={180} height={42} style={{ borderRadius: '10px', marginTop: '20px' }} />
    </div>
  )
}
