import { ArrowRight, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { TaskActivityItem } from 'shared/types/taskActivity'
import styles from '../TaskPage.module.css'
import { ActivityChip } from './ActivityChip'
import { arrayDiff, formatColumnPlace, getColumnPlaceParts, userRefName } from './activityMeta'
import { formatActivityDiffValue } from './formatActivityDate'
import type { TagRef, UserRef } from './types'

function ColumnPlaceInChip({ place }: { place: unknown }) {
  const parts = getColumnPlaceParts(place)
  if (!parts) return <>—</>
  return (
    <>
      <span className={styles.activityColumnPlacePrimary}>{parts.primary}</span>
      {parts.secondary ? (
        <span className={styles.activityColumnPlaceSecondary}>{parts.secondary}</span>
      ) : null}
    </>
  )
}

export function ActivityInlineSummary({ item }: { item: TaskActivityItem }) {
  const p = item.payload

  if (item.kind === 'moved') {
    return (
      <div className={styles.activityFlowMove}>
        <ActivityChip place title={formatColumnPlace(p.from)}>
          <ColumnPlaceInChip place={p.from} />
        </ActivityChip>
        <div className={styles.activityFlowMoveArrow} aria-hidden>
          <ChevronDown size={14} className={styles.activityArrow} />
        </div>
        <ActivityChip place variant="accent" title={formatColumnPlace(p.to)}>
          <ColumnPlaceInChip place={p.to} />
        </ActivityChip>
      </div>
    )
  }

  if (item.kind === 'attachment_added' || item.kind === 'attachment_removed') {
    if (typeof p.fileName !== 'string' || !p.fileName) return null
    return (
      <div className={styles.activityFlowRow}>
        <ActivityChip>
          <FileText size={13} aria-hidden />
          {p.fileName}
        </ActivityChip>
      </div>
    )
  }

  if (item.kind === 'deleted') {
    if (typeof p.name !== 'string' || !p.name) return null
    return (
      <div className={styles.activityFlowRow}>
        <ActivityChip>{p.name}</ActivityChip>
      </div>
    )
  }

  if (item.kind === 'send_back' || item.kind === 'reject_review') {
    const comment = typeof p.comment === 'string' ? p.comment : ''
    const fromLabel = formatColumnPlace(p.from)
    const toLabel = formatColumnPlace(p.to)
    return (
      <div className={styles.activitySummaryStack}>
        {comment ? <blockquote className={styles.activityQuote}>{comment}</blockquote> : null}
        {fromLabel !== '—' || toLabel !== '—' ? (
          <div className={styles.activityFlowMove}>
            <ActivityChip place title={fromLabel}>
              <ColumnPlaceInChip place={p.from} />
            </ActivityChip>
            <div className={styles.activityFlowMoveArrow} aria-hidden>
              <ChevronDown size={14} className={styles.activityArrow} />
            </div>
            <ActivityChip place variant="accent" title={toLabel}>
              <ColumnPlaceInChip place={p.to} />
            </ActivityChip>
          </div>
        ) : null}
      </div>
    )
  }

  if (item.kind === 'assignees') {
    const before = Array.isArray(p.before) ? (p.before as UserRef[]) : []
    const after = Array.isArray(p.after) ? (p.after as UserRef[]) : []
    const { added, removed } = arrayDiff(before, after)
    if (added.length === 0 && removed.length === 0) return null
    return (
      <div className={styles.activityFlowRow}>
        {added.map((u) => (
          <ActivityChip key={`a-${u.id ?? userRefName(u)}`} variant="positive">
            + {userRefName(u)}
          </ActivityChip>
        ))}
        {removed.map((u) => (
          <ActivityChip key={`r-${u.id ?? userRefName(u)}`} variant="negative">
            − {userRefName(u)}
          </ActivityChip>
        ))}
      </div>
    )
  }

  if (item.kind === 'tags') {
    const before = Array.isArray(p.before) ? (p.before as TagRef[]) : []
    const after = Array.isArray(p.after) ? (p.after as TagRef[]) : []
    const { added, removed } = arrayDiff(before, after)
    if (added.length === 0 && removed.length === 0) return null
    return (
      <div className={styles.activityFlowRow}>
        {added.map((t) => (
          <ActivityChip key={`a-${t.id ?? t.name}`} variant="positive">
            + {t.name ?? '—'}
          </ActivityChip>
        ))}
        {removed.map((t) => (
          <ActivityChip key={`r-${t.id ?? t.name}`} variant="negative">
            − {t.name ?? '—'}
          </ActivityChip>
        ))}
      </div>
    )
  }

  if (item.kind === 'updated') {
    const changes = Array.isArray(p.changes)
      ? (p.changes as { field?: string; label?: string; from?: string | null; to?: string | null }[])
      : []
    if (changes.length === 0) return null
    const previewCount = 2
    const preview = changes.slice(0, previewCount)
    const rest = changes.length - preview.length
    return (
      <div className={styles.activityChangesPreview}>
        {preview.map((c, i) =>
          c.field === 'description' ? (
            <div key={`${c.field ?? i}-${i}`} className={styles.activityChangeRow}>
              <span className={styles.activityDescriptionChangeNote}>Изменено описание</span>
            </div>
          ) : (
            <div key={`${c.field ?? i}-${i}`} className={styles.activityChangeRow}>
              <span className={styles.activityFieldName}>{c.label ?? c.field ?? 'Поле'}</span>
              <span className={styles.activityChangeBody}>
                <ActivityChip>
                  {formatActivityDiffValue(c.field, c.from ?? null)}
                </ActivityChip>
                <ArrowRight size={12} className={styles.activityArrow} aria-hidden />
                <ActivityChip variant="accent">
                  {formatActivityDiffValue(c.field, c.to ?? null)}
                </ActivityChip>
              </span>
            </div>
          ),
        )}
        {rest > 0 ? (
          <span className={styles.activityChangesMore}>и ещё {rest}</span>
        ) : null}
      </div>
    )
  }

  return null
}
