import { useNavigate } from 'react-router-dom'
import VfoWordmark from '../components/shared/VfoWordmark'

const ROLES = [
  { label: 'VFOS/ERT', sub: 'Team access', to: '/admin/login', initials: 'VE' },
  { label: 'VFO Specialist', sub: 'Your secure Specialist portal', to: '/specialist/login', initials: 'SP' },
  { label: 'Member', sub: 'Advisor and Accountant access', to: '/member/login', initials: 'ME' },
  { label: 'Client', sub: 'Your secure Client portal', to: '/client/login', initials: 'CL' },
]

export default function RolePicker() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: 'linear-gradient(160deg, #002973 0%, #0d47a8 55%, #125ecc 100%)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      {/* decorative rosette outlines */}
      <svg width="520" height="520" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: '-160px', right: '-160px', opacity: 0.08 }} aria-hidden="true">
        {[0, 60, 120, 180, 240, 300].map(a => (
          <circle key={a} cx={12 + 4.4 * Math.cos((a * Math.PI) / 180)} cy={12 + 4.4 * Math.sin((a * Math.PI) / 180)} r="5.8" stroke="#ffffff" strokeWidth="0.5" />
        ))}
      </svg>
      <svg width="420" height="420" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', bottom: '-140px', left: '-140px', opacity: 0.07 }} aria-hidden="true">
        {[0, 60, 120, 180, 240, 300].map(a => (
          <circle key={a} cx={12 + 4.4 * Math.cos((a * Math.PI) / 180)} cy={12 + 4.4 * Math.sin((a * Math.PI) / 180)} r="5.8" stroke="#ffffff" strokeWidth="0.5" />
        ))}
      </svg>

      <VfoWordmark size={28} light />
      <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', fontSize: '32px', color: '#ffffff', margin: '20px 0 0', textAlign: 'center' }}>Welcome to the VFO Portal</h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', margin: '0 0 28px' }}>Select your portal to sign in</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', width: '100%', maxWidth: '560px', position: 'relative' }}>
        {ROLES.map(role => (
          <button
            key={role.label}
            onClick={() => role.to && navigate(role.to)}
            onMouseEnter={e => { if (role.to) { e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,15,46,0.4)'; e.currentTarget.style.transform = 'translateY(-3px)' } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,15,46,0.25)'; e.currentTarget.style.transform = 'none' }}
            style={{
              padding: '20px 22px', borderRadius: '16px', border: 'none',
              background: 'var(--vfo-card)', textAlign: 'left', cursor: role.to ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 24px rgba(0,15,46,0.25)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              opacity: role.to ? 1 : 0.75, display: 'flex', alignItems: 'center', gap: '14px',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '3px' }}>{role.label}</span>
              <span style={{ display: 'block', fontSize: '12.5px', color: role.to ? 'var(--vfo-muted)' : '#e06717', fontWeight: role.to ? 400 : 600 }}>{role.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
