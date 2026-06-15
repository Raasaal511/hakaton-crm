import { Button } from 'shared/ui'
import styles from '../TaskPage.module.css'

type Props = {
  canApproveFromReview: boolean
  canRejectFromReview: boolean
  approveBusy: boolean
  onApprove: () => void
  onOpenReject: () => void
}

export function TaskActionsBar({
  canApproveFromReview,
  canRejectFromReview,
  approveBusy,
  onApprove,
  onOpenReject,
}: Props) {
  if (!canRejectFromReview && !canApproveFromReview) {
    return null
  }

  return (
    <div className={styles.taskActionsBar}>
      {canApproveFromReview ? (
        <Button
          type="button"
          variant="primary"
          disabled={approveBusy}
          onClick={onApprove}
          className={styles.taskActionBtn}
        >
          <span className={styles.taskActionBtnIcon} aria-hidden>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          {approveBusy ? 'Подтверждение…' : 'Подтвердить'}
        </Button>
      ) : null}
      {canRejectFromReview ? (
        <Button
          type="button"
          variant="danger"
          onClick={onOpenReject}
          className={styles.taskActionBtn}
        >
          <span className={styles.taskActionBtnIcon} aria-hidden>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
          Отклонить
        </Button>
      ) : null}
    </div>
  )
}
