import { useEffect } from 'react'
import { cn } from 'shared/lib'
import type { TodayScheduleItem, TodayScheduleSections } from 'shared/lib/taskTodaySchedule'
import { Button } from 'shared/ui'
import styles from './TodayScheduleRail.module.css'

type Props = {
  sections: TodayScheduleSections
  dayLabel: string
  loading?: boolean
  open: boolean
  onClose: () => void
  onOpenTask: (taskId: number) => void
  sheet?: boolean
  className?: string
  canCreate?: boolean
  onAddTask?: (ymd: string) => void
  dayYmd: string
}

function ScheduleItemButton({
  item,
  onOpenTask,
  showPastStyle,
}: {
  item: TodayScheduleItem
  onOpenTask: (taskId: number) => void
  showPastStyle: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        styles.itemBtn,
        showPastStyle && item.isPast && styles.itemBtnPast,
        item.isOverdue && styles.itemBtnOverdue,
      )}
      onClick={() => onOpenTask(item.taskId)}
    >
      <span className={styles.itemName}>{item.name}</span>
      <span className={styles.itemMeta}>
        {item.columnColor ? (
          <span
            className={styles.colDot}
            style={{ background: item.columnColor }}
            aria-hidden
          />
        ) : null}
        <span className={styles.itemMetaText}>
          {[item.columnName, item.departmentName, item.allDayHint]
            .filter(Boolean)
            .join(' · ') || '—'}
        </span>
      </span>
    </button>
  )
}

function TimedRow({
  item,
  onOpenTask,
  showPastStyle,
}: {
  item: TodayScheduleItem
  onOpenTask: (taskId: number) => void
  showPastStyle: boolean
}) {
  return (
    <li className={styles.timelineItem}>
      <span className={styles.timelineTime}>{item.timeLabel ?? '—'}</span>
      <span
        className={cn(
          styles.timelineDot,
          showPastStyle && item.isPast && styles.timelineDotPast,
          item.isOverdue && styles.timelineDotOverdue,
        )}
        aria-hidden
      />
      <ScheduleItemButton
        item={item}
        onOpenTask={onOpenTask}
        showPastStyle={showPastStyle}
      />
    </li>
  )
}

function RailContent({
  sections,
  dayLabel,
  loading,
  onClose,
  onOpenTask,
  showClose,
  canCreate,
  onAddTask,
  dayYmd,
}: {
  sections: TodayScheduleSections
  dayLabel: string
  loading?: boolean
  onClose: () => void
  onOpenTask: (taskId: number) => void
  showClose: boolean
  canCreate?: boolean
  onAddTask?: (ymd: string) => void
  dayYmd: string
}) {
  const { isLiveDay, pastTimed, upcomingTimed, allDay, totalCount } = sections
  const showNowMarker = isLiveDay && pastTimed.length > 0 && upcomingTimed.length > 0
  const showPastStyle = isLiveDay
  const timedCount = pastTimed.length + upcomingTimed.length

  return (
    <>
      <div className={styles.railHead}>
        <div className={styles.railHeadText}>
          <h2 className={styles.railTitle}>{isLiveDay ? 'Сегодня' : dayLabel}</h2>
          {isLiveDay ? <p className={styles.railSubtitle}>{dayLabel}</p> : null}
          {!loading ? (
            <p className={styles.railCount}>
              {totalCount === 0
                ? 'Нет задач'
                : `${totalCount} ${taskCountLabel(totalCount)}`}
            </p>
          ) : null}
        </div>
        {showClose ? (
          <button
            type="button"
            className={styles.railClose}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        ) : null}
      </div>
      {canCreate && onAddTask ? (
        <Button
          type="button"
          variant="primary"
          className={styles.railAdd}
          onClick={() => onAddTask(dayYmd)}
        >
          + Добавить задачу
        </Button>
      ) : null}
      <div className={styles.railBody}>
        {loading ? (
          <p className={styles.railLoading}>Загрузка…</p>
        ) : totalCount === 0 ? (
          <p className={styles.railEmpty}>
            На этот день задач нет
            <span className={styles.railEmptyHint}>
              Укажите дату и время в задаче — она появится в ленте
            </span>
          </p>
        ) : (
          <>
            {isLiveDay && pastTimed.length > 0 ? (
              <>
                <p className={styles.sectionLabel}>Прошло</p>
                <ul className={styles.timelineList}>
                  {pastTimed.map((item) => (
                    <TimedRow
                      key={item.taskId}
                      item={item}
                      onOpenTask={onOpenTask}
                      showPastStyle={showPastStyle}
                    />
                  ))}
                </ul>
              </>
            ) : null}
            {showNowMarker ? (
              <div className={styles.nowMarker} aria-hidden>
                <span className={styles.nowMarkerLine} />
                <span className={styles.nowMarkerLabel}>Сейчас</span>
                <span className={styles.nowMarkerLine} />
              </div>
            ) : null}
            {upcomingTimed.length > 0 ? (
              <>
                <p className={styles.sectionLabel}>
                  {isLiveDay && pastTimed.length > 0
                    ? 'Дальше'
                    : timedCount > 0
                      ? 'По времени'
                      : ''}
                </p>
                <ul className={styles.timelineList}>
                  {upcomingTimed.map((item) => (
                    <TimedRow
                      key={item.taskId}
                      item={item}
                      onOpenTask={onOpenTask}
                      showPastStyle={showPastStyle}
                    />
                  ))}
                </ul>
              </>
            ) : null}
            {allDay.length > 0 ? (
              <>
                <p className={styles.sectionLabel}>Весь день</p>
                <ul className={cn(styles.timelineList, styles.allDayList)}>
                  {allDay.map((item) => (
                    <li key={item.taskId} className={styles.allDayItem}>
                      <ScheduleItemButton
                        item={item}
                        onOpenTask={onOpenTask}
                        showPastStyle={showPastStyle}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

function taskCountLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'задача'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'задачи'
  return 'задач'
}

export function TodayScheduleRail({
  sections,
  dayLabel,
  loading = false,
  open,
  onClose,
  onOpenTask,
  sheet = false,
  className,
  canCreate = false,
  onAddTask,
  dayYmd,
}: Props) {
  useEffect(() => {
    if (!sheet || !open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sheet, open])

  if (!open) return null

  const ariaDay = sections.isLiveDay ? 'сегодня' : dayLabel

  const content = (
    <RailContent
      sections={sections}
      dayLabel={dayLabel}
      loading={loading}
      onClose={onClose}
      onOpenTask={onOpenTask}
      showClose={sheet}
      canCreate={canCreate}
      onAddTask={onAddTask}
      dayYmd={dayYmd}
    />
  )

  if (sheet) {
    return (
      <>
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Закрыть ленту дня"
          onClick={onClose}
        />
        <div
          className={cn(styles.railSheet, className)}
          role="dialog"
          aria-label={`Задачи на ${ariaDay}`}
        >
          <div className={styles.sheetHandle} aria-hidden>
            <span className={styles.sheetHandleBar} />
          </div>
          <aside className={styles.rail}>{content}</aside>
        </div>
      </>
    )
  }

  return (
    <aside
      className={cn(styles.rail, styles.railDesktopOnly, className)}
      aria-label={`Задачи на ${ariaDay}`}
    >
      {content}
    </aside>
  )
}
