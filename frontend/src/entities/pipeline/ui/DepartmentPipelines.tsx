import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { pipelineModel } from 'entities/pipeline'
import {
  addFavoritePipelineToStore,
  removeFavoritePipelineFromStore,
  useFavoritesForOrganization,
} from 'entities/pipeline/model/favorites'
import type { Pipeline } from 'shared/types/pipelines'
import styles from './DepartmentPipelines.module.css'
import { CreatePipelineModal } from './CreatePipelineModal'

type Props = {
  departmentId: number
  organizationId: number
  canManage: boolean
}

export function DepartmentPipelines({ departmentId, organizationId, canManage }: Props) {
  const navigate = useNavigate()
  const pipelines = pipelineModel.selectors.usePipelinesForDepartment(departmentId)
  const orgFavorites = useFavoritesForOrganization(organizationId)
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [busyPipelineId, setBusyPipelineId] = useState<number | null>(null)

  const favoriteIds = useMemo(
    () => new Set(orgFavorites.map((f) => f.pipelineId)),
    [orgFavorites],
  )

  useEffect(() => {
    if (!departmentId || pipelines.length > 0) return

    setLoading(true)
    pipelinesAPI
      .getAll(departmentId)
      .then((list) => {
        pipelineModel.setPipelines({ departmentId, pipelines: list })
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить воронки')
      })
      .finally(() => setLoading(false))
  }, [departmentId, pipelines.length])

  const handleCreated = (pipeline: Pipeline) => {
    pipelineModel.addPipeline(pipeline)
    navigate(`/departments/${departmentId}/pipelines/${pipeline.id}`)
  }

  const toggleFavorite = async (e: React.MouseEvent, pipeline: Pipeline) => {
    e.preventDefault()
    e.stopPropagation()
    if (busyPipelineId != null) return
    const isFav = favoriteIds.has(pipeline.id)
    setBusyPipelineId(pipeline.id)
    try {
      if (isFav) {
        await pipelinesAPI.removeFavoritePipeline(pipeline.id)
        removeFavoritePipelineFromStore({ organizationId, pipelineId: pipeline.id })
      } else {
        const item = await pipelinesAPI.addFavoritePipeline(pipeline.id)
        addFavoritePipelineToStore({ organizationId, item })
      }
    } catch {
      /* оставить без toast — ошибка уже в axios message при необходимости */
    } finally {
      setBusyPipelineId(null)
    }
  }

  if (loading && pipelines.length === 0) {
    return <div className={styles.loading}>Загрузка воронок…</div>
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
        </div>
        {loadError && <p className={styles.error}>{loadError}</p>}
      </div>

      <div className={styles.grid}>
        {pipelines.map((p) => {
          const isFav = favoriteIds.has(p.id)
          const starDisabled = busyPipelineId === p.id
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              className={styles.card}
              onClick={() => navigate(`/departments/${departmentId}/pipelines/${p.id}`)}
              onKeyDown={(evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                  evt.preventDefault()
                  navigate(`/departments/${departmentId}/pipelines/${p.id}`)
                }
              }}
              aria-label={`Открыть воронку ${p.name}`}
            >
              <button
                type="button"
                className={`${styles.cardStarBtn} ${isFav ? styles.cardStarBtnActive : ''}`}
                title={isFav ? 'Убрать из избранного' : 'Добавить в избранные доски'}
                aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
                aria-pressed={isFav}
                disabled={starDisabled}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => void toggleFavorite(e, p)}
              >
                <Star
                  size={17}
                  strokeWidth={isFav ? 0 : 1.75}
                  className={`${styles.cardStarIcon} ${isFav ? styles.cardStarIconFilled : ''}`}
                  aria-hidden
                  fill={isFav ? 'currentColor' : 'none'}
                />
              </button>
              <div className={styles.cardBody}>
                <div className={styles.cardBadge}>Канбан‑воронка</div>
                <div className={styles.cardName}>{p.name}</div>
              </div>
            </div>
          )
        })}

        {canManage && (
          <button
            type="button"
            className={styles.cardCreate}
            onClick={() => setShowCreateModal(true)}
          >
            <span className={styles.cardCreatePlus}>+</span>
            <span className={styles.cardCreateText}>Новая воронка</span>
          </button>
        )}
      </div>

      {showCreateModal && canManage && (
        <CreatePipelineModal
          departmentId={departmentId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
