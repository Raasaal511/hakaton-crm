export type DepartmentPermissions = {
  deptAdminCanManageMembers: boolean
  deptAdminCanManagePipelines: boolean
  deptAdminCanManageColumns: boolean
  deptAdminCanManageTags: boolean
  deptAdminCanRenameDepartment: boolean
  memberCanSeeAllTasks: boolean
  memberCanCreateTasks: boolean
}

export const DEFAULT_DEPARTMENT_PERMISSIONS: DepartmentPermissions = {
  deptAdminCanManageMembers: true,
  deptAdminCanManagePipelines: true,
  deptAdminCanManageColumns: true,
  deptAdminCanManageTags: true,
  deptAdminCanRenameDepartment: true,
  memberCanSeeAllTasks: false,
  memberCanCreateTasks: true,
}

export type DepartmentPermissionKey = keyof DepartmentPermissions
