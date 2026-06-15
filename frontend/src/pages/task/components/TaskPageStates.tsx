import type { ReactNode } from 'react'
import { AppLayout } from 'shared/ui'
import styles from '../TaskPage.module.css'

/**
 * Стейт «загрузка задачи». Показываем тот же двухколоночный layout, что и
 * успешный рендер: слева спиннер, справа сразу боковая панель истории, чтобы
 * она открывалась моментально, а её собственное состояние загрузки шло в ней.
 */
export function TaskPageLoading({
  aside,
  edgeHandle,
  withAside,
}: {
  aside?: ReactNode
  edgeHandle?: ReactNode
  withAside?: boolean
}) {
  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={`${styles.workspace} ${withAside ? styles.workspaceWithAside : ''}`}>
          <div className={styles.workspaceMain}>
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} aria-hidden />
              <p className={styles.loadingText}>Загрузка задачи…</p>
            </div>
          </div>
          {aside}
        </div>
        {edgeHandle}
      </div>
    </AppLayout>
  )
}

export function TaskPageError({
  message,
  onBack,
}: {
  message: string
  onBack: () => void
}) {
  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.error}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 9v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2>Не удалось открыть задачу</h2>
          <p>{message || 'Задача не найдена'}</p>
          <button type="button" className={styles.errorBtn} onClick={onBack}>
            ← Назад
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
