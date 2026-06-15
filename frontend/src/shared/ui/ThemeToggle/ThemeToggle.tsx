import { Monitor, Moon, Sun } from 'lucide-react'
import { cn, useTheme, type ThemePreference } from 'shared/lib'
import styles from './ThemeToggle.module.css'

type Props = {
  className?: string
  /** Компактный вид для сайдбара (только иконки) */
  compact?: boolean
}

const OPTIONS: { value: ThemePreference; label: string; shortLabel: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Светлая', shortLabel: 'Свет', Icon: Sun },
  { value: 'dark', label: 'Тёмная', shortLabel: 'Тёмн', Icon: Moon },
  { value: 'system', label: 'Системная', shortLabel: 'Авто', Icon: Monitor },
]

export function ThemeToggle({ className, compact = false }: Props) {
  const { preference, setPreference } = useTheme()

  return (
    <div
      className={cn(styles.root, compact && styles.rootCompact, className)}
      role="group"
      aria-label="Тема оформления"
    >
      {!compact ? <span className={styles.label}>Тема</span> : null}
      <div className={cn(styles.segmented, compact && styles.segmentedCompact)}>
        {OPTIONS.map(({ value, label, shortLabel, Icon }) => (
          <button
            key={value}
            type="button"
            className={cn(styles.btn, preference === value && styles.btnActive)}
            aria-pressed={preference === value}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
          >
            <Icon size={compact ? 16 : 17} strokeWidth={1.75} aria-hidden />
            {!compact ? <span className={styles.btnText}>{label}</span> : null}
            {compact ? <span className={styles.srOnly}>{label}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
