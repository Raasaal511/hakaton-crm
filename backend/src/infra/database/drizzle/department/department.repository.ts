import { injectable, inject } from 'inversify'
import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import type { IDepartmentRepository, CreateDepartmentDTO, UpdateDepartmentDTO, DepartmentRole } from '../../../../entities/department/index.js'
import type { DepartmentPermissions } from '../../../../entities/department/department.permissions.js'
import type { DepartmentPolicies } from '../../../../entities/department/department.policies.js'
import { Department, departmentSchema, usersToDepartmentsSchema, usersSchema } from '../schema.js'

@injectable()
export class DepartmentRepository implements IDepartmentRepository {
    constructor(@inject(TYPES.DB) private db: DB) { }

    async getDepartmentsByOrganizationId(organizationId: number): Promise<Department[]> {
        return this.db
            .select()
            .from(departmentSchema)
            .where(
                and(
                    eq(departmentSchema.organizationId, organizationId),
                    isNull(departmentSchema.deletedAt)
                )
            )
            .orderBy(asc(departmentSchema.position), asc(departmentSchema.id))
    }

    async getDepartmentsByOrganizationIdForUser(organizationId: number, userId: number): Promise<Department[]> {
        return await this.db
            .select({
                id: departmentSchema.id,
                name: departmentSchema.name,
                organizationId: departmentSchema.organizationId,
                position: departmentSchema.position,
                permissions: departmentSchema.permissions,
                policies: departmentSchema.policies,
                createdAt: departmentSchema.createdAt,
                updatedAt: departmentSchema.updatedAt,
                deletedAt: departmentSchema.deletedAt,
            })
            .from(departmentSchema)
            .innerJoin(
                usersToDepartmentsSchema,
                eq(departmentSchema.id, usersToDepartmentsSchema.departmentId)
            )
            .where(
                and(
                    eq(departmentSchema.organizationId, organizationId),
                    eq(usersToDepartmentsSchema.userId, userId),
                    isNull(departmentSchema.deletedAt)
                )
            )
            .orderBy(asc(departmentSchema.position), asc(departmentSchema.id))
    }

    async getDepartmentById(departmentId: number): Promise<Department | undefined> {
        const [department] = await this.db
            .select()
            .from(departmentSchema)
            .where(
                and(
                    eq(departmentSchema.id, departmentId),
                    isNull(departmentSchema.deletedAt)
                )
            )
            .limit(1)
        return department
    }

    async createDepartment(dto: CreateDepartmentDTO): Promise<Department> {
        const [{ maxPos }] = await this.db
            .select({ maxPos: max(departmentSchema.position) })
            .from(departmentSchema)
            .where(
                and(
                    eq(departmentSchema.organizationId, dto.organizationId),
                    isNull(departmentSchema.deletedAt)
                )
            )
        const nextPosition = (maxPos ?? -1) + 1
        const [department] = await this.db
            .insert(departmentSchema)
            .values({ name: dto.name, organizationId: dto.organizationId, position: nextPosition })
            .returning()
        return department
    }

    async updateDepartment(dto: UpdateDepartmentDTO & { id: number }): Promise<Department> {
        const [department] = await this.db
            .update(departmentSchema)
            .set({ name: dto.name, updatedAt: new Date() })
            .where(eq(departmentSchema.id, dto.id))
            .returning()
        return department
    }

    async updateDepartmentPermissions(departmentId: number, permissions: DepartmentPermissions): Promise<Department> {
        const [department] = await this.db
            .update(departmentSchema)
            .set({ permissions, updatedAt: new Date() })
            .where(eq(departmentSchema.id, departmentId))
            .returning()
        return department
    }

    async updateDepartmentPolicies(departmentId: number, policies: DepartmentPolicies): Promise<Department> {
        const [department] = await this.db
            .update(departmentSchema)
            .set({ policies, updatedAt: new Date() })
            .where(eq(departmentSchema.id, departmentId))
            .returning()
        return department
    }

    async softDeleteDepartment(departmentId: number): Promise<void> {
        await this.db
            .update(departmentSchema)
            .set({ deletedAt: new Date() })
            .where(eq(departmentSchema.id, departmentId))
    }

