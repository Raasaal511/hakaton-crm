import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './AssigneesReadonlyCollapse.module.css'

/** Свернуть в одну строку, как на странице задачи (TaskPage ASSIGNEES_LIST_COLLAPSE_AFTER) */
const COLLAPSE_AFTER = 2
const PANEL_Z = 10020

function initialOf(label: string) {
  const t = label.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

export type AssigneeReadonly = { id: number; label: string }

type Props = {
  assignees: AssigneeReadonly[]
}

function usePanelPosition(anchorRef: RefObject<HTMLDivElement | null>, open: boolean) {
  const [box, setBox] = useState<{ top: number; left: number; minW: number } | null>(null)

  const update = useCallback(() => {
    const el = anchorRef.current
    if (!el || !open) {
      if (!open) setBox(null)
      return
    }
    const r = el.getBoundingClientRect()
    const minW = Math.max(200, r.width)
    let left = r.left
    const pad = 8
    if (left + minW > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - minW - pad)
    }
    setBox({
      top: r.bottom + 6,
      left,
      minW,
    })
  }, [anchorRef, open])

  useLayoutEffect(() => {
    update()
  }, [open, update])

  useEffect(() => {
    if (!open) return
    const r = () => update()
    window.addEventListener('scroll', r, true)
    window.addEventListener('resize', r)
    return () => {
      window.removeEventListener('scroll', r, true)
      window.removeEventListener('resize', r)
    }
  }, [open, update])

  return [box, update] as const
}

/**
 * Список исполнителей: при малом количестве — чипы; при большом — сводка (аватары, +N, «N исполнителей») с раскрытием.
 * Раскрытый список в портале, чтобы не обрезался в скролле колонок.
 */
export function AssigneesReadonlyCollapse({ assignees }: Props) {
  const count = assignees.length
  const [expanded, setExpanded] = useState(count <= COLLAPSE_AFTER)
  const prevCountRef = useRef(count)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [panelBox] = usePanelPosition(anchorRef, expanded)

  useEffect(() => {
    const prev = prevCountRef.current
    if (count <= COLLAPSE_AFTER) {
      setExpanded(true)
    } else if (prev <= COLLAPSE_AFTER && count > COLLAPSE_AFTER) {
      setExpanded(false)
    }
    prevCountRef.current = count
  }, [count])

  useEffect(() => {
    if (count <= COLLAPSE_AFTER || !expanded) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (anchorRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setExpanded(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [count, expanded])

  const summaryTitle = useMemo(() => assignees.map((a) => a.label).join(', '), [assignees])
  const needsCollapse = count > COLLAPSE_AFTER

  const portalTarget = typeof document !== 'undefined' ? document.body : null

  if (count === 0) {
    return <span className={styles.muted}>не назначены</span>
  }

  if (!needsCollapse) {
    return (
      <>
        {assignees.map((a) => (
          <span key={a.id} className={styles.inlineChip}>
            {a.label}
          </span>
        ))}
      </>
    )
  }

  const panelNode =
    expanded && panelBox && portalTarget
      ? createPortal(
          <div
            ref={panelRef}
            className={styles.expanded}
            style={{
              position: 'fixed',
              top: panelBox.top,
              left: panelBox.left,
              minWidth: panelBox.minW,
              zIndex: PANEL_Z,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ul className={styles.list} aria-label="Список исполнителей">
              {assignees.map((a) => (
                <li key={a.id} className={styles.listRow} title={a.label}>
                  <span className={styles.listAvatar} aria-hidden>
                    {initialOf(a.label)}
                  </span>
                  <span className={styles.listName}>{a.label}</span>
                </li>
              ))}
            </ul>
          </div>,
          portalTarget,
        )
      : null

  return (
    <>
      <div
        ref={anchorRef}
        className={`${styles.anchor} ${expanded ? styles.anchorOpen : ''}`.trim()}
      >
        <button
          type="button"
          className={styles.summaryBtn}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          aria-expanded={expanded}
          title={summaryTitle}
        >
          <span className={styles.stack} aria-hidden>
            {assignees.slice(0, 3).map((a) => (
              <span key={a.id} className={styles.avatar}>
                {initialOf(a.label)}
              </span>
            ))}
            {count > 3 ? <span className={styles.extra}>+{count - 3}</span> : null}
          </span>
          <span className={styles.summaryLabel}>{count} исполнителей</span>
          <svg
            className={expanded ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {panelNode}
    </>
  )
}
