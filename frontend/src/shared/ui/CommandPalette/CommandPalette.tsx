import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  Users,
  Building2,
  Target,
  Package,
  Briefcase,
  BarChart3,
  Bot,
  Settings,
  ArrowRight,
} from 'lucide-react'
import styles from './CommandPalette.module.css'

type CommandItem = {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
  category: 'navigation' | 'action' | 'recent'
  keywords?: string[]
}

const CATEGORY_LABELS: Record<CommandItem['category'], string> = {
  navigation: 'Навигация',
  action:     'Действия',
  recent:     'Недавние',
}

export type CommandPaletteProps = {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const go = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  const allCommands: CommandItem[] = [
    { id: 'nav-dashboard', label: 'Дашборд', icon: <LayoutDashboard size={15} strokeWidth={1.75} />, action: () => go('/dashboard'), category: 'navigation', keywords: ['главная', 'home'] },
    { id: 'nav-contacts',  label: 'Контакты', description: 'CRM', icon: <Users size={15} strokeWidth={1.75} />, action: () => go('/crm/contacts'), category: 'navigation', keywords: ['crm', 'клиенты'] },
    { id: 'nav-companies', label: 'Компании', description: 'CRM', icon: <Building2 size={15} strokeWidth={1.75} />, action: () => go('/crm/companies'), category: 'navigation', keywords: ['crm', 'организации'] },
    { id: 'nav-leads',     label: 'Лиды', description: 'CRM', icon: <Target size={15} strokeWidth={1.75} />, action: () => go('/crm/leads'), category: 'navigation', keywords: ['crm', 'воронка'] },
    { id: 'nav-products',  label: 'Товары', description: 'Каталог', icon: <Package size={15} strokeWidth={1.75} />, action: () => go('/catalog/products'), category: 'navigation', keywords: ['каталог', 'продукты'] },
    { id: 'nav-services',  label: 'Услуги', description: 'Каталог', icon: <Briefcase size={15} strokeWidth={1.75} />, action: () => go('/catalog/services'), category: 'navigation', keywords: ['каталог'] },
    { id: 'nav-reports',   label: 'Отчеты', icon: <BarChart3 size={15} strokeWidth={1.75} />, action: () => go('/reports'), category: 'navigation', keywords: ['аналитика', 'статистика'] },
    { id: 'nav-ai',        label: 'Meridian AI', icon: <Bot size={15} strokeWidth={1.75} />, action: () => go('/ai'), category: 'navigation', keywords: ['искусственный', 'интеллект', 'ai'] },
    { id: 'nav-settings',  label: 'Настройки', icon: <Settings size={15} strokeWidth={1.75} />, action: () => go('/profile'), category: 'navigation', keywords: ['профиль'] },
  ]

  const filtered = query.trim()
    ? allCommands.filter((cmd) => {
        const q = query.toLowerCase()
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.includes(q))
        )
      })
    : allCommands

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const flatList = filtered

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActiveIdx(0)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, flatList.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        flatList[activeIdx]?.action()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flatList, activeIdx, onClose])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  let flatIdx = 0

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal aria-label="Поиск и команды">
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <Search size={16} strokeWidth={2} className={styles.searchIcon} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Поиск страниц и действий..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.escKbd} aria-label="Нажмите Escape чтобы закрыть">Esc</kbd>
        </div>

        {flatList.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔍</span>
            <span>Ничего не найдено по «{query}»</span>
          </div>
        ) : (
          <ul ref={listRef} className={styles.list} role="listbox">
            {(Object.keys(grouped) as CommandItem['category'][]).map((cat) => (
              <li key={cat} className={styles.group}>
                <div className={styles.groupLabel}>{CATEGORY_LABELS[cat]}</div>
                <ul className={styles.groupItems}>
                  {grouped[cat].map((cmd) => {
                    const idx = flatIdx++
                    return (
                      <li
                        key={cmd.id}
                        role="option"
                        aria-selected={idx === activeIdx}
                        data-idx={idx}
                        className={`${styles.item} ${idx === activeIdx ? styles.itemActive : ''}`}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={cmd.action}
                      >
                        <span className={styles.itemIcon}>{cmd.icon}</span>
                        <span className={styles.itemText}>
                          <span className={styles.itemLabel}>{cmd.label}</span>
                          {cmd.description && (
                            <span className={styles.itemDesc}>{cmd.description}</span>
                          )}
                        </span>
                        {idx === activeIdx && (
                          <ArrowRight size={14} strokeWidth={2} className={styles.itemArrow} />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.footer}>
          <span><kbd className={styles.kbd}>↑↓</kbd> навигация</span>
          <span><kbd className={styles.kbd}>↵</kbd> выбрать</span>
          <span><kbd className={styles.kbd}>Esc</kbd> закрыть</span>
        </div>
      </div>
    </div>
  )
}
