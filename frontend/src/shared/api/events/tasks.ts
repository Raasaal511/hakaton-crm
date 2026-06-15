import { createEvent } from 'effector'
import type { Task } from 'shared/types/tasks'

export const setTasks = createEvent<{ columnId: number; tasks: Task[] }>()
export const setTasksForColumns = createEvent<Record<number, Task[]>>()
export const addTask = createEvent<Task>()
export const editTask = createEvent<Task>()
export const delTask = createEvent<number>()
export const reorderTasks = createEvent<{ columnId: number; taskIds: number[] }>()
export const clearTasks = createEvent()

/** Число задач в колонке (по правам), приходит с пагинированного GET /columns/:id/tasks */
export const setColumnTaskTotals = createEvent<Record<number, number>>()

/**
 * Оптимистическое перемещение 1 задачи между колонками в счётчиках `$columnTaskTotals`.
 * Нужно, т.к. sample на clock=editTask читает state ПОСЛЕ .on и не видит старую колонку задачи.
 * Вызывается вручную отовсюду, где меняется columnId задачи (DnD, формы редактирования).
 */
export const moveColumnTaskTotal = createEvent<{ from: number; to: number }>()

