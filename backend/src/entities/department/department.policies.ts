export type DepartmentTaskRules = {
  requireResponsible: boolean
  requireDeadLine: boolean
}

export type DepartmentNotificationPolicies = {
  deptAdminOnTaskCreated: boolean
  deptAdminOnTaskCompleted: boolean
  deptAdminOnTaskMoved: boolean
  deptAdminOnAssigneesChanged: boolean
}

export type DepartmentPolicies = {
  taskRules: DepartmentTaskRules
  notifications: DepartmentNotificationPolicies
}

export const DEFAULT_DEPARTMENT_POLICIES: DepartmentPolicies = {
  taskRules: {
    requireResponsible: false,
    requireDeadLine: false,
  },
  notifications: {
    deptAdminOnTaskCreated: true,
    deptAdminOnTaskCompleted: true,
    deptAdminOnTaskMoved: true,
    deptAdminOnAssigneesChanged: true,
  },
}

export type DepartmentTaskRulesKey = keyof DepartmentTaskRules
export type DepartmentNotificationKey = keyof DepartmentNotificationPolicies

const TASK_RULE_KEYS = Object.keys(DEFAULT_DEPARTMENT_POLICIES.taskRules) as DepartmentTaskRulesKey[]
const NOTIFICATION_KEYS = Object.keys(
  DEFAULT_DEPARTMENT_POLICIES.notifications,
) as DepartmentNotificationKey[]

export function mergeDepartmentPolicies(
  raw: Partial<DepartmentPolicies> | null | undefined,
): DepartmentPolicies {
  const merged: DepartmentPolicies = {
    taskRules: { ...DEFAULT_DEPARTMENT_POLICIES.taskRules },
    notifications: { ...DEFAULT_DEPARTMENT_POLICIES.notifications },
  }
  if (!raw || typeof raw !== 'object') return merged
  if (raw.taskRules && typeof raw.taskRules === 'object') {
    for (const key of TASK_RULE_KEYS) {
      if (typeof raw.taskRules[key] === 'boolean') {
        merged.taskRules[key] = raw.taskRules[key]
      }
    }
  }
  if (raw.notifications && typeof raw.notifications === 'object') {
    for (const key of NOTIFICATION_KEYS) {
      if (typeof raw.notifications[key] === 'boolean') {
        merged.notifications[key] = raw.notifications[key]
      }
    }
  }
  return merged
}

export function parseDepartmentPoliciesPayload(body: unknown): Partial<DepartmentPolicies> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const nested =
    src.policies != null && typeof src.policies === 'object'
      ? (src.policies as Record<string, unknown>)
      : src
  const out: Partial<DepartmentPolicies> = {}
  const taskRules: Partial<DepartmentTaskRules> = {}
  const notifications: Partial<DepartmentNotificationPolicies> = {}
  const tr =
    nested.taskRules != null && typeof nested.taskRules === 'object'
      ? (nested.taskRules as Record<string, unknown>)
      : nested
  for (const key of TASK_RULE_KEYS) {
    if (typeof tr[key] === 'boolean') taskRules[key] = tr[key]
  }
  const nt =
    nested.notifications != null && typeof nested.notifications === 'object'
      ? (nested.notifications as Record<string, unknown>)
      : nested
  for (const key of NOTIFICATION_KEYS) {
    if (typeof nt[key] === 'boolean') notifications[key] = nt[key]
  }
  if (Object.keys(taskRules).length > 0) out.taskRules = taskRules as DepartmentTaskRules
  if (Object.keys(notifications).length > 0) {
    out.notifications = notifications as DepartmentNotificationPolicies
  }
  return Object.keys(out).length > 0 ? out : null
}
