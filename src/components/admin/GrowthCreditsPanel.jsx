import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'
import SandboxModeToggle from './SandboxModeToggle'
import { TableSkeleton } from '../shared/Skeleton'

// Automation & Config -> Growth Credits. Sandbox toggle for the GROWTH_CREDITS
// Stripe pipeline, the fixed purchase packages (server-enforced), and a service
// management table (name / description / category / credit cost / active).

const PACKAGES = [
  { credits: 1, price: '$100' },
  { credits: 10, price: '$950' },
  { credits: 20, price: '$1,800' },
]

const NAVY = '#002973'
const BLUE = '#125ecc'

export default function GrowthCreditsPanel() {
  const [services, setServices] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState({ name: '', description: '', category: '', credit_cost: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('gc_load_services', { include_inactive: true })
      if (res?.error) { setError(res.error); return }
      setServices(res.services || [])
      setSandboxConfig(res.sandbox_config || { sandbox_mode: false })
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function flash(msg) { setStatus(msg); setTimeout(() => setStatus(''), 4000) }

  async function saveService(svc, patch) {
    setBusy(true)
    try {
      await callApi('gc_manage_service', {
        service_id: svc.id,
        name: patch.name ?? svc.name,
        description: patch.description ?? svc.description,
        category: patch.category ?? svc.category,
        credit_cost: patch.credit_cost ?? svc.credit_cost,
        active: patch.active ?? svc.active,
      })
      flash('Service updated.')
      await load()
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function addService() {
    if (!adding.name || !adding.credit_cost) { flash('Name and credit cost are required.'); return }
    setBusy(true)
    try {
      await callApi('gc_manage_service', {
        name: adding.name,
        description: adding.description,
        category: adding.category,
        credit_cost: parseInt(adding.credit_cost, 10),
      })
      setAdding({ name: '', description: '', category: '', credit_cost: '' })
      flash('Service added.')
      await load()
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const wrap = { padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const card = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '22px', marginBottom: '20px' }
  const cardTitle = { fontSize: '15px', fontWeight: 700, color: 'var(--vfo-heading)', margin: '0 0 16px', paddingBottom: '8px', borderBottom: `2px solid ${NAVY}`, display: 'inline-block' }
  const input = { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }
  const cols = '1.6fr 1.2fr 100px 90px 90px'

  return (
    <div style={wrap}>
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '10.5px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 4px' }}>Automation & Config</p>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>Growth Credits</h2>
        </div>
        {sandboxConfig && (
          <SandboxModeToggle
            pipeline="GROWTH_CREDITS"
            label="Growth Credits"
            sandboxConfig={sandboxConfig}
            onChange={setSandboxConfig}
            note="This toggles the Stripe mode used for Growth Credit purchases only."
          />
        )}
      </div>

      {status && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', marginBottom: '14px' }}>{status}</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}

      <div style={card}>
        <div style={cardTitle}>Packages</div>
        <p style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', margin: '0 0 14px' }}>Purchase packages are fixed and enforced server-side (a member cannot alter the price).</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {PACKAGES.map(p => (
            <div key={p.credits} style={{ flex: 1, minWidth: '160px', border: '1px solid var(--vfo-border-mid)', background: 'var(--vfo-tint)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--vfo-ink)' }}>{p.credits}</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--vfo-muted)', marginTop: '2px' }}>{p.credits === 1 ? 'credit' : 'credits'}</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: BLUE, marginTop: '8px' }}>{p.price}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Services</div>
        {loading && <TableSkeleton cols={[2, 1, 1, 1]} rows={3} />}
        {!loading && !error && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '10px', padding: '8px 4px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)', borderBottom: '1px solid var(--vfo-border-soft)' }}>
              <span>Name / Description</span><span>Category</span><span style={{ textAlign: 'right' }}>Credit Cost</span><span style={{ textAlign: 'center' }}>Active</span><span />
            </div>
            {services.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--vfo-faint)', fontSize: '13px' }}>No services yet.</div>
            )}
            {services.map(svc => (
              <ServiceRow key={svc.id} svc={svc} cols={cols} input={input} busy={busy} onSave={saveService} />
            ))}

            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--vfo-border-soft)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--vfo-muted)', marginBottom: '10px' }}>Add a service</div>
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input style={input} placeholder="Name" value={adding.name} onChange={e => setAdding(a => ({ ...a, name: e.target.value }))} />
                  <input style={input} placeholder="Description (optional)" value={adding.description} onChange={e => setAdding(a => ({ ...a, description: e.target.value }))} />
                </div>
                <input style={input} placeholder="Category" value={adding.category} onChange={e => setAdding(a => ({ ...a, category: e.target.value }))} />
                <input style={{ ...input, textAlign: 'right' }} type="number" placeholder="0" value={adding.credit_cost} onChange={e => setAdding(a => ({ ...a, credit_cost: e.target.value }))} />
                <span />
                <button onClick={addService} disabled={busy} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${BLUE} 0%, #0a85e8 100%)`, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ServiceRow({ svc, cols, input, busy, onSave }) {
  const [cost, setCost] = useState(String(svc.credit_cost ?? ''))
  const dirty = String(svc.credit_cost ?? '') !== cost

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '10px', padding: '12px 4px', borderBottom: '1px solid var(--vfo-border-soft)', alignItems: 'center', fontSize: '13px', color: 'var(--vfo-ink)' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{svc.name}</div>
        {svc.description && <div style={{ fontSize: '11.5px', color: 'var(--vfo-muted)', marginTop: '2px' }}>{svc.description}</div>}
      </div>
      <span style={{ color: 'var(--vfo-muted)' }}>{svc.category || '—'}</span>
      <input style={{ ...input, textAlign: 'right', maxWidth: '90px', justifySelf: 'end' }} type="number" value={cost} onChange={e => setCost(e.target.value)} />
      <button
        onClick={() => onSave(svc, { active: !svc.active })}
        disabled={busy}
        style={{ justifySelf: 'center', padding: '4px 12px', borderRadius: '20px', border: '1px solid', borderColor: svc.active ? 'rgba(22,163,74,0.4)' : 'var(--vfo-border-strong)', background: svc.active ? 'rgba(22,163,74,0.12)' : 'var(--vfo-tint)', color: svc.active ? '#16a34a' : 'var(--vfo-muted)', fontSize: '11.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
        {svc.active ? 'Active' : 'Inactive'}
      </button>
      <button
        onClick={() => onSave(svc, { credit_cost: parseInt(cost, 10) })}
        disabled={busy || !dirty || cost === ''}
        style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${dirty ? '#125ecc' : 'var(--vfo-border-strong)'}`, background: 'var(--vfo-card)', color: dirty ? '#125ecc' : 'var(--vfo-faint)', fontSize: '12.5px', fontWeight: 600, cursor: (busy || !dirty) ? 'default' : 'pointer' }}>
        Save
      </button>
    </div>
  )
}
