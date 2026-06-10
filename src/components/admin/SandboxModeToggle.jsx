import { useState } from 'react'
import { callApi } from '../../lib/api'

// Clickable SANDBOX / LIVE badge + confirm modal, shared by the automation panels
// that previously rendered a non-interactive badge (PIP, Advisor, Accountant).
// Flips sandbox_mode + stripe_test_mode + boldsign_test_mode together via
// save_sandbox_config for the given `pipeline` row, then reports the new config
// back through onChange so the parent's local state stays in sync.
export default function SandboxModeToggle({ pipeline, label, sandboxConfig, onChange, note }) {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  if (!sandboxConfig) return null

  const sandbox = !!sandboxConfig.sandbox_mode
  const palette = sandbox
    ? { bg: 'rgba(251,137,90,0.15)', border: 'rgba(251,137,90,0.4)', text: '#e06717', txt: 'SANDBOX MODE' }
    : { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', txt: 'LIVE MODE' }
  const name = label || pipeline
  const switchingTo = sandbox ? 'LIVE' : 'SANDBOX'
  const goingLive = switchingTo === 'LIVE'

  async function toggle() {
    const next = !sandbox
    setSaving(true)
    setErr('')
    try {
      await callApi('save_sandbox_config', {
        pipeline,
        sandbox_mode: next,
        stripe_test_mode: next,
        boldsign_test_mode: next,
      })
      onChange?.({ ...sandboxConfig, sandbox_mode: next, stripe_test_mode: next, boldsign_test_mode: next })
      setShowModal(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setErr(''); setShowModal(true) }}
        title="Click to toggle"
        style={{
          padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
          background: palette.bg, color: palette.text,
          border: `1px solid ${palette.border}`, letterSpacing: '0.5px',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {palette.txt}
      </button>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(16,34,69,0.50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          fontFamily: '"Inter", sans-serif',
        }}>
          <div style={{
            background: '#ffffff', border: '1px solid #e3eaf5',
            borderRadius: '12px', padding: '32px', maxWidth: '440px', width: '90%',
          }}>
            <h2 style={{ fontSize: '18px', color: '#16264a', margin: '0 0 12px' }}>
              Switch {name} to {switchingTo} mode?
            </h2>
            <p style={{ fontSize: '14px', color: '#4e6087', lineHeight: 1.6, margin: '0 0 16px' }}>
              {goingLive
                ? `This switches ${name} to LIVE Stripe + BoldSign keys. Real emails go to real clients/members/PFs and real cards are charged.`
                : `This switches ${name} back to sandbox: emails route to the sandbox address and Stripe/BoldSign use test keys.`}
            </p>
            {note && <p style={{ fontSize: '13px', color: '#e06717', fontWeight: 500, lineHeight: 1.5, margin: '0 0 16px' }}>{note}</p>}
            {err && <p style={{ fontSize: '13px', color: '#d93025', fontWeight: 500, margin: '0 0 16px' }}>{err}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  border: '1px solid #d6e0ee', background: 'transparent',
                  color: '#4e6087', fontSize: '14px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={toggle}
                disabled={saving}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: goingLive ? '#ef4444' : '#e06717', color: '#fff', fontSize: '14px', fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : `Switch to ${switchingTo}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
