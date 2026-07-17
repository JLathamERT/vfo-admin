// Compact, editable completion-date field for step / task tracking rows.
// Replaces the old read-only "MM/DD" span next to a completed step: the date
// still auto-stamps to today on completion (the caller's saveTask does that),
// but staff can now adjust it inline. Renders a small native date input that
// themes automatically via the global `color-scheme` (light/dark).
//
// Only rendered once a date exists (i.e. the step has been completed), so
// not-started rows stay as clean as before — nothing shows until there's a
// date. `value` is a YYYY-MM-DD string; `onChange` receives the new one.
export default function StepDate({ value, onChange, disabled }) {
  if (!value) return null
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      title="Completion date — click to edit"
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
