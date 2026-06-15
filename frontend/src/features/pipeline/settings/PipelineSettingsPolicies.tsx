import { useCallback, useEffect, useState } from 'react'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { departmentsAPI } from 'shared/api/requests/departments'
import { mergeDepartmentPolicies, mergePipelinePolicies } from 'shared/lib/departmentPoliciesConfig'
import type { Column } from 'shared/types/columns'
import type {
  DepartmentNotificationPolicies,
  PipelineNotificationOverrides,
  PipelinePolicies,
} from 'shared/types/departmentPoliciesConfig'
import { PipelineColumnsSettings } from './PipelineColumnsSettings'
import styles from '../../department/settings/DepartmentSettingsPermissions.module.css'

type Props = {
  pipelineId: number
  departmentId: number
  isMainTemplate: boolean
  columns: Column[]
  initialPolicies?: PipelinePolicies
  onColumnsSaved: (columns: Column[]) => void
}

const NOTIFICATION_ROWS: Array<{
  key: keyof DepartmentNotificationPolicies
  label: string
}> = [
  { key: 'deptAdminOnTaskCreated', label: 'Новая задача' },
  { key: 'deptAdminOnTaskCompleted', label: 'Завершение' },
  { key: 'deptAdminOnTaskMoved', label: 'Перенос' },
  { key: 'deptAdminOnAssigneesChanged', label: 'Смена исполнителей' },
]

type TriState = 'inherit' | 'on' | 'off'

function notificationTriState(v: boolean | null | undefined): TriState {
  if (v === true) return 'on'
  if (v === false) return 'off'
  return 'inherit'
}

export function PipelineSettingsPolicies({
  pipelineId,
  departmentId,
  isMainTemplate,
  columns,
  initialPolicies,
  onColumnsSaved,
}: Props) {
  const [policies, setPolicies] = useState<PipelinePolicies>(() =>
    mergePipelinePolicies(initialPolicies),
  )
  const [deptPolicies, setDeptPolicies] = useState(mergeDepartmentPolicies(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPolicies(mergePipelinePolicies(initialPolicies))
  }, [pipelineId, initialPolicies])

  useEffect(() => {
    departmentsAPI.getById(departmentId).then((d) => {
      setDeptPolicies(mergeDepartmentPolicies(d.policies))
    }).catch(() => undefined)
  }, [departmentId])

  const persist = useCallback(
    async (next: PipelinePolicies) => {
      const prev = policies
      setPolicies(next)
      setSaving(true)
      setError(null)
      try {
        const saved = await pipelinesAPI.updatePolicies(pipelineId, next)
        setPolicies(saved)
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
    [pipelineId, policies],
  )

  const setMemberOverride = (
    key: 'memberCanSeeAllTasks' | 'memberCanCreateTasks',
    mode: TriState,
  ) => {
    const value = mode === 'inherit' ? null : mode === 'on'
    void persist({ ...policies, [key]: value })
  }

  const setNotificationOverride = (key: keyof PipelineNotificationOverrides, mode: TriState) => {
    const value = mode === 'inherit' ? null : mode === 'on'
    void persist({
      ...policies,
      notifications: { ...policies.notifications, [key]: value },
    })
  }

  const renderTri = (
    label: string,
    value: TriState,
    onChange: (m: TriState) => void,
  ) => (
    <li className={styles.item} key={label}>
      <span className={styles.labelTitle} style={{ display: 'block', marginBottom: 4 }}>
        {label}
      </span>
      <select
        disabled={saving}
        value={value}
        onChange={(e) => onChange(e.target.value as TriState)}
      >
        <option value="inherit">Как в разделе</option>
        <option value="on">Включено</option>
        <option value="off">Выключено</option>
      </select>
    </li>
  )

  return (
    <>
      <div className={styles.root}>
        <h2 className={styles.sectionTitle}>Завершение задач</h2>
        <p className={styles.sectionDesc}>
          Колонка, при переносе в которую задача считается завершённой. Для основной воронки по
          умолчанию — «Завершенные».
        </p>
        <select
          disabled={saving || isMainTemplate}
          value={policies.completedColumnId ?? ''}
          onChange={(e) => {
            const v = e.target.value
            void persist({
              ...policies,
              completedColumnId: v === '' ? null : Number(v),
            })
          }}
          style={{ maxWidth: 280 }}
        >
          <option value="">Последняя по порядку</option>
          {[...columns]
            .sort((a, b) => a.position - b.position)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      <div className={styles.root} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.sectionTitle}>Участники в этой воронке</h2>
        <p className={styles.sectionDesc}>
          Переопределение прав участников раздела (по умолчанию — как в настройках раздела).
        </p>
        <ul className={styles.list}>
          {renderTri(
            'Видеть все задачи воронки',
            policies.memberCanSeeAllTasks === null
              ? 'inherit'
              : policies.memberCanSeeAllTasks
                ? 'on'
                : 'off',
            (m) => setMemberOverride('memberCanSeeAllTasks', m),
          )}
          {renderTri(
            'Создавать задачи',
            policies.memberCanCreateTasks === null
              ? 'inherit'
              : policies.memberCanCreateTasks
                ? 'on'
                : 'off',
            (m) => setMemberOverride('memberCanCreateTasks', m),
          )}
        </ul>
      </div>

      <div className={styles.root} style={{ marginTop: '1.25rem' }}>
        <h2 className={styles.sectionTitle}>Уведомления админам отдела</h2>
        <p className={styles.sectionDesc}>
          Переопределение уведомлений раздела. Сейчас в разделе:{' '}
          {deptPolicies.notifications.deptAdminOnTaskCreated ? 'вкл.' : 'выкл.'} для новых задач.
        </p>
        <ul className={styles.list}>
          {NOTIFICATION_ROWS.map((row) =>
            renderTri(row.label, notificationTriState(policies.notifications[row.key]), (m) =>
              setNotificationOverride(row.key, m),
            ),
          )}
        </ul>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      <section style={{ marginTop: '1.25rem' }}>
        <PipelineColumnsSettings
          pipelineId={pipelineId}
          columns={columns}
          completedColumnId={policies.completedColumnId}
          isMainTemplate={isMainTemplate}
          onSaved={onColumnsSaved}
        />
      </section>
    </>
  )
}
