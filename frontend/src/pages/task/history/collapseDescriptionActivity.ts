import type { TaskActivityItem } from 'shared/types/taskActivity'

function isDescriptionOnlyUpdate(item: TaskActivityItem): boolean {
  if (item.kind !== 'updated') return false
  const raw = item.payload?.changes
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.every(
    (c) =>
      c != null &&
      typeof c === 'object' &&
      (c as { field?: string }).field === 'description',
  )
}

function actorKey(item: TaskActivityItem): number | 'none' {
  const id = item.actor?.id
  return id != null && Number.isFinite(id) ? id : 'none'
}

/**
 * Лента с сервера приходит от новых к старым (`id DESC`).
 * Подряд идущие «обновление только описания» от одного пользователя заменяем
 * одной строкой — самым новым событием в серии (то же тело ответа API).
 */
export function collapseConsecutiveDescriptionUpdates(
  items: TaskActivityItem[],
): TaskActivityItem[] {
  const out: TaskActivityItem[] = []
  let i = 0
  while (i < items.length) {
    const cur = items[i]
    if (!isDescriptionOnlyUpdate(cur)) {
      out.push(cur)
      i += 1
      continue
    }

    const key = actorKey(cur)
    let j = i + 1
    while (j < items.length) {
      const next = items[j]
      if (!isDescriptionOnlyUpdate(next) || actorKey(next) !== key) break
      j += 1
    }

    out.push(cur)
    i = j
  }
  return out
}
