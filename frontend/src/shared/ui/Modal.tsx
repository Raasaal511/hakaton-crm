import { type ReactNode, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from 'shared/lib'
import styles from './Modal.module.css'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = contentRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const modal = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        ref={contentRef}
        className={cn(styles.content, className)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeBtn}
              aria-label="Закрыть"
            >
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
