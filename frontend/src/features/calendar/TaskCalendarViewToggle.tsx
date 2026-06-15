import { Calendar, LayoutGrid, List, SquareKanban } from 'lucide-react'
import { cn } from 'shared/lib'
import styles from './TaskCalendarViewToggle.module.css'

export type BoardViewMode = 'kanban' | 'list' | 'calendar'
export type MyTasksViewMode = 'board' | 'list' | 'calendar'

type BoardProps = {
  variant: 'board'
  value: BoardViewMode
  onChange: (mode: BoardViewMode) => void
  className?: string
  hideKanban?: boolean
}

type MyTasksProps = {
  variant: 'myTasks'
  value: MyTasksViewMode
  onChange: (mode: MyTasksViewMode) => void
  className?: string
  /** На мобиле колонки недоступны — остаются список и календарь */
  hideBoard?: boolean
}

type ListOnlyProps = {
  variant: 'listOnly'
  value: 'list' | 'calendar'
  onChange: (mode: 'list' | 'calendar') => void
  className?: string
}

type Props = BoardProps | MyTasksProps | ListOnlyProps

const iconProps = { size: 20, strokeWidth: 1.75, 'aria-hidden': true as const }

export function TaskCalendarViewToggle(props: Props) {
  const { className } = props

  if (props.variant === 'listOnly') {
    return (
      <div className={cn(styles.toggle, className)} role="group" aria-label="Вид списка">
        <ToggleBtn
          active={props.value === 'list'}
          title="Список"
          ariaLabel="Список задач"
          onClick={() => props.onChange('list')}
        >
          <List {...iconProps} />
        </ToggleBtn>
        <ToggleBtn
          active={props.value === 'calendar'}
          title="Календарь"
          ariaLabel="Календарь задач"
          onClick={() => props.onChange('calendar')}
        >
          <Calendar {...iconProps} />
        </ToggleBtn>
      </div>
    )
  }

  if (props.variant === 'myTasks') {
    return (
      <div className={cn(styles.toggle, className)} role="group" aria-label="Вид задач">
        {!props.hideBoard ? (
          <ToggleBtn
            active={props.value === 'board'}
            title="Колонки"
            ariaLabel="Колонки"
            onClick={() => props.onChange('board')}
          >
            <LayoutGrid {...iconProps} />
          </ToggleBtn>
        ) : null}
        <ToggleBtn
          active={props.value === 'list'}
          title="Список"
          ariaLabel="Список"
          onClick={() => props.onChange('list')}
        >
          <List {...iconProps} />
        </ToggleBtn>
        <ToggleBtn
          active={props.value === 'calendar'}
          title="Календарь"
          ariaLabel="Календарь"
          onClick={() => props.onChange('calendar')}
        >
          <Calendar {...iconProps} />
        </ToggleBtn>
      </div>
    )
  }

  return (
    <div className={cn(styles.toggle, className)} role="group" aria-label="Вид доски">
      {!props.hideKanban ? (
        <ToggleBtn
          active={props.value === 'kanban'}
          title="Доска"
          ariaLabel="Доска с колонками"
          onClick={() => props.onChange('kanban')}
        >
          <SquareKanban {...iconProps} />
        </ToggleBtn>
      ) : null}
      <ToggleBtn
        active={props.value === 'list'}
        title="Список"
        ariaLabel="Список задач"
        onClick={() => props.onChange('list')}
      >
        <List {...iconProps} />
      </ToggleBtn>
      <ToggleBtn
        active={props.value === 'calendar'}
        title="Календарь"
        ariaLabel="Календарь задач"
        onClick={() => props.onChange('calendar')}
      >
        <Calendar {...iconProps} />
      </ToggleBtn>
    </div>
  )
}

function ToggleBtn({
  active,
  title,
  ariaLabel,
  onClick,
  children,
}: {
  active: boolean
  title: string
  ariaLabel: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(styles.btn, active && styles.btnActive)}
      title={title}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
