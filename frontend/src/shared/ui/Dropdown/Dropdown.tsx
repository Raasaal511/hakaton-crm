import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import styles from './Dropdown.module.css'

export type DropdownItemId = string | number

export type DropdownItem = {
  id: DropdownItemId
  label: string
  description?: string
  /** Буква для круглой аватарки слева (например первая буква имени) */
  avatarInitial?: string
}

type DropdownProps = {
  items: DropdownItem[]
  value?: DropdownItemId | DropdownItemId[] | null
  multiple?: boolean
  placeholder?: string
  searchPlaceholder?: string
  label?: string
  onChange: (value: DropdownItemId | DropdownItemId[] | null) => void
  renderTrigger?: (params: {
    open: boolean
    selectedLabel: string
    toggle: () => void
  }) => React.ReactNode
  className?: string
  size?: 'default' | 'large'
  /**
   * `above` — открывать меню над триггером, если сверху хватает места (удобно в drawer / у нижней части формы).
   * `auto` — прежняя эвристика по краю окна.
   */
  menuPlacement?: 'auto' | 'above'
}

export function Dropdown({
  items,
  value,
  multiple = false,
  placeholder = '',
  searchPlaceholder = 'Поиск...',
  label,
  onChange,
  renderTrigger,
  className,
  size = 'default',
  menuPlacement = 'auto',
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuPos, setMenuPos] = useState<{
    top: number
    left: number
    width: number
    maxHeight?: number
  } | null>(null)
  /** Панель показываем только после уточнения координат по реальному DOM — иначе заметен скачок между кадрами. */
  const [menuPaintReady, setMenuPaintReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const valueArray: DropdownItemId[] = Array.isArray(value)
    ? value
    : value != null
      ? [value]
      : []

  const valueSet = new Set(valueArray.map((v) => String(v)))

  const selectedItem = !multiple && valueArray.length
    ? items.find((i) => String(i.id) === String(valueArray[0]))
    : undefined

  const selectedLabel = selectedItem?.label || placeholder || ''

  const toggleOpen = () => {
    setOpen((v) => {
      if (!v) setSearch('')
      return !v
    })
  }

  const EDGE = 16

  /** Ограничиваем left по ширине окна (без смены «якоря» — иначе панель визуально прыгает). */
  const clampMenuLeft = useCallback((menuWidth: number, preferredLeft: number) => {
    let left = preferredLeft
    if (left < EDGE) left = EDGE
    if (left + menuWidth > window.innerWidth - EDGE) {
      left = window.innerWidth - EDGE - menuWidth
    }
    if (left < EDGE) left = EDGE
    return left
  }, [])

  const updateMenuPosition = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const hasDesc = items.some((i) => Boolean(i.description?.trim()))
    const hasAvatarItems = items.some((i) => Boolean(i.avatarInitial?.trim()))
    const menuEl = menuRef.current
    const measuredW = menuEl?.getBoundingClientRect().width
    const approxW = hasDesc
      ? Math.min(640, Math.max(r.width, 480), window.innerWidth - 2 * EDGE)
      : size === 'large'
        ? r.width
        : Math.min(hasAvatarItems ? 260 : 220, Math.max(r.width, hasAvatarItems ? 200 : 180))
    const menuWidth = measuredW && measuredW > 0 ? measuredW : approxW
    /** Меню шире триггера: стабильно привязываем правый край панели к правому краю триггера (без скачка после измерения DOM). */
    const preferredLeft = hasDesc ? r.right - menuWidth : r.left
    const left = clampMenuLeft(menuWidth, preferredLeft)

    const limitBottom = window.innerHeight - EDGE
    let top = r.bottom + gap
    const menuH = menuEl?.getBoundingClientRect().height ?? 0
    const roughMenuH = hasDesc
      ? 340
      : hasAvatarItems
        ? Math.min(360, 260 + Math.min(items.length, 16) * 6)
        : 220

    const estH = menuH > 0 ? menuH : roughMenuH
    const aboveTopCandidate = r.top - gap - estH

    if (menuPlacement === 'above') {
      if (aboveTopCandidate >= EDGE) {
        top = aboveTopCandidate
      }
    } else {
      const manyAvatarItems = hasAvatarItems && items.length >= 5
      const belowOverflows = r.bottom + gap + estH > limitBottom
      const triggerInLowerHalf = r.top > window.innerHeight * 0.38

      if (manyAvatarItems && aboveTopCandidate >= EDGE && (belowOverflows || triggerInLowerHalf)) {
        top = aboveTopCandidate
      } else if (menuH > 0) {
        if (top + menuH > limitBottom) {
          const aboveTop = r.top - gap - menuH
          if (aboveTop >= EDGE) top = aboveTop
        }
      } else if (top + roughMenuH > limitBottom) {
        const aboveTop = r.top - gap - roughMenuH
        if (aboveTop >= EDGE) top = aboveTop
      }
    }

    const opensAbove = top < r.bottom - 2
    /**
     * Для меню "вверх" считаем доступную высоту от триггера до верхней безопасной границы окна.
     * Нельзя вычислять через `top` самого меню (там возникает feedback-loop: maxHeight начинает
     * зависеть от уже ограниченной высоты меню и постепенно «схлопывается» при scroll/resize).
     */
    const maxSpan = opensAbove
      ? Math.max(120, r.top - gap - EDGE)
      : Math.max(120, limitBottom - top - 6)
    const capRich = hasDesc ? Math.min(640, maxSpan) : Math.min(320, maxSpan)
    const maxHeight = Math.max(120, capRich)

    const next = {
      top,
      left,
      width: size === 'large' ? r.width : Math.max(r.width, 180),
      maxHeight,
    }
    setMenuPos((prev) => {
      if (!prev) return next
      if (
        Math.abs(prev.top - next.top) < 0.75 &&
        Math.abs(prev.left - next.left) < 0.75 &&
        Math.abs(prev.width - next.width) < 0.75 &&
        Math.abs((prev.maxHeight ?? 0) - (next.maxHeight ?? 0)) < 1.5
      ) {
        return prev
      }
      return next
    })
  }, [size, items, clampMenuLeft, menuPlacement])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      setMenuPaintReady(false)
      return
    }
    setMenuPaintReady(false)
    updateMenuPosition()
    const raf = requestAnimationFrame(() => {
      updateMenuPosition()
      setMenuPaintReady(true)
    })
    const onMove = () => updateMenuPosition()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, updateMenuPosition])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, search, items, updateMenuPosition])

  useEffect(() => {
    if (open && menuPaintReady) {
      const t = requestAnimationFrame(() =>
        searchInputRef.current?.focus({ preventScroll: true }),
      )
      return () => cancelAnimationFrame(t)
    }
  }, [open, menuPaintReady])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const searchLower = search.trim().toLowerCase()
  const filteredItems = searchLower
    ? items.filter((i) => {
        if (i.label.toLowerCase().includes(searchLower)) return true
        return i.description?.toLowerCase().includes(searchLower) ?? false
      })
    : items

  const hasDescriptions = items.some((i) => Boolean(i.description?.trim()))
  const hasAvatarItems = items.some((i) => Boolean(i.avatarInitial?.trim()))

  const handleSelect = (id: DropdownItemId) => {
    if (multiple) {
      const exists = valueSet.has(String(id))
      const current = new Set(valueArray.map((v) => String(v)))
      if (exists) {
        current.delete(String(id))
      } else {
        current.add(String(id))
      }
      const next = Array.from(current)
      onChange(next)
    } else {
      if (valueSet.has(String(id))) {
        onChange(null)
      } else {
        onChange(id)
      }
      setOpen(false)
    }
  }

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      if (!open) return
      const el = e.target
      /**
       * Ручка «История» задачи рендерится в portal на body. Синхронное setOpen(false) на mousedown
       * даёт ре-рендер до завершения click — событие теряется. Откладываем только этот случай.
       */
      if (el instanceof Element && el.closest('[data-task-history-edge-handle]')) {
        closeTimer = window.setTimeout(() => {
          closeTimer = undefined
          setOpen(false)
        }, 0)
        return
      }
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      if (closeTimer !== undefined) window.clearTimeout(closeTimer)
    }
  }, [open])

  return (
    <div ref={containerRef} className={[styles.container, size === 'large' && styles.containerLarge, className].filter(Boolean).join(' ')}>
      {label && <div className={styles.label}>{label}</div>}
      {renderTrigger ? (
        renderTrigger({ open, selectedLabel, toggle: toggleOpen })
      ) : (
        <button
          type="button"
          className={styles.trigger}
          onClick={toggleOpen}
        >
          <span className={styles.triggerText}>
            {selectedLabel || placeholder || 'Выберите'}
          </span>
          <span className={styles.chevron}>{open ? '▴' : '▾'}</span>
        </button>
      )}

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            data-dropdown-menu-portal
            className={[
              styles.menu,
              styles.menuPortal,
              size === 'large' && styles.menuPortalLarge,
              hasDescriptions && styles.menuPortalRich,
              menuPos.maxHeight != null && styles.menuViewportBoxed,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: size === 'large' ? menuPos.width : undefined,
              minWidth: hasDescriptions ? Math.max(menuPos.width, 480) : menuPos.width,
              maxWidth: hasDescriptions
                ? 'min(640px, calc(100vw - 32px))'
                : size === 'large'
                  ? undefined
                  : hasAvatarItems
                    ? 260
                    : 220,
              maxHeight: menuPos.maxHeight,
              zIndex: 10_000,
              opacity: menuPaintReady ? 1 : 0,
              pointerEvents: menuPaintReady ? 'auto' : 'none',
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className={styles.searchInput}
              onKeyDown={(e) => e.stopPropagation()}
            />
            {filteredItems.length === 0 ? (
              <div className={styles.emptyState}>Ничего не найдено</div>
            ) : (
              <div className={styles.menuList}>
                {filteredItems.map((item) => {
                  const active = valueSet.has(String(item.id))
                  const desc = item.description?.trim()
                  const av = item.avatarInitial?.trim()
                  const avatarLetter = av
                    ? av.charAt(0).toLocaleUpperCase()
                    : ''
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={[
                        styles.item,
                        desc ? styles.itemWithDescription : '',
                        active ? styles.itemActive : '',
                        avatarLetter ? styles.itemHasAvatar : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleSelect(item.id)}
                    >
                      {avatarLetter ? (
                        <span className={styles.itemAvatar} aria-hidden>
                          {avatarLetter}
                        </span>
                      ) : null}
                      <span className={styles.itemMain}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        {desc ? (
                          <span className={styles.itemDescription}>{desc}</span>
                        ) : null}
                      </span>
                      {multiple && (
                        <span className={styles.itemCheck}>{active ? '✔' : ''}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}

