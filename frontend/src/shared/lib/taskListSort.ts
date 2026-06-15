import type { Task } from 'shared/types/tasks'

/** Сортировка строк списка «Мои задачи» / «Все задачи» (совпадает с query `sort` на API). */
export type MyTasksListSortMode = 'bucket' | 'deadline_asc' | 'deadline_desc'

/** Сортировка таблицы на доске воронки (клиент). */
export type PipelineBoardListSortMode = 'column' | 'deadline_asc' | 'deadline_desc'

/** `null` — нет срока; такие задачи в конце при сортировке по дедлайну. */
export function taskDeadlineSortKey(task: Task): number | null {
  if (task.deadLine == null || String(task.deadLine).trim() === '') return null
  const n = Date.parse(String(task.deadLine))
  return Number.isNaN(n) ? null : n
}

/**
 * Стабильная сортировка по сроку: без срока в конце; при равном сроке — больший id выше (как на бэкенде).
 */
export function compareTaskRowsByDeadline(
  a: Task,
  b: Task,
  direction: 'asc' | 'desc',
): number {
  const ta = taskDeadlineSortKey(a)
  const tb = taskDeadlineSortKey(b)
  const aNull = ta == null
  const bNull = tb == null
  if (aNull && bNull) return b.id - a.id
  if (aNull) return 1
  if (bNull) return -1
  const cmp = ta - tb
  if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
  return b.id - a.id
}
