import { useState } from 'react'

export function useDeleteWithConfirm() {
  const [error, setError] = useState('')

  const handleDelete = async (
    confirmMessage: string,
    onDelete: () => Promise<void>,
    onSuccess?: () => void,
  ) => {
    if (!confirm(confirmMessage)) return
    setError('')
    try {
      await onDelete()
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  return { deleteError: error, handleDelete }
}
