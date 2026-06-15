import type { Organization } from "../../infra/database/drizzle/schema.js"
import type {
  CreateOrganizationData,
  OrganizationMember,
  OrganizationRole,
  UpdateOrganizationDTO,
} from "./organization.types.js"

export type { OrganizationMember }

export interface IOrganizationRepository {
  addUserToOrganization(userId: number, organizationId: number, role: OrganizationRole | undefined): Promise<void>
  getOrganizationMembers(organizationId: number): Promise<OrganizationMember[]>
  getOrganizationMember(organizationId: number, userId: number): Promise<OrganizationMember | undefined>
  getOrganizationById(id: number): Promise<Organization | undefined>
  createOrganization(dto: CreateOrganizationData): Promise<Pick<Organization, 'id' | 'name'> | undefined>
  updateOrganization(dto: UpdateOrganizationDTO & { id: number }): Promise<Organization>
  getUserOrganizations(userId: number): Promise<Array<Organization & { myRole: OrganizationRole }>>
  findPersonalByUserId(userId: number): Promise<Organization | undefined>
  /** Восстановить owner_user_id у личной организации (после сбоя или старых данных). */
  setPersonalOrganizationOwner(organizationId: number, ownerUserId: number): Promise<void>
  getAllOrganizations(): Promise<Organization[]>
  softDeleteOrganization(organizationId: number): Promise<void>
  getUserRoleInOrganization(orgId: number, userId: number): Promise<OrganizationRole | undefined>
  countOwnersInOrganization(organizationId: number): Promise<number>
  removeUserFromOrganization(organizationId: number, userId: number): Promise<void>
  removeUsersFromOrganization(organizationId: number, userIds: number[]): Promise<void>
  updateUserRoleInOrganization(organizationId: number, userId: number, role: OrganizationRole): Promise<void>
}
