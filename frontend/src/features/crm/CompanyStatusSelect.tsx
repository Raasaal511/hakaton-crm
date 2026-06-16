import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import {
  COMPANY_STATUS_CONFIG,
  COMPANY_STATUS_OPTIONS,
  normalizeCompanyStatus,
  type CompanyStatus,
} from 'shared/lib/companyStatus'
import styles from './ContactStatusSelect.module.css'

type Props = {
  value: string
  onChange: (status: CompanyStatus) => void
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
}

type MenuPos = { top: number; left: number }

export function CompanyStatusSelect({ value, onChange, disabled, onClick }: Props) {
  const status = normalizeCompanyStatus(value)
  const cfg = COMPANY_STATUS_CONFIG[status]
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateMenuPosition = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const menuH = menuRef.current?.getBoundingClientRect().height ?? 140
    const edge = 8
    let top = r.bottom + gap
    if (top + menuH > window.innerHeight - edge) {
      const above = r.top - gap - menuH
      if (above >= edge) top = above
    }
    let left = r.left
    const menuW = menuRef.current?.getBoundingClientRect().width ?? 160
    if (left + menuW > window.innerWidth - edge) {
      left = window.innerWidth - edge - menuW
    }
    if (left < edge) left = edge
    setMenuPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    const raf = requestAnimationFrame(updateMenuPosition)
    const onMove = () => updateMenuPosition()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
      onClick={(e) => {
        onClick?.(e)
        e.stopPropagation()
      }}
    >
      <button
        type="button"
        className={styles.pill}
        style={{ color: cfg.color, background: cfg.bg }}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {cfg.label}
        {!disabled && <ChevronDown size={11} className={styles.chevron} />}
      </button>
      {open && !disabled && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menuPortal}
            role="listbox"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {COMPANY_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === status}
                className={`${styles.menuItem} ${opt.value === status ? styles.menuItemActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
