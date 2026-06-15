import type { Column } from 'shared/types/columns'

export function isTaskInCompletedPipelineColumn(taskColumnId: number, columns: Column[]): boolean {
  const col = columns.find((c) => c.id === taskColumnId)
  if (col == null || col.pipelineId == null) return false
  const samePipeline = columns.filter((c) => c.pipelineId === col.pipelineId)
  if (samePipeline.length === 0) return false
  const maxPos = Math.max(...samePipeline.map((c) => c.position))
  return col.position === maxPos
}
