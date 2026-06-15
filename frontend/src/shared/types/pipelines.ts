import type { PipelinePolicies } from './departmentPoliciesConfig'

export type Pipeline = {
  id: number
  name: string
  departmentId: number
  policies?: PipelinePolicies
  /** Системная «Основная воронка» с фиксированными колонками */
  isMainTemplate?: boolean
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

/** Превью колонки в шаблоне воронки. */
export type PipelineTemplateColumn = {
  name: string
  color: string | null
}

/** Готовый шаблон для быстрого создания воронки (IT-проект, баг-трекер и т.п.). */
export type PipelineTemplate = {
  key: string
  name: string
  description: string
  icon: string
  columns: PipelineTemplateColumn[]
}

/** Связка «воронка + отдел» для избранного; при сводном списке добавляются поля организации. */
export type FavoritePipelineLink = {
  pipelineId: number
  pipelineName: string
  departmentId: number
  departmentName: string
  organizationId?: number
  organizationName?: string
}

