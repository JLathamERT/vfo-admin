// Strategic-partner revenue-split rules, keyed by the strategic member group
// (the "company": member_type / strategic_member_groups.name).
//
// When a strategic member takes a client through Holistic Planning (MAP 1 or
// Tax Priorities) or Tax Planning, the gross fee is split three ways instead of
// two: a Strategic Partner Share payable to the company, plus the usual VFOS and
// member shares. The split boxes on the input forms auto-fill (read-only) from
// these fractions, and the Strategic Partners profile tab shows the blurbs.
//
// TO ADD A COMPANY: add one block below (fractions for holistic + tax, and a
// 1-2 sentence blurb each). The split logic lives here on purpose — new
// partners are rare and their maths differ, so we edit code per company.
// `holistic` covers MAP 1 + Tax Priorities (program_id 1); `tax` covers Tax
// Planning (program_id 4). Fractions are of the GROSS and must sum to 1.

export const STRATEGIC_SPLITS = {
  'Action Coach': {
    holistic: { strategic: 0.10, vfos: 0.45, member: 0.45 },
    tax: { strategic: 0.10, vfos: 0.60, member: 0.30 },
    blurbs: {
      holistic: 'Holistic — Action Coach takes a 10% Strategic Partner Share off the gross; the remaining 90% is split 50/50, giving 45% to the member and 45% to VFOS.',
      tax: 'Tax Planning — Action Coach takes a 10% Strategic Partner Share off the gross; the remaining 90% is split two-thirds / one-third, giving 60% to VFOS and 30% to the member.',
    },
  },
  'Tax Plan IQ': {
    holistic: { strategic: 0.10, vfos: 0.40, member: 0.50 },
    tax: { strategic: 0.10, vfos: 0.40, member: 0.50 },
    blurbs: {
      holistic: 'Holistic — the member gets 50% of gross, VFOS gets 40%, and Tax Plan IQ takes a 10% Strategic Partner Share.',
      tax: 'Tax Planning — same split as holistic: member 50%, VFOS 40%, Tax Plan IQ 10% Strategic Partner Share.',
    },
  },
}

// Names of the groups we have split logic for. A strategic member whose
// member_type is not in here gets NO third box (falls back to the manual flow).
export const STRATEGIC_GROUP_NAMES = Object.keys(STRATEGIC_SPLITS)

export function hasStrategicSplit(groupName) {
  return !!STRATEGIC_SPLITS[groupName]
}

// Returns the {strategic, vfos, member} fractions for a group + program type
// ('holistic' | 'tax'), or null if the group has no configured logic.
export function getStrategicSplit(groupName, programType) {
  const g = STRATEGIC_SPLITS[groupName]
  if (!g) return null
  return programType === 'tax' ? g.tax : g.holistic
}

// Computes the three dollar amounts off a gross total. The member share absorbs
// the rounding remainder so strategic + vfos + member === gross exactly.
// Returns { strategic, vfos, member } as numbers, or null if not applicable.
export function computeStrategicShares(groupName, programType, grossTotal) {
  const split = getStrategicSplit(groupName, programType)
  const gross = parseFloat(String(grossTotal ?? '').replace(/[,$]/g, '')) || 0
  if (!split || gross <= 0) return null
  const strategic = +(gross * split.strategic).toFixed(2)
  const vfos = +(gross * split.vfos).toFixed(2)
  const member = +(gross - strategic - vfos).toFixed(2)
  return { strategic, vfos, member }
}
