import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../infra/libs/errors.js'
import { validatePositiveId } from '../infra/libs/validation.js'
import { mainPipelineColumnColor } from '../infra/libs/mainPipelineColumnColors.js'
import type { IAuthRepository } from '../entities/auth/index.js'
import type { IDepartmentRepository } from '../entities/department/index.js'
import type { IColumnsRepository } from '../entities/columnts/index.js'
import type { IPipelinesRepository } from '../entities/pipelines/index.js'
import type { OrganizationAccessService } from './organization-access.service.js'
import type { DepartmentAccessService } from './department-access.service.js'
import type { IOrganizationRepository } from '../entities/organization/index.js'
import type { AddUserToDepartmentDTO, CreateDepartmentDTO, UpdateDepartmentDTO, DepartmentRole } from '../entities/department/index.js'
import {
  mergeDepartmentPermissions,
  parseDepartmentPermissionsPayload,
  type DepartmentPermissions,
} from '../entities/department/department.permissions.js'
import {
  mergeDepartmentPolicies,
  parseDepartmentPoliciesPayload,
  type DepartmentPolicies,
} from '../entities/department/department.policies.js'
import type { Department } from '../infra/database/drizzle/schema.js'

type DepartmentMemberView = { id: number; email: string; firstname: string; lastname: string; role: 'member' | 'admin' }

@injectable()
export class DepartmentService {
  constructor(
    @inject(TYPES.DepartmentRepository) private departmentRepo: IDepartmentRepository,
    @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService,
    @inject(TYPES.DepartmentAccessService) private departmentAccessService: DepartmentAccessService,
    @inject(TYPES.AuthRepository) private authRepo: IAuthRepository,
    @inject(TYPES.ColumnRepository) private columnRepo: IColumnsRepository,
    @inject(TYPES.PipelinesRepository) private pipelinesRepo: IPipelinesRepository,
    @inject(TYPES.OrganizationRepository) private organizationRepo: IOrganizationRepository,
  ) {}

  private async ensureDepartmentExists(departmentId: number): Promise<Department> {
    const department = await this.departmentRepo.getDepartmentById(departmentId)
    if (!department) throw new NotFoundError('Раздел не найден')
    return department
  }

  private mapDepartmentForApi(
    department: Department,
  ): Department & { permissions: DepartmentPermissions; policies: DepartmentPolicies } {
    return {
      ...department,
      permissions: mergeDepartmentPermissions(department.permissions),
      policies: mergeDepartmentPolicies(department.policies),
    }
  }

  async getDepartmentPermissions(
    departmentId: number,
    currentUserId: number,
  ): Promise<DepartmentPermissions> {
    const department = await this.ensureDepartmentExists(departmentId)
    await this.orgAccessService.ensureCanManageOrganization(
      department.organizationId,
      currentUserId,
    )
    return mergeDepartmentPermissions(department.permissions)
  }

  async updateDepartmentPermissions(
    departmentId: number,
    currentUserId: number,
    body: unknown,
  ): Promise<DepartmentPermissions> {
    const department = await this.ensureDepartmentExists(departmentId)
    await this.orgAccessService.ensureCanManageOrganization(
      department.organizationId,
      currentUserId,
    )
    const patch = parseDepartmentPermissionsPayload(body)
    if (!patch) throw new BadRequestError('Укажите хотя бы одно поле permissions')
    const next = { ...mergeDepartmentPermissions(department.permissions), ...patch }
    await this.departmentRepo.updateDepartmentPermissions(departmentId, next)
    return next
  }

  /** Правила задач и уведомления админам отдела — владелец/админ org или админ раздела. */
  private async ensureCanManageDepartmentPolicies(
    departmentId: number,
    currentUserId: number,
    action: string,
  ): Promise<void> {
    const department = await this.ensureDepartmentExists(departmentId)
    if (await this.orgAccessService.canManageOrganization(department.organizationId, currentUserId)) {
      return
    }
    const role = await this.departmentRepo.getUserRoleInDepartment(departmentId, currentUserId)
    if (role === 'admin') return
    throw new ForbiddenError(
      `${action} могут владелец/админ организации или администратор этого раздела`,
    )
  }

  async getDepartmentPolicies(
    departmentId: number,
    currentUserId: number,
  ): Promise<DepartmentPolicies> {
    await this.getDepartmentById(departmentId, currentUserId)
    await this.ensureCanManageDepartmentPolicies(
      departmentId,
      currentUserId,
      'Просматривать правила задач и уведомления',
    )
    const department = await this.ensureDepartmentExists(departmentId)
    return mergeDepartmentPolicies(department.policies)
  }

