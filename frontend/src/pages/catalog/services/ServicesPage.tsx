import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Briefcase, List, LayoutGrid, Clock, Trash2 } from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { FilterBar } from 'shared/ui/FilterBar/FilterBar'
import { DataTable, type ColumnDef } from 'shared/ui/DataTable/DataTable'
import { formatRubles } from 'shared/lib/crmDemoData'
import { organizationModel } from 'entities/organization'
import { catalogAPI, type CatalogService } from 'shared/api/requests/catalog'
import { qk } from 'shared/api/queryKeys'
import { ServiceForm } from 'features/catalog/ServiceForm'
import styles from './ServicesPage.module.css'

const SERVICE_COLORS = ['#7c3aed', '#0f766e', '#0369a1', '#d97706', '#dc2626', '#0ea5e9']

type ServiceRow = Omit<CatalogService, 'id'> & { id: string; numericId: number }

function adaptRow(s: CatalogService): ServiceRow {
  const { id, ...rest } = s
  return { ...rest, id: String(id), numericId: id }
}

function ServiceGridCard({ service }: { service: CatalogService }) {
  const color = SERVICE_COLORS[service.id % SERVICE_COLORS.length]
  return (
    <div className={styles.gridCard}>
      <div className={styles.gridCardHeader}>
        <div className={styles.serviceIcon} style={{ background: color }}>
          <Briefcase size={18} color="#fff" strokeWidth={1.5} />
        </div>
        {service.category && (
          <span className={styles.catPill} style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--color-bg))` }}>
            {service.category}
          </span>
        )}
      </div>
      <div className={styles.gridCardName}>{service.name}</div>
      <div className={styles.gridCardDesc}>{service.description}</div>
      <div className={styles.gridCardFooter}>
        <div className={styles.gridCardPrice}>
          {formatRubles(service.price)}
          <span className={styles.gridCardUnit}> / {service.unit}</span>
        </div>
        {service.durationHours && (
          <span className={styles.durationPill}>
            <Clock size={10} />
            {service.durationHours} ч
          </span>
        )}
      </div>
    </div>
  )
}

export function ServicesPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [view, setView] = useState<'grid' | 'table'>('table')
  const [formOpen, setFormOpen] = useState(false)
  const [editService, setEditService] = useState<CatalogService | null>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  function openCreate() {
    setEditService(null)
    setFormOpen(true)
  }

  function openEdit(service: CatalogService) {
    setEditService(service)
    setFormOpen(true)
  }

  const { data: servicesData, isLoading } = useQuery({
    queryKey: qk.catalogServices(org?.id ?? 0, { limit: 200 }),
    queryFn: () => catalogAPI.getServices(org!.id, { limit: 200 }),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => catalogAPI.deleteService(org!.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'services'] }),
  })

  const services = useMemo(() => servicesData?.items ?? [], [servicesData])

  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category).filter(Boolean) as string[])),
    [services],
  )

  const filtered = useMemo(() =>
    services.filter((s) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryFilter === 'all' || s.category === categoryFilter
      return matchSearch && matchCat
    }), [services, search, categoryFilter])

  const tableData: ServiceRow[] = useMemo(() => filtered.map(adaptRow), [filtered])

  const columns: ColumnDef<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Услуга',
      sortable: true,
      renderCell: (row) => {
        const color = SERVICE_COLORS[row.numericId % SERVICE_COLORS.length]
        return (
          <div className={styles.serviceCell}>
            <div className={styles.serviceIcon} style={{ background: color }}>
              <Briefcase size={13} color="#fff" strokeWidth={1.5} />
            </div>
            <div>
              <span className={styles.serviceName}>{row.name}</span>
              {row.description && <div className={styles.serviceDesc}>{row.description}</div>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'category',
      header: 'Категория',
      renderCell: (row) => (
        <span className={styles.catPill}>{row.category ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      header: 'Цена',
      sortable: true,
      renderCell: (row) => (
        <span className={styles.priceCell}>
          {formatRubles(row.price)}
          <span className={styles.priceUnit}> / {row.unit}</span>
        </span>
      ),
    },
    {
      key: 'durationHours',
      header: 'Длительность',
      renderCell: (row) =>
        row.durationHours ? (
          <span className={styles.durationPill}>
            <Clock size={10} />
            {row.durationHours} ч
          </span>
        ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>,
    },
    {
      key: 'active',
      header: 'Статус',
      renderCell: (row) => (
        <span className={row.active ? styles.statusActive : styles.statusInactive}>
          {row.active ? 'Активна' : 'Скрыта'}
        </span>
      ),
    },
  ]

  const bulkActions = [
    {
      id: 'delete',
      label: 'Удалить',
      icon: <Trash2 size={13} />,
      variant: 'danger' as const,
      onClick: (ids: string[]) => {
        Promise.all(ids.map((id) => deleteMutation.mutate(Number(id))))
          .then(() => queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'services'] }))
      },
    },
  ]

  const activeChips = [
    ...(search ? [{ id: 'search', label: 'Поиск', value: search }] : []),
    ...(categoryFilter !== 'all' ? [{ id: 'category', label: 'Категория', value: categoryFilter }] : []),
  ]

  const totalValue = filtered.reduce((s, svc) => s + svc.price, 0)

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Услуги"
          breadcrumb={[{ label: 'Каталог' }]}
          description={isLoading ? 'Загрузка...' : `${servicesData?.total ?? 0} услуг · ${formatRubles(totalValue)} суммарно`}
          actions={
            <>
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('grid')}
                  title="Сетка"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('table')}
                  title="Таблица"
                >
                  <List size={14} />
                </button>
              </div>
              <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreate}>
                Добавить услугу
              </Button>
            </>
          }
          tabs={[
            { id: 'all', label: 'Все', count: servicesData?.total },
            ...categories.map((c) => ({ id: c, label: c })),
          ]}
          activeTab={categoryFilter}
          onTabChange={(id) => setCategoryFilter(id)}
        />

        <FilterBar
          chips={activeChips}
          onRemoveChip={(id) => {
            if (id === 'search') setSearch('')
            if (id === 'category') setCategoryFilter('all')
          }}
          onClearAll={() => { setSearch(''); setCategoryFilter('all') }}
          totalCount={servicesData?.total}
          filteredCount={filtered.length}
        >
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterBar>

        {view === 'grid' ? (
          <div className={styles.body}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <Briefcase size={40} strokeWidth={1.5} />
                <p className={styles.emptyTitle}>{search ? 'Услуги не найдены' : 'Нет услуг'}</p>
                <p className={styles.emptyText}>
                  {search ? 'Измените критерии поиска' : 'Добавьте первую услугу в каталог'}
                </p>
                {!search && (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreate}>
                    Добавить услугу
                  </Button>
                )}
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map((s) => <ServiceGridCard key={s.id} service={s} />)}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <DataTable
              columns={columns}
              data={tableData}
              loading={isLoading}
              bulkActions={bulkActions}
              onRowClick={(row) => {
                const service = services.find((s) => s.id === row.numericId)
                if (service) openEdit(service)
              }}
              emptyState={
                <div className={styles.emptyState}>
                  <Briefcase size={40} strokeWidth={1.5} />
                  <p className={styles.emptyTitle}>{search ? 'Услуги не найдены' : 'Нет услуг'}</p>
                  <p className={styles.emptyText}>
                    {search ? 'Измените критерии поиска' : 'Добавьте первую услугу в каталог'}
                  </p>
                  {!search && (
                    <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreate}>
                      Добавить услугу
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        )}
      </div>

      <ServiceForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditService(null) }}
        existing={editService}
        categorySuggestions={categories}
      />
    </AppLayout>
  )
}
