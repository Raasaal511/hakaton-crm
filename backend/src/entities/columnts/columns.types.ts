import type { Column } from "../../infra/database/drizzle/schema.js";

export type CreateColumnDTO = Pick<Column, 'name' | 'position' | 'departmentId'> & {
  color?: Column['color']
  pipelineId?: Column['pipelineId']
}

export type UpdateColumnDTO = Partial<Pick<Column, 'name' | 'position' | 'color'>> 