import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import { ForbiddenError, NotFoundError } from '../infra/libs/errors.js'
import type { IDepartmentRepository } from '../entities/department/index.js'
import type { OrganizationAccessService } from './organization-access.service.js'
import {
  mergeDepartmentPermissions,
  type DepartmentPermissionKey,
  type DepartmentPermissions,
} from '../entities/department/department.permissions.js'

/**
 * Проверка прав на управление отделом.
 *
 * Владелец/админ организации обходят ограничения раздела.
 * Администратор отдела — права по флагам в `departments.permissions` (настраивает владелец org).
 */
@injectable()
export class DepartmentAccessService {
  constructor(
    @inject(TYPES.DepartmentRepository) private departmentRepo: IDepartmentRepository,
    @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService,
  ) {}

  async getPermissions(departmentId: number): Promise<DepartmentPermissions> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    if (!department) throw new NotFoundError('Раздел не найден')
    return mergeDepartmentPermissions(department.permissions)
  }

  async canManageOrganizationForDepartment(departmentId: number, userId: number): Promise<boolean> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    if (!department) return false
    return this.orgAccessService.canManageOrganization(department.organizationId, userId)
  }

  private async isDepartmentAdmin(departmentId: number, userId: number): Promise<boolean> {
    const role = await this.departmentRepo.getUserRoleInDepartment(departmentId, userId)
    return role === 'admin'
  }

  private async isDepartmentMember(departmentId: number, userId: number): Promise<boolean> {
    return this.departmentRepo.isUserInDepartment(departmentId, userId)
  }

  async hasDepartmentPermission(
    departmentId: number,
    userId: number,
    key: DepartmentPermissionKey,
  ): Promise<boolean> {
    if (await this.canManageOrganizationForDepartment(departmentId, userId)) return true

    const permissions = await this.getPermissions(departmentId)
    const isAdmin = await this.isDepartmentAdmin(departmentId, userId)
    const isMember = await this.isDepartmentMember(departmentId, userId)

    switch (key) {
      case 'deptAdminCanManageMembers':
        return isAdmin && permissions.deptAdminCanManageMembers
      case 'deptAdminCanManagePipelines':
        return isAdmin && permissions.deptAdminCanManagePipelines
      case 'deptAdminCanManageColumns':
        return isAdmin && permissions.deptAdminCanManageColumns
      case 'deptAdminCanManageTags':
        return isAdmin && permissions.deptAdminCanManageTags
      case 'deptAdminCanRenameDepartment':
        return isAdmin && permissions.deptAdminCanRenameDepartment
      case 'memberCanSeeAllTasks':
        return isAdmin || (isMember && permissions.memberCanSeeAllTasks)
      case 'memberCanCreateTasks':
        return isAdmin || (isMember && permissions.memberCanCreateTasks)
      default:
        return false
    }
  }

  async ensureDepartmentPermission(
    departmentId: number,
    userId: number,
    key: DepartmentPermissionKey,
    message?: string,
  ): Promise<void> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    if (!department) throw new NotFoundError('Раздел не найден')
    if (await this.hasDepartmentPermission(departmentId, userId, key)) return
    throw new ForbiddenError(message ?? 'Недостаточно прав для этого действия в разделе')
  }

  /** Любое структурное управление разделом (для обратной совместимости). */
  async canManageDepartment(departmentId: number, userId: number): Promise<boolean> {
    if (await this.canManageOrganizationForDepartment(departmentId, userId)) return true
    const permissions = await this.getPermissions(departmentId)
    if (!(await this.isDepartmentAdmin(departmentId, userId))) return false
    return (
      permissions.deptAdminCanManageMembers ||
      permissions.deptAdminCanManagePipelines ||
      permissions.deptAdminCanManageColumns ||
      permissions.deptAdminCanManageTags ||
      permissions.deptAdminCanRenameDepartment
    )
  }

  async ensureCanManageDepartment(departmentId: number, userId: number): Promise<void> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    if (!department) throw new NotFoundError('Раздел не найден')
    if (await this.canManageDepartment(departmentId, userId)) return
    throw new ForbiddenError(
      'Управлять отделом может только владелец/админ организации либо администратор этого отдела (с разрешёнными правами)',
    )
  }

  async ensureCanAssignDepartmentAdmin(organizationId: number, userId: number): Promise<void> {
    await this.orgAccessService.ensureCanManageOrganization(organizationId, userId)
  }
}
