import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TaskDateRangePicker } from './TaskDateRangePicker'
import { computePopoverPosition } from './computePopoverPosition'
import styles from './TaskDateRangePicker.module.css'

export type TaskDateRangePopoverProps = {
  startValue: string
  endValue: string
  onApply: (start: string | null, end: string | null) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Увеличивайте при каждом открытии — сброс выбора в календаре */
  remountKey: number
  children: React.ReactNode
}

const ESTIMATED_POPOVER_WIDTH = 312
const ESTIMATED_POPOVER_HEIGHT = 460

type Position = { top: number; left: number }

export function TaskDateRangePopover({
  startValue,
  endValue,
  onApply,
  open,
  onOpenChange,
  remountKey,
  children,
}: TaskDateRangePopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    const compute = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const popWidth = popoverRef.current?.offsetWidth ?? ESTIMATED_POPOVER_WIDTH
      const popHeight = popoverRef.current?.offsetHeight ?? ESTIMATED_POPOVER_HEIGHT
      setPosition(computePopoverPosition(rect, popWidth, popHeight))
    }

    compute()

    const popover = popoverRef.current
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => compute())
        : null
    if (popover && resizeObserver) resizeObserver.observe(popover)
    if (anchorRef.current && resizeObserver) resizeObserver.observe(anchorRef.current)

    const onScroll = () => compute()
    const onResize = () => compute()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, remountKey])

  useEffect(() => {
    if (!open) return
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      /**
       * Синхронный setState здесь перерисовывает страницу до завершения click по элементам
       * в portal на document.body (ручка истории задачи) — браузер отменяет click.
       * Откладываем закрытие на следующий macrotask.
       */
      closeTimer = window.setTimeout(() => {
        closeTimer = undefined
        onOpenChange(false)
      }, 0)
    }
    document.addEventListener('mousedown', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      if (closeTimer !== undefined) window.clearTimeout(closeTimer)
    }
  }, [open, onOpenChange])

  return (
    <div className={styles.anchorWrap} ref={anchorRef}>
      {children}
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              data-date-range-popover
              className={styles.popoverFloating}
              style={{
                position: 'fixed',
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              <TaskDateRangePicker
                key={remountKey}
                startValue={startValue}
                endValue={endValue}
                onApply={onApply}
                onDismiss={() => onOpenChange(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
