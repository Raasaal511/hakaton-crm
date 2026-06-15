import type { ColumnPolicies } from './departmentPoliciesConfig'

export type Column = {
  id: number
  name: string
  position: number
  departmentId: number
  pipelineId?: number
  policies?: ColumnPolicies
  color?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

export type CreateColumnDTO = {
  name: string
  position: number
  departmentId: number
  pipelineId?: number
  color?: string | null
}

export type UpdateColumnDTO = {
  name?: string
  position?: number
  color?: string | null
}

export type ReorderColumnsDTO = {
  columnIds: number[]
}
