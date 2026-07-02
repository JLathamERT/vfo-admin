import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { EmailTemplatesSkeleton } from '../shared/Skeleton'

// Program sections — same six that have automation tabs. The standalone Tax
// Planning program shares the TAX templates with Holistic Tax Priorities, so
// both sections list the same rows (editing one affects both).
const SECTIONS = [
  { key: 'map1', label: 'Holistic Planning - MAP 1', pipeline: 'MAP 1' },
  { key: 'tax_holistic', label: 'Holistic Planning - Tax Priorities', pipeline: 'TAX', sharedNote: true },
  { key: 'tax_standalone', label: 'Tax Planning', pipeline: 'TAX', sharedNote: true },
  { key: 'pip', label: 'Holistic Planning - PIP Meetings', pipeline: 'PIP' },
  { key: 'regular', label: 'Holistic Planning - Regular Priorities', pipeline: 'REGULAR' },
  { key: 'advisor', label: 'Advisor Onboarding', pipeline: 'ADVISOR_ONBOARDING' },
  { key: 'accountant', label: 'Accountant Onboarding', pipeline: 'ACCOUNTANT_ONBOARDING' },
  { key: 'specialist', label: 'Specialist Onboarding', pipeline: 'SPECIALIST_ONBOARDING' },
  { key: 'specialist_continuation', label: 'Specialist License Fee Continuation', pipeline: 'SPECIALIST_LICENSE_CONTINUATION' },
  { key: 'specialist_revenue', label: 'VFO Specialist Revenue', pipeline: 'VFO_SPECIALIST_REVENUE' },
  { key: 'client_continuation', label: 'Client Payment Continuation', pipeline: 'CLIENT_PAYMENT_CONTINUATION' },
  { key: 'pft', label: 'Partnership Fast Track', pipeline: 'PARTNERSHIP_FAST_TRACK' },
  // Miscellaneous — standalone, non-pipeline emails grouped together (each row
  // is an explicit [pipeline, template_name] ref rather than a whole pipeline).
  { key: 'misc', label: 'Miscellaneous', items: [
    ['TEAM', 'new_model_sale'],
    ['PAYMENTS', 'card_update'],
    ['LOGIN_SETUP', 'MANUAL_login_setup'],
    ['MEMBER_PAYOUT', 'member_connect_setup'],
  ] },
]

