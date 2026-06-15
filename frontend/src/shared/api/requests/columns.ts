import type { Column, CreateColumnDTO, UpdateColumnDTO } from '../../types/columns'
import { axiosAPI } from '../axios'

export const columnsAPI = {
    getAll: async (departmentId: number) => {
        const { data } = await axiosAPI.get<Column[]>(`/departments/${departmentId}/columns`)
        return data
    },

    getByPipeline: async (pipelineId: number, options?: { signal?: AbortSignal }) => {
        const { data } = await axiosAPI.get<Column[]>(`/pipelines/${pipelineId}/columns`, {
            signal: options?.signal,
        })
        return data
    },

    create: async (departmentId: number, dto: Omit<CreateColumnDTO, 'departmentId'> & { pipelineId?: number }) => {
        const { data } = await axiosAPI.post<Column>(
            `/departments/${departmentId}/columns`,
            {
                name: dto.name,
                position: dto.position,
                color: dto.color,
                pipelineId: dto.pipelineId,
            }
        )
        return data
    },

    update: async (departmentId: number, columnId: number, dto: UpdateColumnDTO) => {
        const { data } = await axiosAPI.patch<Column>(
            `/departments/${departmentId}/columns/${columnId}`,
            dto
        )
        return data
    },

    delete: async (departmentId: number, columnId: number) => {
        await axiosAPI.delete(
            `/departments/${departmentId}/columns/${columnId}`
        )
    },

    reorder: async (departmentId: number, columnIds: number[]) => {
        await axiosAPI.patch(
            `/departments/${departmentId}/columns/reorder`,
            { columnIds }
        )
    },
}
