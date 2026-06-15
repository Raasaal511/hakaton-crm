import type { DepartmentNotificationPolicies } from '../department/department.policies.js'

export type PipelineNotificationOverrides = {
  deptAdminOnTaskCreated: boolean | null
  deptAdminOnTaskCompleted: boolean | null
  deptAdminOnTaskMoved: boolean | null
  deptAdminOnAssigneesChanged: boolean | null
}

export type PipelinePolicies = {
  completedColumnId: number | null
  memberCanSeeAllTasks: boolean | null
  memberCanCreateTasks: boolean | null
  notifications: PipelineNotificationOverrides
}

export const DEFAULT_PIPELINE_POLICIES: PipelinePolicies = {
  completedColumnId: null,
  memberCanSeeAllTasks: null,
  memberCanCreateTasks: null,
  notifications: {
    deptAdminOnTaskCreated: null,
    deptAdminOnTaskCompleted: null,
    deptAdminOnTaskMoved: null,
    deptAdminOnAssigneesChanged: null,
  },
}

export type PipelineNotificationKey = keyof PipelineNotificationOverrides

const NOTIFICATION_KEYS = Object.keys(
  DEFAULT_PIPELINE_POLICIES.notifications,
) as PipelineNotificationKey[]

export function mergePipelinePolicies(
  raw: Partial<PipelinePolicies> | null | undefined,
): PipelinePolicies {
  const merged: PipelinePolicies = {
    completedColumnId: null,
    memberCanSeeAllTasks: null,
    memberCanCreateTasks: null,
    notifications: { ...DEFAULT_PIPELINE_POLICIES.notifications },
  }
  if (!raw || typeof raw !== 'object') return merged
  if (raw.completedColumnId === null || (typeof raw.completedColumnId === 'number' && raw.completedColumnId > 0)) {
    merged.completedColumnId = raw.completedColumnId ?? null
  }
  if (raw.memberCanSeeAllTasks === null || typeof raw.memberCanSeeAllTasks === 'boolean') {
    merged.memberCanSeeAllTasks = raw.memberCanSeeAllTasks ?? null
  }
  if (raw.memberCanCreateTasks === null || typeof raw.memberCanCreateTasks === 'boolean') {
    merged.memberCanCreateTasks = raw.memberCanCreateTasks ?? null
  }
  if (raw.notifications && typeof raw.notifications === 'object') {
    for (const key of NOTIFICATION_KEYS) {
      const v = raw.notifications[key]
      if (v === null || typeof v === 'boolean') {
        merged.notifications[key] = v
      }
    }
  }
  return merged
}

export function parsePipelinePoliciesPayload(body: unknown): Partial<PipelinePolicies> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const nested =
    src.policies != null && typeof src.policies === 'object'
      ? (src.policies as Record<string, unknown>)
      : src
  const out: Partial<PipelinePolicies> = {}
  if (nested.completedColumnId === null) {
    out.completedColumnId = null
  } else if (typeof nested.completedColumnId === 'number' && nested.completedColumnId > 0) {
    out.completedColumnId = nested.completedColumnId
  }
  if (nested.memberCanSeeAllTasks === null || typeof nested.memberCanSeeAllTasks === 'boolean') {
    out.memberCanSeeAllTasks = nested.memberCanSeeAllTasks as boolean | null
  }
  if (nested.memberCanCreateTasks === null || typeof nested.memberCanCreateTasks === 'boolean') {
    out.memberCanCreateTasks = nested.memberCanCreateTasks as boolean | null
  }
  const notifications: Partial<PipelineNotificationOverrides> = {}
  const nt =
    nested.notifications != null && typeof nested.notifications === 'object'
      ? (nested.notifications as Record<string, unknown>)
      : {}
  for (const key of NOTIFICATION_KEYS) {
    const v = nt[key]
    if (v === null || typeof v === 'boolean') notifications[key] = v
  }
  if (Object.keys(notifications).length > 0) out.notifications = notifications as PipelineNotificationOverrides
  return Object.keys(out).length > 0 ? out : null
}

export type DeptAdminNotificationEvent = keyof DepartmentNotificationPolicies

export function resolvePipelineNotification(
  dept: DepartmentNotificationPolicies,
  pipeline: PipelineNotificationOverrides,
  event: DeptAdminNotificationEvent,
): boolean {
  const override = pipeline[event]
  if (override !== null && override !== undefined) return override
  return dept[event]
}
