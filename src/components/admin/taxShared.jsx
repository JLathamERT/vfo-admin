// Shared helper for the Accounting > VFO Services > Tax Planning views. Flattens
// enriched client_tax_plans rows into per-payment CLEARED entries (retainer +
// implementation), each split into member, tax planner and VFOS revenue. Covers both
// program_id=1 (Tax Priorities) and program_id=4 (Tax Planning).
//
// Each emitted row also carries the payout state of its member / planner / strategic leg
// (memberState, plannerState, strategicState) plus a paymentNote for a payment still in
// flight. VFOS has no payout leg of its own, but a payment that is still clearing has not
// landed as VFOS income either, so the row carries a vfosState for that case. The dollars
// are unchanged — the panels use those states purely to mark which slices have not
// actually left the VFO balance yet.
import { parseNum } from './holisticShared'
import { legState, isTerminalLeg, paymentNoteFor } from './shareLegState'

const PAID = new Set(['succeeded', 'processing', 'check_pending'])

function programLabel(pid) { return Number(pid) === 4 ? 'Tax Planning' : 'Tax Priorities' }

// The VFOS slice has no leg to pay out, but a payment still in flight has not become VFOS
// income yet either — same in-flight statuses that give the payment its own note.
function vfosStateFor(status) {
  return paymentNoteFor(status) ? { note: 'payment clearing', tone: 'pending' } : null
}

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
    const ret = parseNum(r.retainer_amount)
    const imp = parseNum(r.implementation_amount)
    // tax_planner_share: stored as DOLLARS OF THE TOTAL engagement, prorated per payment
    // (share / total * payment) exactly as PricingSplitCard does. Comes out of the VFOS
    // slice, which until now absorbed it. retainerIsHistoric mirrors that card's rule: a
    // migrated plan whose retainer was SETTLED on the old two-way system carries a stored
    // split describing the implementation only, so its retainer pays the planner nothing.
    const plannerRaw = parseNum(r.tax_planner_share)
    const total = parseNum(r.total_fee) > 0 ? parseNum(r.total_fee) : ret + imp
    const plannerPortion = (amt) => (total > 0 && plannerRaw > 0 ? Math.min(Math.max((plannerRaw / total) * amt, 0), amt) : 0)
    const retainerIsHistoric = !!r.legacy_source && r.retainer_rev_paid === 'N/A — No Share Due'
    const base = {
      clientName: r.client_name || `Client #${r.client_id}`,
      clientId: r.client_id,
      memberNumber: r.member_number || null,
      memberName: r.member_name || '',
      decision: r.member_revenue_decision || null,
      tier: label,
    }

    // A share is due but no planner is allocated: the payout engine stamps
    // "Awaiting Planner Allocation", but the sweep may not have run yet, so an
    // unallocated plan reads as awaiting-planner regardless of what the leg says.
    const plannerUnallocated = r.tax_planner_id == null
    const plannerStateFor = (slice, status, paymentStatus, context) => {
      if (!(slice > 0)) return null
      if (plannerUnallocated && !isTerminalLeg(status)) return { note: 'awaiting planner', tone: 'pending' }
      return legState(status, { paymentStatus, context })
    }

    if (PAID.has(r.retainer_status) && ret > 0) {
      const clearedAt = r.retainer_invoice_email_sent_at || r.retainer_date
      if (clearedAt) {
        const mp = memberPortion(memberRaw, ret)
        const sp = stratPer(ret)
        const pp = retainerIsHistoric ? 0 : plannerPortion(ret)
        out.push({
          id: `${r.id}-ret`, kind: 'Retainer', clearedAt, amount: ret, member: mp, strategic: sp, planner: pp,
          vfos: Math.max(ret - mp - sp - pp, 0), status: r.retainer_status,
          // The retainer's revenue share fires on the client's decision after the
          // review, not on the charge — hence its own context.
          memberState: legState(r.retainer_rev_paid, { revShare: r.retainer_rev_share, paymentStatus: r.retainer_status, context: 'tax_retainer' }),
          plannerState: plannerStateFor(pp, r.retainer_planner_paid, r.retainer_status, 'tax_retainer'),
          strategicState: sp > 0 ? legState(r.retainer_strat_paid, { paymentStatus: r.retainer_status }) : null,
          vfosState: vfosStateFor(r.retainer_status),
          paymentNote: paymentNoteFor(r.retainer_status),
          ...base,
        })
      }
    }

    if (PAID.has(r.implementation_charge_status) && imp > 0) {
      const clearedAt = r.implementation_charge_date || r.implementation_confirmation_email_sent_at
      if (clearedAt) {
        const mp = memberPortion(memberRaw, imp)
        const sp = stratPer(imp)
        const pp = plannerPortion(imp)
        out.push({
          id: `${r.id}-imp`, kind: 'Implementation', clearedAt, amount: imp, member: mp, strategic: sp, planner: pp,
          vfos: Math.max(imp - mp - sp - pp, 0), status: r.implementation_charge_status,
          memberState: legState(r.implementation_rev_paid, { revShare: r.implementation_rev_share, paymentStatus: r.implementation_charge_status }),
          plannerState: plannerStateFor(pp, r.implementation_planner_paid, r.implementation_charge_status),
          strategicState: sp > 0 ? legState(r.implementation_strat_paid, { paymentStatus: r.implementation_charge_status }) : null,
          vfosState: vfosStateFor(r.implementation_charge_status),
          paymentNote: paymentNoteFor(r.implementation_charge_status),
          ...base,
        })
      }
    }
  }
  return out
}
