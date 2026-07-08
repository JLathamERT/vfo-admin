// Order the active one-page items so each top-level task is immediately followed
// by its sub-tasks, split into New / Ongoing sections. Numbering is stable:
// top-level tasks get whole numbers (1, 2, 3…) and each sub-task takes its
// parent's number with a decimal suffix (1.1, 1.2…), so adding a sub-task under
// task 1 never renumbers task 2. Sub-task rows carry isSub + parentText so the
// table can show the connection. `byIdAll` is a Map of every one-page item (incl.
// completed) for parent-text lookup when a sub-task's parent sits in another section.
export function orderOnePage(active, byIdAll) {
  const tops = active.filter(a => !a.parent_action_id)
  const subsByParent = {}
  active.filter(a => a.parent_action_id).forEach(s => {
    (subsByParent[s.parent_action_id] = subsByParent[s.parent_action_id] || []).push(s)
  })
  const byNum = (a, b) => a.action_number - b.action_number
  const flat = []
  let topNum = 0
  const pushTop = (t, section) => {
    topNum += 1
    flat.push({ ...t, isSub: false, section, num: String(topNum) })
    ;(subsByParent[t.id] || []).slice().sort(byNum).forEach((s, si) => {
      flat.push({ ...s, isSub: true, section, parentText: t.action_text, num: `${topNum}.${si + 1}` })
    })
  }
  tops.filter(t => t.g3_action_type === 'new').sort(byNum).forEach(t => pushTop(t, 'new'))
  tops.filter(t => t.g3_action_type !== 'new').sort(byNum).forEach(t => pushTop(t, 'ongoing'))
  // Sub-tasks whose parent isn't an active top-level item (e.g. parent completed):
  // show them on their own with a whole number, still labeled with the parent's text.
  const topIds = new Set(tops.map(t => t.id))
  active.filter(a => a.parent_action_id && !topIds.has(a.parent_action_id)).slice().sort(byNum).forEach(s => {
    topNum += 1
    flat.push({ ...s, isSub: true, section: s.g3_action_type === 'new' ? 'new' : 'ongoing', parentText: byIdAll.get(s.parent_action_id)?.action_text || '', num: String(topNum) })
  })
  return flat
}
