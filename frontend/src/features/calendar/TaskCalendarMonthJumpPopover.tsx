import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TaskCalendarMonthJump, type TaskCalendarMonthJumpProps } from './TaskCalendarMonthJump'
import styles from './TaskCalendarMonthJump.module.css'

type Props = TaskCalendarMonthJumpProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  remountKey: number
  children: React.ReactNode
}

const GAP = 6
const ESTIMATED_WIDTH = 276
const ESTIMATED_HEIGHT = 300
const VIEWPORT_PADDING = 8

type Position = { top: number; left: number }

export function TaskCalendarMonthJumpPopover({
  open,
  onOpenChange,
  remountKey,
  children,
  onPickDay,
  ...pickerProps
}: Props) {
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
      const popWidth = popoverRef.current?.offsetWidth ?? ESTIMATED_WIDTH
      const popHeight = popoverRef.current?.offsetHeight ?? ESTIMATED_HEIGHT

      let left = rect.left + rect.width / 2 - popWidth / 2
      const maxLeft = window.innerWidth - popWidth - VIEWPORT_PADDING
      if (left > maxLeft) left = Math.max(VIEWPORT_PADDING, maxLeft)
      if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING

      let top = rect.bottom + GAP
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < popHeight + GAP + VIEWPORT_PADDING && rect.top > popHeight + GAP) {
        top = rect.top - popHeight - GAP
      }
      if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING

      setPosition({ top, left })
    }

    compute()

    const onScroll = () => compute()
    const onResize = () => compute()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const handlePickDay = (date: Date) => {
    onPickDay(date)
    onOpenChange(false)
  }

  return (
    <div className={styles.anchorWrap} ref={anchorRef}>
      {children}
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              data-calendar-month-jump-popover
              className={styles.popoverFloating}
              style={{
                position: 'fixed',
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              <TaskCalendarMonthJump
                key={remountKey}
                {...pickerProps}
                onPickDay={handlePickDay}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
