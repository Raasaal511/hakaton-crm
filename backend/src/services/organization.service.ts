import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../infra/libs/errors.js";
import { validateNonEmptyString } from "../infra/libs/validation.js";
import type { IAuthRepository } from "../entities/auth/index.js";
import { AddUserToOrganizationDTO, CreateOrganizationDTO, IOrganizationRepository, OrganizationMember, OrganizationMemberWithDepartments, OrganizationRole, UpdateOrganizationDTO } from "../entities/organization/index.js";
import type { OrganizationAccessService } from "./organization-access.service.js";
import type { IDepartmentRepository } from "../entities/department/index.js";
import { Organization } from "../infra/database/drizzle/schema.js";

const ORGANIZATION_ROLES: OrganizationRole[] = ['owner', 'admin', 'manager', 'employee', 'member', 'viewer']

@injectable()
export class OrganizationService {
  constructor(
    @inject(TYPES.OrganizationRepository) private organizationRepo: IOrganizationRepository,
    @inject(TYPES.AuthRepository) private authRepo: IAuthRepository,
    @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService,
    @inject(TYPES.DepartmentRepository) private departmentRepo: IDepartmentRepository,
  ) { }

  async addUserToOrganization(organizationId: number, { email, role }: AddUserToOrganizationDTO): Promise<OrganizationMember> {
    await this.ensureOrganizationAllowsMemberInvites(organizationId)
    this.validateOrganizationRole(role)
    validateNonEmptyString(email, 'Email')

    const user = await this.authRepo.getUserByEmail(email!)
    if (!user) throw new NotFoundError('Пользователь с таким email не найден')

    const existingRole = await this.organizationRepo.getUserRoleInOrganization(organizationId, user.id)
    if (existingRole) throw new ConflictError('Пользователь уже состоит в организации')

    const assignedRole = role ?? 'member'
    await this.organizationRepo.addUserToOrganization(user.id, organizationId, assignedRole)

    return {
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      role: assignedRole,
    }
  }

  async getOrganizationMembers(organizationId: number, _currentUserId: number): Promise<OrganizationMember[]> {
    const members = await this.organizationRepo.getOrganizationMembers(organizationId)
    return members.map((m) => ({
      id: m.id,
      email: m.email,
      firstname: m.firstname,
      lastname: m.lastname,
      role: m.role,
    }))
  }

  /** Все пользователи организации с отделами и ролями. Только для владельца и админа организации. */
  async getOrganizationMembersWithDepartments(organizationId: number, currentUserId: number): Promise<OrganizationMemberWithDepartments[]> {
    await this.orgAccessService.ensureCanManageOrganization(organizationId, currentUserId)

    const members = await this.getOrganizationMembers(organizationId, currentUserId)
    const result: OrganizationMemberWithDepartments[] = []
    for (const m of members) {
      const departments = await this.departmentRepo.getUserDepartmentsInOrganization(organizationId, m.id)
      result.push({
        id: m.id,
        email: m.email,
        firstname: m.firstname,
        lastname: m.lastname,
        role: m.role,
        departments: departments.map((d) => ({ departmentId: d.departmentId, departmentName: d.departmentName, role: d.role })),
      })
    }
    return result
  }

  async getOrganizationById(id: number): Promise<Organization & { isPlatformOrganization: boolean }> {
    const org = await this.orgAccessService.ensureOrganizationExists(id)
    return {
      ...org,
      isPlatformOrganization: false,
    }
  }

  async getUserOrganizations(userId: number): Promise<Array<Organization & { myRole: OrganizationRole }>> {
    await this.ensurePersonalOrganization(userId).catch(() => undefined)
    return this.organizationRepo.getUserOrganizations(userId)
  }

  async createOrganization(dto: CreateOrganizationDTO, userId: number): Promise<Pick<Organization, 'id' | 'name'>> {
    validateNonEmptyString(dto.name, 'Название организации')

    const organization = await this.organizationRepo.createOrganization({
      name: dto.name!.trim(),
      isPersonal: false,
      ownerUserId: null,
      userId,
      role: 'owner',
    })
    return organization as Pick<Organization, 'id' | 'name'>
  }

  async updateOrganization(id: number, currentUserId: number, dto: UpdateOrganizationDTO): Promise<Organization> {
    validateNonEmptyString(dto.name, 'Название организации')
    const org = await this.orgAccessService.ensureOrganizationExists(id)
    await this.orgAccessService.ensureIsOwner(org.id, currentUserId, 'изменить название организации')

    const trimmedName = dto.name!.trim()
    if (!trimmedName) {
      throw new BadRequestError('Название организации не может быть пустым')
    }

    return this.organizationRepo.updateOrganization({ id, name: trimmedName } as any)
  }

