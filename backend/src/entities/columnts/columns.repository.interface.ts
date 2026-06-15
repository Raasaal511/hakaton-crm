import type { Column } from "../../infra/database/drizzle/schema.js"
import type { CreateColumnDTO, UpdateColumnDTO } from "./columns.types.js"
export interface IColumnsRepository {
  getColumnsByDepartmentId(departmentId: number): Promise<Column[]>
  getColumnsByPipelineId(pipelineId: number): Promise<Column[]>
  getColumnById(columnId: number): Promise<Column | undefined>
  createColumn(dto: CreateColumnDTO): Promise<Column>
  updateColumn(dto: UpdateColumnDTO & { id: number }): Promise<Column>
  softDeleteColumn(columnId: number): Promise<void>
  reorderColumns(departmentId: number, columnIds: number[]): Promise<void>
  reorderColumnsByPipeline(pipelineId: number, columnIds: number[]): Promise<void>
}