// Growth Plan content — advisor + accountant variants. The frontend owns all
// question/action copy; the backend is generic storage. Score MATH lives in
// scoring.js (variant-agnostic). Pick a variant's content with getGrowthConfig().
//
// Question types: 'scale' (1–10 + N/A), 'words' (label→0–10 + N/A),
// 'partnerships' (dynamic rows), 'areas' (fixed compliance areas + dynamic others).

// ── Shared across variants ──────────────────────────────────────────────
export const GP_STEPS = [
  { key: 'gp_hub', label: 'Menu' },
  { key: 'gp_start', label: 'Get Started' },
  { key: 'gp_fourways', label: '4 Ways to Grow a Business' },
  { key: 'gp_score', label: 'Scoring Growth' },
  { key: 'gp_actions', label: 'Possible Growth Actions' },
  { key: 'gp_prioritize', label: 'Prioritize Growth Actions' },
  { key: 'gp_build', label: 'Build One Page Plan' },
  { key: 'gp_onepage', label: 'One Page Growth Plan' },
  { key: 'gp_history', label: 'Growth History' },
]

export const FOUR_WAYS_PRINCIPLES = [
  'Win NEW CLIENTS',
  'Do More Transactions with EXISTING CLIENTS',
  'Increase $ VALUE of transactions',
  'Get more EFFICIENT (reduce costs)',
]

// The four fixed "Compliance Factory" areas (accountant Section 3). Users can
// also add their own "Others" rows alongside these.
export const COMPLIANCE_AREAS = [
  { key: 'tax', label: 'Tax Compliance' },
  { key: 'accounting', label: 'Accounting / Bookkeeping' },
  { key: 'audit', label: 'Audit / Attestation / Financial Statement' },
]

// Per-question word→value maps for the Compliance Factory questions.
const CF_EFFICIENCY = [
  { label: 'Highly Inefficient', value: 0 },
  { label: 'Below Average Efficiency', value: 2 },
  { label: 'Average Efficiency', value: 5 },
  { label: 'Above Average Efficiency', value: 7 },
  { label: 'Highly Efficient', value: 10 },
]
const CF_PROCESSES = [
  { label: 'Poor Processes', value: 0 },
  { label: 'Below Average Processes', value: 2 },
  { label: 'Average Processes', value: 5 },
  { label: 'Above Average Processes', value: 7 },
  { label: 'Excellent Processes', value: 10 },
]
const CF_CULTURE = [
  { label: 'Poor Motivation & Very Disengaged', value: 0 },
  { label: 'Below Average Motivation & Disengaged', value: 2 },
  { label: 'Average Motivation & Moderate Engagement', value: 5 },
  { label: 'Above Average Motivation & Engaged', value: 7 },
  { label: 'Highly Motivated & Highly Engaged', value: 10 },
]
const CF_KPIS = [
  { label: 'Poor KPIs & Measurement', value: 0 },
  { label: 'Below Average KPIs & Measurement', value: 2 },
  { label: 'Average KPIs & Measurement', value: 5 },
  { label: 'Above Average KPIs & Measurement', value: 7 },
  { label: 'Excellent KPIs & Measurement', value: 10 },
]

// ── ADVISOR ─────────────────────────────────────────────────────────────
const ADVISOR_CONFIG = {
  variant: 'advisor',
  typeLabel: 'Type of Advisor',
  typeHelper: 'Which advisor type is this member?',
  typePlaceholder: '-- Select advisor type --',
  memberTypeOptions: [
    { value: 'type1', label: 'Type 1 Advisor' },
    { value: 'type2', label: 'Type 2 Advisor' },
    { value: 'type3', label: 'Type 3 Advisor' },
  ],
  // `lockedForType3` forces the row to N/A for a Type 3 Advisor.
  fourWaysFocuses: [
    { key: 'win_new', row: 'Focus on Winning New Clients', title: 'Win New Clients', sub: 'Focused on Partnership Fast Track to gain access to New Clients' },
    { key: 'existing_vfo', row: 'Focus on Working with Existing Clients via VFO', title: 'Working with Existing Clients via VFO', sub: 'Focused on VFO Fast Track to do more client transactions (at a higher value)', lockedForType3: true },
    { key: 'pricing', row: 'Focus on Pricing ($ Value)', title: 'Increasing the $ Value of Transactions', sub: '' },
    { key: 'efficiency', row: 'Focus on Efficiency of Core Advisor Business', title: 'Increasing Core Business Efficiency', sub: '' },
  ],
  fourWaysConditional: {
    triggerKey: 'win_new',
    question: 'Are you interested in Winning New Accountant Partnerships?',
    optionsFor: () => [{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }],
  },
  sections: [
    {
      key: 'section1',
      label: 'Working with Existing Clients via VFO Fast Track',
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
      label: 'Winning Access to New Clients via Partnership Fast Track',
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
      label: 'Winning New Clients via Marketing & Virtual Family Office',
      questions: [
        { id: 'q11', type: 'scale', text: 'Score the effectiveness of your advisory business value proposition' },
        { id: 'q12', type: 'scale', text: 'Score the effectiveness of your website (and how well it represents your value proposition)' },
        { id: 'q13', type: 'scale', text: 'Score the effectiveness of your social media marketing' },
        { id: 'q14', type: 'scale', text: 'How confident are you with being able to explain the benefits of VFO to your clients (as an integral part of your value proposition)' },
        { id: 'q15', type: 'scale', text: 'How confident are you with being able to use the VFO effectively (in practice) to help your clients?' },
      ],
    },
  ],
  q10PreferenceOptions: [
    { value: 'associates', label: 'I prefer to work with Associates — where I do all their training and attend all their planning meetings with every client' },
    { value: 'introduce', label: "I prefer to introduce accountant to VFO Fast Track — where I only 'hand hold' to the extent required" },
    { value: 'both', label: 'I am open to both Associates and VFO Fast Track Accountant relationships' },
  ],
  categoryLabels: { vfo_ft: 'VFO Fast Track', pft: 'Partnership Fast Track', marketing_vfo: 'Marketing & VFO', other: 'Other' },
  categoryLabelsLong: { vfo_ft: 'VFO Fast Track', pft: 'Partnership Fast Track', marketing_vfo: 'Marketing & VFO', other: 'Other Potential Growth Actions' },
  categoryOrder: ['vfo_ft', 'pft', 'marketing_vfo', 'other'],
  defaultActions: [
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
  ],
}

