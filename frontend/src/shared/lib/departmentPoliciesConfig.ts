import {
  DEFAULT_DEPARTMENT_POLICIES,
  DEFAULT_PIPELINE_POLICIES,
  DEFAULT_COLUMN_POLICIES,
  type DepartmentPolicies,
  type PipelinePolicies,
  type ColumnPolicies,
} from '../types/departmentPoliciesConfig'

export function mergeDepartmentPolicies(
  raw?: Partial<DepartmentPolicies> | null,
): DepartmentPolicies {
  if (!raw) return { ...DEFAULT_DEPARTMENT_POLICIES }
  return {
    taskRules: {
      ...DEFAULT_DEPARTMENT_POLICIES.taskRules,
      ...raw.taskRules,
    },
    notifications: {
      ...DEFAULT_DEPARTMENT_POLICIES.notifications,
      ...raw.notifications,
    },
  }
}

export function mergePipelinePolicies(raw?: Partial<PipelinePolicies> | null): PipelinePolicies {
  if (!raw) return { ...DEFAULT_PIPELINE_POLICIES }
  return {
    completedColumnId: raw.completedColumnId ?? null,
    memberCanSeeAllTasks: raw.memberCanSeeAllTasks ?? null,
    memberCanCreateTasks: raw.memberCanCreateTasks ?? null,
    notifications: {
      ...DEFAULT_PIPELINE_POLICIES.notifications,
      ...raw.notifications,
    },
  }
}

export function mergeColumnPolicies(raw?: Partial<ColumnPolicies> | null): ColumnPolicies {
  if (!raw) return { ...DEFAULT_COLUMN_POLICIES }
  return {
    ...DEFAULT_COLUMN_POLICIES,
    ...raw,
  }
}

export function allDeptNotificationsEnabled(notifications: DepartmentPolicies['notifications']): boolean {
  return (
    notifications.deptAdminOnTaskCreated &&
    notifications.deptAdminOnTaskCompleted &&
    notifications.deptAdminOnTaskMoved &&
    notifications.deptAdminOnAssigneesChanged
  )
}
