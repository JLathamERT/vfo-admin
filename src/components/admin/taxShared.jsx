// Shared helper for the Accounting > VFO Services > Tax Planning views. Flattens
// enriched client_tax_plans rows into per-payment CLEARED entries (retainer +
// implementation), each split into member vs VFOS revenue. Covers both program_id=1
// (Tax Priorities) and program_id=4 (Tax Planning).
import { parseNum } from './holisticShared'

const PAID = new Set(['succeeded', 'processing', 'check_pending'])

function programLabel(pid) { return Number(pid) === 4 ? 'Tax Planning' : 'Tax Priorities' }

// member_share: flat $ (>100) splits in half across retainer+implementation; else % of
// that payment's amount.
function memberPortion(memberRaw, amount) {
  const mp = memberRaw > 100 ? memberRaw / 2 : (memberRaw / 100) * amount
  return Math.min(Math.max(mp, 0), amount)
}

export function clearedTaxPayments(rows) {
  const out = []
  for (const r of rows || []) {
    const memberRaw = parseNum(r.member_share)
    // Strategic Partner Share (strategic members): a flat $ split half on
    // retainer, half on implementation like the member share. Comes out of the
    // VFOS slice (for strategic rows the split is off the full total fee).
    const stratRaw = parseNum(r.strategic_partner_share)
    const stratPer = (amt) => Math.min(Math.max(stratRaw / 2, 0), amt)
    const label = programLabel(r.program_id)
    const base = {
      clientName: r.client_name || `Client #${r.client_id}`,
      clientId: r.client_id,
      memberNumber: r.member_number || null,
      memberName: r.member_name || '',
      decision: r.member_revenue_decision || null,
      tier: label,
    }

    const ret = parseNum(r.retainer_amount)
    if (PAID.has(r.retainer_status) && ret > 0) {
      const clearedAt = r.retainer_invoice_email_sent_at || r.retainer_date
      if (clearedAt) {
        const mp = memberPortion(memberRaw, ret)
        const sp = stratPer(ret)
        out.push({ id: `${r.id}-ret`, kind: 'Retainer', clearedAt, amount: ret, member: mp, strategic: sp, vfos: Math.max(ret - mp - sp, 0), status: r.retainer_status, ...base })
      }
    }

    const imp = parseNum(r.implementation_amount)
    if (PAID.has(r.implementation_charge_status) && imp > 0) {
      const clearedAt = r.implementation_charge_date || r.implementation_confirmation_email_sent_at
      if (clearedAt) {
        const mp = memberPortion(memberRaw, imp)
        const sp = stratPer(imp)
        out.push({ id: `${r.id}-imp`, kind: 'Implementation', clearedAt, amount: imp, member: mp, strategic: sp, vfos: Math.max(imp - mp - sp, 0), status: r.implementation_charge_status, ...base })
      }
    }
  }
  return out
}
