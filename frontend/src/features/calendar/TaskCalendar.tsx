import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  formatMonthTitleRu,
  getCalendarCells,
  parseYmd,
  startOfToday,
  toYmd,
  WEEKDAY_LABELS_RU_SHORT,
} from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import { cn, mediaMaxMobileQuery, useMediaQuery } from 'shared/lib'
import { buildDaySchedule, formatDayScheduleTitle } from 'shared/lib/taskTodaySchedule'
import { TaskCalendarDayPanel } from './TaskCalendarDayPanel'
import { TaskCalendarDayView } from './TaskCalendarDayView'
import { TaskCalendarDisplayModeDropdown } from './TaskCalendarDisplayModeDropdown'
import { TaskCalendarMonthJumpPopover } from './TaskCalendarMonthJumpPopover'
import { TaskCalendarWeekRow } from './TaskCalendarWeekRow'
import {
  buildTaskCalendarPlacement,
  formatDayTitleRu,
  formatWeekTitleRu,
  getWeekCells,
  splitCellsIntoWeeks,
} from './taskCalendarPlacement'
import type { CalendarDisplayMode, TaskCalendarDayChip, TaskCalendarItem } from './types'
import { calendarItemToScheduleTask } from 'features/today-schedule'
import styles from './TaskCalendar.module.css'

export type TaskCalendarProps = {
  tasks: TaskCalendarItem[]
  loading?: boolean
  month: Date
  onMonthChange: (month: Date) => void
  displayMode: CalendarDisplayMode
  onDisplayModeChange: (mode: CalendarDisplayMode) => void
  onAddTask: (ymd: string) => void
  onOpenTask: (taskId: number) => void
  canCreate?: boolean
}

