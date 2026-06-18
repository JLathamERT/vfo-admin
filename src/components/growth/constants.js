// Advisor Growth Plan — all question copy, action copy, and score math.
// The frontend owns this content; the backend is generic storage. The future
// accountant variant reuses the same components with a different question/action
// set, so keep advisor-specific copy confined to this file.

// ── G1 scoring questions ────────────────────────────────────────────────
// type: 'scale'   → 1–10 dropdown + N/A
//       'words'   → word dropdown mapping to a hidden 0–10 value + N/A
//       'partnerships' → Q7 dynamic add/remove rows (avg of row scores)
export const SECTIONS = [
  {
    key: 'section1',
    label: 'Working with VFO Fast Track',
    questions: [
      { id: 'q1', type: 'scale', text: 'Having completed the initial training, score the quality of your existing clients (in the context of the target clients required for VFO Fast Track)' },
      { id: 'q2', type: 'words', text: 'How strongly do you believe you need to focus on winning new (ideal target) clients (as part of your Growth Plan)?', options: [
        { label: 'High Urgent Need', value: 0 },
        { label: 'Quite Urgent Need', value: 2 },
        { label: 'Average Need', value: 5 },
        { label: 'Low Urgent Need', value: 7 },
        { label: 'Not Needed', value: 10 },
      ] },
      { id: 'q3', type: 'scale', text: 'How confident are you at inviting clients to Partners in Planning Meetings (using VFO Fast Track script)?' },
      { id: 'q4', type: 'scale', text: 'How comfortable are you with pricing proactive services (for example using VFO Fast Track auto pricing calculator)?' },
      { id: 'q5', type: 'scale', text: 'How confident are you with your role as Client Relationship Lead in the Partners in Planning Initial Meeting / Follow Up Meeting?' },
    ],
  },
  {
    key: 'section2',
    label: 'Working with Partnership Fast Track',
    questions: [
      { id: 'q6', type: 'words', text: 'How many accountant (& other professional center of influence of any type) do you already have in place?', options: [
        { label: '0', value: 0 },
        { label: '1', value: 2 },
        { label: '2', value: 5 },
        { label: '3', value: 7 },
        { label: '4+', value: 10 },
      ] },
      { id: 'q7', type: 'partnerships', text: 'Rank each existing accountant (& other professional influencers) in terms of depth and quality of relationship' },
      { id: 'q8', type: 'scale', text: 'How confident are you with your role in building new accountant relationships (example Partnership Fast Track Meetings 1-2-3)?' },
      { id: 'q9', type: 'scale', text: 'How confident are you when discussing a revenue share proposal to a new prospect accountant (or other professional influencers)' },
      { id: 'q10', type: 'scale', preference: true, text: "How much confidence do you have in your ability to help train a VFO Associate Accountant or 'hand hold' a VFO Fast Track Accountant" },
    ],
  },
  {
    key: 'section3',
    label: 'Working with Marketing & Virtual Family Office',
    questions: [
      { id: 'q11', type: 'scale', text: 'Score the effectiveness of your advisory business value proposition' },
      { id: 'q12', type: 'scale', text: 'Score the effectiveness of your website (and how well it represents your value proposition)' },
      { id: 'q13', type: 'scale', text: 'Score the effectiveness of your social media marketing' },
      { id: 'q14', type: 'scale', text: 'How confident are you with being able to explain the benefits of VFO to your clients (as an integral part of your value proposition)' },
      { id: 'q15', type: 'scale', text: 'How confident are you with being able to use the VFO effectively (in practice) to help your clients?' },
    ],
  },
]

// Q10 preference (saved as metadata in raw_answers.q10_preference; not scored).
export const Q10_PREFERENCE_OPTIONS = [
  { value: 'associates', label: 'I prefer to work with Associates — where I do all their training and attend all their planning meetings with every client' },
  { value: 'introduce', label: "I prefer to introduce accountant to VFO Fast Track — where I only 'hand hold' to the extent required" },
  { value: 'both', label: 'I am open to both Associates and VFO Fast Track Accountant relationships' },
]

// ── Category labels ─────────────────────────────────────────────────────
export const CATEGORY_LABELS = {
  vfo_ft: 'VFO Fast Track',
  pft: 'Partnership Fast Track',
  marketing_vfo: 'Marketing & VFO',
  other: 'Other',
}
export const CATEGORY_LABELS_LONG = {
  vfo_ft: 'VFO Fast Track',
  pft: 'Partnership Fast Track',
  marketing_vfo: 'Marketing & VFO',
  other: 'Other Potential Growth Actions',
}
export const CATEGORY_ORDER = ['vfo_ft', 'pft', 'marketing_vfo', 'other']

