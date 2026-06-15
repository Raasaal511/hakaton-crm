import { useState } from 'react'
import { Button } from './Button'
import styles from './Form.module.css'

type RemoveMemberButtonProps = {
  confirmMessage: string
  onRemove: () => Promise<void>
  canManage?: boolean
  onSuccess?: () => void
}

export function RemoveMemberButton({
  confirmMessage,
  onRemove,
  canManage = false,
  onSuccess,
}: RemoveMemberButtonProps) {
  const [error, setError] = useState('')

  const handleClick = async () => {
    if (!confirm(confirmMessage)) return
    setError('')
    try {
      await onRemove()
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  if (!canManage) return null

  return (
    <span>
      {error && (
        <span className={styles.error} style={{ marginRight: 8 }}>
          {error}
        </span>
      )}
      <Button variant="danger" type="button" onClick={handleClick}>
        Удалить
      </Button>
    </span>
  )
}
