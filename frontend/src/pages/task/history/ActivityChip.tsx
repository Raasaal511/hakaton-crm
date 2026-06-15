import type { ReactNode } from 'react'
import styles from '../TaskPage.module.css'

type Props = {
  children: ReactNode
  variant?: 'neutral' | 'accent' | 'positive' | 'negative'
  title?: string
  /** Многострочный блок места в доске (колонка / воронка · отдел) без горизонтального раздувания */
  place?: boolean
}

export function ActivityChip({ children, variant = 'neutral', title, place }: Props) {
  return (
    <span
      className={`${styles.activityChip} ${styles[`activityChip_${variant}`] ?? ''} ${place ? styles.activityChip_place : ''}`}
      title={title}
    >
      {children}
    </span>
  )
}
