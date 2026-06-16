import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  FolderKanban,
  Search,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  PauseCircle,
  Archive,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { FormModal } from 'shared/ui/FormModal/FormModal'
import { organizationModel } from 'entities/organization'
import { projectsAPI } from 'shared/api/requests/projects'
import { qk } from 'shared/api/queryKeys'
import type { Project, ProjectStatus, ProjectPriority, CreateProjectDTO, UpdateProjectDTO } from 'shared/types/projects'
import styles from './ProjectsPage.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<ProjectStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  planning:  { label: 'Планирование', icon: <Clock size={12} />,         cls: styles.statusPlanning },
  active:    { label: 'Активный',     icon: <TrendingUp size={12} />,    cls: styles.statusActive },
  on_hold:   { label: 'Приостановлен',icon: <PauseCircle size={12} />,   cls: styles.statusOnHold },
  completed: { label: 'Завершён',     icon: <CheckCircle2 size={12} />,  cls: styles.statusCompleted },
  archived:  { label: 'Архив',        icon: <Archive size={12} />,       cls: styles.statusArchived },
}

const PRIORITY_META: Record<ProjectPriority, { label: string; cls: string }> = {
  low:      { label: 'Низкий',    cls: styles.priorityLow },
  medium:   { label: 'Средний',   cls: styles.priorityMedium },
  high:     { label: 'Высокий',   cls: styles.priorityHigh },
  critical: { label: 'Критичный', cls: styles.priorityCritical },
}

const ALL_STATUSES: { value: ProjectStatus | ''; label: string }[] = [
  { value: '',          label: 'Все статусы' },
  { value: 'planning',  label: 'Планирование' },
  { value: 'active',    label: 'Активные' },
  { value: 'on_hold',   label: 'Приостановлены' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'archived',  label: 'Архив' },
]

const DEFAULT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#06b6d4',
  '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6',
]

