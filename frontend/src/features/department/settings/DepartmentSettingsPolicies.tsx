import { useCallback, useEffect, useState } from 'react'
import { departmentsAPI } from 'shared/api/requests/departments'
import { editDepartment } from 'shared/api/events/department'
import { allDeptNotificationsEnabled, mergeDepartmentPolicies } from 'shared/lib/departmentPoliciesConfig'
import type { Department } from 'shared/types/departments'
import type {
  DepartmentNotificationPolicies,
  DepartmentPolicies,
  DepartmentTaskRules,
} from 'shared/types/departmentPoliciesConfig'
import styles from './DepartmentSettingsPermissions.module.css'

type Props = {
  department: Department
}

const NOTIFICATION_ROWS: Array<{
  key: keyof DepartmentNotificationPolicies
  label: string
}> = [
  { key: 'deptAdminOnTaskCreated', label: 'Новая задача' },
  { key: 'deptAdminOnTaskCompleted', label: 'Завершение задачи' },
  { key: 'deptAdminOnTaskMoved', label: 'Перенос задачи' },
  { key: 'deptAdminOnAssigneesChanged', label: 'Смена исполнителей' },
]

export function DepartmentSettingsPolicies({ department }: Props) {
  const [policies, setPolicies] = useState<DepartmentPolicies>(() =>
    mergeDepartmentPolicies(department.policies),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPolicies(mergeDepartmentPolicies(department.policies))
  }, [department.id, department.policies])

  const persist = useCallback(
    async (next: DepartmentPolicies) => {
      const prev = policies
      setPolicies(next)
      setSaving(true)
      setError(null)
      try {
        const saved = await departmentsAPI.updatePolicies(department.id, next)
        setPolicies(saved)
        editDepartment({ ...department, policies: saved })
      } catch (e: unknown) {
        setPolicies(prev)
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Не удалось сохранить')
        setError(msg)
      } finally {
        setSaving(false)
      }
    },
    [department, policies],
  )

  const toggleTaskRule = (key: keyof DepartmentTaskRules, value: boolean) => {
    void persist({
      ...policies,
      taskRules: { ...policies.taskRules, [key]: value },
    })
  }

  const toggleNotification = (key: keyof DepartmentNotificationPolicies, value: boolean) => {
    void persist({
      ...policies,
      notifications: { ...policies.notifications, [key]: value },
    })
  }

  const toggleAllNotifications = (enabled: boolean) => {
    const notifications = { ...policies.notifications }
    for (const row of NOTIFICATION_ROWS) {
      notifications[row.key] = enabled
    }
    void persist({ ...policies, notifications })
  }

  const allNotifications = allDeptNotificationsEnabled(policies.notifications)

  return (
    <div className={styles.root}>
      <h2 className={styles.sectionTitle}>Правила задач</h2>
      <p className={styles.sectionDesc}>
        Действуют на все воронки раздела. Настраивают администраторы этого раздела. Владелец и
        администратор организации при работе с задачами эти правила не проходят.
      </p>
      <ul className={styles.list}>
        <li className={styles.item}>
          <label className={styles.label}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={policies.taskRules.requireResponsible}
              disabled={saving}
              onChange={(e) => toggleTaskRule('requireResponsible', e.target.checked)}
            />
            <span className={styles.labelText}>
              <span className={styles.labelTitle}>Обязательно назначать исполнителя</span>
            </span>
          </label>
        </li>
        <li className={styles.item}>
          <label className={styles.label}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={policies.taskRules.requireDeadLine}
              disabled={saving}
              onChange={(e) => toggleTaskRule('requireDeadLine', e.target.checked)}
            />
            <span className={styles.labelText}>
              <span className={styles.labelTitle}>Обязательно указывать срок</span>
            </span>
          </label>
        </li>
      </ul>

      <h2 className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>
        Уведомления админам отдела
      </h2>
      <p className={styles.sectionDesc}>
        Какие события по задачам приходят вам и другим администраторам этого раздела (push).
      </p>
      <ul className={styles.list}>
        <li className={styles.item}>
          <label className={styles.label}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={allNotifications}
              disabled={saving}
              onChange={(e) => toggleAllNotifications(e.target.checked)}
            />
            <span className={styles.labelText}>
              <span className={styles.labelTitle}>Все события</span>
            </span>
          </label>
        </li>
        {NOTIFICATION_ROWS.map((row) => (
          <li key={row.key} className={styles.item}>
            <label className={styles.label}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={policies.notifications[row.key]}
                disabled={saving}
                onChange={(e) => toggleNotification(row.key, e.target.checked)}
              />
              <span className={styles.labelText}>
                <span className={styles.labelTitle}>{row.label}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
