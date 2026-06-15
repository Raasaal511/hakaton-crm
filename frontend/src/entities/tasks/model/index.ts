import { createStore, createEffect, sample, createEvent } from 'effector'
import { useUnit } from 'effector-react'
import {
  setTasks,
  setTasksForColumns,
  addTask,
  editTask,
  delTask,
  reorderTasks,
  clearTasks,
  setColumnTaskTotals,
  moveColumnTaskTotal,
} from 'shared/api/events/tasks'
import type { Task, PipelineBoardTaskFilter } from 'shared/types/tasks'
import { tasksAPI } from 'shared/api/requests/tasks'

type TasksState = Record<number, Task[]>

/** Задач за один запрос к API для колонки на доске воронки. */
export const PIPELINE_COLUMN_PAGE_SIZE = 12
/** Верхняя граница limit на бэкенде (GET /columns/:id/tasks). */
export const PIPELINE_COLUMN_MAX_PAGE = 200

const delTaskForTotal = createEvent<{ columnId: number }>()

async function fetchSingleColumnTasksAllPages(
  columnId: number,
  filter: PipelineBoardTaskFilter,
): Promise<{ tasks: Task[]; total: number }> {
  const limit = PIPELINE_COLUMN_MAX_PAGE
  const acc: Task[] = []
  let offset = 0
  let total = 0
  for (;;) {
    const { items, total: t } = await tasksAPI.getByColumnPaginated(columnId, {
      limit,
      offset,
      filter,
    })
    if (offset === 0) total = t
    acc.push(...items)
    offset += items.length
    if (items.length === 0 || offset >= total) break
  }
  acc.sort((a, b) => a.position - b.position || a.id - b.id)
  return { tasks: acc, total }
}

export const $tasksStore = createStore<TasksState>({})
  .on(setTasks, (state, { columnId, tasks }) => ({
    ...state,
    [columnId]: tasks,
  }))
  .on(setTasksForColumns, (state, tasksByColumn) => ({
    ...state,
    ...tasksByColumn,
  }))
  .on(addTask, (state, task) => {
    const list = state[task.columnId] ?? []
    return { ...state, [task.columnId]: [...list, task] }
  })
  .on(editTask, (state, task) => {
    const next: TasksState = {}
    for (const [key, list] of Object.entries(state)) {
      const columnId = Number(key)
      next[columnId] = list.filter((t) => t.id !== task.id)
    }
    const targetList = next[task.columnId] ?? []
    const pos = Math.max(0, Math.min(task.position, targetList.length))
    next[task.columnId] = [...targetList.slice(0, pos), task, ...targetList.slice(pos)]
    return next
  })
  .on(delTask, (state, id) => {
    const next: TasksState = {}
    for (const [key, list] of Object.entries(state)) {
      const columnId = Number(key)
      next[columnId] = list.filter((t) => t.id !== id)
    }
    return next
  })
  .on(reorderTasks, (state, { columnId, taskIds }) => {
    const list = state[columnId] ?? []
    const byId = new Map(list.map((t) => [t.id, t]))
    const idSet = new Set(taskIds)
    const reordered = taskIds
      .map((id, position) => {
        const task = byId.get(id)
        return task ? { ...task, position } : null
      })
      .filter((t): t is Task => t !== null)

    const tail = list.filter((t) => !idSet.has(t.id))
    const offset = reordered.length
    const tailRepositioned = tail.map((t, i) => ({ ...t, position: offset + i }))
    return { ...state, [columnId]: [...reordered, ...tailRepositioned] }
  })
  .on(clearTasks, () => ({}))

export const $columnTaskTotals = createStore<Record<number, number>>({})
  .on(setColumnTaskTotals, (s, p) => ({ ...s, ...p }))
  .on(clearTasks, () => ({}))
  .on(addTask, (s, t) => {
    if (t.columnId == null) return s
    return { ...s, [t.columnId]: (s[t.columnId] ?? 0) + 1 }
  })
  .on(delTaskForTotal, (s, { columnId }) => ({
    ...s,
    [columnId]: Math.max(0, (s[columnId] ?? 0) - 1),
  }))
  .on(moveColumnTaskTotal, (s, { from, to }) => {
    if (from === to) return s
    return {
      ...s,
      [from]: Math.max(0, (s[from] ?? 0) - 1),
      [to]: (s[to] ?? 0) + 1,
    }
  })

