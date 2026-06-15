import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AppLayout, Button, InlineEdit } from 'shared/ui'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { pipelineModel } from 'entities/pipeline'
import { departmentOverviewMounted, departmentOverviewUnmounted } from '../model'
import type { Pipeline } from 'shared/types/pipelines'
import styles from '../settings/DepartmentSettingsPage.module.css'

export function PipelineSettingsPage() {
  const { id, pipelineId } = useParams<{ id: string; pipelineId: string }>()
  const navigate = useNavigate()
  const departmentId = Number(id)
  const pipelineNumericId = Number(pipelineId)

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!departmentId) return
    departmentOverviewMounted({ departmentId })
    return () => departmentOverviewUnmounted()
  }, [departmentId])

  useEffect(() => {
    if (!departmentId || !pipelineNumericId) return
    setLoading(true)
    setError(null)
    pipelinesAPI
      .getAll(departmentId)
      .then((list) => {
        const found = list.find((p) => p.id === pipelineNumericId) ?? null
        if (!found) {
          setError('Воронка не найдена или была удалена')
        }
        setPipeline(found)
      })
      .catch(() => {
        setError('Не удалось загрузить воронку')
      })
      .finally(() => setLoading(false))
  }, [departmentId, pipelineNumericId])

  const handlePipelineNameSave = async (newName: string) => {
    if (!pipeline || pipeline.isMainTemplate) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed === pipeline.name) return
    try {
      const updated = await pipelinesAPI.update(pipeline.id, trimmed)
      setPipeline(updated)
      pipelineModel.editPipeline(updated)
    } catch (err) {
      console.error('Failed to update pipeline name:', err)
      setError('Не удалось сохранить название воронки')
    }
  }

  const handleDeletePipeline = async () => {
    if (!pipeline || pipeline.isMainTemplate) return
    if (!confirm(`Удалить воронку "${pipeline.name}" вместе со всеми колонками и задачами?`)) return
    try {
      await pipelinesAPI.delete(pipeline.id)
      pipelineModel.delPipeline(pipeline.id)
      navigate(`/departments/${departmentId}`)
    } catch (err) {
      console.error('Failed to delete pipeline:', err)
      setError('Не удалось удалить воронку')
    }
  }

  if (loading || !pipeline) {
    return (
      <AppLayout>
        <div className={styles.loading}>{error ?? 'Загрузка...'}</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.breadcrumb}>
            <Link to="/" className={styles.breadcrumbLink}>
              Главная
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link
              to={`/departments/${departmentId}`}
              className={styles.breadcrumbLink}
            >
              Раздел
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link
              to={`/departments/${departmentId}/pipelines/${pipeline.id}`}
              className={styles.breadcrumbLink}
            >
              {pipeline.name}
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Название</span>
          </div>

            <div className={styles.headerActions}>
            <Button
              variant="secondary"
              onClick={() => navigate(`/departments/${departmentId}/pipelines/${pipeline.id}`)}
            >
              ← К воронке
            </Button>
            {!pipeline.isMainTemplate ? (
              <Button variant="danger" onClick={handleDeletePipeline}>
                Удалить
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroIcon}>#</div>
            <div className={styles.heroText}>
              <h1 className={styles.title}>Название воронки</h1>
              <p className={styles.subtitle}>Изменить имя или удалить воронку</p>
            </div>
          </div>

          <div className={styles.sections}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Название</h2>
              </div>
              <p className={styles.sectionDesc}>
                {pipeline.isMainTemplate
                  ? '«Основная воронка» — системная: название, состав колонок и их порядок зафиксированы. Цвет колонок можно менять на доске воронки (меню колонки).'
                  : 'Здесь можно изменить название и удалить воронку. Колонки и задачи привязаны к этой воронке.'}
              </p>
              <div style={{ maxWidth: 320, marginTop: '1rem' }}>
                {pipeline.isMainTemplate ? (
                  <p className={styles.deptName}>{pipeline.name}</p>
                ) : (
                  <div className={styles.deptNameRow}>
                    <InlineEdit
                      value={pipeline.name}
                      onSave={handlePipelineNameSave}
                      className={styles.deptName}
                    />
                    <button
                      type="button"
                      className={styles.editIconBtn}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const target = e.currentTarget.previousElementSibling as HTMLElement | null
                        target?.click()
                      }}
                      title="Переименовать воронку"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M4 13.5L4.5 11.5L11.5 4.5L13.5 6.5L6.5 13.5L4 13.5Z"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M11 4L12.5 2.5C12.8978 2.10218 13.4374 1.87868 14 1.87868C14.2786 1.87868 14.5552 1.9335 14.8142 2.04054C15.0733 2.14758 15.309 2.30468 15.509 2.50471C15.709 2.70473 15.8661 2.94044 15.9732 3.19949C16.0802 3.45854 16.135 3.73513 16.135 4.01375C16.135 4.29236 16.0802 4.56895 15.9732 4.828C15.8661 5.08705 15.709 5.32276 15.509 5.52279L14 7"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 17H16"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </AppLayout>
  )
}

