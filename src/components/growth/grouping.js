// Stable display label for every on-plan action, from the PERSISTED plan_number
// (assigned once, server-side, the first time a priority enters the plan and
// never changed). Top-level tasks show their plan_number; each sub-task shows
// parent.N where N is its position among its siblings (by action_number). Pass
// EVERY on-plan action (active + completed) so a sub-task can find its parent's
// number even when the parent is completed.
export function displayNumbers(all) {
  const byId = new Map(all.map(a => [a.id, a]))
  const subsByParent = {}
  all.filter(a => a.parent_action_id).forEach(s => {
    (subsByParent[s.parent_action_id] = subsByParent[s.parent_action_id] || []).push(s)
  })
  for (const k in subsByParent) subsByParent[k].sort((a, b) => a.action_number - b.action_number)
  const label = new Map()
  for (const a of all) {
    if (!a.parent_action_id) {
      label.set(a.id, a.plan_number != null ? String(a.plan_number) : '')
    } else {
      const parent = byId.get(a.parent_action_id)
      const sibs = subsByParent[a.parent_action_id] || []
      const si = sibs.findIndex(s => s.id === a.id)
      const base = parent && parent.plan_number != null ? String(parent.plan_number) : ''
      label.set(a.id, `${base}.${si >= 0 ? si + 1 : 1}`)
    }
  }
  return label
}

// Order the active one-page items so each top-level task is immediately followed
// by its sub-tasks, split into New / Ongoing sections. Each item's `num` is its
// PERMANENT display number (from plan_number) — so completing/parking a priority
// never renumbers the others. Sub-task rows carry isSub + parentText so the table
// can show the connection. `byIdAll` is a Map of every one-page item (incl.
// completed) for parent lookup + number resolution.
export function orderOnePage(active, byIdAll) {
  const labels = displayNumbers([...byIdAll.values()])
  const tops = active.filter(a => !a.parent_action_id)
  const subsByParent = {}
  active.filter(a => a.parent_action_id).forEach(s => {
    (subsByParent[s.parent_action_id] = subsByParent[s.parent_action_id] || []).push(s)
  })
  const byNum = (a, b) => a.action_number - b.action_number
  // Top-level rows list in PERMANENT-number order (so a re-added priority shows
  // at the bottom with its next number, not slotted by its old catalog position).
  // Sub-tasks stay under their parent in action_number order.
  const byPlan = (a, b) => (a.plan_number ?? Infinity) - (b.plan_number ?? Infinity) || a.action_number - b.action_number
  const flat = []
  const pushTop = (t, section) => {
    flat.push({ ...t, isSub: false, section, num: labels.get(t.id) || '' })
    ;(subsByParent[t.id] || []).slice().sort(byNum).forEach((s) => {
      flat.push({ ...s, isSub: true, section, parentText: t.action_text, num: labels.get(s.id) || '' })
    })
  }
  tops.filter(t => t.g3_action_type === 'new').sort(byPlan).forEach(t => pushTop(t, 'new'))
  tops.filter(t => t.g3_action_type !== 'new').sort(byPlan).forEach(t => pushTop(t, 'ongoing'))
  // Sub-tasks whose parent isn't an active top-level item (e.g. parent completed):
  // show them on their own, still labeled parent.N and with the parent's text.
  const topIds = new Set(tops.map(t => t.id))
  active.filter(a => a.parent_action_id && !topIds.has(a.parent_action_id)).slice().sort(byNum).forEach(s => {
    flat.push({ ...s, isSub: true, section: s.g3_action_type === 'new' ? 'new' : 'ongoing', parentText: byIdAll.get(s.parent_action_id)?.action_text || '', num: labels.get(s.id) || '' })
  })
  return flat
}
