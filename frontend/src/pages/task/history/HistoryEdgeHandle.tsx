import { createPortal } from 'react-dom'
import { ChevronsLeft, History } from 'lucide-react'
import styles from '../TaskPage.module.css'

type Props = {
  count: number
  onOpen: () => void
}

/** «Ручка» истории, которая прилипает к правому краю окна, когда сайдбар закрыт. */
export function HistoryEdgeHandle({ count, onOpen }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <button
      type="button"
      className={styles.historyEdgeHandle}
      data-task-history-edge-handle=""
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      aria-label="Открыть историю изменений"
      title="История изменений"
    >
      <span className={styles.historyEdgeHandleInner}>
        <ChevronsLeft size={16} aria-hidden />
        <History size={14} aria-hidden />
        {count > 0 ? <span className={styles.historyEdgeHandleCount}>{count}</span> : null}
      </span>
    </button>,
    document.body,
  )
}
