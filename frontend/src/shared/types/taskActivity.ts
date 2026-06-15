export type TaskActivityActor = {
  id: number
  firstname: string
  lastname: string
}

export type TaskActivityItem = {
  id: number
  taskId: number
  kind: string
  payload: Record<string, unknown>
  createdAt: string | null
  actor: TaskActivityActor | null
}