// ── G2 default actions (seeded into a new plan) ─────────────────────────
export const DEFAULT_ACTIONS = [
  { action_number: 1, category: 'vfo_ft', action_text: 'Focus on winning new target clients, suitable for VFO Fast Track or general Partners in Planning meetings' },
  { action_number: 2, category: 'vfo_ft', action_text: 'More role play with regard to inviting clients to Partners in Planning Meetings' },
  { action_number: 3, category: 'vfo_ft', action_text: 'More work / coaching required on your proactive pricing model' },
  { action_number: 4, category: 'vfo_ft', action_text: 'More role play on your role in Partners In Planning Meetings' },
  { action_number: 5, category: 'vfo_ft', action_text: 'Something else relating to VFO Fast Track or Partners in Planning Meetings (edit to show action as required here)' },
  { action_number: 6, category: 'pft', action_text: 'Focus on increasing number of new accountant partnerships (or other professional influencers)' },
  { action_number: 7, category: 'pft', action_text: 'Focus on improving the quality of existing accountant partnerships (or other professional influencers)' },
  { action_number: 8, category: 'pft', action_text: 'More role play for building new accountant relationships (example role play on accountant meetings 1-2-3)' },
  { action_number: 9, category: 'pft', action_text: 'More work / coaching required on discussing revenue sharing with accountants' },
  { action_number: 10, category: 'pft', action_text: 'Coaching required on training VFO Associate Accountants or working with VFO Fast Track Accountants' },
  { action_number: 11, category: 'pft', action_text: 'Something else relating to building accountant partnerships (edit to show action as required here)' },
  { action_number: 12, category: 'marketing_vfo', action_text: 'Focus on clarifying and honing your advisory business value proposition' },
  { action_number: 13, category: 'marketing_vfo', action_text: 'Focus on improving your website (to reflect your business value proposition)' },
  { action_number: 14, category: 'marketing_vfo', action_text: 'Focus on improving your social media marketing' },
  { action_number: 15, category: 'marketing_vfo', action_text: 'More work / coaching required on explaining benefits of VFO to your clients' },
  { action_number: 16, category: 'marketing_vfo', action_text: 'More work / coaching required on working more effectively with VFO Liaison' },
  { action_number: 17, category: 'marketing_vfo', action_text: 'Something else relating to winning new clients or using VFO more effectively to win new clients (edit to show action as required here)' },
  { action_number: 18, category: 'other', action_text: 'Help with structuring my business, so that my existing advisor business integrates properly with my additional VFO Business' },
  { action_number: 19, category: 'other', action_text: 'Help with creating a team structure, so that I can personally operate most effectively (in the context of my new business structure including VFO)' },
  { action_number: 20, category: 'other', action_text: 'Something else relating to your business growth (edit to show action as required here)' },
]

// ── Growth Plan sub-tabs ────────────────────────────────────────────────
export const GP_STEPS = [
  { key: 'gp_score', label: 'Scoring Growth' },
  { key: 'gp_actions', label: 'Possible Growth Actions' },
  { key: 'gp_prioritize', label: 'Prioritize Growth Actions' },
  { key: 'gp_build', label: 'Build One Page Plan' },
  { key: 'gp_onepage', label: 'One Page Growth Plan' },
  { key: 'gp_history', label: 'Growth History' },
]

// ── Score math ──────────────────────────────────────────────────────────
// Q7 partnership rows → a 0–10 value (average of scored rows), or null when
// there are no scored rows (treated as N/A for the section denominator).
export function partnershipAverage(rows) {
  const scored = (rows || []).filter(r => !r.is_na && r.score !== '' && r.score !== null && r.score !== undefined)
  if (!scored.length) return null
  // Match the legacy tool: round the partnership average to a whole number
  // before it feeds the section sum (e.g. (5 + 2 + 7) / 3 = 4.67 → 5).
  return Math.round(scored.reduce((a, r) => a + Number(r.score), 0) / scored.length)
}

// Per-question value: N/A → null (drops the question from the denominator);
// blank → 0 (counts as a zero); otherwise the mapped number.
function questionValue(q, answers, partnerships) {
  if (q.type === 'partnerships') return partnershipAverage(partnerships)
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

// All three section percentages + composite (avg of enabled, non-null sections).
export function computeScores(answers, partnerships, enabled) {
  const en = enabled || { section1: true, section2: true, section3: true }
  const pcts = {}
  for (const s of SECTIONS) pcts[s.key] = sectionPercent(s, answers, partnerships)
  const included = SECTIONS
    .filter(s => en[s.key] !== false && pcts[s.key] !== null)
    .map(s => pcts[s.key])
  const composite = included.length ? Math.round(included.reduce((a, b) => a + b, 0) / included.length) : null
  return { section1: pcts.section1, section2: pcts.section2, section3: pcts.section3, composite }
}

export function blankAnswers() {
  const a = {}
  for (const s of SECTIONS) for (const q of s.questions) a[q.id] = { value: '', na: false, notes: '' }
  return a
}
