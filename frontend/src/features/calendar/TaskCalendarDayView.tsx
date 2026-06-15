import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { cn } from 'shared/lib'
import type { TodayScheduleItem, TodayScheduleSections } from 'shared/lib/taskTodaySchedule'
import { parseYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import styles from './TaskCalendarDayView.module.css'

const DAY_GRID_START_HOUR = 6
const DAY_GRID_END_HOUR = 23
const PX_PER_HOUR = 56
const GRID_TOP_INSET_PX = 14
const EVENT_MIN_HEIGHT_PX = 36
/** Длительность блока для раскладки пересечений (точечные задачи). */
const EVENT_LAYOUT_DURATION_MIN = 60
const EVENT_LAYOUT_GAP_REM = 0.35

function yFromHour(hour: number): number {
  return GRID_TOP_INSET_PX + (hour - DAY_GRID_START_HOUR) * PX_PER_HOUR
}

function yFromMinutesAfterGridStart(minutesAfterStart: number): number {
  return GRID_TOP_INSET_PX + (minutesAfterStart / 60) * PX_PER_HOUR
}

type Props = {
  ymd: string
  sections: TodayScheduleSections
  loading?: boolean
  onOpenTask: (taskId: number) => void
  onAddTask?: (ymd: string) => void
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function timedItemsForGrid(sections: TodayScheduleSections): TodayScheduleItem[] {
  if (sections.isLiveDay) {
    return [...sections.pastTimed, ...sections.upcomingTimed].sort(
      (a, b) => (a.sortAt ?? 0) - (b.sortAt ?? 0),
    )
  }
  return [...sections.upcomingTimed].sort((a, b) => (a.sortAt ?? 0) - (b.sortAt ?? 0))
}

function minutesFromItem(item: { sortAt: number | null; timeLabel: string | null }): number | null {
  if (item.timeLabel) {
    const [h, m] = item.timeLabel.split(':').map(Number)
    if (!Number.isNaN(h) && !Number.isNaN(m)) return h * 60 + m
  }
  if (item.sortAt == null) return null
  const d = new Date(item.sortAt)
  return d.getHours() * 60 + d.getMinutes()
}

type TimedRange = {
  item: TodayScheduleItem
  startMin: number
  endMin: number
}

function rangesOverlap(a: TimedRange, b: TimedRange): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin
}

function buildOverlapClusters(ranges: TimedRange[]): TimedRange[][] {
  if (ranges.length === 0) return []
  const parent = ranges.map((_, i) => i)
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }
  const union = (i: number, j: number) => {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) parent[ri] = rj
  }
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) union(i, j)
    }
  }
  const byRoot = new Map<number, TimedRange[]>()
  for (let i = 0; i < ranges.length; i++) {
    const root = find(i)
    const list = byRoot.get(root) ?? []
    list.push(ranges[i])
    byRoot.set(root, list)
  }
  return [...byRoot.values()]
}

function assignColumnsInCluster(cluster: TimedRange[]): Array<TimedRange & { column: number; columnCount: number }> {
  const sorted = [...cluster].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const columnEnds: number[] = []
  const placed = sorted.map((ev) => {
    let column = columnEnds.findIndex((end) => end <= ev.startMin)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(ev.endMin)
    } else {
      columnEnds[column] = ev.endMin
    }
    return { ...ev, column }
  })
  const columnCount = Math.max(1, columnEnds.length)
  return placed.map((ev) => ({ ...ev, columnCount }))
}

type TimedEventLayout = {
  item: TodayScheduleItem
  topPx: number
  heightPx: number
  column: number
  columnCount: number
}

function layoutTimedDayEvents(
  items: TodayScheduleItem[],
  gridStartMinutes: number,
  gridEndMinutes: number,
): TimedEventLayout[] {
  const ranges: TimedRange[] = []
  for (const item of items) {
    const itemMin = minutesFromItem(item)
    if (itemMin == null) continue
    if (itemMin < gridStartMinutes || itemMin >= gridEndMinutes) continue
    const startMin = itemMin
    const endMin = Math.min(itemMin + EVENT_LAYOUT_DURATION_MIN, gridEndMinutes)
    ranges.push({ item, startMin, endMin })
  }

  const layouts: TimedEventLayout[] = []
  for (const cluster of buildOverlapClusters(ranges)) {
    for (const ev of assignColumnsInCluster(cluster)) {
      layouts.push({
        item: ev.item,
        topPx: yFromMinutesAfterGridStart(ev.startMin - gridStartMinutes),
        heightPx: EVENT_MIN_HEIGHT_PX,
        column: ev.column,
        columnCount: ev.columnCount,
      })
    }
  }
  return layouts
}

function eventBlockPositionStyle(column: number, columnCount: number): CSSProperties {
  const gap = `${EVENT_LAYOUT_GAP_REM}rem`
  return {
    left: `calc(100% * ${column} / ${columnCount} + ${gap})`,
    width: `calc(100% / ${columnCount} - ${EVENT_LAYOUT_GAP_REM * 2}rem)`,
  }
}

