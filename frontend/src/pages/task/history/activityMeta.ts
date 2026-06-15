import {
  Activity as ActivityIcon,
  ArrowRightLeft,
  Paperclip,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
  Undo2,
  Users as UsersIcon,
  X as XIcon,
} from 'lucide-react'
import type { TaskActivityItem } from 'shared/types/taskActivity'
import type { ActivityMeta, UserRef } from './types'

export const ACTIVITY_KIND_META: Record<string, ActivityMeta> = {
  created: {
    label: 'Создание',
    verb: 'создал(а) задачу',
    Icon: Plus,
    tone: 'success',
    hasDetails: true,
  },
  updated: {
    label: 'Обновление',
    verb: 'обновил(а) поля',
    Icon: Pencil,
    tone: 'info',
    hasDetails: true,
  },
  moved: {
    label: 'Перенос',
    verb: 'перенёс(ла) задачу',
    Icon: ArrowRightLeft,
    tone: 'purple',
    hasDetails: false,
  },
  assignees: {
    label: 'Исполнители',
    verb: 'изменил(а) исполнителей',
    Icon: UsersIcon,
    tone: 'accent',
    hasDetails: false,
  },
  tags: {
    label: 'Метки',
    verb: 'обновил(а) метки',
    Icon: TagIcon,
    tone: 'pink',
    hasDetails: false,
  },
  attachment_added: {
    label: 'Файл прикреплён',
    verb: 'прикрепил(а) файл',
    Icon: Paperclip,
    tone: 'info',
    hasDetails: false,
  },
  attachment_removed: {
    label: 'Файл удалён',
    verb: 'удалил(а) файл',
    Icon: Paperclip,
    tone: 'danger',
    hasDetails: false,
  },
  send_back: {
    label: 'Возврат на доработку',
    verb: 'вернул(а) задачу на доработку',
    Icon: Undo2,
    tone: 'warning',
    hasDetails: false,
  },
  reject_review: {
    label: 'Отклонение с проверки',
    verb: 'отклонил(а) задачу с проверки',
    Icon: XIcon,
    tone: 'danger',
    hasDetails: false,
  },
  deleted: {
    label: 'Удаление',
    verb: 'удалил(а) задачу',
    Icon: Trash2,
    tone: 'danger',
    hasDetails: false,
  },
}

export function getActivityMeta(kind: string): ActivityMeta {
  return (
    ACTIVITY_KIND_META[kind] ?? {
      label: kind,
      verb: 'выполнил(а) действие',
      Icon: ActivityIcon,
      tone: 'neutral',
      hasDetails: false,
    }
  )
}

/** Две строки: колонка и контекст (воронка · отдел) — компактнее в узкой колонке истории. */
export function getColumnPlaceParts(p: unknown): { primary: string; secondary: string } | null {
  if (!p || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  const column = o.columnName != null ? String(o.columnName).trim() : ''
  const pipeline = o.pipelineName != null ? String(o.pipelineName).trim() : ''
  const department = o.departmentName != null ? String(o.departmentName).trim() : ''
  if (!column && !pipeline && !department) return null
  if (column) {
    const secondary = [pipeline, department].filter(Boolean).join(' · ')
    return { primary: column, secondary }
  }
  if (pipeline) {
    return { primary: pipeline, secondary: department }
  }
  return { primary: department, secondary: '' }
}

export function formatColumnPlace(p: unknown): string {
  const parsed = getColumnPlaceParts(p)
  if (!parsed) return '—'
  return [parsed.primary, parsed.secondary].filter(Boolean).join(' · ')
}

export function userRefName(u: UserRef): string {
  if (u.firstname || u.lastname) {
    return `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim()
  }
  return u.name ?? '—'
}

export function arrayDiff<T extends { id?: number; name?: string }>(
  before: T[],
  after: T[],
): { added: T[]; removed: T[] } {
  const key = (x: T) => (x.id != null ? `id:${x.id}` : `name:${x.name ?? ''}`)
  const beforeKeys = new Set(before.map(key))
  const afterKeys = new Set(after.map(key))
  return {
    added: after.filter((x) => !beforeKeys.has(key(x))),
    removed: before.filter((x) => !afterKeys.has(key(x))),
  }
}

export function actorInitial(item: TaskActivityItem): string {
  if (!item.actor) return 'С'
  const fi = item.actor.firstname?.[0]
  const li = item.actor.lastname?.[0]
  return (fi || li || '?').toUpperCase()
}

export function actorDisplayName(item: TaskActivityItem): string {
  if (!item.actor) return 'Система'
  return `${item.actor.firstname ?? ''} ${item.actor.lastname ?? ''}`.trim() || 'Пользователь'
}
