import type { Pipeline, PipelineTemplate, FavoritePipelineLink } from '../../types/pipelines'
import type { ColumnPolicies, PipelinePolicies } from '../../types/departmentPoliciesConfig'
import { axiosAPI } from '../axios'

export const pipelinesAPI = {
  getAll: async (departmentId: number) => {
    const { data } = await axiosAPI.get<Pipeline[]>(`/departments/${departmentId}/pipelines`)
    return data
  },

  create: async (departmentId: number, name: string) => {
    const { data } = await axiosAPI.post<Pipeline>(`/departments/${departmentId}/pipelines`, {
      name,
      departmentId,
    })
    return data
  },

  /** Каталог готовых шаблонов воронок (IT-проект, баг-трекер, продажи и т.п.). */
  getTemplates: async () => {
    const { data } = await axiosAPI.get<PipelineTemplate[]>('/pipeline-templates')
    return data
  },

  /** Создание воронки на основе шаблона. `name` — опциональное переопределение имени. */
  createFromTemplate: async (departmentId: number, templateKey: string, name?: string) => {
    const { data } = await axiosAPI.post<Pipeline>(
      `/departments/${departmentId}/pipelines/from-template`,
      {
        templateKey,
        ...(name != null && name.trim() !== '' ? { name: name.trim() } : {}),
      },
    )
    return data
  },

  /** Все избранные воронки пользователя во всех доступных организациях. */
  listAllFavoritePipelines: async (options?: { signal?: AbortSignal }) => {
    const { data } = await axiosAPI.get<FavoritePipelineLink[]>('/favorite-pipelines', {
      signal: options?.signal,
    })
    return data
  },

  /** Персональные избранные воронки в организации (для кэша текущего пространства). */
  listFavoritePipelines: async (organizationId: number, options?: { signal?: AbortSignal }) => {
    const { data } = await axiosAPI.get<FavoritePipelineLink[]>(
      `/organizations/${organizationId}/favorite-pipelines`,
      { signal: options?.signal },
    )
    return data
  },

  addFavoritePipeline: async (pipelineId: number) => {
    const { data } = await axiosAPI.post<FavoritePipelineLink>(`/pipelines/${pipelineId}/favorite`)
    return data
  },

  removeFavoritePipeline: async (pipelineId: number) => {
    await axiosAPI.delete(`/pipelines/${pipelineId}/favorite`)
  },

  update: async (id: number, name: string) => {
    const { data } = await axiosAPI.patch<Pipeline>(`/pipelines/${id}`, { name })
    return data
  },

  delete: async (id: number) => {
    await axiosAPI.delete(`/pipelines/${id}`)
  },

  getPolicies: async (id: number) => {
    const { data } = await axiosAPI.get<{ policies: PipelinePolicies }>(`/pipelines/${id}/policies`)
    return data.policies
  },

  updatePolicies: async (id: number, policies: Partial<PipelinePolicies>) => {
    const { data } = await axiosAPI.patch<{ policies: PipelinePolicies }>(
      `/pipelines/${id}/policies`,
      { policies },
    )
    return data.policies
  },

  updateColumnsPolicies: async (
    id: number,
    columns: Array<{ columnId: number; policies: Partial<ColumnPolicies> }>,
  ) => {
    const { data } = await axiosAPI.patch<{
      columns: Array<{ columnId: number; policies: ColumnPolicies }>
    }>(`/pipelines/${id}/columns/policies`, { columns })
    return data.columns
  },
}

