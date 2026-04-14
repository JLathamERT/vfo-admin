import { useState } from 'react'
import { callApi } from '../../lib/api'

export default function MemberWebsitePlugin({ member, onDataChange, readOnly = false }) {
  const [appearanceTab, setAppearanceTab] = useState('appearance')
  const [settings, setSettings] = useState({
    bg_color: member.bg_color || '#0a1628',
    text_color: member.text_color || '#ffffff',
    accent_color: member.accent_color || '#1a2744',
    card_text_color: member.card_text_color || '#ffffff',
    primary_color: member.primary_color || '#d4af37',
    font: member.font || 'DM Sans',
    last_initial_only: member.last_initial_only || false,
    show_count: member.show_count !== false,
    show_search: member.show_search !== false,
    display_mode: member.display_mode || 'filter',
    website_enabled: member.website_enabled || false,
  })
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  function update(key, val) { setSettings(p => ({ ...p, [key]: val })); setDirty(true) }

  async function save() {
    try {
      await callApi('save_member', { member_number: member.member_number, settings })
      if (onDataChange) await onDataChange()
      setDirty(false)
      setStatusType('success'); setStatus('Changes saved!')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const embedCode = `<div id="vfo-showroom"></div>\n<script src="https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/vfo-widget/vfo-widget.js?v=23" data-vfo-key="${member.manage_key}"><\/script>`

  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }
  const inputStyle = { width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }

  if (!member.website_enabled && !readOnly) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff', marginBottom: '12px' }}>Website plugin not enabled</p>
        <p style={{ fontSize: '14px', color: '#8bacc8' }}>Contact your administrator to enable website customization for your account.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        <button style={subTabStyle(appearanceTab === 'appearance')} onClick={() => setAppearanceTab('appearance')}>Appearance</button>
        <button style={subTabStyle(appearanceTab === 'plugin')} onClick={() => setAppearanceTab('plugin')}>Plugin Settings</button>
      </div>

      {appearanceTab === 'appearance' && (
        <>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Colors</div>
            {[
              ['bg_color', 'Background Color', 'Page background'],
              ['text_color', 'Heading Text Color', 'Title, subtitle, search, filters, group headings'],
              ['accent_color', 'Card Background', 'Card and modal background'],
              ['card_text_color', 'Card Text Color', 'Names and bios on cards and modal'],
              ['primary_color', 'Accent Color', 'Active buttons, tags, hover effects, underlines'],
            ].map(([key, label, desc]) => (
              <div key={key} style={rowStyle}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', color: '#fff' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '2px' }}>{desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color" value={settings[key]} onChange={e => update(key, e.target.value)}
                    style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer' }} />
                  <input value={settings[key]} onChange={e => update(key, e.target.value)} style={inputStyle} />
                </div>
              </div>
            ))}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Display Options</div>
            {[
              ['last_initial_only', 'Last Name Initial Only', 'Show "Bill L." instead of "Bill Lloyd"'],
              ['show_count', 'Show Specialist Count', 'Display "60 SPECIALISTS" text'],
              ['show_search', 'Show Search Bar', 'Display the search specialists input'],
            ].map(([key, label, desc]) => (
              <div key={key} style={rowStyle}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', color: '#fff' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '2px' }}>{desc}</div>
                </div>
                <div onClick={() => update(key, !settings[key])}
                  style={{ width: '44px', height: '24px', borderRadius: '12px', background: settings[key] ? '#2563eb' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '2px', left: settings[key] ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}
            <div style={rowStyle}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', color: '#fff' }}>Display Mode</div>
                <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '2px' }}>How specialists are organized</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['filter', 'Filter Buttons'], ['grouped', 'Grouped']].map(([val, label]) => (
                  <button key={val} onClick={() => update('display_mode', val)}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${settings.display_mode === val ? '#5b9fe6' : 'rgba(255,255,255,0.2)'}`, background: settings.display_mode === val ? 'rgba(91,159,230,0.15)' : 'transparent', color: settings.display_mode === val ? '#5b9fe6' : '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {appearanceTab === 'plugin' && (
        <div style={sectionStyle}>
          {!readOnly && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Website Plugin</div>
              <div style={rowStyle}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', color: '#fff' }}>Enable Website Plugin</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '2px' }}>Allow this member to use their showroom widget</div>
                </div>
                <div onClick={() => update('website_enabled', !settings.website_enabled)}
                  style={{ width: '44px', height: '24px', borderRadius: '12px', background: settings.website_enabled ? '#2563eb' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '2px', left: settings.website_enabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Embed Code</div>
            <p style={{ color: '#5a8ab5', fontSize: '14px', marginBottom: '12px', textAlign: 'left' }}>Copy this code and paste it into an HTML widget on your website.</p>
            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', color: '#a0b0c4', fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: '0 0 12px', textAlign: 'left' }}>{embedCode}</pre>
            <button onClick={() => navigator.clipboard.writeText(embedCode)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(39,174,96,0.3)', background: 'transparent', color: '#27ae60', fontSize: '13px', cursor: 'pointer' }}>
              Copy Code
            </button>
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, background: '#073991', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {dirty && <span style={{ fontSize: '13px', color: '#d4af37' }}>You have unsaved changes</span>}
        <button onClick={save} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Save Changes</button>
        {status && <span style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px' }}>{status}</span>}
      </div>
    </div>
  )
}