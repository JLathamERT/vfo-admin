import { useState } from 'react'
import { callApi } from '../../lib/api'

const ECOSYSTEMS = ['Tax Planning', 'Business Advisory', 'Legal', 'Insurance', 'Wealth Management']
const HEADSHOT_SUPABASE = 'https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/'
const HEADSHOT_BASE = 'https://biz-diagnostic.com/Uploads/ExpertPhotos/'

export default function SpecialistsPanel({ allExperts, ecoMap, ciqMap, onDataChange, section }) {
  const activeTab = section === 'add_specialist' ? 'add' : 'edit'
  const [addStatus, setAddStatus] = useState('')
  const [addStatusType, setAddStatusType] = useState('success')
  const [editStatus, setEditStatus] = useState('')
  const [editStatusType, setEditStatusType] = useState('success')
  const [editingId, setEditingId] = useState(null)

  // Add form state
  const [addForm, setAddForm] = useState({ name: '', short_bio: '', long_bio: '', background_check: '', top_of_t: false, 'D&B_strategy_expertise': '', 'D&B_cutoff_date': '', 'D&B_client_requirements': '', 'D&B_investment_cost': '', 'D&B_ideal_client': '', 'D&B_summary_benefits': '', 'D&B_getting_started': '', 'D&B_professional_process': '', 'D&B_competitive_advantage': '', 'D&B_audit_risk_general': '', 'D&B_audit_risk_history': '', 'D&B_audit_risk_worst_case': '', 'D&B_audit_risk_precautions': '', 'D&B_tax_risk_mindset': '', 'D&B_tax_risk_notes': '', 'D&B_revenue_share': '' })
  const [addEcos, setAddEcos] = useState([])
  const [addCiq, setAddCiq] = useState([])
  const [addFile, setAddFile] = useState(null)
  const [addPreview, setAddPreview] = useState(null)
  const [addCiqDrop, setAddCiqDrop] = useState('')

  // Edit form state
  const [editForm, setEditForm] = useState({ name: '', short_bio: '', long_bio: '', details_and_benefits: '' })
  const [editEcos, setEditEcos] = useState([])
  const [editCiq, setEditCiq] = useState([])
  const [editFile, setEditFile] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const [editCiqDrop, setEditCiqDrop] = useState('')
  const [editSearch, setEditSearch] = useState('')
  const [selectedExpert, setSelectedExpert] = useState(null)

  function showStatus(which, type, msg) {
    if (which === 'add') { setAddStatusType(type); setAddStatus(msg); setTimeout(() => setAddStatus(''), 4000) }
    if (which === 'edit') { setEditStatusType(type); setEditStatus(msg); setTimeout(() => setEditStatus(''), 4000) }
  }

  function clearAddForm() {
    setAddForm({ name: '', short_bio: '', long_bio: '', background_check: '', top_of_t: false, 'D&B_strategy_expertise': '', 'D&B_cutoff_date': '', 'D&B_client_requirements': '', 'D&B_investment_cost': '', 'D&B_ideal_client': '', 'D&B_summary_benefits': '', 'D&B_getting_started': '', 'D&B_professional_process': '', 'D&B_competitive_advantage': '', 'D&B_audit_risk_general': '', 'D&B_audit_risk_history': '', 'D&B_audit_risk_worst_case': '', 'D&B_audit_risk_precautions': '', 'D&B_tax_risk_mindset': '', 'D&B_tax_risk_notes': '', 'D&B_revenue_share': '' })
    setAddEcos([]); setAddCiq([]); setAddFile(null); setAddPreview(null)
  }

  function handleEditSelect(expert) {
    setEditingId(expert.id)
    setEditForm({ name: expert.name || '', short_bio: expert.short_bio || '', long_bio: expert.long_bio || '', background_check: expert.background_check || '', top_of_t: expert.top_of_t || false, 'D&B_strategy_expertise': expert['D&B_strategy_expertise'] || '', 'D&B_cutoff_date': expert['D&B_cutoff_date'] || '', 'D&B_client_requirements': expert['D&B_client_requirements'] || '', 'D&B_investment_cost': expert['D&B_investment_cost'] || '', 'D&B_ideal_client': expert['D&B_ideal_client'] || '', 'D&B_summary_benefits': expert['D&B_summary_benefits'] || '', 'D&B_getting_started': expert['D&B_getting_started'] || '', 'D&B_professional_process': expert['D&B_professional_process'] || '', 'D&B_competitive_advantage': expert['D&B_competitive_advantage'] || '', 'D&B_audit_risk_general': expert['D&B_audit_risk_general'] || '', 'D&B_audit_risk_history': expert['D&B_audit_risk_history'] || '', 'D&B_audit_risk_worst_case': expert['D&B_audit_risk_worst_case'] || '', 'D&B_audit_risk_precautions': expert['D&B_audit_risk_precautions'] || '', 'D&B_tax_risk_mindset': expert['D&B_tax_risk_mindset'] || '', 'D&B_tax_risk_notes': expert['D&B_tax_risk_notes'] || '', 'D&B_revenue_share': expert['D&B_revenue_share'] || '' })
    setEditEcos(ecoMap[expert.id] || [])
    setEditCiq(ciqMap[expert.id] || [])
    setEditFile(null)
    if (expert.headshot_image) {
      setEditPreview(HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image))
    } else {
      setEditPreview(null)
    }
    setSelectedExpert(expert)
  }

  function handleFileChange(which, e) {
    const file = e.target.files[0]
    if (!file) return
    if (which === 'add') setAddFile(file)
    else setEditFile(file)
    const reader = new FileReader()
    reader.onload = ev => {
      if (which === 'add') setAddPreview(ev.target.result)
      else setEditPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function toggleEco(which, eco) {
    if (which === 'add') {
      setAddEcos(prev => prev.includes(eco) ? prev.filter(e => e !== eco) : [...prev, eco])
    } else {
      setEditEcos(prev => prev.includes(eco) ? prev.filter(e => e !== eco) : [...prev, eco])
    }
  }

  function addCiqTag(which) {
    const val = which === 'add' ? addCiqDrop : editCiqDrop
    if (!val) return
    if (which === 'add') {
      if (!addCiq.includes(val)) setAddCiq(prev => [...prev, val])
      setAddCiqDrop('')
    } else {
      if (!editCiq.includes(val)) setEditCiq(prev => [...prev, val])
      setEditCiqDrop('')
    }
  }

  function removeCiqTag(which, topic) {
    if (which === 'add') setAddCiq(prev => prev.filter(t => t !== topic))
    else setEditCiq(prev => prev.filter(t => t !== topic))
  }

  async function submitSpecialist(which) {
    const form = which === 'add' ? addForm : editForm
    const ecos = which === 'add' ? addEcos : editEcos
    const ciq = which === 'add' ? addCiq : editCiq
    const file = which === 'add' ? addFile : editFile
    if (!form.name) { showStatus(which, 'error', 'Name is required.'); return }
    try {
      let headshotFilename = ''
      if (file) {
        const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
        headshotFilename = ts + '_' + form.name.replace(/[^a-zA-Z0-9 ]/g, '').trim() + '.png'
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await callApi('upload_headshot', { filename: headshotFilename, file_base64: base64, content_type: file.type })
      }
      const expertData = { ...form }
      if (headshotFilename) expertData.headshot_image = headshotFilename
      if (which === 'add') {
        const maxId = allExperts.reduce((m, e) => e.id > m ? e.id : m, 0)
        expertData.id = maxId + 1
      }
      await callApi('save_specialist', { expert: expertData, ecosystems: ecos, ciq, editing_id: which === 'edit' ? editingId : null })
      await onDataChange()
      showStatus(which, 'success', which === 'add' ? 'Specialist added!' : 'Changes saved!')
      if (which === 'add') clearAddForm()
    } catch (err) {
      showStatus(which, 'error', err.message)
    }
  }

  async function deleteSpecialist() {
    if (!editingId) return
    try {
      await callApi('delete_specialist', { expert_id: editingId })
      await onDataChange()
      setShowEditForm(false)
      setEditSelectVal('')
      setEditingId(null)
      showStatus('edit', 'success', 'Specialist deleted.')
    } catch (err) {
      showStatus('edit', 'error', err.message)
    }
  }

  

  

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const labelStyle = { fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const fieldStyle = { marginBottom: '16px' }
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }

  

  function SpecialistForm({ which, form, setForm, ecos, file, preview, ciq, ciqDrop, setCiqDrop, statusMsg, statusType: sType }) {
    return (
      <div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Short Bio</label>
          <input value={form.short_bio} onChange={e => setForm(p => ({ ...p, short_bio: e.target.value }))} placeholder="One-line specialty description" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Long Bio</label>
          <textarea value={form.long_bio} onChange={e => setForm(p => ({ ...p, long_bio: e.target.value }))} placeholder="Detailed biography..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Details & Benefits</div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Strategy / Expertise</label>
            <textarea value={form['D&B_strategy_expertise']} onChange={e => setForm(p => ({ ...p, 'D&B_strategy_expertise': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Cut-off Date for Strategy</label>
            <input value={form['D&B_cutoff_date']} onChange={e => setForm(p => ({ ...p, 'D&B_cutoff_date': e.target.value }))} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Client Requirements</label>
            <textarea value={form['D&B_client_requirements']} onChange={e => setForm(p => ({ ...p, 'D&B_client_requirements': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Amount of Investment or Cost</label>
            <textarea value={form['D&B_investment_cost']} onChange={e => setForm(p => ({ ...p, 'D&B_investment_cost': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Ideal Client Description</label>
            <textarea value={form['D&B_ideal_client']} onChange={e => setForm(p => ({ ...p, 'D&B_ideal_client': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Summary of Benefits</label>
            <textarea value={form['D&B_summary_benefits']} onChange={e => setForm(p => ({ ...p, 'D&B_summary_benefits': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Getting Started with a Client</label>
            <textarea value={form['D&B_getting_started']} onChange={e => setForm(p => ({ ...p, 'D&B_getting_started': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Steps of Professional Process</label>
            <textarea value={form['D&B_professional_process']} onChange={e => setForm(p => ({ ...p, 'D&B_professional_process': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>What Makes You Better Than the Competition</label>
            <textarea value={form['D&B_competitive_advantage']} onChange={e => setForm(p => ({ ...p, 'D&B_competitive_advantage': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#8bacc8', fontWeight: '600', marginBottom: '16px' }}>Tax Planning Audit Risk Questionnaire</div>
            <div style={fieldStyle}>
              <label style={labelStyle}>1. What are the general risks of this strategy?</label>
              <textarea value={form['D&B_audit_risk_general']} onChange={e => setForm(p => ({ ...p, 'D&B_audit_risk_general': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>2. What has been the history of these risks coming to fruition?</label>
              <textarea value={form['D&B_audit_risk_history']} onChange={e => setForm(p => ({ ...p, 'D&B_audit_risk_history': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>3. What are potential worst-case scenarios?</label>
              <textarea value={form['D&B_audit_risk_worst_case']} onChange={e => setForm(p => ({ ...p, 'D&B_audit_risk_worst_case': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '0' }}>
              <label style={labelStyle}>4. What precautions are in place to prevent or minimize the risks?</label>
              <textarea value={form['D&B_audit_risk_precautions']} onChange={e => setForm(p => ({ ...p, 'D&B_audit_risk_precautions': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Revenue Share</label>
            <textarea value={form['D&B_revenue_share']} onChange={e => setForm(p => ({ ...p, 'D&B_revenue_share': e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#8bacc8', fontWeight: '600', marginBottom: '12px' }}>Acknowledgement, Agreement and Release</div>
            <p style={{ fontSize: '12px', color: '#5a8ab5', lineHeight: '1.6', margin: 0 }}>Member acknowledges that ERT, and their related companies and legal partnerships maintain a relationship with Specialist in various fields of service and specialities, including, without limitation, in the financial, tax, accounting, and legal service industries. Member further acknowledges that (i) each of the Specialist is separate and independent from, and unrelated to, ERT, and their related companies and legal partnerships, and separate and independent from, and unrelated to, the associates, shareholders, managers, members, officers, directors, employees, contractors, agents, controlling persons, related parties, assigns and partners of ERT and/or of their related companies and legal partnerships; and (ii) that the services provided by the Specialists are not provided by ERT, and/or by their related companies or legal partnerships, and/or by the ERT Related Parties. Member acknowledges and agrees that it is their sole and absolute responsibility to seek his, her and/or their own independent legal, tax, compliance, accounting and financial advice, as applicable to such parties, from competent service providers and advisors of their own independent choosing, including, without limitation, to determine whether an Specialist is someone who is or will provide adequate and appropriate advice for and to the Advisor, Accountant and/or Client given the unique facts and circumstances and the particular risk profile of the service recipients.</p>
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Background Check</label>
          <select value={form.background_check} onChange={e => setForm(p => ({ ...p, background_check: e.target.value }))} style={{ ...inputStyle, background: '#0d2a6e', width: '200px' }}>
            <option value="">-- None --</option>
            <option value="Lite">Lite</option>
            <option value="Core">Core</option>
            <option value="Max">Max</option>
          </select>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', fontWeight: '600', marginBottom: '16px' }}>Tax Risk Mindset</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Risk Level</label>
            <select value={form['D&B_tax_risk_mindset']} onChange={e => setForm(p => ({ ...p, 'D&B_tax_risk_mindset': e.target.value }))} style={{ ...inputStyle, background: '#0d2a6e', width: '320px' }}>
              <option value="">-- Select --</option>
              <option value="Risk 1 – Very Conservative Mindset">Risk 1 – Very Conservative Mindset</option>
              <option value="Risk 2 - Moderately Conservative Mindset">Risk 2 - Moderately Conservative Mindset</option>
              <option value="Risk 3 – Average Risk Mindset">Risk 3 – Average Risk Mindset</option>
              <option value="Risk 4 – Moderately Aggressive Mindset">Risk 4 – Moderately Aggressive Mindset</option>
              <option value="Risk 5 – Very Aggressive Mindset">Risk 5 – Very Aggressive Mindset</option>
            </select>
          </div>
          <div style={{ marginBottom: '0' }}>
            <label style={labelStyle}>Tax Risk Notes</label>
            <textarea value={form['D&B_tax_risk_notes']} onChange={e => setForm(p => ({ ...p, 'D&B_tax_risk_notes': e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Headshot</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {preview ? <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { if (which === 'edit') { const exp = allExperts.find(x => x.id === editingId); if (exp) e.target.src = HEADSHOT_BASE + exp.headshot_image } }} /> : <span style={{ color: '#8bacc8', fontSize: '24px' }}>?</span>}
            </div>
            <div>
              <label style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                Choose Image
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(which, e)} />
              </label>
              <p style={{ color: '#8bacc8', fontSize: '12px', marginTop: '6px' }}>JPG or PNG, recommended 400×400px</p>
            </div>
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>VFO Ecosystem</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ECOSYSTEMS.map(eco => (
              <button key={eco} onClick={() => toggleEco(which, eco)}
                style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${ecos.includes(eco) ? '#5b9fe6' : 'rgba(255,255,255,0.2)'}`, background: ecos.includes(eco) ? 'rgba(91,159,230,0.15)' : 'transparent', color: ecos.includes(eco) ? '#5b9fe6' : '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>
                {eco}
              </button>
            ))}
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Top of the T</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div onClick={() => setForm(p => ({ ...p, top_of_t: !p.top_of_t }))}
              style={{ width: '44px', height: '24px', borderRadius: '12px', background: form.top_of_t ? '#2563eb' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '2px', left: form.top_of_t ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: '14px', color: form.top_of_t ? '#fff' : '#8bacc8' }}>{form.top_of_t ? 'Yes' : 'No'}</span>
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>CIQ Topics</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <select value={ciqDrop} onChange={e => setCiqDrop(e.target.value)}
              style={{ ...inputStyle, flex: 1, background: '#0d2a6e' }}>
              <option value="">-- Select a topic --</option>
              {CIQ_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => addCiqTag(which)}
              style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ciq.map(topic => (
              <span key={topic} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(91,159,230,0.15)', border: '1px solid rgba(91,159,230,0.3)', color: '#5b9fe6', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {topic}
                <span onClick={() => removeCiqTag(which, topic)} style={{ cursor: 'pointer', color: '#8bacc8' }}>×</span>
              </span>
            ))}
          </div>
        </div>
        {statusMsg && <p style={{ color: sType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', margin: '8px 0' }}>{statusMsg}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      {/* Section title */}
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff', marginBottom: '24px' }}>
        {activeTab === 'add' ? 'Add Specialist' : 'Search Specialists'}
      </div>

      {/* Add tab */}
      {activeTab === 'add' && (
        <div style={sectionStyle}>
          <SpecialistForm
            which="add" form={addForm} setForm={setAddForm}
            ecos={addEcos} file={addFile} preview={addPreview}
            ciq={addCiq} ciqDrop={addCiqDrop} setCiqDrop={setAddCiqDrop}
            statusMsg={addStatus} statusType={addStatusType}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => submitSpecialist('add')}
              style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
              Add Specialist
            </button>
            <button onClick={clearAddForm}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '14px', cursor: 'pointer' }}>
              Clear Form
            </button>
          </div>
        </div>
      )}

      {/* Search/Edit tab */}
      {activeTab === 'edit' && !selectedExpert && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <input placeholder="Search by name..." style={inputStyle} onChange={e => setEditSearch(e.target.value.toLowerCase())} value={editSearch} />
          </div>
          <div>
            {(editSearch ? allExperts.filter(e => e.name.toLowerCase().includes(editSearch)) : allExperts).map(expert => (
              <div key={expert.id}
                onClick={() => handleEditSelect(expert)}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 14px', marginBottom: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}>
                  {expert.headshot_image && <img src={HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#fff' }}>{expert.name}</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8' }}>{expert.short_bio || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'edit' && selectedExpert && (
        <div>
          <button onClick={() => { setSelectedExpert(null); setEditingId(null) }} style={{ background: 'none', border: 'none', color: '#5b9fe6', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
          <div style={sectionStyle}>
            <SpecialistForm
              which="edit" form={editForm} setForm={setEditForm}
              ecos={editEcos} file={editFile} preview={editPreview}
              ciq={editCiq} ciqDrop={editCiqDrop} setCiqDrop={setEditCiqDrop}
              statusMsg={editStatus} statusType={editStatusType}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => submitSpecialist('edit')}
                style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                Save Changes
              </button>
              <button onClick={() => { setSelectedExpert(null); setEditingId(null) }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={deleteSpecialist}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '14px', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}

const CIQ_TOPICS = ["1031 Exchange Review","179D Commercial Building Tax Deduction Review","401(k) Review","Advanced Business Tax Strategies Review","Advanced Personal Tax Strategies Review","Asset Protection Review","Business Continuation Planning Review","Business Entity Structure Review","Business Exit Planning Review","Business Finance & Costs - Banking Review","Business Finance & Costs - Merchant Processing (Credit Card Fees) Review","Business Growth - Revenue Generation Review","Business Planning Review","Business Valuation Review","Buy-Sell Agreement Review","Captive Insurance Review","Cash Balance Plan Review","Charitable Planning Review","Compensation & Benefits Review","Cost Recovery Review (Cost Segregation)","Cyber Insurance Review","Deferred Compensation Plan Review","Disability Income Protection Review","Employment Practices Liability Insurance (EPLI) Review","Estate Planning Review","Executive Benefits Review","Group Health Insurance Review","Guaranteed Asset Protection Gap Insurance Review","International Tax Strategies Review","Key Person Insurance Review","Leadership / Culture Review","Life Insurance Review","Life Settlements Review","Long-term Care Review","Merchant Processing (credit cards) Review","Opportunity Zones Review","Outsourced Bookkeeping, CFO and Tax Professionals Review","Outsourced CEO Review","Premium Finance Review","Property & Casualty Insurance Review","Qualified Plans Review","R&D Tax Credit Review","Real Estate Review","Risk Mitigation & Insurance Review","Sales Tax Exemption Review","SDIRA / Alternative Investments Review","Section 125 / Health Insurance Review","Solar Investment Review","Student Loan Repayment / Tuition Reimbursement Review","Surety Bonds Review","Tax Planning Review","Tax Resolution Review","Trust Review","Workers Compensation Review"]