// template_name -> plain-English label, in the order each email fires in the process.
const TEMPLATE_META = {
  'LOGIN_SETUP': [
    ['MANUAL_login_setup', 'Manual login invite (member / specialist / client)'],
  ],
  'MAP 1': [
    ['PIP1_reconfirmation|Yes', 'PIP 1 re-confirmation — meeting confirmed'],
    ['PIP1_reconfirmation|No', 'PIP 1 re-confirmation — declined'],
    ['PCADMIN_followup|Undecided', 'PC Admin follow-up — undecided decision email'],
    ['PCADMIN_followup|No', 'PC Admin follow-up — no (closed)'],
    ['CONTRACT_agreementsent|Yes', 'Agreement sent'],
    ['CONTRACT_ceocountersign|Yes', 'CEO countersignature request'],
    ['CONTRACT_paymentemail|Yes', 'Payment link'],
    ['CONTRACT_confirmationemail|card', 'Payment confirmation (card)'],
    ['CONTRACT_confirmationemail|ach', 'Payment confirmation (ACH)'],
    ['CONTRACT_confirmationemail|check', 'Payment confirmation (check)'],
    ['CONTRACT_tracy_newcase', 'New VFO Services case — internal (to Tracy)'],
    ['CONTRACT_invoicereceipt_email|first', 'Invoice & receipt — first payment'],
    ['CONTRACT_invoicereceipt_email|subsequent', 'Receipt — later quarterly payment'],
    ['CONTRACT_invoicereceipt_email|failed', 'Payment failed (action required)'],
    ['CONTRACT_paidbycheck|check', 'Check payment instructions'],
    ['CONTRACT_checkreminder|check', 'Check payment reminder'],
    ['CONTRACT_pcadmin_undecided_reminder', 'Reminder — decision needed'],
    ['CONTRACT_signing_reminder', 'Reminder — signature needed'],
    ['CONTRACT_payment_reminder', 'Reminder — payment needed'],
  ],
  'TAX': [
    ['TAX_readyfortax3|Yes', 'Ready for Tax 3 — yes'],
    ['TAX_readyfortax3|No', 'Ready for Tax 3 — no'],
    ['TAX_decision_undecided', 'Tax 3 decision — undecided email'],
    ['TAX_decision_decline', 'Tax 3 decision — decline'],
    ['TAX_agreementsent|Yes', 'Agreement sent'],
    ['TAX_ceocountersign|Yes', 'CEO countersignature request'],
    ['TAX_paymentemail|Yes', 'Payment link — retainer'],
    ['TAX_confirmationemail|card', 'Retainer payment confirmation (card)'],
    ['TAX_confirmationemail|ach', 'Retainer payment confirmation (ACH)'],
    ['TAX_confirmationemail|check', 'Retainer payment confirmation (check)'],
    ['TAX_invoicereceipt_email|retainer', 'Retainer invoice & receipt'],
    ['TAX_postreview|Continue', 'Tax 4 review — continue'],
    ['TAX_postreview|Undecided', 'Tax 4 review — undecided'],
    ['TAX_postreview|Reminder', 'Tax 4 review — reminder'],
    ['TAX_refund_email|Yes', 'Retainer refund confirmation'],
    ['TAX_implementdecision|Proceed', 'Tax 5 implementation — proceed'],
    ['TAX_implementdecision|Undecided', 'Tax 5 implementation — undecided'],
    ['TAX_implementdecision|Not Implementing', 'Tax 5 implementation — not implementing'],
    ['TAX_implementdecision|Reminder', 'Tax 5 implementation — reminder'],
    ['TAX_confirmationemail|implementation', 'Implementation payment confirmation'],
    ['TAX_invoicereceipt_email|implementation', 'Implementation fee receipt'],
    ['TAX_implementation_announce|Yes', 'Implementation wrap-up announcement'],
    ['TAX_paidbycheck|check', 'Check payment instructions'],
    ['TAX_decision_reminder', 'Reminder — Tax 3 decision needed'],
    ['TAX_signing_reminder', 'Reminder — signature needed'],
    ['TAX_payment_reminder', 'Reminder — payment needed'],
    ['TAX_meeting_nudge|Yes', 'Tax 4 meeting nudge — internal (to Tim)'],
  ],
  'PIP': [
    ['PIP_meeting_confirmation', 'Meeting confirmation'],
    ['PIP_payment', 'Payment link'],
    ['PIP_confirmation', 'Payment confirmation'],
    ['PIP_invoicereceipt_email', 'Invoice & receipt'],
  ],
  'REGULAR': [
    ['REGULAR_map4confirm', 'MAP 4 confirmation — meeting confirmed'],
    ['REGULAR_map4declined', 'MAP 4 confirmation — declined'],
    ['REGULAR_map4followup', 'MAP 4 meeting follow-up (2 days post-meeting)'],
  ],
  'ADVISOR_ONBOARDING': [
    ['ADVISOR_undecided', 'Stage 1 — undecided decision email'],
    ['ADVISOR_decline', 'Stage 1 — decline'],
    ['ADVISOR_agreement_sent', 'Agreement sent'],
    ['ADVISOR_ceo_countersign', 'CEO countersignature request'],
    ['ADVISOR_payment_link', 'Payment link'],
    ['ADVISOR_payment_confirmation|card', 'Payment confirmation (card)'],
    ['ADVISOR_payment_confirmation|ach', 'Payment confirmation (ACH)'],
    ['ADVISOR_invoice_receipt', 'Invoice & receipt'],
    ['ADVISOR_login_setup', 'Member portal login setup'],
    ['ADVISOR_undecided_reminder', 'Reminder — decision needed'],
    ['ADVISOR_signing_reminder', 'Reminder — signature needed'],
    ['ADVISOR_payment_reminder', 'Reminder — payment needed'],
  ],
  'ACCOUNTANT_ONBOARDING': [
    ['ACCOUNTANT_undecided', 'Stage 1 — undecided decision email'],
    ['ACCOUNTANT_decline', 'Stage 1 — decline'],
    ['ACCOUNTANT_agreement_sent', 'Agreement sent'],
    ['ACCOUNTANT_ceo_countersign', 'CEO countersignature request'],
    ['ACCOUNTANT_payment_link', 'Payment link'],
    ['ACCOUNTANT_payment_confirmation|card', 'Payment confirmation (card)'],
    ['ACCOUNTANT_payment_confirmation|ach', 'Payment confirmation (ACH)'],
    ['ACCOUNTANT_invoice_receipt', 'Invoice & receipt'],
    ['ACCOUNTANT_login_setup', 'Member portal login setup'],
    ['ACCOUNTANT_undecided_reminder', 'Reminder — decision needed'],
    ['ACCOUNTANT_signing_reminder', 'Reminder — signature needed'],
    ['ACCOUNTANT_payment_reminder', 'Reminder — payment needed'],
  ],
  'TEAM': [
    ['new_model_sale', 'New Model Sale — fires when an advisor/accountant is created'],
  ],
  'SPECIALIST_ONBOARDING': [
    ['SPECIALIST_yes', 'Stage 1 — yes / continue email'],
    ['SPECIALIST_no', 'Stage 1 — no / decline email'],
    ['SPECIALIST_step2_progress', 'Stage 2 — in-progress update email'],
    ['SPECIALIST_vote_reminder', 'Reminder — executive decision needed'],
    ['SPECIALIST_sif_reminder', 'Reminder — Specialist Information Form needed'],
    ['SPECIALIST_step3', 'Stage 2 completed — ready for Step 3'],
    ['SPECIALIST_step3_proceed', 'Step 3 — ready to proceed'],
    ['SPECIALIST_choice_reminder', 'Reminder — choose background check'],
    ['SPECIALIST_bg_confirmation|card', 'Background check payment confirmation (card)'],
    ['SPECIALIST_bg_confirmation|ach', 'Background check payment confirmation (ACH)'],
    ['SPECIALIST_bg_receipt', 'Background check payment receipt'],
    ['SPECIALIST_bg_passed', 'Background check complete'],
    ['SPECIALIST_ddc_reminder', 'Reminder — due diligence checklist needed'],
    ['SPECIALIST_ddc_edits', 'Due diligence checklist — action needed'],
    ['SPECIALIST_ddc_approved', 'Due diligence checklist approved'],
    ['SPECIALIST_revshare_complete', 'Revenue share proposal complete'],
    ['SPECIALIST_revfinal_reminder', 'Reminder — revenue share response needed'],
    ['SPECIALIST_agreement_sent', 'Agreement sent'],
    ['SPECIALIST_ceo_countersign', 'CEO countersignature request'],
    ['SPECIALIST_signature_reminder', 'Reminder — signature needed'],
    ['SPECIALIST_lic_payment', 'Monthly license — payment link (onboarding)'],
    ['SPECIALIST_licpayment_reminder', 'Reminder — license payment needed'],
    ['SPECIALIST_lic_confirmation|card', 'License payment confirmation (card)'],
    ['SPECIALIST_lic_confirmation|ach', 'License payment confirmation (ACH)'],
    ['SPECIALIST_lic_invoicereceipt', 'License invoice & receipt (every month)'],
    ['SPECIALIST_skool_invite', 'Going live — VFO Skool invite'],
    ['SPECIALIST_login_setup', 'Specialist portal login setup'],
    ['SPECIALIST_denied', 'Denied — executive decline'],
  ],
  'SPECIALIST_LICENSE_CONTINUATION': [
    ['SPECIALIST_lic_continuation_request', 'License continuation request — move an existing specialist onto the portal $99/mo'],
  ],
  'CLIENT_PAYMENT_CONTINUATION': [
    ['setup_link', 'Payment setup link — migrated client adds a card / bank'],
  ],
  'PARTNERSHIP_FAST_TRACK': [
    ['PFT_meeting_confirm', 'Meeting confirmation (all meetings)'],
    ['PFT_discovery_reminder', 'Discovery form reminder (2 days)'],
    ['PFT_meeting_declined', 'Meeting declined'],
    ['PFT_decision_vfo_ft', 'Decision — VFO Fast Track (2-button email)'],
    ['PFT_decision_vfo_ft_reminder', 'Decision — VFO Fast Track reminder'],
    ['PFT_decision_vfo_associate', 'Decision — VFO Associate'],
    ['PFT_decision_no', 'Decision — No'],
  ],
  'PAYMENTS': [
    ['card_update', 'Change payment method — secure update-link email'],
  ],
  'VFO_SPECIALIST_REVENUE': [
    ['SPECREV_payment_request', 'Payment request — to the specialist'],
    ['SPECREV_payment_confirmation', 'Payment confirmation — to specialist (fires after card/ACH)'],
    ['SPECREV_invoice_receipt_email', 'Invoice & receipt — to specialist (fires when funds clear)'],
    ['SPECREV_payment_reminder', 'Payment reminder — to specialist (48h unpaid)'],
    ['SPECREV_revenue_share_confirmation', 'Revenue share confirmation — to recipient (transfer sent)'],
    ['SPECREV_money_mapping_notice', 'Money mapping notice — to recipient (allocated, no transfer)'],
    ['SPECREV_connect_setup', 'Set up payment details — recipient has no Connect account'],
  ],
  'MEMBER_PAYOUT': [
    ['member_connect_setup', 'Member payout setup — Stripe Connect (revenue-share onboarding)'],
  ],
}