  async updateDepartmentPolicies(
    departmentId: number,
    currentUserId: number,
    body: unknown,
  ): Promise<DepartmentPolicies> {
    await this.ensureCanManageDepartmentPolicies(
      departmentId,
      currentUserId,
      'Менять правила задач и уведомления',
    )
    const department = await this.ensureDepartmentExists(departmentId)
    const patch = parseDepartmentPoliciesPayload(body)
    if (!patch) throw new BadRequestError('Укажите хотя бы одно поле policies')
    const current = mergeDepartmentPolicies(department.policies)
    const next: DepartmentPolicies = {
      taskRules: { ...current.taskRules, ...patch.taskRules },
      notifications: { ...current.notifications, ...patch.notifications },
    }
    await this.departmentRepo.updateDepartmentPolicies(departmentId, next)
    return next
  }

  private mapMemberForCard(m: {
    id: number
    email: string
    firstname: string
    lastname: string
    role: DepartmentRole
  }): DepartmentMemberView {
    return {
      id: m.id,
      email: m.email,
      firstname: m.firstname,
      lastname: m.lastname,
      role: m.role as 'member' | 'admin',
    }
  }

  async getDepartmentsByOrganizationId(organizationId: number, currentUserId: number): Promise<Department[]> {
    await this.orgAccessService.ensureUserInOrganization(organizationId, currentUserId)
    const canManage = await this.orgAccessService.canManageOrganization(organizationId, currentUserId)
    const list = canManage
      ? await this.departmentRepo.getDepartmentsByOrganizationId(organizationId)
      : await this.departmentRepo.getDepartmentsByOrganizationIdForUser(organizationId, currentUserId)
    return list.map((d) => this.mapDepartmentForApi(d))
  }

  async getDepartmentById(departmentId: number, currentUserId: number): Promise<Department> {
    const department = await this.ensureDepartmentExists(departmentId)
    await this.orgAccessService.ensureUserInOrganization(department.organizationId, currentUserId)
    const canManage = await this.orgAccessService.canManageOrganization(department.organizationId, currentUserId)
    if (!canManage) {
      const isMember = await this.departmentRepo.isUserInDepartment(departmentId, currentUserId)
      if (!isMember) {
        throw new NotFoundError('Раздел не найден')
      }
    }
    return this.mapDepartmentForApi(department)
  }

  async createDepartment(organizationId: number, currentUserId: number, dto: CreateDepartmentDTO): Promise<Department> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название Раздела обязательно')

    await this.orgAccessService.ensureCanManageOrganization(organizationId, currentUserId)

    const department = await this.departmentRepo.createDepartment({ name, organizationId })

    const mainPipeline = await this.pipelinesRepo.createPipeline({
      name: 'Основная воронка',
      departmentId: department.id,
      isMainTemplate: true,
    })

    const mainColumnDefs: Array<{ name: string; position: number }> = [
      { name: 'Задачи', position: 0 },
      { name: 'В работе', position: 1 },
      { name: 'На проверке', position: 2 },
      { name: 'Завершенные', position: 3 },
    ]
    for (const col of mainColumnDefs) {
      await this.columnRepo.createColumn({
        name: col.name,
        position: col.position,
        departmentId: department.id,
        pipelineId: mainPipeline.id,
        color: mainPipelineColumnColor(col.position),
      })
    }

    await this.departmentRepo.addUserToDepartment(department.id, currentUserId, 'admin')

