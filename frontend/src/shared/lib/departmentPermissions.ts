import {
  DEFAULT_DEPARTMENT_PERMISSIONS,
  type DepartmentPermissionKey,
  type DepartmentPermissions,
} from '../types/departmentPermissions'

type MemberWithRole = { id: number; role?: string }
type DepartmentMemberWithRole = { id: number; role?: 'member' | 'admin' }

export function mergeDepartmentPermissions(
  raw: Partial<DepartmentPermissions> | null | undefined,
): DepartmentPermissions {
  const merged = { ...DEFAULT_DEPARTMENT_PERMISSIONS }
  if (!raw) return merged
  for (const key of Object.keys(DEFAULT_DEPARTMENT_PERMISSIONS) as DepartmentPermissionKey[]) {
    if (typeof raw[key] === 'boolean') {
      merged[key] = raw[key]
    }
  }
  return merged
}

export type DepartmentCapabilities = {
  canManageDepartment: boolean
  /** Правила задач и push-уведомления админам отдела */
  canManageDepartmentPolicies: boolean
  canAssignDepartmentAdmin: boolean
  canManageMembers: boolean
  canManagePipelines: boolean
  canManageColumns: boolean
  canManageTags: boolean
  canRenameDepartment: boolean
  canSeeAllTasks: boolean
  canCreateTasks: boolean
}

export function resolveDepartmentCapabilities(
  orgMembers: MemberWithRole[],
  departmentMembers: DepartmentMemberWithRole[],
  currentUserId: number | null | undefined,
  permissionsInput?: Partial<DepartmentPermissions> | null,
): DepartmentCapabilities {
  const permissions = mergeDepartmentPermissions(permissionsInput)
  const currentOrg = currentUserId != null ? orgMembers.find((m) => m.id === currentUserId) : undefined
  const isOrgManager = currentOrg?.role === 'owner' || currentOrg?.role === 'admin'
  const currentInDept =
    currentUserId != null ? departmentMembers.find((m) => m.id === currentUserId) : undefined
  const isDepartmentAdmin = currentInDept?.role === 'admin'
  const isDepartmentMember = currentInDept != null

  const canManageMembers =
    isOrgManager || (isDepartmentAdmin && permissions.deptAdminCanManageMembers)
  const canManagePipelines =
    isOrgManager || (isDepartmentAdmin && permissions.deptAdminCanManagePipelines)
  const canManageColumns =
    isOrgManager || (isDepartmentAdmin && permissions.deptAdminCanManageColumns)
  const canManageTags = isOrgManager || (isDepartmentAdmin && permissions.deptAdminCanManageTags)
  const canRenameDepartment =
    isOrgManager || (isDepartmentAdmin && permissions.deptAdminCanRenameDepartment)
  const canSeeAllTasks =
    isOrgManager || isDepartmentAdmin || (isDepartmentMember && permissions.memberCanSeeAllTasks)
  const canCreateTasks =
    isOrgManager || isDepartmentAdmin || (isDepartmentMember && permissions.memberCanCreateTasks)

  const canManageDepartment =
    isOrgManager ||
    (isDepartmentAdmin &&
      (permissions.deptAdminCanManageMembers ||
        permissions.deptAdminCanManagePipelines ||
        permissions.deptAdminCanManageColumns ||
        permissions.deptAdminCanManageTags ||
        permissions.deptAdminCanRenameDepartment))

  const canManageDepartmentPolicies = isOrgManager || isDepartmentAdmin

  return {
    canManageDepartment,
    canManageDepartmentPolicies,
    /** Назначать админов отдела — только владелец/админ организации */
    canAssignDepartmentAdmin: isOrgManager,
    canManageMembers,
    canManagePipelines,
    canManageColumns,
    canManageTags,
    canRenameDepartment,
    canSeeAllTasks,
    canCreateTasks,
  }
}