// ── ACCOUNTANT ──────────────────────────────────────────────────────────
const ACCOUNTANT_CONFIG = {
  variant: 'accountant',
  typeLabel: 'Type of Accountant',
  typeHelper: 'Which accountant type applies?',
  typePlaceholder: '-- Select accountant type --',
  memberTypeOptions: [
    { value: 'type1', label: 'Type 1 Accountant (compliance focus)' },
    { value: 'type2', label: 'Type 2 Accountant (tax planning focus)' },
  ],
  // No locked rows — every focus is rankable 1–4/N/A for accountants.
  fourWaysFocuses: [
    { key: 'win_new', row: 'Focus on Winning New Clients', title: 'Win New Clients', sub: 'Focused on Partnership Fast Track to gain access to New Clients' },
    { key: 'existing_vfo', row: 'Focus on Working with Existing Clients via VFO', title: 'Working with Existing Clients via VFO', sub: 'Focused on VFO Fast Track to do more client transactions (at a higher value)' },
    { key: 'pricing', row: 'Focus on Pricing ($ Value)', title: 'Increasing the $ Value of Transactions', sub: '' },
    { key: 'efficiency', row: 'Focus on Efficiency of Core Accounting Business', title: 'Increasing Core Accounting Business Efficiency', sub: '' },
  ],
  fourWaysConditional: {
    triggerKey: 'existing_vfo',
    question: 'What is your preference regarding tax planning?',
    optionsFor: (t) => t === 'type2'
      ? [{ value: 'all_tax_planning', label: 'Do all Tax Planning (rather than VFO Services)' }, { value: 'partnership_vfo', label: 'Work in Partnership with VFO Services' }]
      : [{ value: 'introduce_clients', label: 'Introduce Clients Only' }, { value: 'partnership_vfo', label: 'Work in Partnership with VFO Services' }],
  },
  sections: [
    {
      key: 'section1',
      label: 'Working with VFO Fast Track for Accountants',
      questions: [
        { id: 'q1', type: 'scale', text: 'Score the quality of your existing clients (in the context of the target clients required for VFO Fast Track or any type of proactive planning)' },
        { id: 'q2', type: 'words', text: 'How strongly do you believe you need to focus on winning new (ideal target) clients as part of your Growth Plan?', options: [
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
      label: 'Working with Marketing & Virtual Family Office',
      questions: [
        { id: 'q6', type: 'scale', text: 'Score the effectiveness of your advisory business value proposition' },
        { id: 'q7', type: 'scale', text: 'Score the effectiveness of your website (and how well it represents your value proposition)' },
        { id: 'q8', type: 'scale', text: 'Score the effectiveness of your social media marketing' },
        { id: 'q9', type: 'scale', text: 'How confident are you with being able to explain the benefits of VFO to your clients (as an integral part of your value proposition)' },
        { id: 'q10', type: 'scale', text: 'How confident are you with being able to use the VFO effectively (in practice) to help your clients?' },
      ],
    },
    {
      key: 'section3',
      label: 'Improving Efficiency of "Compliance Factory"',
      questions: [
        { id: 'q11', type: 'areas', scale: 'numeric', areas: COMPLIANCE_AREAS, text: 'Rank overall performance for each separate area of compliance that you operate?' },
        { id: 'q12', type: 'areas', scale: 'words', hasManager: true, areas: COMPLIANCE_AREAS, options: CF_EFFICIENCY, text: 'Who manages (takes primary responsibility) for each separate area of compliance that you operate?' },
        { id: 'q13', type: 'areas', scale: 'words', areas: COMPLIANCE_AREAS, options: CF_PROCESSES, text: 'Rank the Quality Of Standard Processes in each separate area of compliance that you operate?' },
        { id: 'q14', type: 'areas', scale: 'words', areas: COMPLIANCE_AREAS, options: CF_CULTURE, text: 'Rank the Team Culture, Desire & Engagement in each separate area of compliance that you operate' },
        { id: 'q15', type: 'areas', scale: 'words', areas: COMPLIANCE_AREAS, options: CF_KPIS, text: 'Rank the Measurement and Production of Key Performance Indicators (KPIs) in each separate area of compliance that you operate' },
      ],
    },
  ],
  q10PreferenceOptions: null,
  categoryLabels: { vfo_ft: 'VFO Fast Track', marketing_vfo: 'Marketing & VFO', compliance: 'Compliance Factory', other: 'Other' },
  categoryLabelsLong: { vfo_ft: 'VFO Fast Track', marketing_vfo: 'Marketing & VFO', compliance: 'Efficiency in Compliance Factory', other: 'Other Potential Growth Actions' },
  categoryOrder: ['vfo_ft', 'marketing_vfo', 'compliance', 'other'],
  defaultActions: [
    { action_number: 1, category: 'vfo_ft', action_text: 'Focus on winning new target clients, suitable for VFO Fast Track or general Partners in Planning meetings' },
    { action_number: 2, category: 'vfo_ft', action_text: 'More role play with regard to inviting clients to Partners in Planning Meetings' },
    { action_number: 3, category: 'vfo_ft', action_text: 'More work / coaching required on your proactive pricing model' },
    { action_number: 4, category: 'vfo_ft', action_text: 'More role play on your role in Partners In Planning Meetings' },
    { action_number: 5, category: 'vfo_ft', action_text: 'Something else relating to VFO Fast Track or Partners in Planning Meetings (edit to show action as required here)' },
    { action_number: 6, category: 'marketing_vfo', action_text: 'Focus on clarifying and honing your advisory business value proposition' },
    { action_number: 7, category: 'marketing_vfo', action_text: 'Focus on improving your website (to reflect your business value proposition)' },
    { action_number: 8, category: 'marketing_vfo', action_text: 'Focus on improving your social media marketing' },
    { action_number: 9, category: 'marketing_vfo', action_text: 'More work / coaching required on explaining benefits of VFO to your clients' },
    { action_number: 10, category: 'marketing_vfo', action_text: 'More work / coaching required on working more effectively with VFO Liaison' },
    { action_number: 11, category: 'marketing_vfo', action_text: 'Something else relating to winning new clients or using VFO more effectively to win new clients (edit to show action as required here)' },
    { action_number: 12, category: 'compliance', action_text: 'Improve compliance efficiency in (tax compliance / bookkeeping / audit / other)' },
    { action_number: 13, category: 'compliance', action_text: 'Improve compliance management in (tax compliance / bookkeeping / audit / other)' },
    { action_number: 14, category: 'compliance', action_text: 'Improve compliance processes in (tax compliance / bookkeeping / audit / other)' },
    { action_number: 15, category: 'compliance', action_text: 'Improve compliance team culture in (tax compliance / bookkeeping / audit / other)' },
    { action_number: 16, category: 'compliance', action_text: 'Improve compliance measurement & KPIs in (tax compliance / bookkeeping / audit / other)' },
    { action_number: 17, category: 'compliance', action_text: 'Something else relating to Compliance Efficiency (edit to show action as required here)' },
    { action_number: 18, category: 'other', action_text: 'Help with structuring my business, so that my existing advisor business integrates properly with my additional VFO Business' },
    { action_number: 19, category: 'other', action_text: 'Help with creating a team structure, so that I can personally operate most effectively (in the context of my new business structure including VFO)' },
    { action_number: 20, category: 'other', action_text: 'Something else relating to your business growth (edit to show action as required here)' },
    { action_number: 21, category: 'other', action_text: 'Consider upgrading (or use of Growth Credits to obtain Advanced Coaching) to help me drive my Growth Plan / hold me accountable' },
  ],
}

const CONFIGS = { advisor: ADVISOR_CONFIG, accountant: ACCOUNTANT_CONFIG }

// Resolve a variant string to its content config (defaults to advisor).
export function getGrowthConfig(variant) {
  return CONFIGS[variant] || ADVISOR_CONFIG
}

// Variant follows the member's category — accountants get the accountant set.
export function variantForMember(member) {
  return member?.member_category === 'accountant' ? 'accountant' : 'advisor'
}
