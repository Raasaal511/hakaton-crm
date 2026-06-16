import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, LayoutDashboard, Plus } from 'lucide-react'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { pipelineModel } from 'entities/pipeline'
import { Button } from 'shared/ui'
import {
  addFavoritePipelineToStore,
  removeFavoritePipelineFromStore,
  useFavoritesForOrganization,
} from 'entities/pipeline/model/favorites'
import type { Pipeline } from 'shared/types/pipelines'
import styles from './DepartmentPipelines.module.css'
import { CreatePipelineModal } from './CreatePipelineModal'

const CARD_ACCENTS = [
  '#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#ec4899',
]

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
      /* ignore */
    } finally {
      setBusyPipelineId(null)
    }
  }

  if (loading && pipelines.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.skeletonGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionMeta}>
          <span className={styles.sectionTitle}>Воронки</span>
          {pipelines.length > 0 && (
            <span className={styles.sectionCount}>{pipelines.length}</span>
          )}
        </div>
        {canManage && (
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus size={13} />}
            onClick={() => setShowCreateModal(true)}
          >
            Новая воронка
          </Button>
        )}
      </div>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {pipelines.length === 0 && !loading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <LayoutDashboard size={32} strokeWidth={1.25} />
          </div>
          <p className={styles.emptyTitle}>Воронок пока нет</p>
          <p className={styles.emptyText}>Создайте первую воронку для управления задачами в этом разделе</p>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus size={13} />}
              onClick={() => setShowCreateModal(true)}
            >
              Создать воронку
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {pipelines.map((p, idx) => {
            const isFav = favoriteIds.has(p.id)
            const starDisabled = busyPipelineId === p.id
            const accent = CARD_ACCENTS[p.id % CARD_ACCENTS.length] ?? CARD_ACCENTS[idx % CARD_ACCENTS.length]
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className={styles.card}
                style={{ '--card-accent': accent } as React.CSSProperties}
                onClick={() => navigate(`/departments/${departmentId}/pipelines/${p.id}`)}
                onKeyDown={(evt) => {
                  if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault()
                    navigate(`/departments/${departmentId}/pipelines/${p.id}`)
                  }
                }}
                aria-label={`Открыть воронку ${p.name}`}
              >
                <div className={styles.cardAccentBar} />

                <div className={styles.cardIcon}>
                  <LayoutDashboard size={18} strokeWidth={1.5} />
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardBadge}>Канбан‑воронка</div>
                  <div className={styles.cardName}>{p.name}</div>
                </div>

                <button
                  type="button"
                  className={`${styles.cardStarBtn} ${isFav ? styles.cardStarBtnActive : ''}`}
                  title={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
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
                    size={15}
                    strokeWidth={isFav ? 0 : 1.75}
                    className={`${styles.cardStarIcon} ${isFav ? styles.cardStarIconFilled : ''}`}
                    aria-hidden
                    fill={isFav ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
            )
          })}

          {canManage && (
            <button
              type="button"
              className={styles.cardCreate}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={20} strokeWidth={1.75} className={styles.cardCreatePlus} />
              <span className={styles.cardCreateText}>Новая воронка</span>
            </button>
          )}
        </div>
      )}

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
