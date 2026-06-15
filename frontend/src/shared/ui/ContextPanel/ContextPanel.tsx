import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './ContextPanel.module.css'

export type ContextPanelProps = {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  width?: number | string
  children: ReactNode
}

export function ContextPanel({
  open,
  onClose,
  title,
  subtitle,
  width = 380,
  children,
}: ContextPanelProps) {
  return (
    <>
      {open && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        style={{ '--panel-width': typeof width === 'number' ? `${width}px` : width } as React.CSSProperties}
        aria-label={title ?? 'Детали'}
        aria-hidden={!open}
      >
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleBlock}>
            {title && <h2 className={styles.panelTitle}>{title}</h2>}
            {subtitle && <p className={styles.panelSubtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Закрыть панель"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {children}
        </div>
      </aside>
    </>
  )
}
