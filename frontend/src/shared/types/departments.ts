import type { DepartmentPermissions } from './departmentPermissions'
import type { DepartmentPolicies } from './departmentPoliciesConfig'

export type Department = {
  id: number
  name: string
  organizationId: number
  position?: number
  permissions?: DepartmentPermissions
  policies?: DepartmentPolicies
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

export type DepartmentRole = 'member' | 'admin'

export type DepartmentMember = {
  id: number
  email: string
  firstname: string
  lastname: string
  role: DepartmentRole
}

export type CreateDepartmentDTO = { name: string }
export type UpdateDepartmentDTO = { name: string }
export type AddUserToDepartmentDTO = { userId: number; role?: DepartmentRole }