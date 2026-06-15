import { useEffect, useMemo, useState } from 'react'
import { Button } from 'shared/ui'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import type { Pipeline, PipelineTemplate } from 'shared/types/pipelines'
import styles from './CreatePipelineModal.module.css'

type Props = {
  departmentId: number
  /** Закрыть модалку без создания. */
  onClose: () => void
  /** Колбэк после успешного создания, чтобы родитель добавил воронку в стор. */
  onCreated: (pipeline: Pipeline) => void
}

/** Виртуальный «шаблон» — пустая воронка с одной колонкой (текущее поведение API). */
const BLANK_TEMPLATE_KEY = '__blank__' as const

const BLANK_TEMPLATE: PipelineTemplate = {
  key: BLANK_TEMPLATE_KEY,
  name: 'Пустая воронка',
  description: 'Создать с одной колонкой «Задачи». Колонки и цвета добавите вручную.',
  icon: '✨',
  columns: [{ name: 'Задачи', color: null }],
}

export function CreatePipelineModal({ departmentId, onClose, onCreated }: Props) {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>(BLANK_TEMPLATE_KEY)
  const [customName, setCustomName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadingTemplates(true)
    setLoadError('')
    pipelinesAPI
      .getTemplates()
      .then((list) => {
        if (cancelled) return
        setTemplates(list)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить шаблоны')
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Закрывать по Escape — стандартное ожидание для модалок. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const allOptions = useMemo<PipelineTemplate[]>(
    () => [BLANK_TEMPLATE, ...templates],
    [templates],
  )

  const selected = useMemo<PipelineTemplate>(
    () => allOptions.find((t) => t.key === selectedKey) ?? BLANK_TEMPLATE,
    [allOptions, selectedKey],
  )

  const effectiveName = customName.trim().length > 0 ? customName.trim() : selected.name

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!effectiveName) {
      setSubmitError('Введите название воронки')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const created =
        selected.key === BLANK_TEMPLATE_KEY
          ? await pipelinesAPI.create(departmentId, effectiveName)
          : await pipelinesAPI.createFromTemplate(departmentId, selected.key, effectiveName)
      onCreated(created)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось создать воронку')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-pipeline-title">
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h2 id="create-pipeline-title" className={styles.title}>
              Новая воронка
            </h2>
            <p className={styles.subtitle}>
              Выберите шаблон с готовыми колонками или создайте пустую воронку с нуля.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            ×
          </button>
        </header>

        {loadError && <p className={styles.errorBanner}>{loadError}</p>}

        <div className={styles.templatesGrid}>
          {loadingTemplates && templates.length === 0 ? (
            <div className={styles.skeleton}>Загрузка шаблонов…</div>
          ) : (
            allOptions.map((tpl) => {
              const isSelected = tpl.key === selectedKey
              return (
                <button
                  key={tpl.key}
                  type="button"
                  className={`${styles.tplCard} ${isSelected ? styles.tplCardActive : ''}`}
                  onClick={() => {
                    setSelectedKey(tpl.key)
                    setSubmitError('')
                  }}
                >
                  <div className={styles.tplCardHead}>
                    <span className={styles.tplIcon} aria-hidden>
                      {tpl.icon}
                    </span>
                    <span className={styles.tplName}>{tpl.name}</span>
                  </div>
                  <p className={styles.tplDescription}>{tpl.description}</p>
                  <div className={styles.tplPreview}>
                    {tpl.columns.slice(0, 6).map((col, i) => (
                      <span
                        key={`${tpl.key}-col-${i}`}
                        className={styles.tplPreviewChip}
                        style={{
                          background: col.color ?? 'var(--color-bg)',
                          borderColor: col.color ?? 'var(--color-border)',
                          color: col.color ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
                        }}
                        title={col.name}
                      >
                        {col.name}
                      </span>
                    ))}
                    {tpl.columns.length > 6 && (
                      <span className={styles.tplPreviewMore}>
                        +{tpl.columns.length - 6}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Название воронки</span>
            <input
              type="text"
              className={styles.formInput}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={selected.name}
              autoFocus
              maxLength={120}
            />
            <span className={styles.formHint}>
              Пусто — будет использовано имя шаблона: «{selected.name}».
            </span>
          </label>

          {submitError && <p className={styles.formError}>{submitError}</p>}

          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Создание…' : `Создать «${effectiveName}»`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
