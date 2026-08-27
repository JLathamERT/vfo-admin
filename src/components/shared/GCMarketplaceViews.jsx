import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'
import { Skeleton } from './Skeleton'

// The member-facing Growth Credits Services and History views, shared verbatim
// between the member portal (MemberGCMarketplace) and the admin per-member GC
// tab (MembersPanel -> MemberGC) so the two can never drift. adminMode only
// changes copy and the buy-credits affordance; the markup is one source.

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

const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }
const bannerStyle = { background: 'rgba(27,146,84,0.15)', border: '1px solid rgba(27,146,84,0.4)', color: '#1b9254', fontWeight: 500, padding: '14px 20px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'left' }
// The hosts funnel failures through showBanner('Error: ...'), so the prefix is
// the discriminator the historical single green banner never had.
const errorBannerStyle = { ...bannerStyle, background: 'rgba(217,48,37,0.12)', border: '1px solid rgba(217,48,37,0.35)', color: '#d93025' }

const INTERVAL_NOUN = { monthly: 'month', yearly: 'year' }
const isRecurring = (svc) => !!INTERVAL_NOUN[svc?.billing_interval]
const intervalNoun = (bi) => INTERVAL_NOUN[bi] || ''
const creditWord = (n) => (n === 1 ? 'credit' : 'credits')

// next_charge_date arrives as a bare YYYY-MM-DD, which Date() reads as UTC
// midnight and would render as the previous day west of Greenwich — pin those
// to local midnight before formatting.
function fmtDate(v) {
  if (!v) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(String(v) + 'T00:00:00') : new Date(v)
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function GCTransactionHistory({ transactions }) {
  return (
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
  )
}

export function GCServicesView({
  active = true,
  memberNumber,
  adminMode = false,
  balance = null,
  banner = '',
  showBanner,
  onBalanceChange,
  onRedeemed,
  onBuyCredits,
}) {
  const [services, setServices] = useState([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [subscriptions, setSubscriptions] = useState([])
  const [openDetails, setOpenDetails] = useState({})
  const [confirmService, setConfirmService] = useState(null)
  const [redeeming, setRedeeming] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  // The host keeps this component mounted and flips `active`, so the catalogue
  // refreshes on every visit to the tab while what is already loaded stays on
  // screen instead of re-skeletoning.
  useEffect(() => { if (active) loadServices() }, [active, memberNumber])

  async function loadServices() {
    // Subscriptions are additive decoration on the same rows: they are fetched
    // alongside, but a failure there must not blank the catalogue.
    const [svcRes, subRes] = await Promise.all([
      callApi('gc_load_services', adminMode ? { member_number: memberNumber } : {}).catch(err => { console.error(err); return null }),
      callApi('gc_load_subscriptions', { member_number: memberNumber }).catch(err => { console.error(err); return null }),
    ])
    if (svcRes) {
      // An admin session can be served the full catalogue; the member-facing
      // list never shows a retired service, so pin it to the active ones.
      setServices((svcRes.services || []).filter(s => s.active !== false))
    }
    if (subRes) setSubscriptions(subRes.subscriptions || [])
    setServicesLoaded(true)
  }

  async function redeemService(svc) {
    setRedeeming(true)
    try {
      const result = await callApi('gc_redeem', { member_number: memberNumber, service_id: svc.id })
      if (onBalanceChange) onBalanceChange(result.balance)
      const rec = result.recurring
      if (rec) {
        showBanner(`Successfully redeemed ${svc.name}. This service renews automatically on ${fmtDate(rec.next_charge_date)} each ${intervalNoun(rec.billing_interval) || intervalNoun(svc.billing_interval)} — you can cancel anytime from this tab.`)
      } else {
        showBanner(`Successfully redeemed ${svc.name} for ${svc.credit_cost} ${creditWord(svc.credit_cost)}.`)
      }
      if (onRedeemed) onRedeemed()
      // Only a recurring redeem changes what this tab renders (the row flips to
      // Subscribed) — a one-time redeem leaves the catalogue untouched.
      if (rec) loadServices()
    } catch (err) { showBanner('Error: ' + err.message) }
    setRedeeming(false)
    setConfirmService(null)
  }

  async function cancelSubscription(sub, svc) {
    setCancelling(true)
    try {
      await callApi('gc_cancel_subscription', { member_number: memberNumber, subscription_id: sub.id })
      showBanner(`${svc?.name || sub.gc_services?.name || 'Recurring service'} cancelled. No further credits will be deducted.`)
      if (onRedeemed) onRedeemed()
      await loadServices()
    } catch (err) { showBanner('Error: ' + err.message) }
    setCancelling(false)
    setCancelTarget(null)
  }

  function toggleDetails(id) { setOpenDetails(p => ({ ...p, [id]: !p[id] })) }

  const categories = []
  const catMap = {}
  services.forEach(svc => {
    const cat = svc.category || 'Other Services'
    if (!catMap[cat]) { catMap[cat] = []; categories.push(cat) }
    catMap[cat].push(svc)
  })
  categories.sort((a, b) => a === 'Other Services' ? 1 : b === 'Other Services' ? -1 : 0)

  // Only a live subscription replaces the Redeem button; the API returns newest
  // first, so the first live row per service wins.
  const liveSubByService = {}
  ;(subscriptions || []).forEach(s => {
    if (s.status !== 'active' && s.status !== 'on_hold') return
    if (!liveSubByService[s.service_id]) liveSubByService[s.service_id] = s
  })

  if (!active) return null

  const pillBase = { padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }
  const cancelBtnStyle = { padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: '#d93025', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }

  return (
    <>
      {banner && <div style={banner.startsWith('Error') ? errorBannerStyle : bannerStyle}>{banner}</div>}
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
          {catMap[cat].map(svc => {
            const sub = liveSubByService[svc.id]
            const noun = intervalNoun(svc.billing_interval)
            return (
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
                    <span style={{ color: 'var(--vfo-muted)', fontSize: '11px' }}>{noun ? `credits / ${noun}` : 'credits'}</span>
                    {sub ? (
                      <>
                        {sub.status === 'active' ? (
                          <span style={{ ...pillBase, background: 'rgba(27,146,84,0.15)', color: '#1b9254' }}>Subscribed — renews {fmtDate(sub.next_charge_date)}</span>
                        ) : (
                          <span style={{ ...pillBase, background: 'rgba(176,141,38,0.15)', color: '#b08d26' }}>On hold — add credits to resume</span>
                        )}
                        <button onClick={() => setCancelTarget({ sub, svc })} style={cancelBtnStyle}>Cancel</button>
                      </>
                    ) : balance !== null && balance < svc.credit_cost ? (
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
            )
          })}
        </div>
      ))}

      {confirmService && (
        <div onClick={() => { if (!redeeming) setConfirmService(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(9,14,26,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: '0 18px 50px rgba(9,14,26,0.35)', padding: '26px 28px', maxWidth: '420px', width: '100%', textAlign: 'left' }}>
            {balance !== null && balance < confirmService.credit_cost ? (
              <>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '10px' }}>Not enough credits</div>
                <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  <strong>{confirmService.name}</strong> requires <strong>{confirmService.credit_cost} {creditWord(confirmService.credit_cost)}</strong> and {adminMode ? 'this member' : 'you'} currently {adminMode ? 'has' : 'have'} <strong>{balance}</strong>.
                </p>
                <p style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', margin: '0 0 18px' }}>
                  {adminMode
                    ? 'Add credits from the Dashboard tab first.'
                    : `You need ${confirmService.credit_cost - balance} more ${creditWord(confirmService.credit_cost - balance)} to redeem this service.`}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button onClick={() => setConfirmService(null)}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: 'pointer' }}>Close</button>
                  {!adminMode && (
                    <button onClick={() => { setConfirmService(null); if (onBuyCredits) onBuyCredits() }}
                      style={{ padding: '8px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Buy credits</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '10px' }}>Redeem service</div>
                <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  Redeem <strong>{confirmService.name}</strong> {adminMode ? 'for this member ' : ''}for <strong>{confirmService.credit_cost} {creditWord(confirmService.credit_cost)}</strong>
                  {isRecurring(confirmService)
                    ? <> now, and <strong>{confirmService.credit_cost} {creditWord(confirmService.credit_cost)}</strong> automatically every {intervalNoun(confirmService.billing_interval)} until {adminMode ? 'it is cancelled' : 'you cancel'}?</>
                    : '?'}
                </p>
                {balance !== null && (
                  <p style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', margin: '0 0 18px' }}>
                    Balance after: {balance - confirmService.credit_cost} {creditWord(balance - confirmService.credit_cost)}
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

      {cancelTarget && (
        <div onClick={() => { if (!cancelling) setCancelTarget(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(9,14,26,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: '0 18px 50px rgba(9,14,26,0.35)', padding: '26px 28px', maxWidth: '420px', width: '100%', textAlign: 'left' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vfo-heading)', marginBottom: '10px' }}>Cancel recurring service</div>
            <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Stop the recurring service <strong>{cancelTarget.svc?.name || cancelTarget.sub.gc_services?.name}</strong>? No further credits will be deducted. Credits already spent for the current period are not refunded.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setCancelTarget(null)} disabled={cancelling}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: cancelling ? 'default' : 'pointer', opacity: cancelling ? 0.6 : 1 }}>Keep it</button>
              <button onClick={() => cancelSubscription(cancelTarget.sub, cancelTarget.svc)} disabled={cancelling}
                style={{ padding: '8px 22px', borderRadius: '8px', border: 'none', background: '#d93025', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: cancelling ? 'default' : 'pointer', opacity: cancelling ? 0.7 : 1 }}>
                {cancelling ? 'Cancelling…' : 'Stop service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
