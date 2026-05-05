import { useState } from 'react'
import { callApi } from '../../lib/api'
import { getSession } from '../../lib/api'

function AddGeneralNote({ clientId, notes, onNotesChange, programName }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const session = getSession()

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const result = await callApi('add_client_note', { client_id: clientId, phase_name: 'General', tab_name: 'General Note', program_name: programName, note_text: text.trim(), created_by: session?.name || 'Admin' })
      onNotesChange([result.note, ...notes])
      setText('')
      setOpen(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ padding: '4px 12px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ Add Note</button>
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flex: 1, marginLeft: '16px' }}>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a general note..." rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } }} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }} />
      <button onClick={save} disabled={saving || !text.trim()} style={{ padding: '8px 14px', borderRadius: '8px', background: saving ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{saving ? '...' : 'Save'}</button>
      <button onClick={() => { setOpen(false); setText('') }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '12px', cursor: 'pointer' }}>✕</button>
    </div>
  )
}

export default AddGeneralNote