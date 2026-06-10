import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi } from '../lib/api'
 
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
 
  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])
 
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Let an admin action that changes notifications (e.g. saving reviewer notes,
  // which clears a non-dismissible request) refresh the bell immediately rather
  // than waiting for the next 30s poll.
  useEffect(() => {
    function onChanged() { loadNotifications() }
    window.addEventListener('vfo:notifications-changed', onChanged)
    return () => window.removeEventListener('vfo:notifications-changed', onChanged)
  }, [])
 
  async function loadNotifications() {
    try {
      const data = await callApi('load_notifications')
      setNotifications(data.notifications || [])
    } catch (err) { console.error('Notification load error:', err) }
  }
 
  async function handleClick(notif) {
    setOpen(false)
    if (notif.link) {
      // Append a changing nonce so navigating to the SAME link still re-triggers
      // the destination's location.search-based deep-link effect every time
      // (without it, a second click on the same target is a no-op).
      const sep = notif.link.includes('?') ? '&' : '?'
      navigate(`${notif.link}${sep}_n=${Date.now()}`)
    }
    // A click IS the action for FYI (dismissible) notifications — mark it read.
    // Action-required (non-dismissible) ones only clear when the action completes.
    if (notif.dismissible !== false) {
      try {
        await callApi('mark_notification_read', { notification_id: notif.id })
        setNotifications(prev => prev.filter(x => x.id !== notif.id))
      } catch (err) { console.error('mark read error:', err) }
    }
  }
 
  async function markAllRead() {
    setLoading(true)
    try {
      await Promise.all(notifications.map(n => callApi('mark_notification_read', { notification_id: n.id })))
      setNotifications([])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }
 
  const count = notifications.length
 
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{
          position: 'relative', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)',
          borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            background: '#fb895a', color: '#fff', fontSize: '10px', fontWeight: '700',
            borderRadius: '50%', width: '17px', height: '17px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(20,45,95,0.35)'
          }}>{count}</span>
        )}
      </button>
 
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          background: '#ffffff', border: '1px solid #d6e0ee',
          borderRadius: '10px', width: '360px', maxHeight: '400px', overflowY: 'auto',
          zIndex: 300, boxShadow: '0 8px 32px rgba(20,45,95,0.25)'
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #ebf0f8',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#16264a' }}>Notifications</span>
            {count > 0 && (
              <button onClick={markAllRead} disabled={loading}
                style={{ background: 'transparent', border: 'none', color: '#0095ff', fontWeight: 600, fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Mark all read
              </button>
            )}
          </div>
 
          {count === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#697a9c', fontSize: '13px' }}>
              No new notifications
            </div>
          ) : (
            notifications.map(n => {
              const isDismissible = n.dismissible !== false
              const handleDone = async (e) => {
                e.stopPropagation()
                try {
                  await callApi('mark_notification_read', { notification_id: n.id })
                  setNotifications(prev => prev.filter(x => x.id !== n.id))
                } catch (err) { console.error('mark read error:', err) }
              }
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #f4f7fb',
                    cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eef2f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#16264a', fontWeight: '500', marginBottom: '2px' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: '#4e6087', marginBottom: '4px' }}>{n.message}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {n.pipeline && <span style={{ fontSize: '10px', color: '#0095ff', fontWeight: 600, padding: '1px 6px', borderRadius: '3px', background: 'rgba(0,149,255,0.15)' }}>{n.pipeline}</span>}
                      <span style={{ fontSize: '10px', color: '#7c8aa6' }}>{n.created_at?.split('T')[0]}</span>
                      {!isDismissible && <span style={{ fontSize: '10px', color: '#e06717', fontWeight: 600, fontStyle: 'italic' }}>· action required</span>}
                    </div>
                  </div>
                  {isDismissible && (
                    <button
                      onClick={handleDone}
                      style={{
                        padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                        border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)',
                        color: '#1b9254', fontWeight: 600, cursor: 'pointer', flexShrink: 0
                      }}
                    >Done</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}