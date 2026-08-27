export const CORPORATE_TYPES = ['Corporate Member', 'Free Corporate Member', 'Free Corporate Member (Legacy)']

// Admin roster rows carry the number as `plugin_member_number`; the member-portal
// load_data blob aliases the same value to `member_number`.
const numberOf = (m) => String(m?.plugin_member_number || m?.member_number || '').trim()

export function isCorporateMember(member) {
  return CORPORATE_TYPES.includes(member?.member_type)
}

// A corporate member's lead is carried by the member-number PREFIX
// (58147-C1 / -FC1 / -FCL1 all belong to 58147). `connected_member_number` says
// the same thing but the member_connections migration left it set on only a
// handful of rows, so it is preferred when present and the prefix is the
// fallback that resolves for every corporate member.
export function leadMemberNumberOf(member) {
  if (!isCorporateMember(member)) return null
  const connected = String(member?.connected_member_number || '').trim()
  if (connected) return connected
  const num = numberOf(member)
  const dash = num.indexOf('-')
  return dash > 0 ? num.slice(0, dash) : null
}

export function findLeadMember(roster, member) {
  const lead = leadMemberNumberOf(member)
  if (!lead || !Array.isArray(roster)) return null
  return roster.find(m => numberOf(m) === lead) || null
}
