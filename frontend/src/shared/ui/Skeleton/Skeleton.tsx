import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

type SkeletonProps = {
  className?: string
  style?: CSSProperties
  shimmer?: boolean
}

export function Skeleton({ className = '', style, shimmer = true }: SkeletonProps) {
  return (
    <div
      className={`${styles.root} ${shimmer ? styles.shimmer : ''} ${className}`.trim()}
      style={style}
      aria-hidden
    />
  )
}

export function HomeEntrySkeleton() {
  return (
    <div className={styles.home}>
      <Skeleton className={styles.homeTitle} />
      <Skeleton className={styles.homeLine} />
      <Skeleton className={`${styles.homeLine} ${styles.homeLineShort}`} />
      <Skeleton className={styles.homeBtn} />
    </div>
  )
}

export function RouteFallbackSkeleton() {
  return (
    <div className={styles.routeFallback}>
      <Skeleton className={styles.routeBlock} />
      <Skeleton className={`${styles.routeBlock} ${styles.routeBlockWide}`} />
      <Skeleton className={styles.routeBlockWide} style={{ opacity: 0.7 }} />
    </div>
  )
}

export function PipelineBoardSkeleton() {
  return (
    <div className={styles.pipelinePage}>
      <div className={styles.pipelineHeader}>
        <Skeleton className={styles.pipelineBreadcrumb} />
        <Skeleton className={styles.pipelineTitle} />
      </div>
      <div className={styles.pipelineBoard}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.pipelineColumn}>
            <Skeleton className={styles.pipelineColumnHead} />
            <div className={styles.pipelineColumnBody}>
              <Skeleton className={styles.pipelineCard} />
              <Skeleton className={styles.pipelineCard} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