// Resolve a friendly label for a (pipeline, template_name) pair.
function labelFor(pipeline, name) {
  const hit = (TEMPLATE_META[pipeline] || []).find(([n]) => n === name)
  return hit ? hit[1] : name
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Commit an email that's still typed in the box (not yet "Add"-ed) into the list.
function withPending(emails, pending) {
  const e = (pending || '').trim().toLowerCase()
  if (e && EMAIL_RE.test(e) && !emails.includes(e)) return [...emails, e]
  return emails
}

const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }

function RecipientEditor({ title, accent, emails, onChange, input, setInput }) {
  const [warn, setWarn] = useState('')
  function add() {
    const e = input.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) { setWarn('Enter a valid email'); return }
    if (emails.includes(e)) { setInput(''); setWarn(''); return }
    onChange([...emails, e]); setInput(''); setWarn('')
  }
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '11px', color: accent, display: 'block', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.4px' }}>{title}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
        {emails.length === 0 && <span style={{ fontSize: '12px', color: 'var(--vfo-muted)', fontStyle: 'italic' }}>None</span>}
        {emails.map(e => (
          <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', background: `${accent}1f`, color: accent, border: `1px solid ${accent}66` }}>
            {e}
            <button onClick={() => onChange(emails.filter(x => x !== e))} title="Remove"
              style={{ border: 'none', background: 'transparent', color: accent, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.8 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={input} placeholder="name@elitert.com"
          onChange={e => { setInput(e.target.value); setWarn('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onBlur={() => { if (input.trim()) add() }}
          style={{ ...inputStyle, maxWidth: '280px' }} />
        <button onClick={add} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${accent}66`, background: `${accent}1a`, color: accent, whiteSpace: 'nowrap' }}>Add</button>
      </div>
      {warn && <div style={{ fontSize: '11px', color: '#d93025', fontWeight: 600, marginTop: '4px' }}>{warn}</div>}
    </div>
  )
}

function TemplateCard({ tmpl, label, sectionKey }) {
  const [expanded, setExpanded] = useState(false)
  const [subject, setSubject] = useState(tmpl.subject || '')
  const [bodyText, setBodyText] = useState(tmpl.body || '')
  const [cc, setCc] = useState(Array.isArray(tmpl.cc_list) ? tmpl.cc_list : [])
  const [bcc, setBcc] = useState(Array.isArray(tmpl.bcc_list) ? tmpl.bcc_list : [])
  const [ccInput, setCcInput] = useState('')
  const [bccInput, setBccInput] = useState('')
  // Team Notification templates use a single "Team (To)" list instead of CC/BCC.
  const isTeam = tmpl.pipeline === 'TEAM'
  const [to, setTo] = useState(Array.isArray(tmpl.to_list) ? tmpl.to_list : [])
  const [toInput, setToInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  async function save() {
    setSaving(true); setErr(''); setSavedMsg('')
    try {
      if (isTeam) {
        // Team Notification: one recipient list, sent directly TO each (no CC/BCC).
        const finalTo = withPending(to, toInput)
        setTo(finalTo); setToInput('')
        await callApi('automation_save_email_template', { id: tmpl.id, subject, body: bodyText, to_list: finalTo })
        tmpl.subject = subject; tmpl.body = bodyText; tmpl.to_list = finalTo
      } else {
        // Flush any email still typed in the CC/BCC box but not yet "Add"-ed.
        const finalCc = withPending(cc, ccInput)
        const finalBcc = withPending(bcc, bccInput)
        setCc(finalCc); setBcc(finalBcc); setCcInput(''); setBccInput('')
        await callApi('automation_save_email_template', { id: tmpl.id, subject, body: bodyText, cc_list: finalCc, bcc_list: finalBcc })
        tmpl.subject = subject; tmpl.body = bodyText; tmpl.cc_list = finalCc; tmpl.bcc_list = finalBcc
      }
      setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2500)
    } catch (e) { setErr(e.message || String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-tint-deep)', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '10px', color: 'var(--vfo-muted)', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
          <span style={{ fontSize: '13px', color: 'var(--vfo-ink)', fontWeight: 500 }}>{label}</span>
          {isTeam ? (
            to.length > 0 && <span style={{ fontSize: '10px', color: 'var(--vfo-muted)' }}>{to.length} recipient{to.length === 1 ? '' : 's'}</span>
          ) : (cc.length > 0 || bcc.length > 0) && (
            <span style={{ fontSize: '10px', color: 'var(--vfo-muted)' }}>
              {cc.length > 0 && `${cc.length} cc`}{cc.length > 0 && bcc.length > 0 && ' · '}{bcc.length > 0 && `${bcc.length} bcc`}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>
          {tmpl.subject}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--vfo-border-soft)' }}>
          <div style={{ marginTop: '14px' }}>
            {isTeam ? (
              <RecipientEditor title="TEAM — sent directly TO each recipient (no CC/BCC)" accent="#1b9254" emails={to} onChange={setTo} input={toInput} setInput={setToInput} />
            ) : (
              <>
                <RecipientEditor title="CC — internal team" accent="#0095ff" emails={cc} onChange={setCc} input={ccInput} setInput={setCcInput} />
                <RecipientEditor title="BCC — internal team" accent="#9333ea" emails={bcc} onChange={setBcc} input={bccInput} setInput={setBccInput} />
              </>
            )}
          </div>

          <div style={{ height: '1px', background: 'var(--vfo-border-soft)', margin: '4px 0 12px' }} />

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '4px' }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '4px' }}>Body (HTML)</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={10} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '4px' }}>Preview</label>
            <div style={{ padding: '16px', background: 'var(--vfo-card)', borderRadius: '6px', color: '#333', fontSize: '14px', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: bodyText }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={save} disabled={saving} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: saving ? 'default' : 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            {savedMsg && <span style={{ fontSize: '12px', color: '#1b9254', fontWeight: 600 }}>{savedMsg}</span>}
            {err && <span style={{ fontSize: '12px', color: '#d93025', fontWeight: 600 }}>{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openSections, setOpenSections] = useState(() => new Set())

  function toggleSection(key) {
    setOpenSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    try {
      const data = await callApi('automation_load_email_templates')
      setTemplates(data.templates || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <EmailTemplatesSkeleton />

  // index templates by pipeline + template_name
  const byPipeline = {}
  templates.forEach(t => {
    if (!byPipeline[t.pipeline]) byPipeline[t.pipeline] = {}
    byPipeline[t.pipeline][t.template_name] = t
  })

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '24px', color: 'var(--vfo-ink)', margin: '0 0 8px 0' }}>Email Templates</h2>
      <p style={{ fontSize: '13px', color: 'var(--vfo-muted)', margin: '0 0 24px' }}>
        Click a section to expand it. Within a section, emails are listed in the order they fire; expand any email to set its subject, body, and which internal team members receive a CC or BCC.
      </p>

      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {SECTIONS.map(section => {
        // Each section is either a whole pipeline, or an explicit list of
        // [pipeline, template_name] refs (Miscellaneous). Build rows of [tmpl, label].
        let rows
        if (section.items) {
          rows = section.items
            .map(([pipeline, name]) => { const t = byPipeline[pipeline]?.[name]; return t ? [t, labelFor(pipeline, name)] : null })
            .filter(Boolean)
        } else {
          const meta = TEMPLATE_META[section.pipeline] || []
          const inPipeline = byPipeline[section.pipeline] || {}
          const known = new Set(meta.map(([name]) => name))
          const orderedKnown = meta.filter(([name]) => inPipeline[name]).map(([name, label]) => [inPipeline[name], label])
          const extras = Object.keys(inPipeline).filter(name => !known.has(name)).map(name => [inPipeline[name], name])
          rows = [...orderedKnown, ...extras]
        }
        const open = openSections.has(section.key)

        return (
          <div key={section.key} style={{ marginBottom: '10px', border: '1px solid var(--vfo-border-soft)', borderRadius: '12px', overflow: 'hidden', background: 'var(--vfo-card)', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
            <div onClick={() => toggleSection(section.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: open ? '#eef4fd' : 'var(--vfo-input)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: '#0095ff', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--vfo-ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{section.label}</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>{rows.length}</span>
            </div>
            {open && (
              <div style={{ padding: '14px 18px 8px' }}>
                {section.sharedNote && (
                  <div style={{ fontSize: '11px', color: 'var(--vfo-muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                    Tax Priorities and Tax Planning share these templates — edits apply to both.
                  </div>
                )}
                {rows.length === 0
                  ? <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', padding: '8px 0' }}>No templates.</div>
                  : rows.map(([t, label]) => (
                      <TemplateCard key={`${section.key}-${t.template_name}`} tmpl={t} label={label} />
                    ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
