import { useCallback, useEffect, useState } from 'react'
import { departmentsAPI } from 'shared/api/requests/departments'
import { editDepartment } from 'shared/api/events/department'
import { mergeDepartmentPermissions } from 'shared/lib'
import type { Department } from 'shared/types/departments'
import type {
  DepartmentPermissionKey,
  DepartmentPermissions,
} from 'shared/types/departmentPermissions'
import styles from './DepartmentSettingsPermissions.module.css'

type Props = {
  department: Department
}

type PermissionRow = {
  key: DepartmentPermissionKey
  label: string
  description: string
  group: 'admin' | 'member'
}

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: 'deptAdminCanManageMembers',
    label: 'Добавлять и удалять участников',
    description: 'Администратор отдела может приглашать в раздел и исключать участников',
    group: 'admin',
  },
  {
    key: 'deptAdminCanManagePipelines',
    label: 'Управлять воронками',
    description: 'Создание, переименование и удаление воронок (кроме системной «Основной»)',
    group: 'admin',
  },
  {
    key: 'deptAdminCanManageColumns',
    label: 'Управлять колонками',
    description: 'Добавление, переименование, порядок и удаление колонок на доске',
    group: 'admin',
  },
  {
    key: 'deptAdminCanManageTags',
    label: 'Управлять тегами раздела',
    description: 'Создание и удаление тегов в настройках раздела',
    group: 'admin',
  },
  {
    key: 'deptAdminCanRenameDepartment',
    label: 'Переименовывать раздел',
    description: 'Менять название раздела в настройках',
    group: 'admin',
  },
  {
    key: 'memberCanSeeAllTasks',
    label: 'Видеть все задачи раздела',
    description: 'Участник видит не только свои задачи, но и задачи коллег',
    group: 'member',
  },
  {
    key: 'memberCanCreateTasks',
    label: 'Создавать задачи',
    description: 'Участник может создавать новые задачи на доске',
    group: 'member',
  },
]

export function DepartmentSettingsPermissions({ department }: Props) {
  const [permissions, setPermissions] = useState<DepartmentPermissions>(() =>
    mergeDepartmentPermissions(department.permissions),
  )
  const [savingKey, setSavingKey] = useState<DepartmentPermissionKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPermissions(mergeDepartmentPermissions(department.permissions))
  }, [department.id, department.permissions])

  const persist = useCallback(
    async (key: DepartmentPermissionKey, nextValue: boolean) => {
      const prev = permissions
      const optimistic = { ...permissions, [key]: nextValue }
      setPermissions(optimistic)
      setSavingKey(key)
      setError(null)
      try {
        const saved = await departmentsAPI.updatePermissions(department.id, { [key]: nextValue })
        setPermissions(saved)
        editDepartment({ ...department, permissions: saved })
      } catch (e: unknown) {
        setPermissions(prev)
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Не удалось сохранить настройку')
        setError(msg)
      } finally {
        setSavingKey(null)
      }
    },
    [department, permissions],
  )

  const renderGroup = (group: 'admin' | 'member', title: string, subtitle: string) => (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <p className={styles.groupDesc}>{subtitle}</p>
      <ul className={styles.list}>
        {PERMISSION_ROWS.filter((r) => r.group === group).map((row) => (
          <li key={row.key} className={styles.item}>
            <label className={styles.label}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={permissions[row.key]}
                disabled={savingKey != null}
                onChange={(e) => void persist(row.key, e.target.checked)}
              />
              <span className={styles.labelText}>
                <span className={styles.labelTitle}>{row.label}</span>
                <span className={styles.labelDesc}>{row.description}</span>
              </span>
              {savingKey === row.key ? (
                <span className={styles.saving} aria-live="polite">
                  …
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className={styles.root}>
      <h2 className={styles.sectionTitle}>Права в разделе</h2>
      <p className={styles.sectionDesc}>
        Ограничения для администраторов отдела и обычных участников. Владелец и администратор
        организации не ограничиваются этими настройками.
      </p>
      {renderGroup(
        'admin',
        'Администратор отдела',
        'Роль «Админ» в участниках раздела',
      )}
      {renderGroup('member', 'Участник раздела', 'Роль «Участник» в списке участников раздела')}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
