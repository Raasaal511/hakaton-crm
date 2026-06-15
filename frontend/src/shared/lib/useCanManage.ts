import type { DepartmentPermissions } from '../types/departmentPermissions'
import { resolveDepartmentCapabilities } from './departmentPermissions'

type MemberWithRole = { id: number; role?: string }

export function useCanManage(
  members: MemberWithRole[],
  currentUserId?: number | null,
): { canManage: boolean; isOwner: boolean } {
  const currentMember = members.find((m) => m.id === currentUserId)
  return {
    canManage: currentMember?.role === 'owner' || currentMember?.role === 'admin' || false,
    isOwner: currentMember?.role === 'owner' || false,
  }
}

/**
 * Полная аналитика организации (`/organizations/:id/analytics`):
 * системный root — любая организация, включая личную;
 * остальные — только неличные пространства, где пользователь owner/admin.
 */
export function canViewOrganizationFullAnalytics(
  organizationIsPersonal: boolean | undefined,
  canManageInOrganization: boolean,
  systemRole?: 'user' | 'root' | null,
): boolean {
  if (systemRole === 'root') return true
  const personal = organizationIsPersonal === true
  return canManageInOrganization && !personal
}

/** Участник отдела с ролью (member | admin) */
type DepartmentMemberWithRole = { id: number; role?: 'member' | 'admin' }

/**
 * Эффективные права в разделе с учётом `department.permissions` и ролей.
 */
export function useCanManageDepartment(
  orgMembers: MemberWithRole[],
  departmentMembers: DepartmentMemberWithRole[],
  currentUserId?: number | null,
  permissions?: Partial<DepartmentPermissions> | null,
) {
  return resolveDepartmentCapabilities(
    orgMembers,
    departmentMembers,
    currentUserId,
    permissions,
  )
}