export function TaskCalendar({
  tasks,
  loading = false,
  month,
  onMonthChange,
  displayMode,
  onDisplayModeChange,
  onAddTask,
  onOpenTask,
  canCreate = true,
}: TaskCalendarProps) {
  const today = startOfToday()
  const todayKey = toYmd(today)
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)
  const [monthJumpOpen, setMonthJumpOpen] = useState(false)
  const [monthJumpRemountKey, setMonthJumpRemountKey] = useState(0)
  const isMobile = useMediaQuery(mediaMaxMobileQuery)
  const isWeekMode = displayMode === 'week'
  const isDayMode = displayMode === 'day'

  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  const activeYmd = isDayMode ? toYmd(month) : (selectedYmd ?? todayKey)

  useEffect(() => {
    if (!isMobile || isDayMode || !selectedYmd) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobile, isDayMode, selectedYmd])

  useEffect(() => {
    if (!isDayMode) return
    const anchorYmd = toYmd(month)
    if (selectedYmd !== anchorYmd) {
      setSelectedYmd(anchorYmd)
    }
  }, [isDayMode, month, selectedYmd])

  useEffect(() => {
    if (displayMode !== 'day') return
    const d = parseYmd(selectedYmd ?? todayKey) ?? today
    if (toYmd(d) !== toYmd(month)) {
      onMonthChange(d)
    }
  }, [displayMode])

  const cells = useMemo(() => {
    if (isDayMode) {
      const d = parseYmd(activeYmd) ?? today
      return [{ date: d, outside: false }]
    }
    if (isWeekMode) return getWeekCells(month)
    return getCalendarCells(year, monthIndex)
  }, [isDayMode, isWeekMode, month, year, monthIndex, activeYmd, today])

  const weeks = useMemo(() => splitCellsIntoWeeks(cells), [cells])
  const placement = useMemo(() => buildTaskCalendarPlacement(tasks, cells), [tasks, cells])
  const maxChipsPerDay = isWeekMode ? (isMobile ? 6 : 8) : isMobile ? 1 : 3

  const periodTitle = isDayMode
    ? formatDayTitleRu(month)
    : isWeekMode
      ? formatWeekTitleRu(month)
      : formatMonthTitleRu(year, monthIndex)

  const dayScheduleTasks = useMemo(() => {
    const dayList = placement.tasksByDay.get(activeYmd) ?? []
    return dayList.map(calendarItemToScheduleTask)
  }, [placement, activeYmd])

  const sections = useMemo(
    () => buildDaySchedule(dayScheduleTasks, activeYmd),
    [dayScheduleTasks, activeYmd],
  )

  const dayLabel = formatDayScheduleTitle(activeYmd)

  const selectedDayTasks = !isDayMode && selectedYmd
    ? placement.tasksByDay.get(selectedYmd)
    : undefined
  const selectedChips: TaskCalendarDayChip[] | undefined = selectedDayTasks?.map((task) => ({
    task,
    showTitle: true,
  }))

  const goPeriod = (delta: number) => {
    if (isDayMode) {
      const d = parseYmd(activeYmd) ?? today
      const next = new Date(d)
      next.setDate(next.getDate() + delta)
      setSelectedYmd(toYmd(next))
      onMonthChange(next)
      return
    }
    if (isWeekMode) {
      const next = new Date(month)
      next.setDate(next.getDate() + delta * 7)
      onMonthChange(next)
    } else {
      onMonthChange(new Date(year, monthIndex + delta, 1))
    }
    if (!isDayMode) {
      setSelectedYmd(null)
    }
  }

  const selectDay = (ymd: string) => {
    setSelectedYmd(ymd)
  }

  const goToday = () => {
    setSelectedYmd(todayKey)
    if (isDayMode) {
      onMonthChange(today)
    } else if (isWeekMode) {
      onMonthChange(today)
    } else {
      onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))
    }
  }

  const handleDisplayModeChange = (mode: CalendarDisplayMode) => {
    if (mode === 'day') {
      const d = parseYmd(selectedYmd ?? todayKey) ?? today
      onMonthChange(d)
    }
    onDisplayModeChange(mode)
  }

  const prevLabel = isDayMode
    ? 'Предыдущий день'
    : isWeekMode
      ? 'Предыдущая неделя'
      : 'Предыдущий месяц'
  const nextLabel = isDayMode
    ? 'Следующий день'
    : isWeekMode
      ? 'Следующая неделя'
      : 'Следующий месяц'

  return (
    <div
      className={cn(
        styles.root,
        isWeekMode && styles.rootWeekMode,
        isDayMode && styles.rootDayMode,
        isMobile && !isDayMode && selectedYmd != null && styles.rootPanelOpen,
      )}
    >
      <div className={cn(styles.toolbar, isWeekMode && styles.toolbarWeekMode)}>
        <div className={styles.toolbarNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => goPeriod(-1)}
            aria-label={prevLabel}
          >
            ‹
          </button>
          <div className={styles.toolbarPeriod}>
            <TaskCalendarMonthJumpPopover
              open={monthJumpOpen}
              onOpenChange={setMonthJumpOpen}
              remountKey={monthJumpRemountKey}
              year={isDayMode ? month.getFullYear() : year}
              monthIndex={isDayMode ? month.getMonth() : monthIndex}
              today={today}
              selectedYmd={isDayMode ? activeYmd : selectedYmd}
              onPickDay={(date) => {
                const ymd = toYmd(date)
                if (isDayMode) {
                  setSelectedYmd(ymd)
                  onMonthChange(date)
                } else {
                  setSelectedYmd(ymd)
                  onMonthChange(isWeekMode ? date : new Date(date.getFullYear(), date.getMonth(), 1))
                }
              }}
            >
              <button
                type="button"
                className={styles.toolbarTitleBtn}
                aria-expanded={monthJumpOpen}
                aria-haspopup="dialog"
                aria-label={`${periodTitle}. Открыть выбор даты`}
                onClick={() => {
                  setMonthJumpRemountKey((k) => k + 1)
                  setMonthJumpOpen((open) => !open)
                }}
              >
                <span className={styles.toolbarTitleText}>
                  {isDayMode ? dayLabel : periodTitle}
                </span>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={cn(styles.toolbarTitleChevron, monthJumpOpen && styles.toolbarTitleChevronOpen)}
                  aria-hidden
                />
              </button>
            </TaskCalendarMonthJumpPopover>
          </div>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => goPeriod(1)}
            aria-label={nextLabel}
          >
            ›
          </button>
        </div>
        <div className={styles.toolbarActions}>
          <TaskCalendarDisplayModeDropdown
            value={displayMode}
            onChange={handleDisplayModeChange}
            className={styles.modeDropdown}
          />
          <button type="button" className={styles.todayBtn} onClick={goToday}>
            Сегодня
          </button>
        </div>
      </div>

      <div className={cn(styles.body, isDayMode && styles.bodyDayMode)}>
        {isDayMode ? (
          <TaskCalendarDayView
            ymd={activeYmd}
            sections={sections}
            loading={loading}
            onOpenTask={onOpenTask}
            onAddTask={canCreate ? onAddTask : undefined}
          />
        ) : (
          <div className={styles.gridWrap}>
            <div className={styles.weekHeader}>
              {WEEKDAY_LABELS_RU_SHORT.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    styles.weekdayLabel,
                    index >= 5 && styles.weekdayLabelWeekend,
                  )}
                >
                  {label}
                </div>
              ))}
            </div>
            {loading ? (
              <div className={styles.loading}>Загрузка…</div>
            ) : (
              <div
                className={cn(styles.weeksStack, isWeekMode && styles.weeksStackSingle)}
                role="grid"
                aria-label={periodTitle}
              >
                {weeks.map((weekCells, weekIndex) => (
                  <TaskCalendarWeekRow
                    key={weekIndex}
                    weekIndex={weekIndex}
                    weekCells={weekCells}
                    placement={placement}
                    today={today}
                    selectedYmd={selectedYmd}
                    maxChipsPerDay={maxChipsPerDay}
                    weekMode={isWeekMode}
                    onSelectDay={selectDay}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!isDayMode && isMobile && selectedYmd ? (
          <button
            type="button"
            className={styles.dayPanelBackdrop}
            aria-label="Закрыть список задач"
            onClick={() => setSelectedYmd(null)}
          />
        ) : null}

        {!isDayMode && selectedYmd ? (
          <TaskCalendarDayPanel
            ymd={selectedYmd}
            chips={selectedChips ?? []}
            canCreate={canCreate}
            sheet={isMobile}
            onAddTask={onAddTask}
            onOpenTask={onOpenTask}
            onClose={() => setSelectedYmd(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
