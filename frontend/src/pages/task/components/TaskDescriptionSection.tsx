import { Suspense, lazy } from 'react'
import { TaskDescriptionPlain } from 'features/task/description'
import styles from '../TaskPage.module.css'

const TaskDescriptionEditor = lazy(async () => {
  const m = await import('features/task/description/TaskDescriptionEditor')
  return { default: m.TaskDescriptionEditor }
})

type Props = {
  taskId: number
  /** HTML описания задачи (источник истины — родитель). */
  description: string | null | undefined
  /** Стартовое значение редактора (используется в режиме редактирования). */
  editDescription: string
  canEditContent: boolean
  onChange: (html: string) => void
  /** Сохранить описание без debounce (уход фокуса с редактора, вкладка в фоне и т.д.). */
  onFlushDescription?: () => void
}

export function TaskDescriptionSection({
  taskId,
  description,
  editDescription,
  canEditContent,
  onChange,
  onFlushDescription,
}: Props) {
  return (
    <div className={styles.descriptionSection}>
      <div className={styles.descriptionSectionHead}>
        <div className={styles.descriptionTitleRow}>
          <svg
            className={styles.sectionIcon}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2 className={styles.sectionTitle}>Описание</h2>
        </div>
        {!canEditContent && (
          <span className={styles.descriptionHint}>Только просмотр</span>
        )}
      </div>
      <div
        className={
          canEditContent
            ? styles.descriptionSurfaceEditor
            : `${styles.descriptionSurface} ${styles.descriptionSurfaceReadonly}`
        }
      >
        {canEditContent ? (
          <Suspense
            fallback={
              <div className={styles.descriptionEditorLoading}>Загрузка редактора…</div>
            }
          >
            <TaskDescriptionEditor
              key={taskId}
              initialHtml={editDescription}
              onChange={onChange}
              onFlushDescription={onFlushDescription}
            />
          </Suspense>
        ) : (
          <TaskDescriptionPlain html={description} />
        )}
      </div>
    </div>
  )
}
