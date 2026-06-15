import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { departmentsAPI } from 'shared/api/requests/departments'
import { addDepartment } from 'shared/api/events/department'
import { Button, Input } from 'shared/ui'
import styles from 'shared/ui/Form.module.css'

type CreateDepartmentFormProps = {
  organizationId: number
  onSuccess?: () => void
}

export function CreateDepartmentForm({
  organizationId,
  onSuccess,
}: CreateDepartmentFormProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const dep = await departmentsAPI.create(organizationId, name)
      addDepartment(dep)
      onSuccess?.()
      navigate(`/departments/${dep.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
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
        {loading ? 'Создание...' : 'Создать'}
      </Button>
    </form>
  )
}