    async reorderDepartments(organizationId: number, departmentIds: number[]): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < departmentIds.length; i++) {
                await tx
                    .update(departmentSchema)
                    .set({ position: i, updatedAt: new Date() })
                    .where(
                        and(
                            eq(departmentSchema.id, departmentIds[i]),
                            eq(departmentSchema.organizationId, organizationId),
                            isNull(departmentSchema.deletedAt)
                        )
                    )
            }
        })
    }

    async isUserInDepartment(departmentId: number, userId: number): Promise<boolean> {
        const [row] = await this.db
            .select()
            .from(usersToDepartmentsSchema)
            .where(
                and(
                    eq(usersToDepartmentsSchema.departmentId, departmentId),
                    eq(usersToDepartmentsSchema.userId, userId)
                )
            )
            .limit(1)
        return !!row
    }

    async getUserRoleInDepartment(departmentId: number, userId: number): Promise<DepartmentRole | undefined> {
        const [row] = await this.db
            .select({ role: usersToDepartmentsSchema.role })
            .from(usersToDepartmentsSchema)
            .where(
                and(
                    eq(usersToDepartmentsSchema.departmentId, departmentId),
                    eq(usersToDepartmentsSchema.userId, userId)
                )
            )
            .limit(1)
        return row?.role as DepartmentRole | undefined
    }

    async addUserToDepartment(departmentId: number, userId: number, role: DepartmentRole = 'member'): Promise<void> {
        await this.db.insert(usersToDepartmentsSchema).values({ departmentId, userId, role })
    }

    async setUserDepartmentRole(departmentId: number, userId: number, role: DepartmentRole): Promise<void> {
        await this.db
            .update(usersToDepartmentsSchema)
            .set({ role })
            .where(
                and(
                    eq(usersToDepartmentsSchema.departmentId, departmentId),
                    eq(usersToDepartmentsSchema.userId, userId)
                )
            )
    }

    async removeUserFromDepartment(departmentId: number, userId: number): Promise<void> {
        await this.db
            .delete(usersToDepartmentsSchema)
            .where(
                and(
                    eq(usersToDepartmentsSchema.departmentId, departmentId),
                    eq(usersToDepartmentsSchema.userId, userId)
                )
            )
    }

    async getDepartmentMembers(departmentId: number): Promise<{ id: number; email: string; firstname: string; lastname: string; role: DepartmentRole }[]> {
        const rows = await this.db
            .select({
                id: usersSchema.id,
                email: usersSchema.email,
                firstname: usersSchema.firstname,
                lastname: usersSchema.lastname,
                role: usersToDepartmentsSchema.role,
            })
            .from(usersToDepartmentsSchema)
            .innerJoin(usersSchema, eq(usersToDepartmentsSchema.userId, usersSchema.id))
            .where(eq(usersToDepartmentsSchema.departmentId, departmentId))
        return rows.map((r) => ({ ...r, role: r.role as DepartmentRole }))
    }

    async getDepartmentAdminUserIds(departmentId: number): Promise<number[]> {
        const rows = await this.db
            .select({ userId: usersToDepartmentsSchema.userId })
            .from(usersToDepartmentsSchema)
            .where(
                and(
                    eq(usersToDepartmentsSchema.departmentId, departmentId),
                    eq(usersToDepartmentsSchema.role, 'admin'),
                ),
            )
        return rows.map((r) => r.userId)
    }

    async getAllDepartmentMembersInOrganization(organizationId: number): Promise<
        Array<{
            departmentId: number
            id: number
            email: string
            firstname: string
            lastname: string
            role: DepartmentRole
        }>
    > {
        const rows = await this.db
            .select({
                departmentId: departmentSchema.id,
                id: usersSchema.id,
                email: usersSchema.email,
                firstname: usersSchema.firstname,
                lastname: usersSchema.lastname,
                role: usersToDepartmentsSchema.role,
            })
            .from(usersToDepartmentsSchema)
            .innerJoin(usersSchema, eq(usersToDepartmentsSchema.userId, usersSchema.id))
            .innerJoin(departmentSchema, eq(usersToDepartmentsSchema.departmentId, departmentSchema.id))
            .where(
                and(
                    eq(departmentSchema.organizationId, organizationId),
                    isNull(departmentSchema.deletedAt)
                )
            )
        return rows.map((r) => ({
            ...r,
            role: r.role as DepartmentRole,
        }))
    }

    async getUserDepartmentsInOrganization(organizationId: number, userId: number): Promise<{ departmentId: number; departmentName: string; role: DepartmentRole }[]> {
        const rows = await this.db
            .select({
                departmentId: departmentSchema.id,
                departmentName: departmentSchema.name,
                role: usersToDepartmentsSchema.role,
            })
            .from(usersToDepartmentsSchema)
            .innerJoin(departmentSchema, eq(usersToDepartmentsSchema.departmentId, departmentSchema.id))
            .where(
                and(
                    eq(departmentSchema.organizationId, organizationId),
                    eq(usersToDepartmentsSchema.userId, userId),
                    isNull(departmentSchema.deletedAt)
                )
            )
        return rows.map((r) => ({ ...r, role: r.role as DepartmentRole }))
    }

    async removeUserFromAllDepartmentsInOrganization(organizationId: number, userId: number): Promise<void> {
        const depts = await this.db
            .select({ id: departmentSchema.id })
            .from(departmentSchema)
            .where(
                and(
                    eq(departmentSchema.organizationId, organizationId),
                    isNull(departmentSchema.deletedAt)
                )
            )
        const deptIds = depts.map((d) => d.id)
        if (deptIds.length === 0) return
        await this.db
            .delete(usersToDepartmentsSchema)
            .where(
                and(
                    eq(usersToDepartmentsSchema.userId, userId),
                    inArray(usersToDepartmentsSchema.departmentId, deptIds)
                )
            )
    }
}