sample({
  clock: delTask,
  source: $tasksStore,
  filter: (state, id: number) => {
    for (const list of Object.values(state)) {
      if (list.some((t) => t.id === id)) return true
    }
    return false
  },
  fn: (state, id) => {
    for (const [key, list] of Object.entries(state)) {
      if (list.some((t) => t.id === id)) {
        return { columnId: Number(key) }
      }
    }
    return { columnId: 0 }
  },
  target: delTaskForTotal,
})


export const fetchPipelineColumnTasksFirstPageFx = createEffect(
  async (payload: { columnIds: number[]; filter: PipelineBoardTaskFilter }) => {
    const { columnIds, filter } = payload
    if (columnIds.length === 0) {
      return { byColumn: {} as Record<number, Task[]>, totals: {} as Record<number, number> }
    }
    const results = await Promise.all(
      columnIds.map((cid) =>
        tasksAPI.getByColumnPaginated(cid, {
          limit: PIPELINE_COLUMN_PAGE_SIZE,
          offset: 0,
          filter,
        }),
      ),
    )
    const byColumn: Record<number, Task[]> = {}
    const totals: Record<number, number> = {}
    columnIds.forEach((cid, i) => {
      const { items, total } = results[i]!
      byColumn[cid] = items
      totals[cid] = total
    })
    return { byColumn, totals }
  },
)

export const appendColumnTasksPageFx = createEffect(
  async (payload: { columnId: number; filter: PipelineBoardTaskFilter }) => {
    const { columnId, filter } = payload
    const list = $tasksStore.getState()[columnId] ?? []
    const offset = list.length
    const { items, total } = await tasksAPI.getByColumnPaginated(columnId, {
      limit: PIPELINE_COLUMN_PAGE_SIZE,
      offset,
      filter,
    })
    const byId = new Map(list.map((t) => [t.id, t]))
    for (const t of items) {
      byId.set(t.id, t)
    }
    const merged = [...byId.values()].sort((a, b) => a.position - b.position)
    return { columnId, tasks: merged, total }
  },
)

fetchPipelineColumnTasksFirstPageFx.doneData.watch(({ byColumn, totals }) => {
  setTasksForColumns(byColumn)
  setColumnTaskTotals(totals)
})

appendColumnTasksPageFx.doneData.watch(({ columnId, tasks, total }) => {
  setTasks({ columnId, tasks })
  setColumnTaskTotals({ [columnId]: total })
})

/**
 * Полная выгрузка задач колонок для табличного вида доски (несколько страниц до total).
 */
export const fetchPipelineColumnTasksAllPagesFx = createEffect(
  async (payload: { columnIds: number[]; filter: PipelineBoardTaskFilter }) => {
    const { columnIds, filter } = payload
    if (columnIds.length === 0) {
      return { byColumn: {} as Record<number, Task[]>, totals: {} as Record<number, number> }
    }
    const pairs = await Promise.all(
      columnIds.map(async (cid) => {
        const r = await fetchSingleColumnTasksAllPages(cid, filter)
        return [cid, r] as const
      }),
    )
    const byColumn: Record<number, Task[]> = {}
    const totals: Record<number, number> = {}
    for (const [cid, r] of pairs) {
      byColumn[cid] = r.tasks
      totals[cid] = r.total
    }
    return { byColumn, totals }
  },
)

fetchPipelineColumnTasksAllPagesFx.doneData.watch(({ byColumn, totals }) => {
  setTasksForColumns(byColumn)
  setColumnTaskTotals(totals)
})

export const useTasksByColumn = (columnId: number) =>
  useUnit($tasksStore.map((state) => state[columnId] ?? []))

/** `total`: null = ещё не пришла первая страница; 0 = пустая колонка. `undefined` в map() нельзя — Effector трактует как skip. */
export const useColumnTaskMeta = (columnId: number) => {
  const total = useUnit($columnTaskTotals.map((s) => s[columnId] ?? null))
  const tasks = useUnit($tasksStore.map((s) => s[columnId] ?? []))
  return { total, loaded: tasks.length }
}

export const selectors = {
  useTasksByColumn,
  useColumnTaskMeta,
}
