import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star, Layers, ArrowRight, Building2 } from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { userModel } from 'entities/user'
import { removeFavoritePipelineFromStore } from 'entities/pipeline/model/favorites'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import type { FavoritePipelineLink } from 'shared/types/pipelines'
import styles from './FavoritePipelinesPage.module.css'

type OrgSection = {
  organizationId: number
  organizationName: string
  departments: {
    departmentId: number
    departmentName: string
    items: FavoritePipelineLink[]
  }[]
}

function buildSections(items: FavoritePipelineLink[]): OrgSection[] {
  const orgMap = new Map<
    number,
    { organizationName: string; deptMap: Map<number, { departmentName: string; items: FavoritePipelineLink[] }> }
  >()

  for (const fav of items) {
    const oid = fav.organizationId
    if (oid == null) continue

    let org = orgMap.get(oid)
    if (!org) {
      org = { organizationName: fav.organizationName ?? '', deptMap: new Map() }
      orgMap.set(oid, org)
    }
    if (fav.organizationName) {
      org.organizationName = fav.organizationName
    }

    let dept = org.deptMap.get(fav.departmentId)
    if (!dept) {
      dept = { departmentName: fav.departmentName, items: [] }
      org.deptMap.set(fav.departmentId, dept)
    }
    dept.items.push(fav)
  }

  return Array.from(orgMap.entries()).map(([organizationId, { organizationName, deptMap }]) => ({
    organizationId,
    organizationName,
    departments: Array.from(deptMap.entries()).map(([departmentId, row]) => ({
      departmentId,
      departmentName: row.departmentName,
      items: row.items,
    })),
  }))
}

export function FavoritePipelinesPage() {
  const navigate = useNavigate()
  const currentUser = userModel.selectors.useUser()

  const [items, setItems] = useState<FavoritePipelineLink[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!currentUser?.id) return
    const controller = new AbortController()
    setLoading(true)
    pipelinesAPI
      .listAllFavoritePipelines({ signal: controller.signal })
      .then((list) => {
        setItems(list)
        setError(null)
      })
      .catch((e: unknown) => {
        const name = (e as { name?: string; code?: string }).name
        const code = (e as { code?: string }).code
        if (name === 'CanceledError' || code === 'ERR_CANCELED') return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить избранное')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [currentUser?.id])

  const sections = useMemo(() => buildSections(items), [items])

  const removeFavorite = async (fav: FavoritePipelineLink) => {
    if (busyId != null || fav.organizationId == null) return
    setBusyId(fav.pipelineId)
    try {
      await pipelinesAPI.removeFavoritePipeline(fav.pipelineId)
      removeFavoritePipelineFromStore({
        organizationId: fav.organizationId,
        pipelineId: fav.pipelineId,
      })
      setItems((prev) =>
        prev.filter((x) => !(x.pipelineId === fav.pipelineId && x.organizationId === fav.organizationId)),
      )
    } catch {
      /* silent */
    } finally {
      setBusyId(null)
    }
  }

  if (!currentUser) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Избранные доски</h2>
            <p className={styles.emptyText}>Войдите, чтобы видеть свои избранные воронки.</p>
            <Link to="/auth" className={styles.emptyAction}>
              Войти
              <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Избранные доски</h1>
            </div>
            <p className={styles.subtitle}>
              Воронки из всех ваших пространств, где вы отметили звёздочку.
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span className={styles.metaItem}>Всего: {items.length}</span>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading && items.length === 0 ? (
          <div className={styles.loading}>Загружаем избранное…</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden>
              <Star size={32} strokeWidth={1.75} />
            </div>
            <h2 className={styles.emptyTitle}>Здесь пока пусто</h2>
            <p className={styles.emptyText}>
              Откройте раздел в любом пространстве и отметьте воронку звёздочкой — она появится в этом
              списке.
            </p>
            <Link to="/" className={styles.emptyAction}>
              На главную
              <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        ) : (
          <div className={styles.orgBlocks}>
            {sections.map((org) => (
              <section key={org.organizationId} className={styles.orgSection}>
                <div className={styles.orgHeader}>
                  <Building2 size={15} strokeWidth={2} className={styles.orgHeaderIcon} aria-hidden />
                  <Link to={`/organizations/${org.organizationId}`} className={styles.orgTitle}>
                    {org.organizationName || `Организация #${org.organizationId}`}
                  </Link>
                </div>
                <div className={styles.orgBody}>
                  {org.departments.map((group) => (
                    <div key={`${org.organizationId}-${group.departmentId}`} className={styles.group}>
                      <div className={styles.groupHeader}>
                        <Layers size={14} strokeWidth={2} className={styles.groupIcon} aria-hidden />
                        <Link to={`/departments/${group.departmentId}`} className={styles.groupTitle}>
                          {group.departmentName}
                        </Link>
                        <span className={styles.groupCount}>{group.items.length}</span>
                      </div>
                      <div className={styles.grid}>
                        {group.items.map((fav) => {
                          const to = `/departments/${fav.departmentId}/pipelines/${fav.pipelineId}`
                          const removing = busyId === fav.pipelineId
                          return (
                            <article
                              key={`${fav.organizationId}-${fav.pipelineId}`}
                              className={styles.card}
                              onClick={() => navigate(to)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  navigate(to)
                                }
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              <button
                                type="button"
                                className={styles.cardStar}
                                title="Убрать из избранного"
                                aria-label="Убрать из избранного"
                                aria-pressed
                                disabled={removing}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void removeFavorite(fav)
                                }}
                              >
                                <Star
                                  size={17}
                                  strokeWidth={0}
                                  fill="currentColor"
                                  className={styles.cardStarIcon}
                                  aria-hidden
                                />
                              </button>
                              <div className={styles.cardBadge}>Канбан-воронка</div>
                              <div className={styles.cardTitle}>{fav.pipelineName}</div>
                              <div className={styles.cardFooter}>
                                <span className={styles.cardDept}>{fav.departmentName}</span>
                                <ArrowRight
                                  className={styles.cardArrow}
                                  size={14}
                                  strokeWidth={2.25}
                                  aria-hidden
                                />
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
