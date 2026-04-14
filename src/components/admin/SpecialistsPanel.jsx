import { useState, useRef } from 'react'
import { callApi } from '../../lib/api'

const ECOSYSTEMS = ['Tax Planning', 'Business Advisory', 'Legal', 'Insurance', 'Wealth Management']
const HEADSHOT_SUPABASE = 'https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/'
const HEADSHOT_BASE = 'https://biz-diagnostic.com/Uploads/ExpertPhotos/'

export default function SpecialistsPanel({ allExperts, ecoMap, ciqMap, onDataChange }) {
  const [activeTab, setActiveTab] = useState('add')
  const [addStatus, setAddStatus] = useState('')
  const [addStatusType, setAddStatusType] = useState('success')
  const [editStatus, setEditStatus] = useState('')
  const [editStatusType, setEditStatusType] = useState('success')
  const [reorderStatus, setReorderStatus] = useState('')
  const [reorderStatusType, setReorderStatusType] = useState('success')
  const [editingId, setEditingId] = useState(null)
  const [reorderExperts, setReorderExperts] = useState([])
  const [reorderDirty, setReorderDirty] = useState(false)
  const [reorderSearch, setReorderSearch] = useState('')
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  // Add form state
  const [addForm, setAddForm] = useState({ name: '', short_bio: '', long_bio: '', details_and_benefits: '' })
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
  const [editSelectVal, setEditSelectVal] = useState('')
  const [showEditForm, setShowEditForm] = useState(false)

  function showStatus(which, type, msg) {
    if (which === 'add') { setAddStatusType(type); setAddStatus(msg); setTimeout(() => setAddStatus(''), 4000) }
    if (which === 'edit') { setEditStatusType(type); setEditStatus(msg); setTimeout(() => setEditStatus(''), 4000) }
    if (which === 'reorder') { setReorderStatusType(type); setReorderStatus(msg); setTimeout(() => setReorderStatus(''), 4000) }
  }

  function clearAddForm() {
    setAddForm({ name: '', short_bio: '', long_bio: '', details_and_benefits: '' })
    setAddEcos([]); setAddCiq([]); setAddFile(null); setAddPreview(null)
  }

  function handleEditSelect(id) {
    setEditSelectVal(id)
    if (!id) { setShowEditForm(false); return }
    const expert = allExperts.find(e => e.id === parseInt(id))
    if (!expert) return
    setEditingId(expert.id)
    setEditForm({ name: expert.name || '', short_bio: expert.short_bio || '', long_bio: expert.long_bio || '', details_and_benefits: expert.details_and_benefits || '' })
    setEditEcos(ecoMap[expert.id] || [])
    setEditCiq(ciqMap[expert.id] || [])
    setEditFile(null)
    if (expert.headshot_image) {
      setEditPreview(HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image))
    } else {
      setEditPreview(null)
    }
    setShowEditForm(true)
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

  function loadReorderList() {
    setReorderExperts([...allExperts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))
    setReorderDirty(false)
  }

  function handleDragStart(idx) { dragItem.current = idx }
  function handleDragEnter(idx) { dragOver.current = idx }
  function handleDrop() {
    const from = dragItem.current
    const to = dragOver.current
    if (from === null || to === null || from === to) return
    const updated = [...reorderExperts]
    const moved = updated.splice(from, 1)[0]
    updated.splice(to, 0, moved)
    setReorderExperts(updated)
    setReorderDirty(true)
    dragItem.current = null
    dragOver.current = null
  }

  async function saveOrder() {
    try {
      const order = reorderExperts.map((e, i) => ({ id: e.id, sort_order: i + 1 }))
      await callApi('save_specialist_order', { order })
      await onDataChange()
      setReorderDirty(false)
      showStatus('reorder', 'success', 'Order saved!')
    } catch (err) {
      showStatus('reorder', 'error', err.message)
    }
  }

  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const labelStyle = { fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const fieldStyle = { marginBottom: '16px' }
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }

  const filteredReorder = reorderSearch
    ? reorderExperts.filter(e => e.name.toLowerCase().includes(reorderSearch.toLowerCase()))
    : reorderExperts

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
        <div style={fieldStyle}>
          <label style={labelStyle}>Details and Benefits</label>
          <textarea value={form.details_and_benefits} onChange={e => setForm(p => ({ ...p, details_and_benefits: e.target.value }))} placeholder="Strategy details, client requirements, benefits..." rows={6} style={{ ...inputStyle, resize: 'vertical' }} />
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
      {/* Sub tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        {[['add', 'Add Specialist'], ['edit', 'Edit Specialist'], ['reorder', 'Reorder']].map(([key, label]) => (
          <button key={key} style={subTabStyle(activeTab === key)}
            onClick={() => { setActiveTab(key); if (key === 'reorder') loadReorderList() }}>
            {label}
          </button>
        ))}
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

      {/* Edit tab */}
      {activeTab === 'edit' && (
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Select Specialist</label>
            <select value={editSelectVal} onChange={e => handleEditSelect(e.target.value)} style={{...inputStyle, background: '#0d2a6e'}}>
              <option value="">-- Choose a specialist --</option>
              {allExperts.map(ex => <option key={ex.id} value={ex.id}>{ex.name} -- {ex.short_bio || ''}</option>)}
            </select>
          </div>
          {showEditForm && (
            <>
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
                <button onClick={() => { setShowEditForm(false); setEditSelectVal('') }}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '14px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={deleteSpecialist}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '14px', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reorder tab */}
      {activeTab === 'reorder' && (
        <div style={sectionStyle}>
          <p style={{ color: '#8bacc8', fontSize: '13px', marginBottom: '16px', fontStyle: 'italic' }}>Drag and drop to reorder specialists. This order applies to the widget and showroom for all members.</p>
          <input value={reorderSearch} onChange={e => setReorderSearch(e.target.value)} placeholder="Search to find a specialist..." style={{ ...inputStyle, marginBottom: '16px' }} />
          <div style={{ marginBottom: '20px' }}>
            {filteredReorder.map((expert, idx) => (
              <div key={expert.id}
                draggable
                onDragStart={() => handleDragStart(reorderExperts.indexOf(expert))}
                onDragEnter={() => handleDragEnter(reorderExperts.indexOf(expert))}
                onDragEnd={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'grab' }}>
                <span style={{ color: '#8bacc8', fontSize: '16px' }}>☰</span>
                <span style={{ color: '#8bacc8', fontSize: '13px', minWidth: '28px' }}>{reorderExperts.indexOf(expert) + 1}</span>
                <span style={{ fontSize: '14px', color: '#fff' }}>{expert.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {reorderDirty && <span style={{ fontSize: '13px', color: '#d4af37' }}>You have unsaved changes</span>}
            <button onClick={saveOrder}
              style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
              Save Order
            </button>
          </div>
          {reorderStatus && <p style={{ color: reorderStatusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{reorderStatus}</p>}
        </div>
      )}
    </div>
  )
}

const CIQ_TOPICS = ["1031 Exchange Review","179D Commercial Building Tax Deduction Review","401(k) Review","Advanced Business Tax Strategies Review","Advanced Personal Tax Strategies Review","Asset Protection Review","Business Continuation Planning Review","Business Entity Structure Review","Business Exit Planning Review","Business Finance & Costs - Banking Review","Business Finance & Costs - Merchant Processing (Credit Card Fees) Review","Business Growth - Revenue Generation Review","Business Planning Review","Business Valuation Review","Buy-Sell Agreement Review","Captive Insurance Review","Cash Balance Plan Review","Charitable Planning Review","Compensation & Benefits Review","Cost Recovery Review (Cost Segregation)","Cyber Insurance Review","Deferred Compensation Plan Review","Disability Income Protection Review","Employment Practices Liability Insurance (EPLI) Review","Estate Planning Review","Executive Benefits Review","Group Health Insurance Review","Guaranteed Asset Protection Gap Insurance Review","International Tax Strategies Review","Key Person Insurance Review","Leadership / Culture Review","Life Insurance Review","Life Settlements Review","Long-term Care Review","Merchant Processing (credit cards) Review","Opportunity Zones Review","Outsourced Bookkeeping, CFO and Tax Professionals Review","Outsourced CEO Review","Premium Finance Review","Property & Casualty Insurance Review","Qualified Plans Review","R&D Tax Credit Review","Real Estate Review","Risk Mitigation & Insurance Review","Sales Tax Exemption Review","SDIRA / Alternative Investments Review","Section 125 / Health Insurance Review","Solar Investment Review","Student Loan Repayment / Tuition Reimbursement Review","Surety Bonds Review","Tax Planning Review","Tax Resolution Review","Trust Review","Workers Compensation Review"]