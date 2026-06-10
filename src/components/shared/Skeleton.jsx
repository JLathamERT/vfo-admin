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
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8' }}>
      <Skeleton width={8} height={8} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <Skeleton width="60%" height={14} style={{ flex: 1 }} />
      {withPill && <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />}
      {withDate && <Skeleton width={55} height={12} />}
    </div>
  )
}

export function SkeletonCard({ rows = 3, title = true }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '16px' }}>
      {title && <Skeleton width="40%" height={16} style={{ marginBottom: '16px' }} />}
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

export function ProfileTabSkeleton({ sections = 3 }) {
  return (
    <div>
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }}>
          <Skeleton width={120} height={11} style={{ marginBottom: '16px' }} />
          <Skeleton width="35%" height={20} />
        </div>
      ))}
    </div>
  )
}

export function Map1TrackSkeleton({ phaseCount = 4, rowsPerPhase = 3 }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap', paddingLeft: '24px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <Skeleton width={36} height={28} />
            <Skeleton width={70} height={10} />
          </div>
        ))}
      </div>
      {Array.from({ length: phaseCount }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px 24px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={10} height={10} style={{ borderRadius: '50%' }} />
              <Skeleton width={180} height={14} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={60} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={10} height={10} />
            </div>
          </div>
          {Array.from({ length: rowsPerPhase }).map((_, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9eef8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Skeleton width={8} height={8} style={{ borderRadius: '50%' }} />
                <Skeleton width={200} height={14} />
              </div>
              <Skeleton width={120} height={32} style={{ borderRadius: '8px' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function PFTTrackSkeleton() {
  // Row counts roughly matching the real PFT phases (Preliminary Setup, Initial
  // Contact, Accountant Meeting 1, Accountant Meeting 2, ...).
  const phases = [1, 3, 5, 2, 2]
  return (
    <div>
      {phases.map((rows, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', marginBottom: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={9} height={9} style={{ borderRadius: '50%' }} />
              <Skeleton width={170} height={13} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={44} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={72} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={10} height={8} />
            </div>
          </div>
          <div style={{ borderTop: '1px solid #e3eaf5', padding: '12px 18px' }}>
            {Array.from({ length: rows }).map((_, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #e9eef8' }}>
                <Skeleton width={8} height={8} style={{ borderRadius: '50%', flexShrink: 0 }} />
                <Skeleton width="45%" height={13} style={{ flex: 1 }} />
                <Skeleton width={140} height={28} style={{ borderRadius: '6px' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TaxPlanListSkeleton({ count = 2 }) {
  return (
    <div>
      <Skeleton width={80} height={12} style={{ marginBottom: '14px' }} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '20px 24px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={90} height={16} />
            <Skeleton width={80} height={12} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton width={45} height={20} style={{ borderRadius: '4px' }} />
            <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
            <Skeleton width={50} height={14} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdvisorOnboardingDetailSkeleton({ onBack }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      )}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e3eaf5' }}>
        <Skeleton width={220} height={32} style={{ marginBottom: '8px' }} />
        <Skeleton width={180} height={14} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px 24px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={10} height={10} style={{ borderRadius: '50%' }} />
              <Skeleton width={220} height={14} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={10} height={10} />
            </div>
          </div>
          <div style={{ paddingLeft: '20px' }}>
            <SkeletonRow withPill withDate />
            <SkeletonRow withPill withDate />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PipMeetingsListSkeleton({ yearCount = 1, meetingsPerYear = 3 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Skeleton width={90} height={12} />
        <Skeleton width={110} height={32} style={{ borderRadius: '8px' }} />
      </div>
      {Array.from({ length: yearCount }).map((_, y) => (
        <div key={y} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'rgba(0,149,255,0.08)', border: '1px solid rgba(0,149,255,0.2)', borderRadius: '10px', marginBottom: '6px' }}>
            <Skeleton width={10} height={10} />
            <Skeleton width={60} height={14} />
            <Skeleton width={100} height={12} />
          </div>
          {Array.from({ length: meetingsPerYear }).map((_, i) => (
            <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '12px', boxShadow: '0 2px 10px rgba(20,45,95,0.05)', padding: '14px 18px', marginBottom: '8px', marginLeft: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Skeleton width={200} height={14} />
                <Skeleton width={120} height={11} />
              </div>
              <Skeleton width={50} height={13} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function PipMeetingDetailSkeleton() {
  return (
    <div>
      <Skeleton width={150} height={13} style={{ marginBottom: '20px' }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', marginBottom: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={9} height={9} style={{ borderRadius: '50%' }} />
              <Skeleton width={180} height={13} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={60} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={10} height={10} />
            </div>
          </div>
          <div style={{ borderTop: '1px solid #e9eef8', padding: '12px 18px' }}>
            {Array.from({ length: i === 1 ? 4 : 2 }).map((_, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #e9eef8' }}>
                <Skeleton width={8} height={8} style={{ borderRadius: '50%' }} />
                <Skeleton width="50%" height={13} style={{ flex: 1 }} />
                <Skeleton width={130} height={26} style={{ borderRadius: '6px' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdvisorOnboardingListSkeleton({ rows = 2 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={150} height={16} />
            <Skeleton width={240} height={12} />
          </div>
          <Skeleton width={130} height={20} style={{ borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  )
}

export function AccountantOnboardingDetailSkeleton({ onBack }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      )}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e3eaf5' }}>
        <Skeleton width={220} height={32} style={{ marginBottom: '8px' }} />
        <Skeleton width={180} height={14} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px 24px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={10} height={10} style={{ borderRadius: '50%' }} />
              <Skeleton width={220} height={14} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={10} height={10} />
            </div>
          </div>
          <div style={{ paddingLeft: '20px' }}>
            <SkeletonRow withPill withDate />
            <SkeletonRow withPill withDate />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AccountantOnboardingListSkeleton({ rows = 2 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={150} height={16} />
            <Skeleton width={240} height={12} />
          </div>
          <Skeleton width={130} height={20} style={{ borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  )
}

export function SpecialistOnboardingListSkeleton({ rows = 2 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={150} height={16} />
            <Skeleton width={240} height={12} />
          </div>
          <Skeleton width={150} height={20} style={{ borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  )
}

export function SpecialistOnboardingDetailSkeleton({ onBack }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <Skeleton width={200} height={28} style={{ marginBottom: '8px' }} />
          <Skeleton width={260} height={14} />
        </div>
        <Skeleton width={150} height={22} style={{ borderRadius: '4px' }} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', marginBottom: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={9} height={9} style={{ borderRadius: '50%' }} />
              <Skeleton width={220} height={13} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={75} height={20} style={{ borderRadius: '4px' }} />
              <Skeleton width={10} height={10} />
            </div>
          </div>
          {i === 1 && (
            <div style={{ borderTop: '1px solid #e9eef8', padding: '12px 18px' }}>
              <SkeletonRow withPill withDate />
              <SkeletonRow withPill withDate />
              <SkeletonRow withPill withDate />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function AdminProgramViewSkeleton() {
  return (
    <div>
      <Skeleton width={260} height={28} style={{ marginBottom: '20px' }} />
      <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={100} height={11} />
              <Skeleton width={110} height={15} />
            </div>
          ))}
        </div>
        <Skeleton width={50} height={28} style={{ borderRadius: '6px' }} />
      </div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '1px solid #e3eaf5', paddingBottom: '10px' }}>
        <Skeleton width={50} height={18} />
        <Skeleton width={80} height={18} />
        <Skeleton width={70} height={18} />
      </div>
      <ProgramNotesSkeleton />
    </div>
  )
}

export function ProgramNotesSkeleton({ rows = 2 }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Skeleton width={80} height={11} />
        <Skeleton width={90} height={26} style={{ borderRadius: '6px' }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #e9eef8' }}>
          <Skeleton width="85%" height={14} style={{ marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Skeleton width={70} height={11} />
            <Skeleton width={70} height={11} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminMsmHomeSkeleton() {
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  return (
    <div>
      <div style={sectionStyle}>
        <Skeleton width={120} height={11} style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Skeleton width={220} height={38} style={{ borderRadius: '8px' }} />
          <Skeleton width={70} height={36} style={{ borderRadius: '8px' }} />
        </div>
      </div>
      <div style={sectionStyle}>
        <Skeleton width={100} height={11} style={{ marginBottom: '16px' }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eef2f9' }}>
            <Skeleton width={180} height={14} />
            <Skeleton width={70} height={24} style={{ borderRadius: '12px' }} />
          </div>
        ))}
      </div>
      <div style={sectionStyle}>
        <Skeleton width={140} height={11} style={{ marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <Skeleton width={36} height={28} />
              <Skeleton width={100} height={10} />
            </div>
          ))}
        </div>
        <Skeleton width={150} height={36} style={{ borderRadius: '8px' }} />
      </div>
    </div>
  )
}

export function MemberProfileDetailsSkeleton() {
  return (
    <div>
      <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ flex: i === 1 ? 2 : 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={90} height={11} />
              <Skeleton width={130} height={15} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MsmHomeSkeleton({ programRows = 3, historyRows = 2 }) {
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={sectionStyle}>
        <Skeleton width={110} height={11} style={{ marginBottom: '12px' }} />
        <Skeleton width={170} height={16} />
      </div>
      <div style={sectionStyle}>
        <Skeleton width={120} height={11} style={{ marginBottom: '16px' }} />
        {Array.from({ length: programRows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eef2f9' }}>
            <Skeleton width={180} height={14} />
            <Skeleton width={90} height={13} />
          </div>
        ))}
      </div>
      <div style={sectionStyle}>
        <Skeleton width={140} height={11} style={{ marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <Skeleton width={36} height={28} />
              <Skeleton width={100} height={10} />
            </div>
          ))}
        </div>
      </div>
      <div style={sectionStyle}>
        <Skeleton width={130} height={11} style={{ marginBottom: '16px' }} />
        {Array.from({ length: historyRows }).map((_, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #eef2f9', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={130} height={14} />
            <Skeleton width={200} height={11} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CiqListSkeleton({ clientCards = 2 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Skeleton width={110} height={14} />
        <Skeleton width={130} height={36} style={{ borderRadius: '8px' }} />
      </div>
      {Array.from({ length: clientCards }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '14px' }}>
            <Skeleton width={150} height={16} />
            <Skeleton width={220} height={12} />
          </div>
          <div style={{ background: '#eef2f9', border: '1px solid #dde5f2', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={45} height={18} style={{ borderRadius: '4px' }} />
              <Skeleton width={140} height={13} />
            </div>
            <Skeleton width={70} height={13} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CoachingRenewalSkeleton({ historyRows = 2 }) {
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={90} height={10} />
              <Skeleton width={75} height={15} />
            </div>
          ))}
        </div>
      </div>
      <div style={sectionStyle}>
        <Skeleton width={130} height={12} style={{ marginBottom: '16px' }} />
        {Array.from({ length: historyRows }).map((_, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #eef2f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Skeleton width={70} height={18} style={{ borderRadius: '4px' }} />
            <Skeleton width={90} height={14} />
            <Skeleton width={50} height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CoachingMeetingsSkeleton({ upcomingRows = 2, historyRows = 3 }) {
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  const meetingRow = (i) => (
    <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #eef2f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Skeleton width={90} height={14} />
      <Skeleton width={70} height={18} style={{ borderRadius: '4px' }} />
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', gap: '32px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end', paddingLeft: '24px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <Skeleton width={36} height={28} />
            <Skeleton width={70} height={10} />
          </div>
        ))}
      </div>
      <div style={sectionStyle}>
        <Skeleton width={80} height={12} style={{ marginBottom: '16px' }} />
        {Array.from({ length: upcomingRows }).map((_, i) => meetingRow(i))}
      </div>
      <div style={sectionStyle}>
        <Skeleton width={120} height={12} style={{ marginBottom: '16px' }} />
        {Array.from({ length: historyRows }).map((_, i) => meetingRow(i))}
      </div>
    </div>
  )
}

export function TrainingTrackSkeleton({ phaseCount = 2, rowsPerPhase = 5 }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap', paddingLeft: '24px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <Skeleton width={36} height={28} />
            <Skeleton width={70} height={10} />
          </div>
        ))}
      </div>
      {Array.from({ length: phaseCount }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '16px' }}>
          <Skeleton width="30%" height={14} style={{ marginBottom: '16px' }} />
          {Array.from({ length: rowsPerPhase }).map((_, j) => <SkeletonRow key={j} withPill />)}
        </div>
      ))}
    </div>
  )
}

export function PhaseListSkeleton({ phases = 4, rowsPerPhase = 3 }) {
  return (
    <div>
      {Array.from({ length: phases }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '20px 24px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <Skeleton width="40%" height={16} />
            <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
          </div>
          {Array.from({ length: rowsPerPhase }).map((_, j) => <SkeletonRow key={j} withDate />)}
        </div>
      ))}
    </div>
  )
}

export function ClientsListSkeleton({ rows = 2, addButtonLabel = 'Add Client' }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', width: '100%' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', paddingLeft: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={28} height={28} />
            <Skeleton width={50} height={10} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={28} height={28} />
            <Skeleton width={50} height={10} />
          </div>
        </div>
        <Skeleton width={110} height={36} style={{ borderRadius: '8px' }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Skeleton width={120} height={16} />
                <Skeleton width={70} height={11} />
                <Skeleton width={55} height={18} style={{ borderRadius: '4px' }} />
              </div>
              <Skeleton width={180} height={12} />
            </div>
            <Skeleton width={50} height={14} />
          </div>
        </div>
      ))}
    </div>
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
