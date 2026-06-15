import { useState } from 'react'
import { format, formatDistanceToNow, isSameYear, isToday } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Activity as ActivityIcon,
  ChevronDown,
  History,
  X as XIcon,
} from 'lucide-react'
import type { TaskActivityItem } from 'shared/types/taskActivity'
import styles from '../TaskPage.module.css'
import { ActivityDetailsBody } from './ActivityDetailsBody'
import { ActivityInlineSummary } from './ActivityInlineSummary'
import { actorDisplayName, actorInitial, getActivityMeta } from './activityMeta'
import { groupActivityByDay } from './groupByDay'
import { parseActivityDateString } from './formatActivityDate'

type Props = {
  taskId: number
  items: TaskActivityItem[]
  isLoading: boolean
  isError: boolean
  onClose: () => void
  onRetry: () => void
}

export function HistoryAside({
  taskId,
  items,
  isLoading,
  isError,
  onClose,
  onRetry,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <aside className={styles.historyAside} aria-labelledby="task-activity-aside-title">
      <div className={styles.historyAsideInner}>
        <div className={styles.historyAsideHeader}>
          <div className={styles.historyAsideHeaderText}>
            <div className={styles.historyAsideTitleRow}>
              <h2 id="task-activity-aside-title" className={styles.historyAsideTitle}>
                История изменений
              </h2>
              {items.length > 0 ? (
                <span className={styles.historyAsideCount}>{items.length}</span>
              ) : null}
            </div>
            <p className={styles.historyAsideSubtitle}>
              Журнал событий по задаче #{taskId}
            </p>
          </div>
          <div className={styles.historyAsideActions}>
            <button
              type="button"
              className={styles.historyAsideCloseBtn}
              aria-label="Закрыть панель"
              title="Закрыть"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
            >
              <XIcon size={22} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>

        <div className={styles.historyAsideBody}>
          {isLoading ? (
            <div className={styles.activityState}>
              <ActivityIcon size={28} aria-hidden />
              <p>Загружаем историю…</p>
            </div>
          ) : isError ? (
            <div className={`${styles.activityState} ${styles.activityStateError}`}>
              <XIcon size={28} aria-hidden />
              <p>Не удалось загрузить историю</p>
              <button
                type="button"
                className={styles.activityStateRetry}
                onClick={onRetry}
              >
                Повторить
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.activityState}>
              <History size={28} aria-hidden />
              <p>Пока нет записей</p>
              <span className={styles.activityStateHint}>
                События будут появляться здесь по мере работы над задачей
              </span>
            </div>
          ) : (
            <ol className={styles.activityGroups}>
              {groupActivityByDay(items).map((group) => (
                <li key={group.key} className={styles.activityGroup}>
                  <div className={styles.activityGroupHeader}>
                    <span className={styles.activityGroupLabel}>{group.label}</span>
                    <span className={styles.activityGroupCount}>{group.items.length}</span>
                  </div>
                  <ul className={styles.activityTimeline}>
                    {group.items.map((item) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        open={expandedId === item.id}
                        onToggle={() =>
                          setExpandedId((prev) => (prev === item.id ? null : item.id))
                        }
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </aside>
  )
}

function ActivityRow({
  item,
  open,
  onToggle,
}: {
  item: TaskActivityItem
  open: boolean
  onToggle: () => void
}) {
  const meta = getActivityMeta(item.kind)
  const when = item.createdAt ? parseActivityDateString(item.createdAt) : null
  const timeValid = when != null && !Number.isNaN(when.getTime())
  const actorName = actorDisplayName(item)
  const initial = actorInitial(item)

  return (
    <li className={styles.activityItem} data-tone={meta.tone}>
      <div className={styles.activityIconWrap} aria-hidden>
        <span className={styles.activityIconBadge}>
          <meta.Icon size={14} />
        </span>
      </div>
      <div className={styles.activityCard}>
        <div className={styles.activityCardHead}>
          <span
            className={styles.activityActorAvatar}
            aria-hidden
            title={actorName}
          >
            {initial}
          </span>
          <div className={styles.activityCardSentence}>
            <span className={styles.activityActor}>{actorName}</span>{' '}
            <span className={styles.activityVerb}>{meta.verb}</span>
          </div>
          {timeValid && when ? (
            <time
              dateTime={item.createdAt ?? undefined}
              className={styles.activityTime}
              title={format(when, 'd MMMM yyyy, HH:mm', { locale: ru })}
            >
              {isToday(when)
                ? formatDistanceToNow(when, { addSuffix: true, locale: ru })
                : isSameYear(when, new Date())
                  ? format(when, 'd MMMM, HH:mm', { locale: ru })
                  : format(when, 'd MMMM yyyy, HH:mm', { locale: ru })}
            </time>
          ) : null}
        </div>

        <ActivityInlineSummary item={item} />

        {meta.hasDetails ? (
          <button
            type="button"
            className={styles.activityToggle}
            aria-expanded={open}
            onClick={onToggle}
          >
            <ChevronDown
              size={14}
              className={
                open ? styles.activityToggleIconOpen : styles.activityToggleIcon
              }
              aria-hidden
            />
            {open ? 'Скрыть подробности' : 'Подробности'}
          </button>
        ) : null}

        {open && meta.hasDetails ? (
          <div className={styles.activityDetails}>
            <ActivityDetailsBody item={item} />
          </div>
        ) : null}
      </div>
    </li>
  )
}
