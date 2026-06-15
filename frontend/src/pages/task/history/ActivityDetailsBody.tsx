import { ArrowRight } from 'lucide-react'
import type { TaskActivityItem } from 'shared/types/taskActivity'
import styles from '../TaskPage.module.css'
import { ActivityChip } from './ActivityChip'
import { formatColumnPlace, userRefName } from './activityMeta'
import { formatActivityDiffValue, formatActivitySnapshotDate } from './formatActivityDate'
import type { TagRef, UserRef } from './types'

export function ActivityDetailsBody({ item }: { item: TaskActivityItem }) {
  const p = item.payload

  if (item.kind === 'created') {
    const snap = p.snapshot as Record<string, unknown> | undefined
    if (!snap) {
      return <pre className={styles.activityJson}>{JSON.stringify(p, null, 2)}</pre>
    }
    const rows: { label: string; value: string }[] = [
      { label: 'Название', value: String(snap.name ?? '—') },
      { label: 'Колонка', value: formatColumnPlace(snap.column) },
      {
        label: 'Исполнители',
        value: Array.isArray(snap.assignees)
          ? (snap.assignees as UserRef[]).map(userRefName).filter(Boolean).join(', ') || '—'
          : '—',
      },
      {
        label: 'Метки',
        value: Array.isArray(snap.tags)
          ? (snap.tags as TagRef[]).map((t) => t.name).filter(Boolean).join(', ') || '—'
          : '—',
      },
      { label: 'Дата начала', value: formatActivitySnapshotDate(snap.startDate) },
      { label: 'Срок', value: formatActivitySnapshotDate(snap.deadLine) },
      {
        label: 'Описание',
        value:
          snap.descriptionPreview != null && String(snap.descriptionPreview).trim()
            ? 'Задано при создании'
            : '—',
      },
    ]
    return (
      <dl className={styles.activityDl}>
        {rows.map((r) => (
          <div key={r.label} className={styles.activityDlRow}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  if (item.kind === 'updated') {
    const changes = p.changes as
      | { field?: string; label?: string; from?: string | null; to?: string | null }[]
      | undefined
    if (!Array.isArray(changes) || changes.length === 0) {
      return <pre className={styles.activityJson}>{JSON.stringify(p, null, 2)}</pre>
    }
    return (
      <ul className={styles.activityDiffList}>
        {changes.map((c, i) =>
          c.field === 'description' ? (
            <li key={`${c.field ?? i}-${i}`} className={styles.activityDiffItem}>
              <div className={styles.activityDiffLabel}>{c.label ?? 'Описание'}</div>
              <p className={styles.activityDiffDescriptionNote}>Текст описания был изменён.</p>
            </li>
          ) : (
            <li key={`${c.field ?? i}-${i}`} className={styles.activityDiffItem}>
              <div className={styles.activityDiffLabel}>{c.label ?? c.field ?? 'Поле'}</div>
              <div className={styles.activityDiffValues}>
                <ActivityChip>
                  {formatActivityDiffValue(c.field, c.from ?? null)}
                </ActivityChip>
                <ArrowRight size={14} className={styles.activityArrow} aria-hidden />
                <ActivityChip variant="accent">
                  {formatActivityDiffValue(c.field, c.to ?? null)}
                </ActivityChip>
              </div>
            </li>
          ),
        )}
      </ul>
    )
  }

  return <pre className={styles.activityJson}>{JSON.stringify(p, null, 2)}</pre>
}
