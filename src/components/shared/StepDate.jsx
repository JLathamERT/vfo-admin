// Compact, editable completion-date field for step / task tracking rows.
// Replaces the old read-only "MM/DD" span next to a completed step: the date
// still auto-stamps to today on completion (the caller's saveTask does that),
// but staff can now adjust it inline. Renders a small native date input that
// themes automatically via the global `color-scheme` (light/dark).
//
// Only rendered once a date exists (i.e. the step has been completed), so
// not-started rows stay as clean as before — nothing shows until there's a
// date. `value` is a YYYY-MM-DD string; `onChange` receives the new one.
//
// Typing is buffered locally and only pushed to `onChange` on blur / Enter.
// Callers wire `onChange` to an async save that disables + re-values this input;
// firing it on every keystroke clobbered the native input mid-edit, so typing
// "12" into a month segment landed as "02". Keeping edits local until the user
// leaves the field lets the browser's per-segment editing work normally and
// saves exactly once per edit.
import { useState, useEffect, useRef } from 'react'

export default function StepDate({ value, onChange, disabled }) {
  const [local, setLocal] = useState(value || '')
  const editing = useRef(false)

  // Pull in external changes (a fresh load, a save echo) — but never while the
  // user is actively editing, or we'd yank the value out from under them.
  useEffect(() => {
    if (!editing.current) setLocal(value || '')
  }, [value])

  if (!value) return null

  const commit = () => {
    editing.current = false
    if (local && local !== value) onChange(local)       // real edit → save
    else if (local !== value) setLocal(value)           // cleared/reverted → snap back
  }

  return (
    <input
      type="date"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => { editing.current = true }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      disabled={disabled}
      title="Completion date — type or pick, saves when you click away"
      onClick={e => e.stopPropagation()}
      style={{
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '6px',
        border: '1px solid var(--vfo-border-strong)',
        background: 'var(--vfo-card)',
        color: 'var(--vfo-muted)',
        fontFamily: 'Inter, sans-serif',
        width: '122px',
        flexShrink: 0,
      }}
    />
  )
}
