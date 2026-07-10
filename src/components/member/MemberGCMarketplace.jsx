import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'
import { Skeleton } from '../shared/Skeleton'

// Escape DB/admin-authored text before it's rendered via dangerouslySetInnerHTML
// (M1a) so a malicious gc_services.description can't inject script into member browsers.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function formatServiceDetails(description) {
  if (!description) return ''
  const parts = description.split('|')
  const labels = ['Objective', 'Available to', 'Includes', 'Tailoring Options']
  return parts.map((part, i) => part.trim() ? `<div style="margin-bottom:8px;text-align:left;"><span style="color:var(--vfo-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${labels[i] || ''}</span><div style="color:#44557a;font-size:13px;margin-top:2px;">${escapeHtml(part.trim())}</div></div>` : '').join('')
}

export default function MemberGCMarketplace({ memberNumber }) {
  const [gcTab, setGcTab] = useState('dashboard')
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState(null)
  const [services, setServices] = useState([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [totalRedeemed, setTotalRedeemed] = useState(null)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [buyPkg, setBuyPkg] = useState(null) // selected package -> shows the payment-method step
  const [confirmService, setConfirmService] = useState(null)
  const [redeeming, setRedeeming] = useState(false)
  const [openDetails, setOpenDetails] = useState({})
  const [banner, setBanner] = useState('')

  useEffect(() => { loadDashboard() }, [memberNumber])
  useEffect(() => { if (gcTab === 'services') loadServices() }, [gcTab])

  // Stripe returns the buyer to /member?gc_success=1&m=<method>. Card payments
  // settle immediately (webhook credits within seconds) so we poll the balance
  // and confirm; ACH settles over days, so we just explain and wait.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gc_success') !== '1') return
    const method = params.get('m')
    params.delete('gc_success')
    params.delete('m')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''))

    if (method === 'ach') {
      // setBanner (not showBanner) so the message persists — no auto-dismiss.
      setBanner('Payment received. Your bank transfer is processing — credits will appear here automatically once it settles, typically a few business days.')
      return
    }

    // Card (or method absent): poll gc_load_balance until the balance rises.
    setBanner('Payment received. Adding your credits…')
    let cancelled = false
    ;(async () => {
      let initial = null
      try {
        const b = await callApi('gc_load_balance', { member_number: memberNumber })
        initial = b.balance || 0
      } catch { initial = null }
      const start = Date.now()
      while (!cancelled && Date.now() - start < 30000) {
        await new Promise(r => setTimeout(r, 3000))
        try {
          const b = await callApi('gc_load_balance', { member_number: memberNumber })
          const nb = b.balance || 0
          if (initial !== null && nb > initial) {
            if (cancelled) return
            setBanner(`Purchase complete — your new balance is ${nb} credits.`)
            loadDashboard()
            return
          }
        } catch { /* transient — keep polling */ }
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function loadDashboard() {
    try {
      const [balData, transData] = await Promise.all([
        callApi('gc_load_balance', { member_number: memberNumber }),
        callApi('gc_load_transactions', { member_number: memberNumber }),
      ])
      setBalance(balData.balance || 0)
      setTransactions(transData.transactions || [])
      const spent = (transData.transactions || []).filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      setTotalRedeemed(spent)
    } catch (err) { console.error(err) }
  }

  async function loadServices() {
    try {
      const data = await callApi('gc_load_services')
      setServices(data.services || [])
    } catch (err) { console.error(err) }
    finally { setServicesLoaded(true) }
  }

  async function buyCredits(amount, payment_method) {
    try {
      // Price is derived server-side from the fixed package table; only the
      // credit amount + method are sent (card adds the processing fee server-side).
      const data = await callApi('gc_create_checkout', { member_number: memberNumber, amount, payment_method })
      if (data.url) window.location.href = data.url
    } catch (err) { showBanner('Error: ' + err.message); closeBuyModal() }
  }

  function closeBuyModal() { setShowBuyModal(false); setBuyPkg(null) }

  async function redeemService(svc) {
    setRedeeming(true)
    try {
      const result = await callApi('gc_redeem', { member_number: memberNumber, service_id: svc.id })
      setBalance(result.balance)
      showBanner(`Successfully redeemed ${svc.name} for ${svc.credit_cost} ${svc.credit_cost === 1 ? 'credit' : 'credits'}.`)
      loadDashboard()
    } catch (err) { showBanner('Error: ' + err.message) }
    setRedeeming(false)
    setConfirmService(null)
  }

  function showBanner(msg) { setBanner(msg); setTimeout(() => setBanner(''), 5000) }
  function toggleDetails(id) { setOpenDetails(p => ({ ...p, [id]: !p[id] })) }

  const subTabStyle = (active) => ({
    padding: '7px 16px', background: active ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : 'var(--vfo-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px'
  })
  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }

  const categories = []
  const catMap = {}
  services.forEach(svc => {
    const cat = svc.category || 'Other Services'
    if (!catMap[cat]) { catMap[cat] = []; categories.push(cat) }
    catMap[cat].push(svc)
  })
  categories.sort((a, b) => a === 'Other Services' ? 1 : b === 'Other Services' ? -1 : 0)

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--vfo-border)', marginBottom: '24px' }}>
        {[['dashboard', 'Dashboard'], ['services', 'Services'], ['history', 'History']].map(([key, label]) => (
          <button key={key} style={subTabStyle(gcTab === key)} onClick={() => setGcTab(key)}>{label}</button>
        ))}
      </div>

      {/* Dashboard */}
      {gcTab === 'dashboard' && (
        <>
          {banner && <div style={{ background: 'rgba(27,146,84,0.15)', border: '1px solid rgba(27,146,84,0.4)', color: '#1b9254', fontWeight: 500, padding: '14px 20px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }}>{banner}</div>}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...sectionStyle, flex: 1, textAlign: 'center' }}>
              <p style={{ color: 'var(--vfo-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Credit Balance</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '42px', color: 'var(--vfo-ink)', margin: '0 0 36px', lineHeight: '1', minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {balance === null ? <Skeleton width={70} height={36} /> : balance}
              </p>
              <button onClick={() => { setBuyPkg(null); setShowBuyModal(true) }} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Buy Credits</button>
            </div>
            <div style={{ ...sectionStyle, flex: 1 }}>
              <p style={{ color: 'var(--vfo-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Quick Stats</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--vfo-tint)' }}>
                <span style={{ color: 'var(--vfo-muted)', fontSize: '13px' }}>Total Transactions</span>
                {transactions === null ? <Skeleton width={30} height={14} /> : <span style={{ color: 'var(--vfo-ink)', fontWeight: '600' }}>{transactions.length}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--vfo-muted)', fontSize: '13px' }}>Total Redeemed</span>
                {totalRedeemed === null ? <Skeleton width={30} height={14} /> : <span style={{ color: 'var(--vfo-ink)', fontWeight: '600' }}>{totalRedeemed}</span>}
              </div>
            </div>
          </div>
          {showBuyModal && !buyPkg && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Buy Credits</div>
              <p style={{ color: 'var(--vfo-muted)', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>Select a credit package to purchase.</p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {[
                  { amount: 1, price: 100, label: '1 credit — $100', savings: null },
                  { amount: 10, price: 950, label: '10 credits — $950', savings: 'Save 5%' },
                  { amount: 20, price: 1800, label: '20 credits — $1,800', savings: 'Save 10%' },
                ].map(pkg => (
                  <button key={pkg.amount} onClick={() => setBuyPkg(pkg)}
                    style={{ padding: '16px 24px', flex: 1, textAlign: 'center', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'var(--vfo-tint)', cursor: 'pointer' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--vfo-ink)' }}>{pkg.amount}</div>
                    <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--vfo-muted)', marginTop: '4px' }}>{pkg.label}</div>
                    {pkg.savings && <div style={{ fontSize: '10px', color: '#1b9254', fontWeight: 600, marginTop: '2px' }}>{pkg.savings}</div>}
                  </button>
                ))}
              </div>
              <button onClick={closeBuyModal} style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
          )}
          {showBuyModal && buyPkg && (() => {
            // Card grosses up so the 2.9% + $0.30 Stripe fee nets to the package
            // price — same formula as the public /pay pages. ACH has no fee.
            const cardTotal = Math.round((buyPkg.price + 0.30) / (1 - 0.029) * 100) / 100
            const cardFee = Math.round((cardTotal - buyPkg.price) * 100) / 100
            const money = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return (
              <div style={sectionStyle}>
                <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Payment Method</div>
                <p style={{ color: 'var(--vfo-muted)', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>
                  {buyPkg.amount} {buyPkg.amount === 1 ? 'credit' : 'credits'} — choose how you'd like to pay.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <button onClick={() => buyCredits(buyPkg.amount, 'ach')}
                    style={{ padding: '16px 20px', textAlign: 'left', borderRadius: '10px', border: '1px solid var(--vfo-border-mid)', background: 'var(--vfo-tint)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>Bank transfer (ACH)</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#1b9254', background: 'rgba(27,146,84,0.15)', padding: '3px 10px', borderRadius: '999px' }}>No fee</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--vfo-ink)', marginTop: '8px' }}>${money(buyPkg.price)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '4px' }}>Funds transfer directly from your bank. Takes a few business days; credits appear once it settles.</div>
                  </button>
                  <button onClick={() => buyCredits(buyPkg.amount, 'card')}
                    style={{ padding: '16px 20px', textAlign: 'left', borderRadius: '10px', border: '1px solid var(--vfo-border-mid)', background: 'var(--vfo-tint)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>Card</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#0095ff', background: 'rgba(0,149,255,0.15)', padding: '3px 10px', borderRadius: '999px' }}>2.9% + $0.30 fee</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--vfo-ink)', marginTop: '8px' }}>${money(cardTotal)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '4px' }}>${money(buyPkg.price)} + ${money(cardFee)} processing fee. Processes immediately.</div>
                  </button>
                </div>
                <button onClick={() => setBuyPkg(null)} style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: 'pointer' }}>Back</button>
              </div>
            )
          })()}
        </>
      )}

      {/* Services */}
      {gcTab === 'services' && (
        <>
          {banner && <div style={{ background: 'rgba(27,146,84,0.15)', border: '1px solid rgba(27,146,84,0.4)', color: '#1b9254', fontWeight: 500, padding: '14px 20px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }}>{banner}</div>}
          {!servicesLoaded && Array.from({ length: 2 }).map((_, ci) => (
            <div key={ci} style={sectionStyle}>
              <Skeleton width={150} height={12} style={{ marginBottom: '18px' }} />
              {Array.from({ length: 4 }).map((_, ri) => (
                <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid var(--vfo-border-soft)', marginBottom: '14px' }}>
                  <Skeleton width="42%" height={14} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton width={28} height={14} />
                    <Skeleton width={72} height={30} style={{ borderRadius: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
          {servicesLoaded && categories.map(cat => (
            <div key={cat} style={sectionStyle}>
              <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>{cat}</div>
              {catMap[cat].map(svc => (
                <div key={svc.id} style={{ paddingBottom: '14px', borderBottom: '1px solid var(--vfo-border-soft)', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--vfo-ink)', fontSize: '14px', textAlign: 'left' }}>{svc.name}</span>
                      {svc.description && (
                        <button onClick={() => toggleDetails(svc.id)}
                          style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {openDetails[svc.id] ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{ color: 'var(--vfo-ink)', fontWeight: '700' }}>{svc.credit_cost}</span>
                      <span style={{ color: 'var(--vfo-muted)', fontSize: '11px' }}>credits</span>
                      {balance !== null && balance < svc.credit_cost ? (
                        <button onClick={() => setConfirmService(svc)} title="Not enough credits"
                          style={{ padding: '6px 18px', borderRadius: '6px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-mid)', color: 'var(--vfo-muted)', fontSize: '12px', cursor: 'pointer' }}>Redeem</button>
                      ) : (
                        <button onClick={() => setConfirmService(svc)} style={{ padding: '6px 18px', borderRadius: '6px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Redeem</button>
                      )}
                    </div>
                  </div>
                  {openDetails[svc.id] && (
                    <div style={{ marginTop: '12px', padding: '16px', background: 'var(--vfo-tint)', borderRadius: '8px', textAlign: 'left' }}
                      dangerouslySetInnerHTML={{ __html: formatServiceDetails(svc.description) }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* History */}
      {gcTab === 'history' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Transaction History</div>
          {transactions === null
            ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--vfo-tint)' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <Skeleton width={160} height={14} />
                  <Skeleton width={90} height={11} style={{ marginTop: '4px' }} />
                </div>
                <Skeleton width={70} height={20} style={{ borderRadius: '6px' }} />
              </div>
            ))
            : transactions.length === 0
            ? <p style={{ color: 'var(--vfo-muted)', fontSize: '14px' }}>No transactions yet.</p>
            : transactions.map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--vfo-tint)' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: 'var(--vfo-ink)', fontSize: '14px' }}>{tx.description || tx.type}</div>
                  <div style={{ color: 'var(--vfo-muted)', fontSize: '12px', marginTop: '2px' }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {tx.type === 'purchased'
                    ? <span style={{ background: 'rgba(27,146,84,0.2)', color: '#1b9254', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>purchased</span>
                    : tx.type === 'refunded'
                    ? <span style={{ background: 'rgba(0,149,255,0.2)', color: '#0095ff', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>refunded</span>
                    : <span style={{ background: 'rgba(231,76,60,0.2)', color: '#d93025', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>redeemed</span>
                  }
                  <span style={{ color: tx.amount > 0 ? '#1b9254' : '#d93025', fontWeight: '600', minWidth: '50px', textAlign: 'right' }}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
                  <span style={{ color: 'var(--vfo-muted)', fontSize: '12px', minWidth: '40px', textAlign: 'right' }}>{tx.balance_after}</span>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {confirmService && (
        <div onClick={() => { if (!redeeming) setConfirmService(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(9,14,26,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: '0 18px 50px rgba(9,14,26,0.35)', padding: '26px 28px', maxWidth: '420px', width: '100%', textAlign: 'left' }}>
            {balance !== null && balance < confirmService.credit_cost ? (
              <>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '10px' }}>Not enough credits</div>
                <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  <strong>{confirmService.name}</strong> requires <strong>{confirmService.credit_cost} {confirmService.credit_cost === 1 ? 'credit' : 'credits'}</strong> and you currently have <strong>{balance}</strong>.
                </p>
                <p style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', margin: '0 0 18px' }}>
                  You need {confirmService.credit_cost - balance} more {confirmService.credit_cost - balance === 1 ? 'credit' : 'credits'} to redeem this service.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button onClick={() => setConfirmService(null)}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: 'pointer' }}>Close</button>
                  <button onClick={() => { setConfirmService(null); setGcTab('dashboard'); setBuyPkg(null); setShowBuyModal(true) }}
                    style={{ padding: '8px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Buy credits</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '10px' }}>Redeem service</div>
                <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  Redeem <strong>{confirmService.name}</strong> for <strong>{confirmService.credit_cost} {confirmService.credit_cost === 1 ? 'credit' : 'credits'}</strong>?
                </p>
                {balance !== null && (
                  <p style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', margin: '0 0 18px' }}>
                    Balance after: {balance - confirmService.credit_cost} {balance - confirmService.credit_cost === 1 ? 'credit' : 'credits'}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: balance === null ? '18px' : 0 }}>
                  <button onClick={() => setConfirmService(null)} disabled={redeeming}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: redeeming ? 'default' : 'pointer', opacity: redeeming ? 0.6 : 1 }}>Cancel</button>
                  <button onClick={() => redeemService(confirmService)} disabled={redeeming}
                    style={{ padding: '8px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: redeeming ? 'default' : 'pointer', opacity: redeeming ? 0.7 : 1 }}>
                    {redeeming ? 'Redeeming…' : 'Confirm redemption'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}