    return this.mapDepartmentForApi(department)
  }

  async updateDepartment(departmentId: number, currentUserId: number, dto: UpdateDepartmentDTO): Promise<Department> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название Раздела обязательно')

    await this.ensureDepartmentExists(departmentId)
    await this.departmentAccessService.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanRenameDepartment',
      'Переименовывать раздел может только владелец/админ организации либо администратор отдела с соответствующим правом',
    )

    const updated = await this.departmentRepo.updateDepartment({ ...dto, name, id: departmentId })
    return this.mapDepartmentForApi(updated)
  }

  async softDeleteDepartment(departmentId: number, currentUserId: number): Promise<void> {
    const department = await this.ensureDepartmentExists(departmentId)
    await this.orgAccessService.ensureCanManageOrganization(department.organizationId, currentUserId)

    await this.departmentRepo.softDeleteDepartment(departmentId)
  }

  async reorderDepartments(
    organizationId: number,
    departmentIds: number[],
    currentUserId: number
  ): Promise<void> {
    await this.orgAccessService.ensureOrganizationExists(organizationId)
    await this.orgAccessService.ensureCanManageOrganization(
      organizationId,
      currentUserId,
    )

    if (!Array.isArray(departmentIds)) {
      throw new BadRequestError('departmentIds должен быть массивом')
    }
    const ids = departmentIds.filter((id) => Number.isInteger(id) && id > 0)
    if (ids.length === 0) return

    const existing = await this.departmentRepo.getDepartmentsByOrganizationId(organizationId)
    const existingIds = new Set(existing.map((d) => d.id))
    for (const id of ids) {
      if (!existingIds.has(id)) {
        throw new BadRequestError(`Раздел id=${id} не принадлежит этой организации`)
      }
    }

    await this.departmentRepo.reorderDepartments(organizationId, ids)
  }

  async addUserToDepartment(
    departmentId: number,
    currentUserId: number,
    dto: AddUserToDepartmentDTO
  ): Promise<{ id: number; email: string; firstname: string; lastname: string; role: 'member' | 'admin' }> {
    validatePositiveId(dto.userId, 'id пользователя')

    const department = await this.ensureDepartmentExists(departmentId)
    const role = dto.role ?? 'member'
    if (role === 'admin') {
      await this.departmentAccessService.ensureCanAssignDepartmentAdmin(
        department.organizationId,
        currentUserId,
      )
    } else {
      await this.departmentAccessService.ensureDepartmentPermission(
        departmentId,
        currentUserId,
        'deptAdminCanManageMembers',
        'Добавлять участников может только владелец/админ организации либо администратор отдела с соответствующим правом',
      )
    }
    await this.orgAccessService.ensureUserInOrganization(department.organizationId, dto.userId)

    const isInDepartment = await this.departmentRepo.isUserInDepartment(departmentId, dto.userId)
    if (isInDepartment) throw new ConflictError('Пользователь уже добавлен в Раздел')

    await this.departmentRepo.addUserToDepartment(departmentId, dto.userId, role)

    const user = await this.authRepo.getUserById(dto.userId)
    if (!user) throw new NotFoundError('Пользователь не найден')

    return { id: user.id, email: user.email, firstname: user.firstname, lastname: user.lastname, role }
  }

  async removeUserFromDepartment(departmentId: number, currentUserId: number, userIdToRemove: number): Promise<void> {
    const department = await this.ensureDepartmentExists(departmentId)
    if (currentUserId === userIdToRemove) {
      throw new ForbiddenError('Нельзя удалить себя из Раздела')
    }
    await this.departmentAccessService.ensureDepartmentPermission(
      departmentId,
      currentUserId,
      'deptAdminCanManageMembers',
      'Удалять участников может только владелец/админ организации либо администратор отдела с соответствующим правом',
    )

    const organization = await this.organizationRepo.getOrganizationById(department.organizationId)
    if (!organization) throw new NotFoundError('Организация не найдена')
    if (organization.ownerUserId != null && userIdToRemove === organization.ownerUserId) {
      throw new ForbiddenError('Нельзя удалить владельца организации из Раздела')
    }

    const isInDepartment = await this.departmentRepo.isUserInDepartment(departmentId, userIdToRemove)
    if (!isInDepartment) throw new NotFoundError('Пользователь не состоит в Разделе')

    await this.departmentRepo.removeUserFromDepartment(departmentId, userIdToRemove)
  }

  async getDepartmentMembers(departmentId: number, currentUserId: number): Promise<DepartmentMemberView[]> {
    await this.getDepartmentById(departmentId, currentUserId)
    const members = await this.departmentRepo.getDepartmentMembers(departmentId)
    return members.map((m) => this.mapMemberForCard(m))
  }

  /**
   * Участники всех разделов организации, видимых пользователю, одним вызовом
   * (без N запросов getDepartmentMembers + N вызовов кэша платформы).
   */
  async getDepartmentsMembersForOrganization(
    organizationId: number,
    currentUserId: number
  ): Promise<Record<number, DepartmentMemberView[]>> {
    await this.orgAccessService.ensureUserInOrganization(organizationId, currentUserId)
    const allowed = await this.getDepartmentsByOrganizationId(organizationId, currentUserId)
    const allowedIds = new Set(allowed.map((d) => d.id))
    if (allowedIds.size === 0) {
      return {}
    }
    const rows = await this.departmentRepo.getAllDepartmentMembersInOrganization(organizationId)
    const result: Record<number, DepartmentMemberView[]> = {}
    for (const row of rows) {
      if (!allowedIds.has(row.departmentId)) continue
      if (!result[row.departmentId]) result[row.departmentId] = []
      result[row.departmentId]!.push(this.mapMemberForCard(row))
    }
    return result
  }

  async setDepartmentMemberRole(
    departmentId: number,
    currentUserId: number,
    userId: number,
    role: 'member' | 'admin'
  ): Promise<void> {
    const department = await this.ensureDepartmentExists(departmentId)
    if (role === 'admin') {
      await this.departmentAccessService.ensureCanAssignDepartmentAdmin(
        department.organizationId,
        currentUserId,
      )
    } else {
      await this.departmentAccessService.ensureDepartmentPermission(
        departmentId,
        currentUserId,
        'deptAdminCanManageMembers',
        'Менять роли участников может только владелец/админ организации либо администратор отдела с соответствующим правом',
      )
    }
    const isInDepartment = await this.departmentRepo.isUserInDepartment(departmentId, userId)
    if (!isInDepartment) throw new NotFoundError('Пользователь не состоит в Разделе')
    await this.departmentRepo.setUserDepartmentRole(departmentId, userId, role)
  }
}
