import type { Pipeline } from '../../infra/database/drizzle/schema.js'

export type CreatePipelineDTO = Pick<Pipeline, 'name' | 'departmentId'> & {
  isMainTemplate?: boolean
}

export type UpdatePipelineDTO = Partial<Pick<Pipeline, 'name'>>

