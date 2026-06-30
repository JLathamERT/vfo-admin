// Shared helpers for the Accounting > VFO Services > Holistic Planning views.
// Flattens enriched pipeline_map1 rows into per-installment CLEARED payments (money
// that actually hit the bank) with each payment split into member vs VFOS revenue.

const PAID = new Set(['succeeded', 'processing', 'check_pending'])

export function parseNum(v) {
  return parseFloat(String(v ?? '0').replace(/[,$]/g, '')) || 0
}

// One entry per cleared installment across all engagements. Each has the cleared date,
// the amount that came in, and the member/VFOS split of that amount.
export function clearedPayments(rows) {
  const out = []
  for (const r of rows || []) {
    const net = parseNum(r.net_invoice)
    const q = r.payment_plan === 'Quarterly'
    const n = q ? 4 : 1
    const amount = n ? net / n : net
    const memberRaw = parseNum(r.member_share)
    const memberPortion = (() => {
      let mp = memberRaw > 100 ? (q ? memberRaw / 4 : memberRaw) : (memberRaw / 100) * amount
      return Math.min(Math.max(mp, 0), amount)
    })()
    const tier = r.service_level || r.c15_service_level || ''
    for (let i = 1; i <= n; i++) {
      const status = r[`pay${i}_status`]
      if (!PAID.has(status)) continue
      const clearedAt = i === 1 ? (r.invoice_email_sent_at || r.pay1_date) : (r[`pay${i}_paid_at`] || r[`pay${i}_date`])
      if (!clearedAt) continue
      out.push({
        id: `${r.id}-${i}`,
        installment: i,
        plan: q ? 'Quarterly' : 'Pay in full',
        clearedAt,
        amount,
        member: memberPortion,
        vfos: amount - memberPortion,
        clientName: r.client_name || `Client #${r.client_id}`,
        memberNumber: r.member_number || null,
        memberName: r.member_name || '',
        decision: r.member_revenue_decision || null,
        tier,
        status,
      })
    }
  }
  return out
}

export function inPeriod(dateStr, year, month) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (d.getFullYear() !== year) return false
  if (month >= 0 && d.getMonth() !== month) return false
  return true
}
