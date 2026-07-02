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
    return <button onClick={() => setOpen(true)} style={{ padding: '4px 12px', borderRadius: '6px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Add Note</button>
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flex: 1, marginLeft: '16px' }}>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a general note..." rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } }} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
      <button onClick={save} disabled={saving || !text.trim()} style={{ padding: '8px 14px', borderRadius: '8px', background: saving ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{saving ? '...' : 'Save'}</button>
      <button onClick={() => { setOpen(false); setText('') }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '12px', cursor: 'pointer' }}>✕</button>
    </div>
  )
}

export default AddGeneralNote