  async softDeleteOrganization(organizationId: number): Promise<void> {
    await this.orgAccessService.ensureOrganizationExists(organizationId)
    await this.organizationRepo.softDeleteOrganization(organizationId)
  }

  async updateMemberRole(organizationId: number, userId: number, newRole: OrganizationRole, currentUserId: number): Promise<OrganizationMember> {
    await this.orgAccessService.ensureIsOwner(organizationId, currentUserId, 'менять роли участников в организации')
    this.validateOrganizationRole(newRole)

    const currentRole = await this.organizationRepo.getUserRoleInOrganization(organizationId, userId)
    if (!currentRole) throw new NotFoundError('Пользователь не состоит в организации')

    if (currentRole === 'owner' && newRole !== 'owner') {
      const ownersCount = await this.organizationRepo.countOwnersInOrganization(organizationId)
      if (ownersCount <= 1) {
        throw new ForbiddenError('Нельзя понизить единственного владельца')
      }
    }

    await this.organizationRepo.updateUserRoleInOrganization(organizationId, userId, newRole)
    const updated = await this.organizationRepo.getOrganizationMember(organizationId, userId)
    if (!updated) throw new NotFoundError('Пользователь не найден')
    return { ...updated, role: newRole }
  }

  async removeUserFromOrganization(organizationId: number, userIdToRemove: number): Promise<void> {
    const userToRemoveRole = await this.organizationRepo.getUserRoleInOrganization(organizationId, userIdToRemove)
    if (!userToRemoveRole) throw new NotFoundError('Пользователь не состоит в организации')

    if (userToRemoveRole === 'owner') {
      const ownersCount = await this.organizationRepo.countOwnersInOrganization(organizationId)
      if (ownersCount <= 1) {
        throw new ForbiddenError('Нельзя удалить единственного владельца организации')
      }
    }

    await this.organizationRepo.removeUserFromOrganization(organizationId, userIdToRemove)
  }

  async removeUsersFromOrganization(organizationId: number, userIdsToRemove: number[]): Promise<void> {
    const uniqueIds = Array.from(new Set(userIdsToRemove))
    if (uniqueIds.length === 0) return

    const roles = await Promise.all(
      uniqueIds.map(async (userId) => {
        const role = await this.organizationRepo.getUserRoleInOrganization(organizationId, userId)
        return { userId, role }
      }),
    )

    for (const { role } of roles) {
      if (!role) throw new NotFoundError('Пользователь не состоит в организации')
    }

    const ownersCount = await this.organizationRepo.countOwnersInOrganization(organizationId)
    const ownersToRemove = roles.reduce((acc, r) => (r.role === 'owner' ? acc + 1 : acc), 0)

    if (ownersCount - ownersToRemove <= 0) {
      throw new ForbiddenError('Нельзя удалить единственного владельца организации')
    }

    await this.organizationRepo.removeUsersFromOrganization(organizationId, uniqueIds)
  }

  private validateOrganizationRole(role: OrganizationRole): void {
    if (!role || !ORGANIZATION_ROLES.includes(role)) {
      throw new BadRequestError('Некорректная роль')
    }
  }

  /** Личная организация («Личное пространство») — только владелец, без приглашений. */
  private async ensureOrganizationAllowsMemberInvites(organizationId: number): Promise<void> {
    const org = await this.orgAccessService.ensureOrganizationExists(organizationId)
    if (org.isPersonal) {
      throw new ForbiddenError(
        'В личную организацию нельзя добавлять участников. Создайте отдельную организацию для совместной работы.',
      )
    }
  }

  private async ensurePersonalOrganization(userId: number): Promise<Organization> {
    const existing = await this.organizationRepo.findPersonalByUserId(userId)
    if (existing) {
      if (existing.ownerUserId == null) {
        await this.organizationRepo.setPersonalOrganizationOwner(existing.id, userId)
        return { ...existing, ownerUserId: userId }
      }
      return existing
    }

    const organization = await this.organizationRepo.createOrganization({
      name: 'Личное пространство',
      isPersonal: true,
      ownerUserId: userId,
      userId,
      role: 'owner',
    })

    if (!organization) {
      throw new BadRequestError('Не удалось создать личную организацию')
    }

    // создаём базовый Раздел для личных задач
    await this.departmentRepo.createDepartment({
      name: 'Личное',
      organizationId: organization.id,
    })

    return organization as Organization
  }
}
