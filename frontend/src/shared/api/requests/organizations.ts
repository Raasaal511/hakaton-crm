import { axiosAPI } from '../axios'
import type {
    AddUserToOrganizationDTO,
    AnalyticsPeriod,
    Organization,
    OrganizationAnalytics,
    OrganizationMember,
    OrganizationMemberWithDepartments,
} from '../../types/organization'

export const organizationsAPI = {
    getAll: async () => {
        const { data } = await axiosAPI.get<Organization[]>('/organizations')
        return data
    },
    getById: async (id: number) => {
        const { data } = await axiosAPI.get<Organization>(`/organizations/${id}`)
        return data
    },
    create: async (name: string) => {
        const { data } = await axiosAPI.post<Pick<Organization, 'id' | 'name'>>('/organizations', { name })
        return data
    },
    update: async (id: number, name: string) => {
        const { data } = await axiosAPI.patch<Organization>(`/organizations/${id}`, { name })
        return data
    },
    delete: async (id: number) => {
        await axiosAPI.delete(`/organizations/${id}`)
    },
    getMembers: async (organizationId: number) => {
        const { data } = await axiosAPI.get<OrganizationMember[]>(`/organizations/${organizationId}/members`)
        return data
    },
    getMembersWithDepartments: async (organizationId: number) => {
        const { data } = await axiosAPI.get<OrganizationMemberWithDepartments[]>(
            `/organizations/${organizationId}/members/with-departments`
        )
        return data
    },
    addMember: async (organizationId: number, dto: AddUserToOrganizationDTO) => {
        const { data } = await axiosAPI.post<OrganizationMember>(`/organizations/${organizationId}/members`, dto)
        return data
    },
    updateMemberRole: async (organizationId: number, userId: number, role: string) => {
        const { data } = await axiosAPI.patch<OrganizationMember>(
            `/organizations/${organizationId}/members/${userId}/role`,
            { role }
        )
        return data
    },
    removeMember: async (organizationId: number, userId: number) => {
        await axiosAPI.delete(`/organizations/${organizationId}/members/${userId}`)
    },
    removeMembers: async (organizationId: number, userIds: number[]) => {
        await axiosAPI.delete(`/organizations/${organizationId}/members`, {
            data: { userIds },
        })
    },
    getAnalytics: async (
        organizationId: number,
        period: AnalyticsPeriod,
        departmentId?: number | null,
    ) => {
        const params: { period: AnalyticsPeriod; departmentId?: number } = { period }
        if (departmentId != null) params.departmentId = departmentId
        const { data } = await axiosAPI.get<OrganizationAnalytics>(
            `/organizations/${organizationId}/analytics`,
            { params },
        )
        return data
    },
}