import { Button } from 'shared/ui'
import styles from '../TaskPage.module.css'
import { SendBackRevisionIcon } from './SendBackRevisionIcon'

type Props = {
  open: boolean
  comment: string
  busy: boolean
  onCommentChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function SendBackDialog({
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
      aria-labelledby="send-back-title"
    >
      <button
        type="button"
        className={styles.sendBackOverlay}
        aria-label="Закрыть"
        onClick={() => !busy && onClose()}
      />
      <div className={`${styles.sendBackPanel} ${styles.sendBackPanelWarning}`}>
        <div className={styles.sendBackTitleRow}>
          <span className={`${styles.sendBackTitleIcon} ${styles.sendBackTitleIconWarning}`}>
            <SendBackRevisionIcon size={20} />
          </span>
          <div>
            <h2 id="send-back-title" className={styles.sendBackTitle}>
              Вернуть на доработку
            </h2>
            <p className={styles.sendBackSubtitle}>Задача из «Завершенные» → «Задачи»</p>
          </div>
        </div>
        <p className={styles.sendBackHint}>
          Задача вернётся исполнителю в первую колонку воронки. Комментарий добавится в описание задачи.
        </p>
        <textarea
          className={styles.sendBackTextarea}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Опишите, что нужно исправить или доделать…"
          disabled={busy}
        />
        <div className={styles.sendBackActions}>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={onConfirm}>
            {busy ? 'Отправка…' : 'Вернуть на доработку'}
          </Button>
        </div>
      </div>
    </div>
  )
}
