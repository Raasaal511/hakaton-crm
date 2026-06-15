import { inject, injectable } from 'inversify'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { TYPES } from '../types.js'
import type { DB } from '../infra/database/drizzle/client.js'
import type { IAuthRepository } from '../entities/auth/index.js'
import type { OrganizationRole } from '../entities/organization/index.js'
import { ForbiddenError } from '../infra/libs/errors.js'
import {
  rbacGroupMembersSchema,
  rbacGroupsSchema,
  rbacPermissionsSchema,
  usersToOrganizationsSchema,
} from '../infra/database/drizzle/schema.js'

export type CoreRole = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer'
export type CoreCapability =
  | 'crm.read'
  | 'crm.write'
  | 'crm.delete'
  | 'catalog.read'
  | 'catalog.write'
  | 'catalog.inventory'
  | 'sales.read'
  | 'sales.write'
  | 'automation.manage'
  | 'rbac.manage'
  | 'realtime.board'
  | 'audit.read'

const ROLE_ALIASES: Record<string, CoreRole> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  employee: 'employee',
  member: 'employee',
  viewer: 'viewer',
}

const ROLE_CAPABILITIES: Record<CoreRole, CoreCapability[]> = {
  owner: [
    'crm.read', 'crm.write', 'crm.delete',
    'catalog.read', 'catalog.write', 'catalog.inventory',
    'sales.read', 'sales.write',
    'automation.manage', 'rbac.manage', 'realtime.board', 'audit.read',
  ],
  admin: [
    'crm.read', 'crm.write', 'crm.delete',
    'catalog.read', 'catalog.write', 'catalog.inventory',
    'sales.read', 'sales.write',
    'automation.manage', 'rbac.manage', 'realtime.board', 'audit.read',
  ],
  manager: [
    'crm.read', 'crm.write',
    'catalog.read', 'catalog.write', 'catalog.inventory',
    'sales.read', 'sales.write',
    'automation.manage', 'realtime.board',
  ],
  employee: [
    'crm.read', 'crm.write',
    'catalog.read',
    'sales.read',
    'realtime.board',
  ],
  viewer: [
    'crm.read',
    'catalog.read',
    'sales.read',
    'realtime.board',
  ],
}

function roleHas(role: CoreRole, capability: CoreCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability)
}

@injectable()
export class RbacService {
  constructor(
    @inject(TYPES.DB) private db: DB,
    @inject(TYPES.AuthRepository) private authRepo: IAuthRepository,
  ) {}

  private async isRoot(userId: number): Promise<boolean> {
    const user = await this.authRepo.getUserById(userId)
    return user?.systemRole === 'root'
  }

  async getUserCoreRole(organizationId: number, userId: number): Promise<CoreRole | null> {
    if (await this.isRoot(userId)) return 'owner'

    const explicit = await this.db
      .select({ role: rbacPermissionsSchema.role })
      .from(rbacPermissionsSchema)
      .where(
        and(
          eq(rbacPermissionsSchema.organizationId, organizationId),
          eq(rbacPermissionsSchema.userId, userId),
          or(isNull(rbacPermissionsSchema.expiresAt), gt(rbacPermissionsSchema.expiresAt, new Date()))!,
        ),
      )
      .limit(1)

    if (explicit[0]?.role) return explicit[0].role

    const membership = await this.db
      .select({ role: usersToOrganizationsSchema.role })
      .from(usersToOrganizationsSchema)
      .where(
        and(
          eq(usersToOrganizationsSchema.organizationId, organizationId),
          eq(usersToOrganizationsSchema.userId, userId),
        ),
      )
      .limit(1)

    const role = membership[0]?.role as OrganizationRole | undefined
    return role ? ROLE_ALIASES[role] ?? null : null
  }

  async hasCapability(organizationId: number, userId: number, capability: CoreCapability): Promise<boolean> {
    const role = await this.getUserCoreRole(organizationId, userId)
    if (!role) return false
    if (roleHas(role, capability)) return true

    const groupRows = await this.db
      .select({ permissions: rbacGroupsSchema.permissions })
      .from(rbacGroupMembersSchema)
      .innerJoin(rbacGroupsSchema, eq(rbacGroupMembersSchema.groupId, rbacGroupsSchema.id))
      .where(
        and(
          eq(rbacGroupsSchema.organizationId, organizationId),
          eq(rbacGroupMembersSchema.userId, userId),
          or(isNull(rbacGroupMembersSchema.expiresAt), gt(rbacGroupMembersSchema.expiresAt, new Date()))!,
        ),
      )

    return groupRows.some((row) => row.permissions?.[capability] === true)
  }

  async ensureCapability(organizationId: number, userId: number, capability: CoreCapability): Promise<void> {
    if (!(await this.hasCapability(organizationId, userId, capability))) {
      throw new ForbiddenError('Недостаточно прав для действия')
    }
  }
}
