import { Link } from 'react-router-dom'
import { RemoveTaskButton } from 'features/task/remove'
import type { Task } from 'shared/types/tasks'
import styles from '../TaskPage.module.css'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  task: Task
  saveStatus: SaveStatus
  canDeleteTask: boolean
  onBack: () => void
  onTaskDeleted: () => void
}

export function TaskTopBar({
  task,
  saveStatus,
  canDeleteTask,
  onBack,
  onTaskDeleted,
}: Props) {
  return (
    <div className={styles.topBar}>
      <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Назад">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span className={styles.backBtnText}>Назад</span>
      </button>
      <div className={styles.breadcrumb}>
        <Link to="/" className={styles.breadcrumbLink}>
          Главная
        </Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>#{task.id}</span>
      </div>

      <div className={styles.topBarActions}>
        <span className={styles.saveStatus} data-status={saveStatus}>
          {saveStatus === 'saving' && 'Сохранение...'}
          {saveStatus === 'saved' && 'Сохранено'}
          {saveStatus === 'error' && 'Ошибка'}
        </span>
        <RemoveTaskButton task={task} canManage={canDeleteTask} onSuccess={onTaskDeleted} />
      </div>
    </div>
  )
}
