import { useNavigate } from 'react-router-dom'

const baseStyle = { color: 'var(--vfo-primary, #125ecc)', cursor: 'pointer', textDecoration: 'none' }
const hoverProps = {
  onMouseEnter: e => { e.currentTarget.style.textDecoration = 'underline' },
  onMouseLeave: e => { e.currentTarget.style.textDecoration = 'none' },
}

export function MemberNameLink({ memberNumber, children, style }) {
  const navigate = useNavigate()
  if (!memberNumber) return <span style={style}>{children}</span>
  // _n cache-buster: AdminPortal reads ?member= off window.location.search, so the query
  // string has to change for a repeat click on the same member to register. Stamped
  // inside the handler so two clicks without a re-render still differ.
  return (
    <span
      title="Open member profile"
      style={{ ...style, ...baseStyle }}
      onClick={e => { e.stopPropagation(); navigate(`/admin?member=${encodeURIComponent(memberNumber)}&_n=${Date.now()}`) }}
      {...hoverProps}>
      {children}
    </span>
  )
}

export function ClientNameLink({ clientId, program, tab, children, style }) {
  const navigate = useNavigate()
  if (!clientId) return <span style={style}>{children}</span>
  let target = `/admin/client/${clientId}`
  if (program) target += `?program=${encodeURIComponent(program)}`
  if (tab) target += `${program ? '&' : '?'}tab=${encodeURIComponent(tab)}`
  return (
    <span
      title="Open client profile"
      style={{ ...style, ...baseStyle }}
      onClick={e => { e.stopPropagation(); navigate(target) }}
      {...hoverProps}>
      {children}
    </span>
  )
}
