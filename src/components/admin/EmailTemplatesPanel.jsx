import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

// Program sections — same six that have automation tabs. The standalone Tax
// Planning program shares the TAX templates with Holistic Tax Priorities, so
// both sections list the same rows (editing one affects both).
const SECTIONS = [
  { key: 'map1', label: 'Holistic Planning - MAP 1', pipeline: 'MAP 1' },
  { key: 'tax_holistic', label: 'Holistic Planning - Tax Priorities', pipeline: 'TAX', sharedNote: true },
  { key: 'tax_standalone', label: 'Tax Planning', pipeline: 'TAX', sharedNote: true },
  { key: 'pip', label: 'Holistic Planning - PIP Meetings', pipeline: 'PIP' },
  { key: 'advisor', label: 'Advisor Onboarding', pipeline: 'ADVISOR_ONBOARDING' },
  { key: 'accountant', label: 'Accountant Onboarding', pipeline: 'ACCOUNTANT_ONBOARDING' },
  { key: 'specialist', label: 'Specialist Onboarding', pipeline: 'SPECIALIST_ONBOARDING' },
  { key: 'pft', label: 'Partnership Fast Track', pipeline: 'PARTNERSHIP_FAST_TRACK' },
]

// template_name -> plain-English label, in the order each email fires in the process.
const TEMPLATE_META = {
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
  'SPECIALIST_ONBOARDING': [
    ['SPECIALIST_yes', 'Stage 1 — yes / continue email'],
    ['SPECIALIST_no', 'Stage 1 — no / decline email'],
    ['SPECIALIST_step2_progress', 'Stage 2 — in-progress update email'],
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
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Commit an email that's still typed in the box (not yet "Add"-ed) into the list.
function withPending(emails, pending) {
  const e = (pending || '').trim().toLowerCase()
  if (e && EMAIL_RE.test(e) && !emails.includes(e)) return [...emails, e]
  return emails
}

const inputStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '13px', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }

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
        {emails.length === 0 && <span style={{ fontSize: '12px', color: '#697a9c', fontStyle: 'italic' }}>None</span>}
        {emails.map(e => (
          <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '3px 8px', borderRadius: '999px', background: `${accent}33`, color: '#fff', border: `1px solid ${accent}88` }}>
            {e}
            <button onClick={() => onChange(emails.filter(x => x !== e))} title="Remove"
              style={{ border: 'none', background: 'transparent', color: '#16264a', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.8 }}>×</button>
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
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  async function save() {
    // Flush any email still typed in the CC/BCC box but not yet "Add"-ed.
    const finalCc = withPending(cc, ccInput)
    const finalBcc = withPending(bcc, bccInput)
    setCc(finalCc); setBcc(finalBcc); setCcInput(''); setBccInput('')
    setSaving(true); setErr(''); setSavedMsg('')
    try {
      await callApi('automation_save_email_template', { id: tmpl.id, subject, body: bodyText, cc_list: finalCc, bcc_list: finalBcc })
      tmpl.subject = subject; tmpl.body = bodyText; tmpl.cc_list = finalCc; tmpl.bcc_list = finalBcc
      setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2500)
    } catch (e) { setErr(e.message || String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: '#ffffff', border: '1px solid #ebf0f8', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '10px', color: '#4e6087', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
          <span style={{ fontSize: '13px', color: '#16264a', fontWeight: 500 }}>{label}</span>
          {(cc.length > 0 || bcc.length > 0) && (
            <span style={{ fontSize: '10px', color: '#697a9c' }}>
              {cc.length > 0 && `${cc.length} cc`}{cc.length > 0 && bcc.length > 0 && ' · '}{bcc.length > 0 && `${bcc.length} bcc`}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#697a9c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>
          {tmpl.subject}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f2f5fa' }}>
          <div style={{ marginTop: '14px' }}>
            <RecipientEditor title="CC — internal team" accent="#0095ff" emails={cc} onChange={setCc} input={ccInput} setInput={setCcInput} />
            <RecipientEditor title="BCC — internal team" accent="#9333ea" emails={bcc} onChange={setBcc} input={bccInput} setInput={setBccInput} />
          </div>

          <div style={{ height: '1px', background: '#f2f5fa', margin: '4px 0 12px' }} />

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: '#697a9c', display: 'block', marginBottom: '4px' }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#697a9c', display: 'block', marginBottom: '4px' }}>Body (HTML)</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={10} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#697a9c', display: 'block', marginBottom: '4px' }}>Preview</label>
            <div style={{ padding: '16px', background: '#fff', borderRadius: '6px', color: '#333', fontSize: '14px', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: bodyText }} />
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

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    try {
      const data = await callApi('automation_load_email_templates')
      setTemplates(data.templates || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#4e6087' }}>Loading...</div>

  // index templates by pipeline + template_name
  const byPipeline = {}
  templates.forEach(t => {
    if (!byPipeline[t.pipeline]) byPipeline[t.pipeline] = {}
    byPipeline[t.pipeline][t.template_name] = t
  })

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '24px', color: '#16264a', margin: '0 0 8px 0' }}>Email Templates</h2>
      <p style={{ fontSize: '13px', color: '#4e6087', margin: '0 0 24px' }}>
        Emails listed in the order they fire for each program. Expand any email to set its subject, body, and which internal team members receive a CC or BCC.
      </p>

      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {SECTIONS.map(section => {
        const meta = TEMPLATE_META[section.pipeline] || []
        const inPipeline = byPipeline[section.pipeline] || {}
        const known = new Set(meta.map(([name]) => name))
        const orderedKnown = meta.filter(([name]) => inPipeline[name])
        const extras = Object.keys(inPipeline).filter(name => !known.has(name)).map(name => [name, name])
        const rows = [...orderedKnown, ...extras]

        return (
          <div key={section.key} style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0095ff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: section.sharedNote ? '2px' : '12px' }}>{section.label}</div>
            {section.sharedNote && (
              <div style={{ fontSize: '11px', color: '#697a9c', marginBottom: '12px', fontStyle: 'italic' }}>
                Tax Priorities and Tax Planning share these templates — edits apply to both.
              </div>
            )}
            {rows.length === 0
              ? <div style={{ fontSize: '12px', color: '#697a9c', padding: '8px 0' }}>No templates.</div>
              : rows.map(([name, label]) => (
                  <TemplateCard key={`${section.key}-${name}`} sectionKey={section.key} tmpl={inPipeline[name]} label={label} />
                ))}
          </div>
        )
      })}
    </div>
  )
}
