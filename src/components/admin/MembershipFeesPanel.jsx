import { NAVY } from './specialistRevenueShared'

// Accounting > Members > Advisor/Accountant Membership Fees. Placeholder for now —
// recurring membership-fee tracking isn't built yet.
export default function MembershipFeesPanel({ title }) {
  return (
    <div style={{ padding: '24px', maxWidth: '1050px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · Members</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--vfo-faint)', fontSize: '14px', border: '1px dashed var(--vfo-border-strong)', borderRadius: '14px', background: 'var(--vfo-input)' }}>
        Membership fee tracking isn't set up yet.
      </div>
    </div>
  )
}
