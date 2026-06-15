import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import { ForbiddenError, NotFoundError } from '../infra/libs/errors.js'
import type { IOrganizationRepository } from '../entities/organization/index.js'
import type { IAuthRepository } from '../entities/auth/index.js'
import type { OrganizationRole } from '../entities/organization/index.js'
import type { Organization } from '../infra/database/drizzle/schema.js'

const MANAGER_ROLES: OrganizationRole[] = ['owner', 'admin']

@injectable()
export class OrganizationAccessService {
  constructor(
    @inject(TYPES.OrganizationRepository) private organizationRepo: IOrganizationRepository,
    @inject(TYPES.AuthRepository) private authRepo: IAuthRepository
  ) {}

  async ensureOrganizationExists(organizationId: number): Promise<Organization> {
    const organization = await this.organizationRepo.getOrganizationById(organizationId)
    if (!organization) throw new NotFoundError('Организация не найдена')
    return organization
  }

  private async isRoot(userId: number): Promise<boolean> {
    const user = await this.authRepo.getUserById(userId)
    return user?.systemRole === 'root'
  }

  async ensureCanManageOrganization(organizationId: number, userId: number): Promise<void> {
    if (await this.isRoot(userId)) return
    const role = await this.organizationRepo.getUserRoleInOrganization(organizationId, userId)
    if (!role || !MANAGER_ROLES.includes(role)) {
      throw new ForbiddenError('Только владелец или админ может управлять организацией')
    }
  }

  async canManageOrganization(organizationId: number, userId: number): Promise<boolean> {
    if (await this.isRoot(userId)) return true
    const role = await this.organizationRepo.getUserRoleInOrganization(organizationId, userId)
    return !!role && MANAGER_ROLES.includes(role)
  }

  async ensureUserInOrganization(organizationId: number, userId: number): Promise<void> {
    if (await this.isRoot(userId)) return
    const role = await this.organizationRepo.getUserRoleInOrganization(organizationId, userId)
    if (!role) throw new ForbiddenError('Нет доступа к организации')
  }

  /**
   * @param actionMessage — фраза после «Только владелец может …» (например «удалить организацию»).
   */
  async ensureIsOwner(
    organizationId: number,
    userId: number,
    actionMessage = 'удалить организацию'
  ): Promise<void> {
    if (await this.isRoot(userId)) return
    const role = await this.organizationRepo.getUserRoleInOrganization(organizationId, userId)
    if (role !== 'owner') {
      throw new ForbiddenError(`Только владелец может ${actionMessage}`)
    }
  }

  async ensureCanManageOrIsSelf(organizationId: number, currentUserId: number, targetUserId: number): Promise<void> {
    if (currentUserId === targetUserId) return
    await this.ensureCanManageOrganization(organizationId, currentUserId)
  }
}
