import type { Column } from 'shared/types/columns'
import styles from './ColumnCard.module.css'

type ColumnCardProps = {
  column: Column
  headerActions?: React.ReactNode
  children?: React.ReactNode
}

export function ColumnCard({ column, headerActions, children }: ColumnCardProps) {
  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <h3 className={styles.title}>{column.name}</h3>
        {headerActions && <span className={styles.headerActions}>{headerActions}</span>}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
