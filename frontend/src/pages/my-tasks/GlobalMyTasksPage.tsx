import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  TaskCalendar,
  TaskCalendarViewToggle,
  CalendarOrgQuickCreateDrawer,
  useCalendarDisplayMode,
  useCalendarMonthQuery,
  calendarMonthQueryKey,
} from 'features/calendar'
import { ArrowUpDown } from 'lucide-react'
import {
  AppLayout,
  Dropdown,
  FilterSelectTrigger,
  filterSelectDropdownClassName,
  PaginationBar,
  type DropdownItem,
} from 'shared/ui'
import { ScopedTasksTable, type ScopedTasksTableRow } from 'entities/tasks'
import { userModel } from 'entities/user'
import { organizationModel } from 'entities/organization'
import { tasksAPI } from 'shared/api/requests/tasks'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { departmentsAPI } from 'shared/api/requests/departments'
import { setOrganizations } from 'shared/api/events/organization'
import type { Organization, OrganizationMember } from 'shared/types/organization'
import type { Department } from 'shared/types/departments'
import type { Task } from 'shared/types/tasks'
import { cn, useMediaQuery, mediaMaxMobileQuery } from 'shared/lib'
import { readLastVisitedOrganizationId } from 'shared/lib/lastVisitedOrganization'
import type { MyTasksListSortMode } from 'shared/lib/taskListSort'
import { MY_TASKS_PAGE_SIZE } from 'shared/lib/myTasksPagination'
import styles from './GlobalMyTasksPage.module.css'

type TaskBucket = 'outgoing' | 'incoming' | 'completed' | 'overdue' | 'review' | 'organization'

type TaskRow = {
  task: Task
  buckets: TaskBucket[]
  organizationName: string
}

type DepartmentFilterOption = {
  id: number
  name: string
  organizationId: number
  organizationName: string
}

const BUCKET_LABELS: Record<Exclude<TaskBucket, 'organization'>, string> = {
  incoming: 'Входящие',
  outgoing: 'Исходящие',
  review: 'Проверка',
  completed: 'Завершённые',
  overdue: 'Просроченные',
}

/** В фильтре «Тип» нет отдельного пункта для задач с полным доступом — они без отдельного бейджа в таблице. */
const BUCKET_FILTER_KEYS = Object.keys(BUCKET_LABELS) as (keyof typeof BUCKET_LABELS)[]
const INVOLVEMENT_LABELS: Record<'all' | 'created' | 'assigned', string> = {
  all: 'Любое',
  created: 'Создано мной',
  assigned: 'Я исполнитель',
}

function globalBucketDotColor(buckets: TaskBucket[]): string {
  if (buckets.includes('overdue')) return 'var(--color-required)'
  if (buckets.includes('completed')) return 'var(--color-text-secondary)'
  if (buckets.includes('review')) return 'var(--color-accent-secondary)'
  if (buckets.includes('incoming')) return 'var(--color-accent)'
  if (buckets.includes('outgoing')) return 'var(--color-accent)'
  if (buckets.includes('organization')) return 'var(--color-accent-secondary)'
  return 'var(--color-accent)'
}

function globalRowToScoped(row: TaskRow): ScopedTasksTableRow {
  const nonOrg = row.buckets.filter((b) => b !== 'organization')
  const labels: string[] = []
  for (const b of nonOrg) {
    if (Object.prototype.hasOwnProperty.call(BUCKET_LABELS, b)) {
      labels.push(BUCKET_LABELS[b as keyof typeof BUCKET_LABELS])
    }
  }
  const hasOrgScope = row.buckets.includes('organization')
  const stageLabel =
    labels.length > 0 ? labels.join(', ') : hasOrgScope ? 'Вся организация' : '—'
  const stageDone =
    row.buckets.includes('completed') || Boolean(row.task.inPipelineTerminalColumn)
  return {
    task: row.task,
    stageLabel,
    stageDone,
    stageDotColor: globalBucketDotColor(row.buckets),
    organizationName: row.organizationName,
  }
}

function orgMemberLabel(m: OrganizationMember) {
  const n = [m.firstname, m.lastname].filter(Boolean).join(' ').trim()
  return n || m.email
}

