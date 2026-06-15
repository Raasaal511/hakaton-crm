import { axiosAPI } from '../axios'
import type { Organization } from '../../types/organization'

export type AdminStats = {
  organizations: number
  users: number
  tasks: number
  departments: number
}

export const adminAPI = {
  getStats: async () => {
    const { data } = await axiosAPI.get<AdminStats>('/admin/stats')
    return data
  },
  getAllOrganizations: async () => {
    const { data } = await axiosAPI.get<Organization[]>('/admin/organizations')
    return data
  },
}
