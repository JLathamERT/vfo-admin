import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'

function formatServiceDetails(description) {
  if (!description) return ''
  const parts = description.split('|')
  const labels = ['Objective', 'Available to', 'Includes', 'Tailoring Options']
  return parts.map((part, i) => part.trim() ? `<div style="margin-bottom:8px;text-align:left;"><span style="color:#8bacc8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${labels[i] || ''}</span><div style="color:#c0ccda;font-size:13px;margin-top:2px;">${part.trim()}</div></div>` : '').join('')
}

export default function MemberGCMarketplace({ memberNumber }) {
  const [gcTab, setGcTab] = useState('dashboard')
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [services, setServices] = useState([])
  const [totalRedeemed, setTotalRedeemed] = useState(0)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [confirmService, setConfirmService] = useState(null)
  const [openDetails, setOpenDetails] = useState({})
  const [banner, setBanner] = useState('')

  useEffect(() => { loadDashboard() }, [memberNumber])
  useEffect(() => { if (gcTab === 'services') loadServices() }, [gcTab])

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
  }

  async function buyCredits(amount, price) {
    try {
      const data = await callApi('gc_create_checkout', { member_number: memberNumber, amount, price })
      if (data.url) window.location.href = data.url
    } catch (err) { showBanner('Error: ' + err.message) }
    setShowBuyModal(false)
  }

  async function redeemService(svc) {
    try {
      const result = await callApi('gc_redeem', { member_number: memberNumber, service_id: svc.id })
      setBalance(result.balance)
      setConfirmService(null)
      showBanner(`Successfully redeemed ${svc.name} for ${svc.credit_cost} credits.`)
      loadDashboard()
    } catch (err) { showBanner('Error: ' + err.message) }
  }

  function showBanner(msg) { setBanner(msg); setTimeout(() => setBanner(''), 5000) }
  function toggleDetails(id) { setOpenDetails(p => ({ ...p, [id]: !p[id] })) }

  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }

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
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        {[['dashboard', 'Dashboard'], ['services', 'Services'], ['history', 'History']].map(([key, label]) => (
          <button key={key} style={subTabStyle(gcTab === key)} onClick={() => setGcTab(key)}>{label}</button>
        ))}
      </div>

      {/* Dashboard */}
      {gcTab === 'dashboard' && (
        <>
          {banner && <div style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.4)', color: '#5dca7a', padding: '14px 20px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }}>{banner}</div>}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...sectionStyle, flex: 1, textAlign: 'center' }}>
              <p style={{ color: '#8bacc8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Credit Balance</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '42px', color: '#fff', margin: '0 0 16px', lineHeight: '1' }}>{balance}</p>
              <button onClick={() => setShowBuyModal(true)} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Buy Credits</button>
            </div>
            <div style={{ ...sectionStyle, flex: 1 }}>
              <p style={{ color: '#8bacc8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Quick Stats</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#8bacc8', fontSize: '13px' }}>Total Transactions</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{transactions.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#8bacc8', fontSize: '13px' }}>Total Redeemed</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{totalRedeemed}</span>
              </div>
            </div>
          </div>
          {showBuyModal && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Buy Credits</div>
              <p style={{ color: '#8bacc8', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>Select a credit package to purchase.</p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {[
                  { amount: 1, price: 100, label: '1 credit — $100', savings: null },
                  { amount: 10, price: 950, label: '10 credits — $950', savings: 'Save 5%' },
                  { amount: 20, price: 1800, label: '20 credits — $1,800', savings: 'Save 10%' },
                ].map(pkg => (
                  <button key={pkg.amount} onClick={() => buyCredits(pkg.amount, pkg.price)}
                    style={{ padding: '16px 24px', flex: 1, textAlign: 'center', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{pkg.amount}</div>
                    <div style={{ fontSize: '11px', color: '#8bacc8', marginTop: '4px' }}>{pkg.label}</div>
                    {pkg.savings && <div style={{ fontSize: '10px', color: '#5dca7a', marginTop: '2px' }}>{pkg.savings}</div>}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowBuyModal(false)} style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
          )}
        </>
      )}

      {/* Services */}
      {gcTab === 'services' && (
        <>
          {banner && <div style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.4)', color: '#5dca7a', padding: '14px 20px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }}>{banner}</div>}
          {categories.map(cat => (
            <div key={cat} style={sectionStyle}>
              <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>{cat}</div>
              {catMap[cat].map(svc => (
                <div key={svc.id} style={{ paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#fff', fontSize: '14px', textAlign: 'left' }}>{svc.name}</span>
                      {svc.description && (
                        <button onClick={() => toggleDetails(svc.id)}
                          style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {openDetails[svc.id] ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontWeight: '700' }}>{svc.credit_cost}</span>
                      <span style={{ color: '#5a8ab5', fontSize: '11px' }}>credits</span>
                      {confirmService?.id === svc.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#ffb347', fontSize: '13px' }}>Confirm?</span>
                          <button onClick={() => redeemService(svc)} style={{ padding: '5px 14px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Yes</button>
                          <button onClick={() => setConfirmService(null)} style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmService(svc)} style={{ padding: '6px 18px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Redeem</button>
                      )}
                    </div>
                  </div>
                  {openDetails[svc.id] && (
                    <div style={{ marginTop: '12px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', textAlign: 'left' }}
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
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Transaction History</div>
          {transactions.length === 0
            ? <p style={{ color: '#5a8ab5', fontSize: '14px' }}>No transactions yet.</p>
            : transactions.map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: '14px' }}>{tx.description || tx.type}</div>
                  <div style={{ color: '#5a8ab5', fontSize: '12px', marginTop: '2px' }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {tx.type === 'purchased'
                    ? <span style={{ background: 'rgba(39,174,96,0.2)', color: '#5dca7a', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>purchased</span>
                    : tx.type === 'refunded'
                    ? <span style={{ background: 'rgba(91,159,230,0.2)', color: '#5b9fe6', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>refunded</span>
                    : <span style={{ background: 'rgba(231,76,60,0.2)', color: '#ff6b6b', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>redeemed</span>
                  }
                  <span style={{ color: tx.amount > 0 ? '#5dca7a' : '#ff6b6b', fontWeight: '600', minWidth: '50px', textAlign: 'right' }}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
                  <span style={{ color: '#5a8ab5', fontSize: '12px', minWidth: '40px', textAlign: 'right' }}>{tx.balance_after}</span>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}