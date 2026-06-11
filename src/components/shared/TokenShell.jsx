import VfoWordmark from './VfoWordmark'

// Branded shell for public token pages (pay / decide / setup links): navy
// gradient header with the wordmark, page background, and a centered white
// card with the gradient accent strip. Presentation only — children carry
// all content and behavior.
export default function TokenShell({ children, maxWidth = 560 }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fd', fontFamily: 'Inter, sans-serif', color: '#16264a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,41,115,0.25)', flexShrink: 0 }}>
        <VfoWordmark size={17} light />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: `${maxWidth}px`, background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 55%, #0a85e8 100%)' }} />
          <div style={{ padding: '36px 32px' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}
