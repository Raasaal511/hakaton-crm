import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import styles from './KPICard.module.css'

export type KPICardProps = {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
  accentColor?: string
}

export function KPICard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  trend,
  loading = false,
  accentColor,
}: KPICardProps) {
  const deltaDir = trend ?? (delta == null ? undefined : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral')

  return (
    <div className={styles.card}>
      {loading ? (
        <div className={styles.skeleton}>
          <div className={styles.skelLabel} />
          <div className={styles.skelValue} />
          <div className={styles.skelDelta} />
        </div>
      ) : (
        <>
          <div className={styles.top}>
            <span className={styles.label}>{label}</span>
            {icon && (
              <span
                className={styles.iconWrap}
                style={accentColor ? { color: accentColor, background: `${accentColor}18` } : undefined}
              >
                {icon}
              </span>
            )}
          </div>

          <div className={styles.value}>{value}</div>

          {(delta != null || deltaLabel) && (
            <div className={`${styles.delta} ${deltaDir ? styles[`delta-${deltaDir}`] : ''}`}>
              <DeltaIcon dir={deltaDir} />
              <span className={styles.deltaText}>
                {delta != null && `${delta > 0 ? '+' : ''}${delta}%`}
                {deltaLabel && ` ${deltaLabel}`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DeltaIcon({ dir }: { dir?: string }) {
  if (dir === 'up')      return <TrendingUp size={12} strokeWidth={2.5} />
  if (dir === 'down')    return <TrendingDown size={12} strokeWidth={2.5} />
  if (dir === 'neutral') return <Minus size={12} strokeWidth={2.5} />
  return null
}
