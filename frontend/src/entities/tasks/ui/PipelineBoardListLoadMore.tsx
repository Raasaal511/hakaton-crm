import { useMemo, useState } from 'react'
import { useUnit } from 'effector-react'
import { tasksModel } from 'entities/tasks'
import type { PipelineBoardTaskFilter } from 'shared/types/tasks'
import styles from './PipelineBoardListLoadMore.module.css'

type Props = {
  columnIds: number[]
  boardFilter: PipelineBoardTaskFilter
}

export function PipelineBoardListLoadMore({ columnIds, boardFilter }: Props) {
  const tasksByColumn = useUnit(tasksModel.$tasksStore)
  const totals = useUnit(tasksModel.$columnTaskTotals)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const columnsWithMore = useMemo(
    () =>
      columnIds.filter((id) => {
        const total = totals[id]
        if (total == null) return false
        return (tasksByColumn[id] ?? []).length < total
      }),
    [columnIds, totals, tasksByColumn],
  )

  const remainingTotal = useMemo(
    () =>
      columnsWithMore.reduce((sum, id) => {
        const total = totals[id] ?? 0
        const loaded = (tasksByColumn[id] ?? []).length
        return sum + Math.max(0, total - loaded)
      }, 0),
    [columnsWithMore, totals, tasksByColumn],
  )

  if (columnsWithMore.length === 0) return null

  const handleLoadMore = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all(
        columnsWithMore.map((columnId) =>
          tasksModel.appendColumnTasksPageFx({ columnId, filter: boardFilter }),
        ),
      )
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Не удалось загрузить ещё задачи'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={styles.btn}
        disabled={loading}
        onClick={() => void handleLoadMore()}
      >
        {loading ? 'Загрузка…' : 'Показать ещё'}
        {!loading && remainingTotal > 0 ? (
          <span className={styles.badge}>{remainingTotal}</span>
        ) : null}
      </button>
    </div>
  )
}
