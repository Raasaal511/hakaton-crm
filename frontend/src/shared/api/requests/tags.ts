import type { Tag } from 'shared/types/tags'
import { axiosAPI } from '../axios'

export const tagsAPI = {
  getByDepartment: async (departmentId: number) => {
    const { data } = await axiosAPI.get<Tag[]>(`/departments/${departmentId}/tags`)
    return data
  },

  searchByDepartment: async (departmentId: number, query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return []

    const { data } = await axiosAPI.get<Tag[]>(`/departments/${departmentId}/tags/search`, {
      params: { query: trimmed },
    })
    return data
  },

  getByTask: async (taskId: number) => {
    const { data } = await axiosAPI.get<Tag[]>(`/tasks/${taskId}/tags`)
    return data
  },

  setForTask: async (taskId: number, tagIds: number[]) => {
    await axiosAPI.patch(`/tasks/${taskId}/tags`, { tagIds })
  },

  create: async (organizationId: number, name: string) => {
    const { data } = await axiosAPI.post<Tag>(`/organizations/${organizationId}/tags`, {
      name,
    })
    return data
  },

  createByDepartment: async (departmentId: number, name: string) => {
    const { data } = await axiosAPI.post<Tag>(`/departments/${departmentId}/tags`, { name })
    return data
  },

  updateByDepartment: async (departmentId: number, tagId: number, name: string) => {
    const { data } = await axiosAPI.patch<Tag>(`/departments/${departmentId}/tags/${tagId}`, {
      name,
    })
    return data
  },

  deleteByDepartment: async (departmentId: number, tagId: number) => {
    await axiosAPI.delete(`/departments/${departmentId}/tags/${tagId}`)
  },
}

