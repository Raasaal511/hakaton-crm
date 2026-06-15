import type { Pipeline } from '../../infra/database/drizzle/schema.js'
import type { CreatePipelineDTO, UpdatePipelineDTO } from './pipelines.types.js'
export interface IPipelinesRepository {
  getPipelinesByDepartmentId(departmentId: number): Promise<Pipeline[]>
  getPipelineById(id: number): Promise<Pipeline | undefined>
  createPipeline(dto: CreatePipelineDTO): Promise<Pipeline>
  updatePipeline(dto: UpdatePipelineDTO & { id: number }): Promise<Pipeline>
  softDeletePipeline(id: number): Promise<void>
}

