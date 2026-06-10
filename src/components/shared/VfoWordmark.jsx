// VFO Services brand wordmark: rosette mark + "VFO SERVICES" logotype.
// `light` renders the white-on-navy variant for dark headers. Presentation only.
export default function VfoWordmark({ size = 20, showServices = true, light = false, onClick, style = {} }) {
  const petals = [0, 60, 120, 180, 240, 300]
  const mark = light ? '#ffffff' : '#125ecc'
  const vfo = light ? '#ffffff' : '#125ecc'
  const services = light ? 'rgba(255,255,255,0.62)' : '#7aa3e0'
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: `${Math.round(size * 0.45)}px`,
        userSelect: 'none', cursor: onClick ? 'pointer' : 'default', lineHeight: 1, ...style,
      }}
    >
      <svg width={size * 1.15} height={size * 1.15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {petals.map(a => (
          <circle
            key={a}
            cx={12 + 4.4 * Math.cos((a * Math.PI) / 180)}
            cy={12 + 4.4 * Math.sin((a * Math.PI) / 180)}
            r="5.8"
            stroke={mark}
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: `${size}px`, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 800, color: vfo }}>VFO</span>
        {showServices && <span style={{ fontWeight: 400, color: services }}>SERVICES</span>}
      </span>
    </span>
  )
}