export function TaskCalendarDayView({
  ymd,
  sections,
  loading = false,
  onOpenTask,
  onAddTask,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!sections.isLiveDay) return
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [sections.isLiveDay])

  const date = parseYmd(ymd)
  const gridHeightPx =
    GRID_TOP_INSET_PX + (DAY_GRID_END_HOUR - DAY_GRID_START_HOUR) * PX_PER_HOUR
  const gridStartMinutes = DAY_GRID_START_HOUR * 60
  const gridEndMinutes = DAY_GRID_END_HOUR * 60

  const weekdayLabel = date
    ? date
      .toLocaleDateString('ru-RU', { weekday: 'short' })
      .replace(/\.$/, '')
      .toUpperCase()
    : ''

  const dayNum = date?.getDate() ?? ''
  const monthYearLabel = date
    ? date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    : ''

  const hourMarks = useMemo(() => {
    const marks: number[] = []
    for (let h = DAY_GRID_START_HOUR; h <= DAY_GRID_END_HOUR; h++) {
      marks.push(h)
    }
    return marks
  }, [])

  const timedItems = timedItemsForGrid(sections)

  const timedLayouts = useMemo(
    () => layoutTimedDayEvents(timedItems, gridStartMinutes, gridEndMinutes),
    [timedItems, gridStartMinutes, gridEndMinutes],
  )

  const nowTimeLabel = useMemo(() => {
    const now = new Date(nowMs)
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }, [nowMs])

  const nowLineTopPx = useMemo(() => {
    if (!sections.isLiveDay) return null
    const now = new Date(nowMs)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (nowMin < gridStartMinutes || nowMin > gridEndMinutes) return null
    return yFromMinutesAfterGridStart(nowMin - gridStartMinutes)
  }, [sections.isLiveDay, nowMs, gridStartMinutes, gridEndMinutes])

  if (loading) {
    return <div className={styles.loading}>Загрузка…</div>
  }

  return (
    <div className={styles.root}>
      <header
        className={cn(styles.dayBanner, sections.isLiveDay && styles.dayBannerLive)}
        aria-label={date?.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
      >
        <div className={styles.dayBannerMain}>
          <div className={styles.dayBannerDate}>
            {weekdayLabel ? (
              <div className={styles.dayBannerMeta}>
                <span className={styles.weekdayPill}>{weekdayLabel}</span>
              </div>
            ) : null}
            <div className={styles.dayNumRow}>
              <span className={styles.dayBannerNum}>{dayNum}</span>
              {sections.isLiveDay ? (
                <span className={styles.todayGroup}>
                  <span className={styles.todaySep} aria-hidden>
                    ·
                  </span>
                  <span className={styles.todayBadge}>Сегодня</span>
                </span>
              ) : null}
            </div>
            {monthYearLabel ? (
              <span className={styles.monthYear}>{monthYearLabel}</span>
            ) : null}
          </div>
        </div>
        {onAddTask ? (
          <button
            type="button"
            className={styles.addTaskBtn}
            onClick={() => onAddTask(ymd)}
          >
            <span className={styles.addTaskIcon} aria-hidden>
              <Plus size={18} strokeWidth={2.25} />
            </span>
            <span className={styles.addTaskLabel}>Добавить задачу</span>
          </button>
        ) : null}
      </header>

      {sections.allDay.length > 0 ? (
        <section className={styles.allDaySection} aria-label="Весь день">
          <span className={styles.allDayLabel}>Весь день</span>
          <ul className={styles.allDayList}>
            {sections.allDay.map((item) => (
              <li key={item.taskId}>
                <button
                  type="button"
                  className={cn(
                    styles.allDayChip,
                    item.isOverdue && styles.allDayChipOverdue,
                  )}
                  onClick={() => onOpenTask(item.taskId)}
                >
                  {item.columnColor ? (
                    <span
                      className={styles.colDot}
                      style={{ background: item.columnColor }}
                      aria-hidden
                    />
                  ) : null}
                  <span className={styles.allDayChipName}>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.totalCount === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>На этот день задач нет</p>
          <p className={styles.emptyHint}>Укажите дату и время в задаче — она появится в расписании</p>
          {onAddTask ? (
            <button type="button" className={styles.emptyAddBtn} onClick={() => onAddTask(ymd)}>
              <Plus size={16} strokeWidth={2.25} aria-hidden />
              Добавить задачу
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.timeGrid}>
          {nowLineTopPx != null ? (
            <div
              className={styles.nowLine}
              style={{ top: nowLineTopPx }}
              aria-label={`Сейчас ${nowTimeLabel}`}
            >
              <span className={styles.nowLineTime}>{nowTimeLabel}</span>
              <span className={styles.nowLineBar} />
            </div>
          ) : null}
          <div className={styles.hourLabels} style={{ height: gridHeightPx }}>
            {hourMarks.map((hour) => (
              <span
                key={hour}
                className={cn(
                  styles.hourLabel,
                  hour === DAY_GRID_START_HOUR && styles.hourLabelFirst,
                )}
                style={{ top: yFromHour(hour) }}
              >
                {formatHourLabel(hour)}
              </span>
            ))}
          </div>
          <div className={styles.gridArea} style={{ height: gridHeightPx }}>
            {hourMarks.slice(0, -1).map((hour) => (
              <span
                key={hour}
                className={styles.hourLine}
                style={{ top: yFromHour(hour) }}
                aria-hidden
              />
            ))}
            {timedLayouts.map(({ item, topPx, heightPx, column, columnCount }) => (
              <button
                key={item.taskId}
                type="button"
                className={cn(
                  styles.eventBlock,
                  sections.isLiveDay && item.isPast && styles.eventBlockPast,
                  item.isOverdue && styles.eventBlockOverdue,
                )}
                style={{
                  top: topPx,
                  height: heightPx,
                  ...eventBlockPositionStyle(column, columnCount),
                }}
                onClick={() => onOpenTask(item.taskId)}
              >
                <span className={styles.eventTime}>{item.timeLabel}</span>
                <span className={styles.eventName}>{item.name}</span>
                {(item.columnName || item.departmentName) && (
                  <span className={styles.eventMeta}>
                    {[item.columnName, item.departmentName].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
