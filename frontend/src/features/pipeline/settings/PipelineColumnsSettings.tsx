import { useState } from 'react'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { mergeColumnPolicies } from 'shared/lib/departmentPoliciesConfig'
import type { Column } from 'shared/types/columns'
import type { ColumnPolicies } from 'shared/types/departmentPoliciesConfig'
import styles from '../../department/settings/DepartmentSettingsPermissions.module.css'

type Props = {
  pipelineId: number
  columns: Column[]
  completedColumnId: number | null
  isMainTemplate: boolean
  onSaved: (columns: Column[]) => void
}

type RowState = Column & { policies: ColumnPolicies }

export function PipelineColumnsSettings({
  pipelineId,
  columns,
  completedColumnId,
  isMainTemplate,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    [...columns]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ ...c, policies: mergeColumnPolicies(c.policies) })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateRow = (columnId: number, patch: Partial<ColumnPolicies>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === columnId ? { ...r, policies: { ...r.policies, ...patch } } : r,
      ),
    )
  }

  const setCompleted = (columnId: number) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        policies: {
          ...r.policies,
          isCompletedColumn: r.id === columnId,
        },
      })),
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const completedId = rows.find((r) => r.policies.isCompletedColumn)?.id ?? completedColumnId
      if (completedId != null) {
        await pipelinesAPI.updatePolicies(pipelineId, { completedColumnId: completedId })
      }
      const result = await pipelinesAPI.updateColumnsPolicies(
        pipelineId,
        rows.map((r) => ({
          columnId: r.id,
          policies: { ...r.policies, wipLimit: null },
        })),
      )
      const byId = new Map(result.map((x) => [x.columnId, x.policies]))
      const merged = columns.map((c) => ({
        ...c,
        policies: byId.get(c.id) ?? mergeColumnPolicies(c.policies),
      }))
      onSaved(merged)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Не удалось сохранить')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.sectionTitle}>Колонки</h2>
      <p className={styles.sectionDesc}>
        Что проверять при переносе задачи в колонку. Завершающая колонка — одна на воронку (задача
        считается выполненной).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th align="left">Колонка</th>
              <th>Исполнитель при входе</th>
              <th>Срок при входе</th>
              <th>Завершающая</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '0.35rem 0.5rem 0.35rem 0' }}>{row.name}</td>
                <td style={{ padding: '0.35rem 0.5rem' }}>
                  <input
                    type="checkbox"
                    disabled={saving}
                    checked={row.policies.requireResponsibleOnEnter}
                    onChange={(e) =>
                      updateRow(row.id, { requireResponsibleOnEnter: e.target.checked })
                    }
                  />
                </td>
                <td style={{ padding: '0.35rem 0.5rem' }}>
                  <input
                    type="checkbox"
                    disabled={saving}
                    checked={row.policies.requireDeadLineOnEnter}
                    onChange={(e) =>
                      updateRow(row.id, { requireDeadLineOnEnter: e.target.checked })
                    }
                  />
                </td>
                <td style={{ padding: '0.35rem 0.5rem' }}>
                  <input
                    type="radio"
                    name="completedColumn"
                    disabled={saving || (isMainTemplate && row.position === 3)}
                    checked={
                      row.policies.isCompletedColumn ||
                      completedColumnId === row.id ||
                      (isMainTemplate && row.position === 3)
                    }
                    onChange={() => setCompleted(row.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className={styles.sectionTitle}
        style={{
          marginTop: '0.75rem',
          cursor: saving ? 'wait' : 'pointer',
          fontSize: '0.875rem',
          background: 'var(--color-primary, #6366f1)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '0.4rem 0.85rem',
        }}
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Сохранение…' : 'Сохранить колонки'}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
