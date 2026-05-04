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
 
  async function loadNotifications() {
    try {
      const data = await callApi('load_notifications')
      setNotifications(data.notifications || [])
    } catch (err) { console.error('Notification load error:', err) }
  }
 
  async function handleClick(notif) {
    setOpen(false)
    if (notif.link) navigate(notif.link)
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
        style={{
          position: 'relative', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#fff', fontSize: '13px',
          fontFamily: 'DM Sans, sans-serif'
        }}
      >
        Notifications
        {count > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-6px',
            background: '#e74c3c', color: '#fff', fontSize: '10px', fontWeight: '700',
            borderRadius: '50%', width: '18px', height: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{count}</span>
        )}
      </button>
 
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          background: '#0d2a6e', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '10px', width: '360px', maxHeight: '400px', overflowY: 'auto',
          zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Notifications</span>
            {count > 0 && (
              <button onClick={markAllRead} disabled={loading}
                style={{ background: 'transparent', border: 'none', color: '#5b9fe6', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Mark all read
              </button>
            )}
          </div>
 
          {count === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#5a8ab5', fontSize: '13px' }}>
              No new notifications
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500', marginBottom: '2px' }}>{n.title}</div>
                <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '4px' }}>{n.message}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {n.pipeline && <span style={{ fontSize: '10px', color: '#5b9fe6', padding: '1px 6px', borderRadius: '3px', background: 'rgba(91,159,230,0.15)' }}>{n.pipeline}</span>}
                  <span style={{ fontSize: '10px', color: '#4a7a9e' }}>{n.created_at?.split('T')[0]}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}