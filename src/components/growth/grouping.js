// Order the active one-page items so each top-level task is immediately followed
// by its sub-tasks, split into New / Ongoing sections, with a flat 1..N numbering
// shared with the matrix. Sub-task rows carry isSub + parentText so the table can
// show the connection. `byIdAll` is a Map of every one-page item (incl. completed)
// for parent-text lookup when a sub-task's parent sits in another section.
export function orderOnePage(active, byIdAll) {
  const tops = active.filter(a => !a.parent_action_id)
  const subsByParent = {}
  active.filter(a => a.parent_action_id).forEach(s => {
    (subsByParent[s.parent_action_id] = subsByParent[s.parent_action_id] || []).push(s)
  })
  const byNum = (a, b) => a.action_number - b.action_number
  const flat = []
  const pushTop = (t, section) => {
    flat.push({ ...t, isSub: false, section })
    ;(subsByParent[t.id] || []).slice().sort(byNum).forEach(s => {
      flat.push({ ...s, isSub: true, section, parentText: t.action_text })
    })
  }
  tops.filter(t => t.g3_action_type === 'new').sort(byNum).forEach(t => pushTop(t, 'new'))
  tops.filter(t => t.g3_action_type !== 'new').sort(byNum).forEach(t => pushTop(t, 'ongoing'))
  // Sub-tasks whose parent isn't an active top-level item (e.g. parent completed):
  // show them on their own, still labeled with the parent's text.
  const topIds = new Set(tops.map(t => t.id))
  active.filter(a => a.parent_action_id && !topIds.has(a.parent_action_id)).slice().sort(byNum).forEach(s => {
    flat.push({ ...s, isSub: true, section: s.g3_action_type === 'new' ? 'new' : 'ongoing', parentText: byIdAll.get(s.parent_action_id)?.action_text || '' })
  })
  return flat.map((a, i) => ({ ...a, num: i + 1 }))
}
