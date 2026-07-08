// Generic Growth Plan score math — variant-agnostic. Callers pass the variant's
// `sections` array (from getGrowthConfig). Question types:
//   'scale'        → 1–10 dropdown + N/A
//   'words'        → word dropdown mapping to a hidden 0–10 value + N/A
//   'partnerships' → dynamic add/remove rows (avg of row scores)
//   'areas'        → fixed compliance areas + dynamic "others" (avg of area scores)

// Partnership rows → a 0–10 value (avg of scored rows), or null when none scored.
export function partnershipAverage(rows) {
  const scored = (rows || []).filter(r => !r.is_na && r.score !== '' && r.score !== null && r.score !== undefined)
  if (!scored.length) return null
  // Match the legacy tool: round to a whole number before it feeds the sum.
  return Math.round(scored.reduce((a, r) => a + Number(r.score), 0) / scored.length)
}

// 'areas' answer → a 0–10 value (avg of every scored area, fixed + others), or
// null when nothing is scored (treated as N/A for the section denominator).
export function areaAverage(ans) {
  if (!ans) return null
  const vals = []
  const take = (entry) => {
    if (!entry || entry.na) return
    const v = entry.value
    if (v === '' || v === null || v === undefined) return
    vals.push(Number(v))
  }
  if (ans.areas) Object.values(ans.areas).forEach(take)
  if (Array.isArray(ans.others)) ans.others.forEach(take)
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

// Per-question value: N/A → null (drops the question from the denominator);
// blank → 0 (counts as a zero); otherwise the mapped number.
export function questionValue(q, answers, partnerships) {
  if (q.type === 'partnerships') return partnershipAverage(partnerships)
  if (q.type === 'areas') return areaAverage(answers ? answers[q.id] : null)
  const a = answers ? answers[q.id] : null
  if (a && a.na) return null
  if (!a || a.value === '' || a.value === null || a.value === undefined) return 0
  return Number(a.value)
}

// Section percentage. Max raw = 50 (5 × 10). denominator = 50 − 10×(N/A count).
// All-N/A section → null. Returns an integer percent (0–100) or null.
export function sectionPercent(section, answers, partnerships) {
  let sum = 0, na = 0
  for (const q of section.questions) {
    const v = questionValue(q, answers, partnerships)
    if (v === null) na += 1
    else sum += v
  }
  const denom = 50 - 10 * na
  if (denom <= 0) return null
  return Math.round((sum / denom) * 100)
}

// Section percentages keyed by section.key + composite (avg of enabled non-null).
export function computeScores(sections, answers, partnerships, enabled) {
  const en = enabled || {}
  const pcts = {}
  for (const s of sections) pcts[s.key] = sectionPercent(s, answers, partnerships)
  const included = sections
    .filter(s => en[s.key] !== false && pcts[s.key] !== null)
    .map(s => pcts[s.key])
  const composite = included.length ? Math.round(included.reduce((a, b) => a + b, 0) / included.length) : null
  return { section1: pcts.section1, section2: pcts.section2, section3: pcts.section3, composite }
}

// Blank answer scaffold for a variant's sections.
export function blankAnswers(sections) {
  const a = {}
  for (const s of sections) for (const q of s.questions) {
    if (q.type === 'areas') {
      const areas = {}
      ;(q.areas || []).forEach(ar => { areas[ar.key] = { value: '', na: false, manager: '' } })
      a[q.id] = { areas, others: [], notes: '' }
    } else {
      a[q.id] = { value: '', na: false, notes: '' }
    }
  }
  return a
}
