import type { Department, DepartmentMember, DepartmentRole } from '../../types/departments'
import type { DepartmentPermissions } from '../../types/departmentPermissions'
import type { DepartmentPolicies } from '../../types/departmentPoliciesConfig'
import { axiosAPI } from "../axios";

export const departmentsAPI = {
    getAll: async (organizationId: number) => {
        const { data } = await axiosAPI.get<Department[]>(`/organizations/${organizationId}/departments`)
        return data
    },

    getById: async (id: number) => {
        const { data } = await axiosAPI.get<Department>(`/departments/${id}`)
        return data
    },

    getMembers: async (id: number) => {
        const { data } = await axiosAPI.get<DepartmentMember[]>(`/departments/${id}/members`)
        return data
    },

    /** Все участники разделов организации, доступных пользователю (один запрос вместо N × getMembers). */
    getMembersByOrganization: async (organizationId: number) => {
        const { data } = await axiosAPI.get<Record<string, DepartmentMember[]>>(
            `/organizations/${organizationId}/departments/members`,
        )
        return data
    },

    create: async (organizationId: number, name: string) => {
        const { data } = await axiosAPI.post(`/organizations/${organizationId}/departments`, { name })
        return data
    },

    update: async (id: number, name: string) => {
        const { data } = await axiosAPI.patch(`/departments/${id}`, { name })
        return data
    },

    delete: async (id: number) => {
        await axiosAPI.delete(`/departments/${id}`)
    },

    reorder: async (organizationId: number, departmentIds: number[]) => {
        await axiosAPI.patch(`/organizations/${organizationId}/departments/reorder`, { departmentIds })
    },

    addUser: async (id: number, userId: number, role?: DepartmentRole) => {
        const body = role ? { userId, role } : { userId }
        const { data } = await axiosAPI.post<DepartmentMember>(`/departments/${id}/members`, body)
        return data
    },
    updateMemberRole: async (id: number, userId: number, role: DepartmentRole) => {
        await axiosAPI.patch(`/departments/${id}/members/${userId}/role`, { role })
    },
    deleteUser: async (id: number, userId: number) => {
        await axiosAPI.delete(`/departments/${id}/members/${userId}`)
    },

    getPermissions: async (id: number) => {
        const { data } = await axiosAPI.get<{ permissions: DepartmentPermissions }>(
            `/departments/${id}/permissions`,
        )
        return data.permissions
    },

    updatePermissions: async (id: number, permissions: Partial<DepartmentPermissions>) => {
        const { data } = await axiosAPI.patch<{ permissions: DepartmentPermissions }>(
            `/departments/${id}/permissions`,
            { permissions },
        )
        return data.permissions
    },

    getPolicies: async (id: number) => {
        const { data } = await axiosAPI.get<{ policies: DepartmentPolicies }>(
            `/departments/${id}/policies`,
        )
        return data.policies
    },

    updatePolicies: async (id: number, policies: Partial<DepartmentPolicies>) => {
        const { data } = await axiosAPI.patch<{ policies: DepartmentPolicies }>(
            `/departments/${id}/policies`,
            { policies },
        )
        return data.policies
    },
}