import type { ReactNode, HTMLAttributes } from 'react'
import styles from './Card.module.css'

export type CardVariant = 'default' | 'flat' | 'raised' | 'bordered'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  as: Tag = 'div',
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[
        styles.card,
        styles[variant],
        styles[`padding-${padding}`],
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export type CardHeaderProps = {
  title?: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}

export function CardHeader({ title, description, action, children }: CardHeaderProps) {
  return (
    <div className={styles.cardHeader}>
      {children ?? (
        <>
          <div className={styles.cardHeaderContent}>
            {title && <h3 className={styles.cardTitle}>{title}</h3>}
            {description && <p className={styles.cardDescription}>{description}</p>}
          </div>
          {action && <div className={styles.cardHeaderAction}>{action}</div>}
        </>
      )}
    </div>
  )
}
