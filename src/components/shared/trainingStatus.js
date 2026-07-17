// Shared semantics for training-track task statuses (`member_training_progress.status`,
// options defined per task in `program_training_tasks.status_options`).
//
// Used by both the admin track (components/admin/MSMTracking.jsx) and the member track
// (components/member/MemberMSMTracking.jsx) so the two never drift apart.
//
// NOTE: this covers the TRAINING track only (`program_training_tasks`). The client track
// (`program_client_tasks`) has its own unrelated status_options vocabulary ('auto',
// 'date_entry', ...) and deliberately does not use these helpers.

// Positive values are open-ended and differ per program — "Completed", "Have Watched",
// "3 to Call", "17 to Send", "Built - 45%", "Type 2 - Mixed 50%" all mean the step is done.
// So the rule is a denylist: a selection is positive unless it is explicitly one of the
// not-done values below. New "done"-style options therefore work without a code change;
// a new not-done option must be added here.
const NOT_DONE_STATUSES = new Set(['Outstanding', 'Will Watch', 'Pending', 'In Progress', 'Stopped'])

export const STATUS_STOPPED = 'Stopped'
export const STATUS_NOT_APPLICABLE = 'N/A'

// 'N/A' means the step does not apply to this member: it leaves the track entirely, so a
// 4-step phase becomes 3 rather than sitting permanently incomplete.
export const isExcludedStatus = (status) => status === STATUS_NOT_APPLICABLE

// A step counts toward progress only on a positive selection. 'Outstanding' and 'Stopped'
// are touched-but-not-done: they stay in the denominator and never green the step.
export const isPositiveStatus = (status) =>
  !!status && !isExcludedStatus(status) && !NOT_DONE_STATUSES.has(status)

// Any selection at all, positive or not — the "someone has been here" test that drives the
// in-progress (blue) phase state.
export const isTouchedStatus = (status) => !!status && !isExcludedStatus(status)

// Section headers are labels only. 'N/A' steps are excluded per the rule above.
export const countedTasks = (list, progress) =>
  (list || []).filter(t => t.task_type !== 'section' && !isExcludedStatus(progress?.[t.id]?.status))

export function phaseState(list, progress) {
  const tasks = countedTasks(list, progress)
  if (tasks.length === 0) return 'pending'
  if (tasks.every(t => isPositiveStatus(progress?.[t.id]?.status))) return 'done'
  if (tasks.some(t => isTouchedStatus(progress?.[t.id]?.status))) return 'active'
  return 'pending'
}

export const countedDone = (list, progress) =>
  countedTasks(list, progress).filter(t => isPositiveStatus(progress?.[t.id]?.status)).length

// A single 'Stopped' step stops the whole 90 Day Plan. Derived live from the tasks, so
// clearing that step's status revives the plan.
export const isTrackStopped = (phases, progress) =>
  (phases || []).some(ph =>
    (ph.program_training_tasks || []).some(t => progress?.[t.id]?.status === STATUS_STOPPED))

// The value shown after "90 Day Plan:" — 'Stopped', 'Not Started', 'Completed', or the
// name of the furthest phase with any touched task. Drives the admin header badge.
export function planStatusLabel(phases, progress) {
  if (isTrackStopped(phases, progress)) return 'Stopped'
  const allTasks = (phases || []).flatMap(p => countedTasks(p.program_training_tasks, progress))
  if (!allTasks.length) return 'Not Started'
  if (allTasks.every(t => isPositiveStatus(progress?.[t.id]?.status))) return 'Completed'
  for (let i = (phases || []).length - 1; i >= 0; i--) {
    const tasks = countedTasks(phases[i].program_training_tasks, progress)
    if (tasks.some(t => isTouchedStatus(progress?.[t.id]?.status))) return phases[i].name
  }
  return 'Not Started'
}
