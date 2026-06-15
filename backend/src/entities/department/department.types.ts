export type DepartmentRole = 'member' | 'admin'

export interface CreateDepartmentDTO {
    name: string
    organizationId: number
}

export interface UpdateDepartmentDTO {
    name: string
}

export interface AddUserToDepartmentDTO {
    userId: number
    role?: DepartmentRole
}
