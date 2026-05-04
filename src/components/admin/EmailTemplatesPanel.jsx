import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
 
export default function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
 
  useEffect(() => { loadTemplates() }, [])
 
  async function loadTemplates() {
    try {
      const data = await callApi('automation_load_email_templates')
      setTemplates(data.templates || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
 
  function startEdit(tmpl) {
    setEditingId(tmpl.id)
    setEditSubject(tmpl.subject || '')
    setEditBody(tmpl.body || '')
    setExpandedId(tmpl.id)
  }
 
  function cancelEdit() {
    setEditingId(null)
    setEditSubject('')
    setEditBody('')
  }
 
  async function saveEdit() {
    setSaving(true)
    try {
      await callApi('automation_save_email_template', { id: editingId, subject: editSubject, body: editBody })
      setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, subject: editSubject, body: editBody } : t))
      setEditingId(null)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
 
  const inputStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', width: '100%' }
 
  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>
 
  // Group by pipeline
  const grouped = {}
  templates.forEach(t => {
    if (!grouped[t.pipeline]) grouped[t.pipeline] = []
    grouped[t.pipeline].push(t)
  })
 
  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: '#fff', margin: '0 0 24px 0' }}>
        Email Templates
      </h2>
 
      {error && <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
 
      {Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#8bacc8', fontSize: '15px' }}>No email templates yet</p>
        </div>
      ) : (
        Object.entries(grouped).map(([pipeline, tmpls]) => (
          <div key={pipeline} style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{pipeline}</div>
 
            {tmpls.map(tmpl => {
              const isExpanded = expandedId === tmpl.id
              const isEditing = editingId === tmpl.id
              const parts = tmpl.template_name.split('|')
              const stepName = parts[0] || ''
              const condition = parts[1] || ''
              const conditionColor = condition === 'Yes' ? '#27ae60' : condition === 'No' ? '#e74c3c' : '#f59e0b'
 
              return (
                <div key={tmpl.id} style={{
                  background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px', marginBottom: '8px', overflow: 'hidden'
                }}>
                  {/* Header */}
                  <div
                    onClick={() => { if (!isEditing) setExpandedId(isExpanded ? null : tmpl.id) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '10px', color: '#8bacc8', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                      <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{stepName}</span>
                      {condition && (
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                          background: `${conditionColor}22`, color: conditionColor,
                          border: `1px solid ${conditionColor}44`
                        }}>{condition}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5a8ab5' }}>
                      {tmpl.subject?.substring(0, 50)}{tmpl.subject?.length > 50 ? '...' : ''}
                    </div>
                  </div>
 
                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {isEditing ? (
                        <>
                          <div style={{ marginTop: '12px', marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: '#5a8ab5', display: 'block', marginBottom: '4px' }}>Subject</label>
                            <input value={editSubject} onChange={e => setEditSubject(e.target.value)} style={inputStyle} />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '11px', color: '#5a8ab5', display: 'block', marginBottom: '4px' }}>Body (HTML)</label>
                            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12} style={{ ...inputStyle, resize: 'vertical' }} />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '11px', color: '#5a8ab5', display: 'block', marginBottom: '4px' }}>Preview</label>
                            <div style={{
                              padding: '16px', background: '#fff', borderRadius: '6px', color: '#333',
                              fontSize: '14px', fontFamily: 'Arial, sans-serif', lineHeight: '1.6'
                            }} dangerouslySetInnerHTML={{ __html: editBody }} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={saveEdit} disabled={saving} style={{
                              padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                              border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60'
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button onClick={cancelEdit} style={{
                              padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                              border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#8bacc8'
                            }}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ marginTop: '12px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', color: '#5a8ab5' }}>Subject: </span>
                            <span style={{ fontSize: '13px', color: '#fff' }}>{tmpl.subject}</span>
                          </div>
                          <div style={{
                            padding: '16px', background: '#fff', borderRadius: '6px', color: '#333',
                            fontSize: '14px', fontFamily: 'Arial, sans-serif', lineHeight: '1.6', marginBottom: '10px'
                          }} dangerouslySetInnerHTML={{ __html: tmpl.body }} />
                          <button onClick={() => startEdit(tmpl)} style={{
                            padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                            border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.12)', color: '#5b9fe6'
                          }}>Edit</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}