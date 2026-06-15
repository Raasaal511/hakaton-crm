import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { addOrganization } from 'shared/api/events/organization'
import { Button, Input } from 'shared/ui'
import styles from 'shared/ui/Form.module.css'

type CreateOrganizationFormProps = {
  onSuccess?: () => void
}

export function CreateOrganizationForm({ onSuccess }: CreateOrganizationFormProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const org = await organizationsAPI.create(name)
      addOrganization(org)
      onSuccess?.()
      navigate(`/organizations/${org.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        label="Название организации"
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
