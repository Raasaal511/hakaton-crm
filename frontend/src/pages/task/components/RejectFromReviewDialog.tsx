import { Button } from 'shared/ui'
import styles from '../TaskPage.module.css'

type Props = {
  open: boolean
  comment: string
  busy: boolean
  onCommentChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function RejectFromReviewDialog({
  open,
  comment,
  busy,
  onCommentChange,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null

  return (
    <div
      className={styles.sendBackDialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-review-title"
    >
      <button
        type="button"
        className={styles.sendBackOverlay}
        aria-label="Закрыть"
        onClick={() => !busy && onClose()}
      />
      <div className={`${styles.sendBackPanel} ${styles.sendBackPanelDanger}`}>
        <div className={styles.sendBackTitleRow}>
          <span className={`${styles.sendBackTitleIcon} ${styles.sendBackTitleIconDanger}`}>
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
          <div>
            <h2 id="reject-review-title" className={styles.sendBackTitle}>
              Отклонить с проверки
            </h2>
            <p className={styles.sendBackSubtitle}>Задача из «На проверке» → «В работе»</p>
          </div>
        </div>
        <p className={styles.sendBackHint}>
          Задача вернётся исполнителю в колонку «В работе». Комментарий добавится в описание задачи.
        </p>
        <textarea
          className={styles.sendBackTextarea}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Укажите причину отклонения…"
          disabled={busy}
        />
        <div className={styles.sendBackActions}>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Отправка…' : 'Отклонить'}
          </Button>
        </div>
      </div>
    </div>
  )
}
