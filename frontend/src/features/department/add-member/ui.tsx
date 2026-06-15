import { useState, useEffect } from 'react'
import { departmentsAPI } from 'shared/api/requests/departments'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { addDepartmentMember } from 'shared/api/events/department'
import { Button, Dropdown, type DropdownItem } from 'shared/ui'
import styles from './AddDepartmentMember.module.css'
import type { OrganizationMember } from 'shared/types/organization'
import type { DepartmentMember, DepartmentRole } from 'shared/types/departments'

type AddDepartmentMemberFormProps = {
  departmentId: number
  organizationId: number
  currentMembers: DepartmentMember[]
  /** Если передан — запрос getMembers не выполняется (данные уже есть на странице) */
  orgMembers?: OrganizationMember[] | null
  canAssignDepartmentAdmin?: boolean
  onClose: () => void
}

function getMemberLabel(m: OrganizationMember) {
  return `${m.firstname} ${m.lastname} (${m.email})`
}

export function AddDepartmentMemberForm({
  departmentId,
  organizationId,
  currentMembers,
  orgMembers: orgMembersProp,
  canAssignDepartmentAdmin = false,
  onClose,
}: AddDepartmentMemberFormProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [addAsRole, setAddAsRole] = useState<DepartmentRole>('member')
  const [fetchedOrgMembers, setFetchedOrgMembers] = useState<OrganizationMember[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const orgMembers = orgMembersProp ?? fetchedOrgMembers

  const memberIds = new Set(currentMembers.map((m) => m.id))
  const availableMembers = orgMembers.filter((m) => !memberIds.has(m.id))
  const availableToAdd = availableMembers.filter((m) => !selectedIds.includes(m.id))
  const dropdownItems: DropdownItem[] = availableToAdd.map((m) => ({
    id: m.id,
    label: getMemberLabel(m),
    avatarInitial: m.firstname?.[0]?.toUpperCase() || '?',
  }))
  const selectedMembers = orgMembers.filter((m) => selectedIds.includes(m.id))

  useEffect(() => {
    if (orgMembersProp != null) return
    organizationsAPI.getMembers(organizationId).then(setFetchedOrgMembers).catch(() => setFetchedOrgMembers([]))
  }, [organizationId, orgMembersProp])

  const addToSelection = (id: number) => {
    if (!selectedIds.includes(id)) setSelectedIds((prev) => [...prev, id])
  }

  const removeFromSelection = (id: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0) return
    setError('')
    setLoading(true)
    try {
      const role = canAssignDepartmentAdmin ? addAsRole : undefined
      for (const uid of selectedIds) {
        const member = await departmentsAPI.addUser(departmentId, uid, role)
        addDepartmentMember(member)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.addRow}>
        <label className={styles.chipsLabel}>Кого добавить</label>
        <div className={styles.dropdownWrap}>
          <Dropdown
            items={dropdownItems}
            value={null}
            placeholder={availableToAdd.length === 0 ? 'Нет доступных' : 'Выберите участника из организации...'}
            searchPlaceholder="Имя или email..."
            size="large"
            className={styles.selectMemberDropdown}
            onChange={(val) => {
              const id = val != null ? Number(Array.isArray(val) ? val[0] : val) : null
              if (id != null && !Number.isNaN(id)) addToSelection(id)
            }}
          />
        </div>
        {availableMembers.length === 0 && selectedIds.length === 0 && (
          <p className={styles.emptyHint}>Все уже в разделе</p>
        )}
      </div>

      {selectedMembers.length > 0 && (
        <div className={styles.selectedBlock}>
          <div className={styles.chipsList}>
            {selectedMembers.map((m) => (
              <span key={m.id} className={styles.chip}>
                <span>{m.firstname} {m.lastname}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeFromSelection(m.id)}
                  title="Убрать"
                  aria-label="Убрать"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {canAssignDepartmentAdmin && (
            <div className={styles.roleChoices}>
              <span className={styles.roleLabel}>Добавить как</span>
              <div className={styles.roleCards}>
                <label
                  className={[
                    styles.roleCard,
                    addAsRole === 'member' ? styles.roleCardActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name="addRole"
                    checked={addAsRole === 'member'}
                    onChange={() => setAddAsRole('member')}
                  />
                  <span className={styles.roleCardTitle}>Участник</span>
                  <span className={styles.roleCardDesc}>
                    Доска и задачи: в основном там, где автор или исполнитель. Без управления воронкой, колонками и
                    людьми в разделе.
                  </span>
                </label>
                <label
                  className={[
                    styles.roleCard,
                    addAsRole === 'admin' ? styles.roleCardActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name="addRole"
                    checked={addAsRole === 'admin'}
                    onChange={() => setAddAsRole('admin')}
                  />
                  <span className={styles.roleCardTitle}>Админ отдела</span>
                  <span className={styles.roleCardDesc}>
                    Полное управление разделом и все задачи в нём. Роль админа раздела при добавлении выдаёт только
                    владелец или админ организации.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading || selectedIds.length === 0} className={styles.submitBtn}>
        {loading ? 'Добавление...' : selectedIds.length > 1 ? `Добавить ${selectedIds.length}` : 'Добавить'}
      </Button>
    </form>
  )
}
