export type ColDragId = `col-${number}`
export type TaskDragId = `task-${number}`

export const makeColId = (id: number): ColDragId => `col-${id}` as const
export const makeTaskId = (id: number): TaskDragId => `task-${id}` as const

export const parseColId = (id: ColDragId | string | number): number =>
  typeof id === 'string' && id.startsWith('col-') ? Number(id.slice(4)) : Number(id)

export const parseTaskId = (id: TaskDragId | string | number): number =>
  typeof id === 'string' && id.startsWith('task-') ? Number(id.slice(5)) : Number(id)

