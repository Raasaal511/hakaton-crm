import { axiosAPI } from '../axios'
import type {
  Project,
  ProjectMember,
  ProjectListResponse,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectListFilter,
} from '../../types/projects'

export const projectsAPI = {
  list: async (orgId: number, filter?: ProjectListFilter): Promise<ProjectListResponse> => {
    const { data } = await axiosAPI.get<ProjectListResponse>('/projects', {
      params: { orgId, ...filter },
    })
    return data
  },

  create: async (orgId: number, dto: CreateProjectDTO): Promise<Project> => {
    const { data } = await axiosAPI.post<Project>('/projects', dto, {
      params: { orgId },
    })
    return data
  },

  getById: async (orgId: number, id: number): Promise<Project> => {
    const { data } = await axiosAPI.get<Project>(`/projects/${id}`, {
      params: { orgId },
    })
    return data
  },

  update: async (orgId: number, id: number, dto: UpdateProjectDTO): Promise<Project> => {
    const { data } = await axiosAPI.patch<Project>(`/projects/${id}`, dto, {
      params: { orgId },
    })
    return data
  },

  delete: async (orgId: number, id: number): Promise<void> => {
    await axiosAPI.delete(`/projects/${id}`, { params: { orgId } })
  },

  getMembers: async (orgId: number, id: number): Promise<ProjectMember[]> => {
    const { data } = await axiosAPI.get<ProjectMember[]>(`/projects/${id}/members`, {
      params: { orgId },
    })
    return data
  },

  addMember: async (orgId: number, id: number, userId: number, role = 'member'): Promise<ProjectMember[]> => {
    const { data } = await axiosAPI.post<ProjectMember[]>(
      `/projects/${id}/members`,
      { userId, role },
      { params: { orgId } },
    )
    return data
  },

  removeMember: async (orgId: number, id: number, userId: number): Promise<void> => {
    await axiosAPI.delete(`/projects/${id}/members/${userId}`, { params: { orgId } })
  },
}
