import type { Organization } from "../../infra/database/drizzle/schema.js"

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'

export type CreateOrganizationDTO = Pick<Organization, 'name'>
export type UpdateOrganizationDTO = Pick<Organization, 'name'>
export type AddUserToOrganizationDTO = {
  email: string
  role: OrganizationRole
}
export type CreateOrganizationData = Pick<Organization, 'name' | 'isPersonal' | 'ownerUserId'> & {
  userId: number
  role?: OrganizationRole
}

export type OrganizationMember = { id: number; email: string; firstname: string; lastname: string; role: OrganizationRole }

export type MemberDepartmentInfo = { departmentId: number; departmentName: string; role: 'member' | 'admin' }
export type OrganizationMemberWithDepartments = OrganizationMember & { departments: MemberDepartmentInfo[] }
