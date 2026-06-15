import { useState } from 'react'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { addMember } from 'shared/api/events/organization'
import { Button, Input } from 'shared/ui'
import type { OrganizationRole } from 'shared/types/organization'
import styles from 'shared/ui/Form.module.css'

type AddMemberFormProps = {
  organizationId: number
  onClose: () => void
}

export function AddMemberForm({ organizationId, onClose }: AddMemberFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('member')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const member = await organizationsAPI.addMember(organizationId, { email, role })
      addMember(member)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formWide}>
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel}>Роль</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrganizationRole)}
          className={styles.select}
        >

          <option value="member">
            Участник — только назначенные разделы; в задачах в основном автор или исполнитель
          </option>
          <option value="admin">
            Администратор — участники, разделы, все задачи; название, удаление и смена ролей в организации — у
            владельца
          </option>
          <option value="owner">
            Владелец — название, удаление организации, смена ролей, остальное как у админа
          </option>
        </select>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Добавление...' : 'Добавить'}
      </Button>
    </form>
  )
}
