import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import {
  TaskActivityRepository,
  type TaskActivityListRow,
} from '../infra/database/drizzle/task-activity/task-activity.repository.js'

@injectable()
export class TaskActivityService {
  constructor(
    @inject(TYPES.TaskActivityRepository) private repo: TaskActivityRepository,
  ) {}

  append(taskId: number, actorUserId: number, kind: string, payload: Record<string, unknown>): Promise<void> {
    return this.repo.insert({ taskId, actorUserId, kind, payload })
  }

  listForTask(
    taskId: number,
    opts: { limit: number; beforeId?: number },
  ): Promise<TaskActivityListRow[]> {
    return this.repo.listByTaskId(taskId, opts)
  }
}
