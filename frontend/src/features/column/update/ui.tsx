import { useState } from 'react'
import { columnsAPI } from 'shared/api/requests/columns'
import { editColumn } from 'shared/api/events/columns'
import { Button, Input } from 'shared/ui'
import type { Column } from 'shared/types/columns'
import styles from 'shared/ui/Form.module.css'

type UpdateColumnFormProps = {
  column: Column
  onSuccess?: () => void
}

export function UpdateColumnForm({
  column,
  onSuccess,
}: UpdateColumnFormProps) {
  const [name, setName] = useState(column.name)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const updated = await columnsAPI.update(column.departmentId, column.id, {
        name: name.trim(),
      })
      editColumn(updated)
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        label="Название колонки"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </form>
  )
}
