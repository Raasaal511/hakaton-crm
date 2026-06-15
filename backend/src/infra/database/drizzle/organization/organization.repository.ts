import { injectable, inject } from 'inversify'
import { and, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import type { IOrganizationRepository, CreateOrganizationData, OrganizationMember, OrganizationRole } from '../../../../entities/organization/index.js'
import { Organization, organizationsSchema, usersSchema, usersToOrganizationsSchema } from '../schema.js'

@injectable()
export class OrganizationRepository implements IOrganizationRepository {
  constructor(@inject(TYPES.DB) private db: DB) { }

  async addUserToOrganization(userId: number, organizationId: number, role: OrganizationRole | undefined): Promise<void> {
    await this.db.insert(usersToOrganizationsSchema).values({
      userId,
      organizationId,
      role: role ?? 'member'
    })
  }

  async getOrganizationMembers(organizationId: number) {
    return this.db
      .select({
        id: usersSchema.id,
        email: usersSchema.email,
        firstname: usersSchema.firstname,
        lastname: usersSchema.lastname,
        role: usersToOrganizationsSchema.role,
      })
      .from(usersToOrganizationsSchema)
      .innerJoin(usersSchema, eq(usersToOrganizationsSchema.userId, usersSchema.id))
      .where(eq(usersToOrganizationsSchema.organizationId, organizationId))
  }

  async getOrganizationMember(organizationId: number, userId: number): Promise<OrganizationMember | undefined> {
    const [row] = await this.db
      .select({
        id: usersSchema.id,
        email: usersSchema.email,
        firstname: usersSchema.firstname,
        lastname: usersSchema.lastname,
        role: usersToOrganizationsSchema.role,
      })
      .from(usersToOrganizationsSchema)
      .innerJoin(usersSchema, eq(usersToOrganizationsSchema.userId, usersSchema.id))
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationId),
          eq(usersToOrganizationsSchema.userId, userId),
        ),
      )
      .limit(1)
    return row
  }

  async getUserRoleInOrganization(orgId: number, userId: number): Promise<OrganizationRole | undefined> {
    const [record] = await this.db
      .select({ role: usersToOrganizationsSchema.role })
      .from(usersToOrganizationsSchema)
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, orgId),
          eq(usersToOrganizationsSchema.userId, userId)
        )
      )
      .limit(1)
    return record?.role
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const [organization] = await this.db
      .select()
      .from(organizationsSchema)
      .where(
        and(
          eq(organizationsSchema.id, id),
          isNull(organizationsSchema.deletedAt)
        )
      )
      .limit(1)
    return organization
  }

  async getUserOrganizations(userId: number): Promise<Array<Organization & { myRole: OrganizationRole }>> {
    const result = await this.db
      .select({
        ...getTableColumns(organizationsSchema),
        myRole: usersToOrganizationsSchema.role,
      })
      .from(organizationsSchema)
      .innerJoin(
        usersToOrganizationsSchema,
        eq(organizationsSchema.id, usersToOrganizationsSchema.organizationId)
      )
      .where(
        and(
          eq(usersToOrganizationsSchema.userId, userId),
          isNull(organizationsSchema.deletedAt)
        )
      )

    return result
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return this.db
      .select()
      .from(organizationsSchema)
      .where(
        and(
          isNull(organizationsSchema.deletedAt),
          eq(organizationsSchema.isPersonal, false)
        )
      )
  }

  async createOrganization(dto: CreateOrganizationData): Promise<Pick<Organization, 'id' | 'name'> | undefined> {
    const [organization] = await this.db
      .insert(organizationsSchema)
      .values({
        name: dto.name,
        isPersonal: dto.isPersonal ?? false,
        ownerUserId: dto.ownerUserId ?? null,
      })
      .returning({ id: organizationsSchema.id, name: organizationsSchema.name })

    if (!organization) return undefined
    await this.db.insert(usersToOrganizationsSchema).values({
      userId: dto.userId,
      organizationId: organization.id,
      role: dto.role ?? 'owner'
    })
    return organization
  }

  async countOwnersInOrganization(organizationId: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersToOrganizationsSchema)
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationId),
          eq(usersToOrganizationsSchema.role, 'owner')
        )
      )
    return result[0]?.count ?? 0
  }

  async softDeleteOrganization(organizationId: number): Promise<void> {
    await this.db
      .update(organizationsSchema)
      .set({ deletedAt: new Date() })
      .where(eq(organizationsSchema.id, organizationId))
  }

  async removeUserFromOrganization(organizationId: number, userId: number): Promise<void> {
    await this.db
      .delete(usersToOrganizationsSchema)
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationId),
          eq(usersToOrganizationsSchema.userId, userId)
        )
      )
  }

  async removeUsersFromOrganization(organizationId: number, userIds: number[]): Promise<void> {
    if (userIds.length === 0) return

    await this.db
      .delete(usersToOrganizationsSchema)
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationId),
          inArray(usersToOrganizationsSchema.userId, userIds)
        )
      )
  }

  async updateUserRoleInOrganization(organizationId: number, userId: number, role: OrganizationRole): Promise<void> {
    await this.db
      .update(usersToOrganizationsSchema)
      .set({ role })
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationId),
          eq(usersToOrganizationsSchema.userId, userId)
        )
      )
  }

  async findPersonalByUserId(userId: number): Promise<Organization | undefined> {
    const [byOwnerColumn] = await this.db
      .select()
      .from(organizationsSchema)
      .where(
        and(
          eq(organizationsSchema.ownerUserId, userId),
          eq(organizationsSchema.isPersonal, true),
          isNull(organizationsSchema.deletedAt),
        ),
      )
      .limit(1)
    if (byOwnerColumn) return byOwnerColumn

    // «Сломанная» личная орг: owner_user_id NULL, но пользователь — owner в users_to_organizations
    const [byMembership] = await this.db
      .select({ org: organizationsSchema })
      .from(organizationsSchema)
      .innerJoin(
        usersToOrganizationsSchema,
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationsSchema.id),
          eq(usersToOrganizationsSchema.userId, userId),
          eq(usersToOrganizationsSchema.role, 'owner'),
        ),
      )
      .where(
        and(
          eq(organizationsSchema.isPersonal, true),
          isNull(organizationsSchema.deletedAt),
          isNull(organizationsSchema.ownerUserId),
        ),
      )
      .limit(1)
    return byMembership?.org
  }

  async setPersonalOrganizationOwner(organizationId: number, ownerUserId: number): Promise<void> {
    await this.db
      .update(organizationsSchema)
      .set({ ownerUserId, updatedAt: new Date() })
      .where(
        and(
          eq(organizationsSchema.id, organizationId),
          eq(organizationsSchema.isPersonal, true),
          isNull(organizationsSchema.deletedAt),
          isNull(organizationsSchema.ownerUserId),
        ),
      )
  }

  async updateOrganization(dto: CreateOrganizationData & { id: number }): Promise<Organization> {
    const [org] = await this.db
      .update(organizationsSchema)
      .set({
        name: dto.name,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationsSchema.id, dto.id),
          isNull(organizationsSchema.deletedAt),
        ),
      )
      .returning()

    return org
  }
}
