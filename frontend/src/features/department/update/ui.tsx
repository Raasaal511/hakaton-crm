import { useState } from 'react'
import { departmentsAPI } from 'shared/api/requests/departments'
import { editDepartment } from 'shared/api/events/department'
import { Button, Input } from 'shared/ui'
import type { Department } from 'shared/types/departments'
import styles from 'shared/ui/Form.module.css'

type UpdateDepartmentFormProps = {
  department: Department
  onSuccess?: () => void
}

export function UpdateDepartmentForm({
  department,
  onSuccess,
}: UpdateDepartmentFormProps) {
  const [name, setName] = useState(department.name)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const updated = await departmentsAPI.update(department.id, name)
      editDepartment(updated)
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
        label="Название Раздела"
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
