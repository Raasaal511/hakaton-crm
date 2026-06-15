import { useState } from 'react'
import { columnsAPI } from 'shared/api/requests/columns'
import { addColumn } from 'shared/api/events/columns'
import { Button, Input } from 'shared/ui'
import styles from 'shared/ui/Form.module.css'

type CreateColumnFormProps = {
  departmentId: number
  nextPosition: number
  pipelineId: number | null
  onClose: () => void
}

export function CreateColumnForm({
  departmentId,
  nextPosition,
  pipelineId,
  onClose,
}: CreateColumnFormProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pipelineId == null) {
      setError('Сначала выберите воронку')
      return
    }

    setLoading(true)
    try {
      const column = await columnsAPI.create(departmentId, {
        name: name.trim(),
        position: nextPosition,
        pipelineId,
      })
      addColumn(column)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
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
        {loading ? 'Создание...' : 'Создать'}
      </Button>
    </form>
  )
}