export function GlobalMyTasksPage() {
  const currentUser = userModel.selectors.useUser()
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()

  const [loading, setLoading] = useState(false)
  const [fetchedOrgs, setFetchedOrgs] = useState<Organization[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partialWarning, setPartialWarning] = useState(false)
  const [rows, setRows] = useState<TaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasOrgScopeTasks, setHasOrgScopeTasks] = useState(false)
  const [memberNamesByOrg, setMemberNamesByOrg] = useState<Record<number, Map<number, string>>>({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const lastFetchedDebouncedRef = useRef(debouncedSearch)
  const [orgFilter, setOrgFilter] = useState<number | 'all'>('all')
  const [departmentFilter, setDepartmentFilter] = useState<number | 'all'>('all')
  const [bucketFilter, setBucketFilter] = useState<Exclude<TaskBucket, 'organization'> | 'all'>('all')
  const [involvementFilter, setInvolvementFilter] = useState<'all' | 'created' | 'assigned'>('all')
  const [departments, setDepartments] = useState<DepartmentFilterOption[]>([])
  const autoOrgFilterAppliedRef = useRef(false)

  const GLOBAL_MY_TASKS_SORT_KEY = 'globalMyTasksListSort'
  const GLOBAL_MY_TASKS_LAYOUT_KEY = 'globalMyTasksLayout'
  const GLOBAL_MY_TASKS_CALENDAR_MODE_KEY = 'globalMyTasksCalendarMode'
  const [listSort, setListSortState] = useState<MyTasksListSortMode>('bucket')
  const [viewLayout, setViewLayoutState] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [calendarDisplayMode, setCalendarDisplayMode] = useCalendarDisplayMode(
    GLOBAL_MY_TASKS_CALENDAR_MODE_KEY,
  )
  const [calendarCreateOpen, setCalendarCreateOpen] = useState(false)
  const [calendarCreateYmd, setCalendarCreateYmd] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    try {
      const v = localStorage.getItem(GLOBAL_MY_TASKS_LAYOUT_KEY)
      if (v === 'calendar') setViewLayoutState('calendar')
    } catch {
      /* ignore */
    }
  }, [])

  const setViewLayout = useCallback((mode: 'list' | 'calendar') => {
    setViewLayoutState(mode)
    try {
      localStorage.setItem(GLOBAL_MY_TASKS_LAYOUT_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      const v = localStorage.getItem(GLOBAL_MY_TASKS_SORT_KEY)
      if (v === 'deadline_asc' || v === 'deadline_desc' || v === 'bucket') {
        setListSortState(v)
      } else {
        setListSortState('bucket')
      }
    } catch {
      setListSortState('bucket')
    }
  }, [])

  const setListSort = useCallback((mode: MyTasksListSortMode) => {
    setListSortState(mode)
    try {
      localStorage.setItem(GLOBAL_MY_TASKS_SORT_KEY, mode)
    } catch {
      /* ignore */
    }
    setPage(1)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!currentUser) {
      setFetchedOrgs(null)
      setRows([])
      setTotal(0)
      setHasOrgScopeTasks(false)
      setMemberNamesByOrg({})
      setError(null)
      setPartialWarning(false)
      setLoading(false)
      return
    }

    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const orgs = await organizationsAPI.getAll()
        setOrganizations(orgs)
        if (cancelled) return
        setFetchedOrgs(orgs)

        if (orgs.length === 0) {
          setMemberNamesByOrg({})
          return
        }

        const memberLists = await Promise.all(
          orgs.map((org) => organizationsAPI.getMembers(org.id).catch(() => [] as OrganizationMember[])),
        )
        const departmentLists = await Promise.all(
          orgs.map((org) => departmentsAPI.getAll(org.id).catch(() => [] as Department[])),
        )
        if (cancelled) return
        const next: Record<number, Map<number, string>> = {}
        for (let i = 0; i < orgs.length; i++) {
          const map = new Map<number, string>()
          for (const m of memberLists[i]!) {
            map.set(m.id, orgMemberLabel(m))
          }
          const org = orgs[i]!
          next[org.id] = map
        }
        setMemberNamesByOrg(next)
        setDepartments(
          departmentLists
            .flatMap((items, i) => {
              const org = orgs[i]!
              return items.map((d) => ({
                id: d.id,
                name: d.name,
                organizationId: org.id,
                organizationName: org.name,
              }))
            })
            .sort((a, b) => {
              const byOrg = a.organizationName.localeCompare(b.organizationName, 'ru')
              if (byOrg !== 0) return byOrg
              return a.name.localeCompare(b.name, 'ru')
            }),
        )
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить пространства')
          setFetchedOrgs([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const calendarQueryScope =
    viewLayout === 'calendar' && currentUser
      ? {
          type: 'global' as const,
          organizationId: orgFilter === 'all' ? undefined : orgFilter,
          departmentId: departmentFilter === 'all' ? undefined : departmentFilter,
          bucket: bucketFilter,
          involvement: involvementFilter,
          q: debouncedSearch || undefined,
          sort: listSort,
        }
      : null

  const calendarQuery = useCalendarMonthQuery(
    calendarMonth,
    calendarQueryScope,
    calendarDisplayMode,
  )

  const calendarCreateOrgId =
    orgFilter !== 'all'
      ? orgFilter
      : currentOrganization?.id ?? fetchedOrgs?.[0]?.id ?? 0

  useEffect(() => {
    if (!currentUser || fetchedOrgs === null || viewLayout === 'calendar') {
      return
    }

    if (fetchedOrgs.length === 0) {
      setRows([])
      setTotal(0)
      setHasOrgScopeTasks(false)
      setLoading(false)
      return
    }

    let cancelled = false

    ;(async () => {
      const searchChanged = lastFetchedDebouncedRef.current !== debouncedSearch
      if (searchChanged && page > 1) {
        setPage(1)
        return
      }
      setLoading(true)
      setError(null)
      setPartialWarning(false)
      try {
        const data = await tasksAPI.getGlobalMyTasks({
          page,
          pageSize: MY_TASKS_PAGE_SIZE,
          organizationId: orgFilter === 'all' ? undefined : orgFilter,
          departmentId: departmentFilter === 'all' ? undefined : departmentFilter,
          bucket: bucketFilter,
          involvement: involvementFilter,
          q: debouncedSearch || undefined,
          sort: listSort,
        })
        if (cancelled) return
        lastFetchedDebouncedRef.current = debouncedSearch
        setRows(
          data.rows.map((r) => ({
            task: r.task,
            buckets: r.buckets as TaskBucket[],
            organizationName: r.organizationName,
          })),
        )
        setTotal(data.total)
        setPage(data.page)
        setHasOrgScopeTasks(data.hasOrgScopeTask)
        setPartialWarning(data.failedOrganizationIds.length > 0)
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить задачи')
          setRows([])
          setTotal(0)
          setHasOrgScopeTasks(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, fetchedOrgs, page, orgFilter, departmentFilter, bucketFilter, involvementFilter, debouncedSearch, listSort, viewLayout])

  useEffect(() => {
    if (autoOrgFilterAppliedRef.current) return
    if (fetchedOrgs == null || fetchedOrgs.length === 0) return
    if (orgFilter !== 'all') {
      autoOrgFilterAppliedRef.current = true
      return
    }
    const preferredOrgId = currentOrganization?.id ?? readLastVisitedOrganizationId()
    // Дождаться следующего тика после setOrganizations/hydrate: не ставим «уже применено»,
    // если id ещё неизвестны — иначе после перезагрузки фильтр навсегда остаётся «все пространства».
    if (preferredOrgId == null) {
      return
    }
    const exists = fetchedOrgs.some((o) => o.id === preferredOrgId)
    if (!exists) {
      autoOrgFilterAppliedRef.current = true
      return
    }
    setOrgFilter(preferredOrgId)
    setPage(1)
    autoOrgFilterAppliedRef.current = true
  }, [fetchedOrgs, currentOrganization?.id, orgFilter])

  useEffect(() => {
    if (orgFilter === 'all') return
    const hasSelectedDepartment = departments.some(
      (d) => d.id === departmentFilter && d.organizationId === orgFilter,
    )
    if (!hasSelectedDepartment && departmentFilter !== 'all') {
      setDepartmentFilter('all')
    }
  }, [orgFilter, departmentFilter, departments])

  const orgOptions = useMemo(
    () => [...(fetchedOrgs ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [fetchedOrgs],
  )

  const personalOrganizationIds = useMemo(
    () => new Set((fetchedOrgs ?? []).filter((o) => o.isPersonal).map((o) => o.id)),
    [fetchedOrgs],
  )

  const scopedTableRows = useMemo(() => rows.map(globalRowToScoped), [rows])

  const isMobileLayout = useMediaQuery(mediaMaxMobileQuery)

  const orgDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'all', label: 'Все пространства' },
      ...orgOptions.map((org) => ({
        id: String(org.id),
        label: org.name,
      })),
    ],
    [orgOptions],
  )
  const departmentOptions = useMemo(
    () =>
      departments.filter((d) => orgFilter === 'all' || d.organizationId === orgFilter),
    [departments, orgFilter],
  )
  const departmentDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'all', label: 'Все отделы' },
      ...departmentOptions.map((dep) => ({
        id: String(dep.id),
        label: dep.name,
        description: dep.organizationName,
      })),
    ],
    [departmentOptions],
  )
  const bucketDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'all', label: 'Все типы' },
      ...BUCKET_FILTER_KEYS.map((b) => ({
        id: b,
        label: BUCKET_LABELS[b],
      })),
    ],
    [],
  )
  const involvementDropdownItems = useMemo<DropdownItem[]>(
    () =>
      (Object.keys(INVOLVEMENT_LABELS) as Array<keyof typeof INVOLVEMENT_LABELS>).map((id) => ({
        id,
        label: INVOLVEMENT_LABELS[id],
      })),
    [],
  )
  const listSortDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'bucket', label: 'По типу задачи' },
      { id: 'deadline_asc', label: 'Срок — сначала ближайшие' },
      { id: 'deadline_desc', label: 'Срок — сначала поздние' },
    ],
    [],
  )

  const totalPages = Math.max(1, Math.ceil(total / MY_TASKS_PAGE_SIZE) || 1)

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (!currentUser) {
    return (
      <AppLayout>
        <div className={styles.centered}>
          <h1 className={styles.centerTitle}>Все задачи</h1>
          <p className={styles.centerText}>Авторизуйтесь, чтобы просматривать задачи.</p>
          <Link to="/auth" className={styles.authLink}>
            Войти
          </Link>
        </div>
      </AppLayout>
    )
  }

  if (currentUser && fetchedOrgs !== null && fetchedOrgs.length === 0 && !loading && !error) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <header className={styles.header}>
            <nav className={styles.breadcrumb} aria-label="Навигация">
              <Link to="/" className={styles.breadcrumbLink}>
                Главная
              </Link>
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbCurrent}>Все задачи</span>
            </nav>
            <h1 className={styles.pageTitle}>Все задачи</h1>
            <p className={styles.pageSubtitle}>
              Здесь собираются задачи из всех пространств и команд, где вы участвуете.
            </p>
          </header>
          <div className={styles.emptyOrganizations}>
            <p className={styles.emptyOrganizationsText}>
              Пока нет ни одного пространства. Создайте личное или командное — на главной странице.
            </p>
            <Link to="/" className={styles.homeLink}>
              На главную
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (currentUser && fetchedOrgs === null) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.loading}>Загрузка…</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div
        className={cn(
          styles.page,
          viewLayout === 'calendar' && styles.pageCalendarMode,
        )}
      >
        <header className={styles.header}>
          <nav className={styles.breadcrumb} aria-label="Навигация">
            <Link to="/" className={styles.breadcrumbLink}>
              Главная
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Все задачи</span>
          </nav>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.pageTitle}>Все задачи</h1>
              <p className={styles.pageSubtitle}>
                {hasOrgScopeTasks
                  ? 'Сводка по пространствам, где у вас есть полный доступ: видны и ваши личные задачи, и остальные по всей организации. У участников — только свои (создатель, исполнитель, соисполнители).'
                  : 'Ваши поручения и входящие по всем пространствам, где вы участвуете; метка «Создано мной» для исходящих, завершение и сроки — как на дашборде.'}
              </p>
            </div>
            <div className={styles.headerRowAside}>
              <TaskCalendarViewToggle
                variant="listOnly"
                value={viewLayout}
                onChange={setViewLayout}
              />
              <div className={styles.statPills} aria-live="polite">
                <span className={styles.statPill}>
                  <span className={styles.statPillValue}>{total}</span>
                  <span className={styles.statPillLabel}>
                    {search || orgFilter !== 'all' || departmentFilter !== 'all' || bucketFilter !== 'all' || involvementFilter !== 'all' ? 'по фильтру' : 'всего'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {partialWarning && !error && (
          <div className={styles.warning}>
            Часть пространств не удалось загрузить. Список может быть неполным — попробуйте обновить
            страницу.
          </div>
        )}

        <div className={styles.filtersCard}>
          <label className={styles.searchLabel}>
            <span className={styles.srOnly}>Поиск по названию</span>
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Поиск по названию задачи…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className={styles.filtersGrid}>
            <div className={styles.filterBlock}>
              <span className={styles.filterHeading}>Пространство</span>
              <Dropdown
                items={orgDropdownItems}
                value={String(orgFilter)}
                placeholder="Все пространства"
                searchPlaceholder="Поиск пространства..."
                size="large"
                renderTrigger={({ open, selectedLabel, toggle }) => (
                  <FilterSelectTrigger
                    open={open}
                    selectedLabel={selectedLabel || 'Все пространства'}
                    toggle={toggle}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M2.75 4.25A1.25 1.25 0 0 1 4 3h8a1.25 1.25 0 0 1 1.25 1.25v7.5A1.25 1.25 0 0 1 12 13H4a1.25 1.25 0 0 1-1.25-1.25v-7.5Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M2.75 5.25h10.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    }
                  />
                )}
                onChange={(value) => {
                  const raw = value == null ? 'all' : String(value)
                  setPage(1)
                  if (raw === 'all') {
                    setOrgFilter('all')
                    setDepartmentFilter('all')
                    return
                  }
                  const numeric = Number(raw)
                  if (!Number.isNaN(numeric)) {
                    setOrgFilter(numeric)
                    setDepartmentFilter('all')
                  }
                }}
                className={filterSelectDropdownClassName}
              />
            </div>

            <div className={styles.filterBlock}>
              <span className={styles.filterHeading}>Отдел</span>
              <Dropdown
                items={departmentDropdownItems}
                value={String(departmentFilter)}
                placeholder="Все отделы"
                searchPlaceholder="Поиск отдела..."
                size="large"
                renderTrigger={({ open, selectedLabel, toggle }) => (
                  <FilterSelectTrigger
                    open={open}
                    selectedLabel={selectedLabel || 'Все отделы'}
                    toggle={toggle}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M2.5 12.5h11M3.5 12.5V4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8M6 12.5V9.25M8 12.5V9.25M10 12.5V9.25"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                )}
                onChange={(value) => {
                  const raw = value == null ? 'all' : String(value)
                  setPage(1)
                  if (raw === 'all') {
                    setDepartmentFilter('all')
                    return
                  }
                  const numeric = Number(raw)
                  if (!Number.isNaN(numeric)) {
                    setDepartmentFilter(numeric)
                  }
                }}
                className={filterSelectDropdownClassName}
              />
            </div>

            <div className={styles.filterBlock}>
              <span className={styles.filterHeading}>Тип</span>
              <Dropdown
                items={bucketDropdownItems}
                value={bucketFilter}
                placeholder="Все типы"
                searchPlaceholder="Поиск типа..."
                size="large"
                renderTrigger={({ open, selectedLabel, toggle }) => (
                  <FilterSelectTrigger
                    open={open}
                    selectedLabel={selectedLabel || 'Все типы'}
                    toggle={toggle}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 4h10M3 8h7M3 12h5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    }
                  />
                )}
                onChange={(value) => {
                  const raw = value == null ? 'all' : String(value)
                  if (raw === 'all' || BUCKET_FILTER_KEYS.includes(raw as Exclude<TaskBucket, 'organization'>)) {
                    setPage(1)
                    setBucketFilter(raw as Exclude<TaskBucket, 'organization'> | 'all')
                  }
                }}
                className={filterSelectDropdownClassName}
              />
            </div>

            <div className={styles.filterBlock}>
              <span className={styles.filterHeading}>Участие</span>
              <Dropdown
                items={involvementDropdownItems}
                value={involvementFilter}
                placeholder="Любое"
                searchPlaceholder="Поиск участия..."
                size="large"
                renderTrigger={({ open, selectedLabel, toggle }) => (
                  <FilterSelectTrigger
                    open={open}
                    selectedLabel={selectedLabel || 'Любое'}
                    toggle={toggle}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M5.5 6.25a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10.75 6.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
                          stroke="currentColor"
                          strokeWidth="1.3"
                        />
                        <path
                          d="M2.75 12.75a2.75 2.75 0 0 1 5.5 0M8.5 12.75a2.25 2.25 0 0 1 4.5 0"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                    }
                  />
                )}
                onChange={(value) => {
                  const raw = value == null ? 'all' : String(value)
                  if (raw === 'all' || raw === 'created' || raw === 'assigned') {
                    setPage(1)
                    setInvolvementFilter(raw)
                  }
                }}
                className={filterSelectDropdownClassName}
              />
            </div>
          </div>

          <div className={styles.filtersListSortBand}>
            <div className={styles.filtersListSortIntro}>
              <span className={styles.filtersListSortTitle}>Порядок в таблице</span>
            </div>
            <div className={styles.filtersListSortControl}>
              <Dropdown
                items={listSortDropdownItems}
                value={listSort}
                placeholder="По типу"
                searchPlaceholder="Найти вариант…"
                size="large"
                renderTrigger={({ open, selectedLabel, toggle }) => (
                  <FilterSelectTrigger
                    open={open}
                    selectedLabel={selectedLabel || 'По типу'}
                    toggle={toggle}
                    icon={<ArrowUpDown size={16} strokeWidth={1.75} aria-hidden />}
                  />
                )}
                onChange={(value) => {
                  const raw = value == null ? 'bucket' : String(value)
                  if (raw === 'bucket' || raw === 'deadline_asc' || raw === 'deadline_desc') {
                    setListSort(raw as MyTasksListSortMode)
                  }
                }}
                className={filterSelectDropdownClassName}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка задач…</div>
        ) : total === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Нет задач по выбранным условиям</p>
            <p className={styles.emptyHint}>
              Сбросьте фильтры или поищите другое название — или откройте задачи одного пространства в
              меню слева.
            </p>
            {(search || orgFilter !== 'all' || departmentFilter !== 'all' || bucketFilter !== 'all' || involvementFilter !== 'all') && (
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setSearch('')
                  setOrgFilter('all')
                  setDepartmentFilter('all')
                  setBucketFilter('all')
                  setInvolvementFilter('all')
                  setPage(1)
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : viewLayout === 'calendar' ? (
          <div className={styles.calendarWrap}>
            <TaskCalendar
              tasks={calendarQuery.data ?? []}
              loading={calendarQuery.isPending}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              displayMode={calendarDisplayMode}
              onDisplayModeChange={setCalendarDisplayMode}
              canCreate={calendarCreateOrgId > 0}
              onAddTask={(ymd) => {
                setCalendarCreateYmd(ymd)
                setCalendarCreateOpen(true)
              }}
              onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
            />
          </div>
        ) : (
          <>
            <ScopedTasksTable
              rows={scopedTableRows}
              memberNamesByOrg={memberNamesByOrg}
              currentUser={
                currentUser
                  ? {
                      id: currentUser.id,
                      firstname: currentUser.firstname ?? '',
                      lastname: currentUser.lastname ?? '',
                      email: currentUser.email ?? '',
                    }
                  : null
              }
              personalOrganizationIds={personalOrganizationIds}
              showOrganizationColumn
            />
            <PaginationBar
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={MY_TASKS_PAGE_SIZE}
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </>
        )}
      </div>
      <CalendarOrgQuickCreateDrawer
        open={calendarCreateOpen}
        onClose={() => setCalendarCreateOpen(false)}
        organizationId={calendarCreateOrgId}
        ymd={calendarCreateYmd}
        currentUserId={currentUser?.id}
        onCreated={() => {
          if (calendarQueryScope) {
            queryClient.invalidateQueries({
              queryKey: calendarMonthQueryKey(calendarQueryScope, calendarMonth, calendarDisplayMode),
            })
          }
        }}
      />
    </AppLayout>
  )
}
