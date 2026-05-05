import { useState } from 'react'
import { callApi } from '../../lib/api'
import { getSession } from '../../lib/api'

export function PhaseNotesButton({ count, isOpen, onClick }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: isOpen ? 'rgba(91,159,230,0.15)' : 'rgba(255,255,255,0.04)', color: isOpen ? '#5b9fe6' : '#8bacc8', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
      Notes{count > 0 && <span style={{ background: '#5b9fe6', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>{count}</span>}
    </button>
  )
}

export function PhaseNotesPanel({ clientId, phaseName, tabName, programName, notes, onNotesChange }) {
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const session = getSession()

  const phaseNotes = (notes || []).filter(n => n.phase_name === phaseName && n.tab_name === tabName)

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    try {
      const result = await callApi('add_client_note', { client_id: clientId, phase_name: phaseName, tab_name: tabName, program_name: programName || null, note_text: newNote.trim(), created_by: session?.name || 'Admin' })
      onNotesChange([result.note, ...notes])
      setNewNote('')
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function updateNote(noteId) {
    if (!editText.trim()) return
    try {
      const result = await callApi('update_client_note', { note_id: noteId, note_text: editText.trim() })
      onNotesChange(notes.map(n => n.id === noteId ? result.note : n))
      setEditingId(null)
    } catch (err) { console.error(err) }
  }

  async function deleteNote(noteId) {
    try {
      await callApi('delete_client_note', { note_id: noteId })
      onNotesChange(notes.filter(n => n.id !== noteId))
    } catch (err) { console.error(err) }
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 18px', background: 'rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote() } }} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }} />
        <button onClick={addNote} disabled={saving || !newNote.trim()} style={{ padding: '8px 14px', borderRadius: '8px', background: saving ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>{saving ? 'Saving...' : 'Add'}</button>
      </div>
      {phaseNotes.length === 0 && <div style={{ fontSize: '12px', color: '#5a8ab5', padding: '4px 0' }}>No notes yet</div>}
      {phaseNotes.map(note => (
        <div key={note.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {editingId === note.id ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button onClick={() => updateNote(note.id)} style={{ padding: '4px 10px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '13px', color: '#fff', lineHeight: '1.5', marginBottom: '4px', whiteSpace: 'pre-wrap' }}>{note.note_text}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{note.created_by} · {note.created_at?.split('T')[0]}</span>
                <button onClick={() => { setEditingId(note.id); setEditText(note.note_text) }} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#5b9fe6', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => deleteNote(note.id)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#e74c3c', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}