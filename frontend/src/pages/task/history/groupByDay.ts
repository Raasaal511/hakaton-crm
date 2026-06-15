import { format, isSameDay, isToday, isYesterday, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { TaskActivityItem } from 'shared/types/taskActivity'
import { parseActivityDateString } from './formatActivityDate'

export function formatDayHeader(date: Date): string {
  if (isToday(date)) return 'Сегодня'
  if (isYesterday(date)) return 'Вчера'
  return format(date, 'd MMMM yyyy', { locale: ru })
}

export function groupActivityByDay(items: TaskActivityItem[]): {
  key: string
  label: string
  items: TaskActivityItem[]
}[] {
  const groups: { key: string; label: string; date: Date; items: TaskActivityItem[] }[] = []
  for (const it of items) {
    const date = it.createdAt ? parseActivityDateString(it.createdAt) : null
    if (!date || Number.isNaN(date.getTime())) {
      const last = groups[groups.length - 1]
      if (last && last.key === 'unknown') {
        last.items.push(it)
      } else {
        groups.push({
          key: 'unknown',
          label: 'Без даты',
          date: new Date(0),
          items: [it],
        })
      }
      continue
    }
    const day = startOfDay(date)
    const key = format(day, 'yyyy-MM-dd')
    const last = groups[groups.length - 1]
    if (last && last.key === key && isSameDay(last.date, day)) {
      last.items.push(it)
    } else {
      groups.push({ key, label: formatDayHeader(day), date: day, items: [it] })
    }
  }
  return groups.map((g) => ({ key: g.key, label: g.label, items: g.items }))
}
