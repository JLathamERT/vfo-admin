// Recognises the two member-driven "90 Day Plan" tracker steps: Partnership Fast
// Track "Add Minimum of 2 Accountants to Tracker" and VFO Holistic Planning "Add
// Minimum 5 Clients to Client Target List". Both the member and admin tracks use
// this to swap the normal status row for the tracker form / read-only chip.
//
// status_options is the durable signal ('tracker_accountants' / 'tracker_clients'),
// set at the deploy-time DB swap. Before that swap lands the rows still carry their
// old status_options, so an exact task.name fallback keeps recognition working —
// same belt-and-suspenders pattern as the tax_planner_select step.

const ACCOUNTANT_STEP = {
  kind: 'accountant',
  threshold: 2,
  noun: 'Accountant',
  nounPlural: 'Accountants',
}
const CLIENT_STEP = {
  kind: 'client',
  threshold: 5,
  noun: 'Client',
  nounPlural: 'Clients',
}

const NAME_ACCOUNTANT = 'Add Minimum of 2 Accountants to Tracker'
const NAME_CLIENT = 'Add Minimum 5 Clients to Client Target List'

export function isTrackerTask(task) {
  if (!task) return null
  if (task.status_options === 'tracker_accountants') return ACCOUNTANT_STEP
  if (task.status_options === 'tracker_clients') return CLIENT_STEP
  if (task.name === NAME_ACCOUNTANT) return ACCOUNTANT_STEP
  if (task.name === NAME_CLIENT) return CLIENT_STEP
  return null
}
