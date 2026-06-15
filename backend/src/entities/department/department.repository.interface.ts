import type { Department } from "../../infra/database/drizzle/schema.js"
import type { CreateDepartmentDTO, UpdateDepartmentDTO, DepartmentRole } from "./department.types.js"
import type { DepartmentPermissions } from "./department.permissions.js"
import type { DepartmentPolicies } from "./department.policies.js"

export interface IDepartmentRepository {
    getDepartmentsByOrganizationId(organizationId: number): Promise<Department[]>
    getDepartmentsByOrganizationIdForUser(organizationId: number, userId: number): Promise<Department[]>
    getDepartmentById(departmentId: number): Promise<Department | undefined>
    createDepartment(dto: CreateDepartmentDTO): Promise<Department>
    updateDepartment(dto: UpdateDepartmentDTO & { id: number }): Promise<Department>
    updateDepartmentPermissions(departmentId: number, permissions: DepartmentPermissions): Promise<Department>
    updateDepartmentPolicies(departmentId: number, policies: DepartmentPolicies): Promise<Department>
    softDeleteDepartment(departmentId: number): Promise<void>
    reorderDepartments(organizationId: number, departmentIds: number[]): Promise<void>
    isUserInDepartment(departmentId: number, userId: number): Promise<boolean>
    getUserRoleInDepartment(departmentId: number, userId: number): Promise<DepartmentRole | undefined>
    addUserToDepartment(departmentId: number, userId: number, role?: DepartmentRole): Promise<void>
    setUserDepartmentRole(departmentId: number, userId: number, role: DepartmentRole): Promise<void>
    removeUserFromDepartment(departmentId: number, userId: number): Promise<void>
    getDepartmentMembers(departmentId: number): Promise<{ id: number; email: string; firstname: string; lastname: string; role: DepartmentRole }[]>
    getDepartmentAdminUserIds(departmentId: number): Promise<number[]>
    /**
     * Все участники всех неудалённых разделов организации (одним запросом);
     * фильтр по списку разделов, доступных пользователю, делается в сервисе.
     */
    getAllDepartmentMembersInOrganization(organizationId: number): Promise<
        Array<{
            departmentId: number
            id: number
            email: string
            firstname: string
            lastname: string
            role: DepartmentRole
        }>
    >
    getUserDepartmentsInOrganization(organizationId: number, userId: number): Promise<{ departmentId: number; departmentName: string; role: DepartmentRole }[]>
    removeUserFromAllDepartmentsInOrganization(organizationId: number, userId: number): Promise<void>
}