function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtBudget(n: number, currency = 'RUB') {
  return n.toLocaleString('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 })
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-color': color } as React.CSSProperties}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────────────────────

type ProjectCardProps = {
  project: Project
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
}

function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const statusMeta = STATUS_META[project.status] ?? STATUS_META.planning
  const priorityMeta = PRIORITY_META[project.priority] ?? PRIORITY_META.medium
  const accent = project.color ?? '#6366f1'

  const startStr = fmtDate(project.startDate)
  const endStr   = fmtDate(project.endDate)
  const isOverdue = project.endDate && project.status !== 'completed' && new Date(project.endDate) < new Date()

  return (
    <div
      className={styles.card}
      style={{ '--card-accent': accent } as React.CSSProperties}
    >
      <div className={styles.cardAccentBar} />

      <div className={styles.cardTop}>
        <div className={styles.cardIcon} style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
          <FolderKanban size={20} />
        </div>
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.cardMenuBtn}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            aria-label="Действия"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className={styles.cardMenu} onMouseLeave={() => setMenuOpen(false)}>
              <button type="button" className={styles.cardMenuItem} onClick={() => { setMenuOpen(false); onEdit(project) }}>
                <Pencil size={13} /> Редактировать
              </button>
              <button type="button" className={`${styles.cardMenuItem} ${styles.cardMenuItemDanger}`} onClick={() => { setMenuOpen(false); onDelete(project) }}>
                <Trash2 size={13} /> Удалить
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardBadges}>
          <span className={`${styles.statusBadge} ${statusMeta.cls}`}>
            {statusMeta.icon}
            {statusMeta.label}
          </span>
          <span className={`${styles.priorityBadge} ${priorityMeta.cls}`}>
            {priorityMeta.label}
          </span>
        </div>
        <h3 className={styles.cardName}>{project.name}</h3>
        {project.description && (
          <p className={styles.cardDesc}>{project.description}</p>
        )}
      </div>

      <div className={styles.cardProgress}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Прогресс</span>
          <span className={styles.progressValue}>{project.progress}%</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${project.progress}%`, background: accent }}
          />
        </div>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.cardMeta}>
          {(startStr || endStr) && (
            <span className={`${styles.metaItem} ${isOverdue ? styles.metaOverdue : ''}`}>
              {isOverdue && <AlertTriangle size={11} />}
              <Calendar size={11} />
              {startStr && endStr ? `${startStr} — ${endStr}` : (endStr ?? startStr)}
            </span>
          )}
          {project.budget > 0 && (
            <span className={styles.metaItem}>
              {fmtBudget(project.budget, project.currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Project form ──────────────────────────────────────────────────────────────

type ProjectFormProps = {
  initial?: Project | null
  onSubmit: (dto: CreateProjectDTO | UpdateProjectDTO) => void
  loading: boolean
  error?: string | null
}

function ProjectForm({ initial, onSubmit, loading, error }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'planning')
  const [priority, setPriority] = useState<ProjectPriority>(initial?.priority ?? 'medium')
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) ?? '')
  const [budget, setBudget] = useState(String(initial?.budget ?? 0))
  const [color, setColor] = useState(initial?.color ?? '#6366f1')
  const [progress, setProgress] = useState(String(initial?.progress ?? 0))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dto: CreateProjectDTO & { progress?: number } = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      startDate: startDate || null,
      endDate: endDate || null,
      budget: Number(budget) || 0,
      color,
    }
    if (initial) (dto as UpdateProjectDTO).progress = Number(progress)
    onSubmit(dto)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.formField}>
        <label className={styles.formLabel}>Название *</label>
        <input
          className={styles.formInput}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Название проекта"
          required
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Описание</label>
        <textarea
          className={styles.formTextarea}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Краткое описание проекта"
          rows={3}
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Статус</label>
          <select className={styles.formSelect} value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
            {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Приоритет</label>
          <select className={styles.formSelect} value={priority} onChange={e => setPriority(e.target.value as ProjectPriority)}>
            {(Object.keys(PRIORITY_META) as ProjectPriority[]).map(p => (
              <option key={p} value={p}>{PRIORITY_META[p].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Начало</label>
          <input type="date" className={styles.formInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Дедлайн</label>
          <input type="date" className={styles.formInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Бюджет (₽)</label>
          <input
            type="number"
            className={styles.formInput}
            value={budget}
            onChange={e => setBudget(e.target.value)}
            min={0}
            placeholder="0"
          />
        </div>
        {initial && (
          <div className={styles.formField}>
            <label className={styles.formLabel}>Прогресс (%)</label>
            <input
              type="number"
              className={styles.formInput}
              value={progress}
              onChange={e => setProgress(e.target.value)}
              min={0}
              max={100}
            />
          </div>
        )}
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Цвет</label>
        <div className={styles.colorPicker}>
          {DEFAULT_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
          <input type="color" className={styles.colorInput} value={color} onChange={e => setColor(e.target.value)} />
        </div>
      </div>

      <div className={styles.formFooter}>
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохранение…' : initial ? 'Сохранить' : 'Создать проект'}
        </Button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const filter = useMemo(() => ({
    q: search.trim() || undefined,
    status: filterStatus || undefined,
  }), [search, filterStatus])

  const { data, isLoading } = useQuery({
    queryKey: qk.projects(orgId, filter),
    queryFn: () => projectsAPI.list(orgId, filter),
    enabled: !!orgId,
  })

  const projects = data?.items ?? []
  const total = data?.total ?? 0

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['projects', orgId] })
  }, [qc, orgId])

  const createMut = useMutation({
    mutationFn: (dto: CreateProjectDTO) => projectsAPI.create(orgId, dto),
    onSuccess: () => { invalidate(); setCreateOpen(false); setFormError(null) },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateProjectDTO }) => projectsAPI.update(orgId, id, dto),
    onSuccess: () => { invalidate(); setEditTarget(null); setFormError(null) },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsAPI.delete(orgId, id),
    onSuccess: () => invalidate(),
  })

  const handleDelete = useCallback((p: Project) => {
    if (!confirm(`Удалить проект «${p.name}»?`)) return
    deleteMut.mutate(p.id)
  }, [deleteMut])

  // KPI calculations
  const kpi = useMemo(() => {
    const all = projects
    const active = all.filter(p => p.status === 'active').length
    const completed = all.filter(p => p.status === 'completed').length
    const totalBudget = all.reduce((s, p) => s + p.budget, 0)
    return { total: all.length, active, completed, totalBudget }
  }, [projects])

  const openCreate = () => { setFormError(null); setCreateOpen(true) }
  const openEdit = (p: Project) => { setFormError(null); setEditTarget(p) }

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Проекты"
          description={`${total} проект${total === 1 ? '' : total > 4 ? 'ов' : 'а'} в организации`}
          actions={
            <Button onClick={openCreate}>
              <Plus size={15} strokeWidth={2} />
              Создать проект
            </Button>
          }
        />

        <div className={styles.content}>
          {/* KPI strip */}
          <div className={styles.kpiStrip}>
            <KpiCard label="Всего проектов" value={kpi.total} color="#6366f1" />
            <KpiCard label="Активные" value={kpi.active} color="#10b981" />
            <KpiCard label="Завершённые" value={kpi.completed} color="#06b6d4" />
            <KpiCard label="Общий бюджет" value={fmtBudget(kpi.totalBudget)} color="#f59e0b" />
          </div>

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Поиск проектов…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as ProjectStatus | '')}
            >
              {ALL_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><FolderKanban size={48} strokeWidth={1} /></div>
              <h3 className={styles.emptyTitle}>
                {search || filterStatus ? 'Проекты не найдены' : 'Проектов пока нет'}
              </h3>
              <p className={styles.emptyDesc}>
                {search || filterStatus
                  ? 'Попробуйте изменить фильтры или поисковый запрос.'
                  : 'Создайте первый проект, чтобы начать управлять задачами и командой.'}
              </p>
              {!search && !filterStatus && (
                <Button onClick={openCreate}>
                  <Plus size={15} />
                  Создать проект
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
              <button type="button" className={styles.addCard} onClick={openCreate}>
                <Plus size={22} strokeWidth={1.5} />
                <span>Новый проект</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <FormModal
        title="Создать проект"
        open={createOpen}
        onClose={() => { setCreateOpen(false); setFormError(null) }}
      >
        <ProjectForm
          onSubmit={dto => createMut.mutate(dto as CreateProjectDTO)}
          loading={createMut.isPending}
          error={formError}
        />
      </FormModal>

      {/* Edit modal */}
      <FormModal
        title="Редактировать проект"
        open={!!editTarget}
        onClose={() => { setEditTarget(null); setFormError(null) }}
      >
        {editTarget && (
          <ProjectForm
            initial={editTarget}
            onSubmit={dto => updateMut.mutate({ id: editTarget.id, dto: dto as UpdateProjectDTO })}
            loading={updateMut.isPending}
            error={formError}
          />
        )}
      </FormModal>
    </AppLayout>
  )
}
