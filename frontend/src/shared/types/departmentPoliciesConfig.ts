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

export type ColumnPolicies = {
  requireResponsibleOnEnter: boolean
  requireDeadLineOnEnter: boolean
  wipLimit: number | null
  isCompletedColumn: boolean
}

export const DEFAULT_COLUMN_POLICIES: ColumnPolicies = {
  requireResponsibleOnEnter: false,
  requireDeadLineOnEnter: false,
  wipLimit: null,
  isCompletedColumn: false,
}
