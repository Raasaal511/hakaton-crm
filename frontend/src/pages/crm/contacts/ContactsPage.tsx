import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Download,
  Upload,
  Phone,
  Mail,
  Building2,
  Trash2,
  Tag,
  UserCheck,
} from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { DataTable, type ColumnDef } from 'shared/ui/DataTable/DataTable'
import { FilterBar } from 'shared/ui/FilterBar/FilterBar'
import { ContextPanel } from 'shared/ui/ContextPanel/ContextPanel'
import { organizationModel } from 'entities/organization'
import { crmAPI, type CrmContact as ApiContact } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { formatRubles } from 'shared/lib/crmDemoData'
import { ContactForm } from 'features/crm/ContactForm'
import styles from './ContactsPage.module.css'

type ContactStatus = 'active' | 'inactive' | 'prospect'

type CrmContact = {
  id: string
  name: string
  initials: string
  position: string | null
  company: string
  email: string | null
  phone: string | null
  tags: string[]
  status: ContactStatus
  deals: number
  totalValue: number
  lastActivity: string
}

function adaptContact(c: Awaited<ReturnType<typeof crmAPI.getContacts>>['items'][number]): CrmContact {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  const initials = [c.firstName?.[0], c.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const status: ContactStatus =
    c.status === 'active' || c.status === 'inactive' || c.status === 'prospect'
      ? (c.status as ContactStatus)
      : 'active'
  return {
    id: String(c.id),
    name,
    initials,
    position: c.position ?? null,
    company: '',
    email: c.email ?? null,
    phone: c.phone ?? null,
    tags: [],
    status,
    deals: 0,
    totalValue: 0,
    lastActivity: c.updatedAt,
  }
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'Активный',      color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  inactive: { label: 'Неактивный',    color: 'var(--color-text-secondary)', bg: 'var(--color-bg-secondary)' },
  prospect: { label: 'Перспективный', color: 'var(--color-accent)', bg: 'var(--color-accent-light)' },
}

const AVATAR_COLORS = ['#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1', '#1a7f37', '#9d174d', '#4f46e5']
function getAvatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function formatActivityDate(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return 'Сегодня'
    if (diff === 1) return 'Вчера'
    if (diff < 7) return `${diff} дн. назад`
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch { return '—' }
}

export function ContactsPage() {
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [panelContact, setPanelContact] = useState<CrmContact | null>(null)
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editContact, setEditContact] = useState<ApiContact | null>(null)

  const filter = {
    q: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 50,
    offset: (page - 1) * 50,
  }

  const { data, isLoading } = useQuery({
    queryKey: qk.crmContacts(currentOrganization?.id ?? 0, filter),
    queryFn: () =>
      crmAPI.getContacts(currentOrganization!.id, filter),
    enabled: Boolean(currentOrganization?.id),
    placeholderData: (prev) => prev,
  })

  const contacts = useMemo(() => (data?.items ?? []).map(adaptContact), [data?.items])

  const activeChips = [
    ...(statusFilter !== 'all' ? [{ id: 'status', label: 'Статус', value: STATUS_CONFIG[statusFilter].label }] : []),
    ...(search ? [{ id: 'search', label: 'Поиск', value: search }] : []),
  ]

  const columns: ColumnDef<CrmContact>[] = [
    {
      key: 'name',
      header: 'Контакт',
      sortable: true,
      renderCell: (row) => (
        <div className={styles.contactCell}>
          <span className={styles.avatar} style={{ background: getAvatarColor(row.name) }}>
            {row.initials}
          </span>
          <div className={styles.contactInfo}>
            <span className={styles.contactName}>{row.name || '(без имени)'}</span>
            {row.position && <span className={styles.contactPos}>{row.position}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Компания',
      sortable: true,
      renderCell: (row) => (
        <div className={styles.companyCell}>
          {row.company
            ? <><Building2 size={13} className={styles.cellIcon} />{row.company}</>
            : <span className={styles.empty}>—</span>
          }
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      renderCell: (row) => {
        const cfg = STATUS_CONFIG[row.status]
        return (
          <span className={styles.statusPill} style={{ color: cfg.color, background: cfg.bg }}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'email',
      header: 'Email',
      renderCell: (row) =>
        row.email
          ? <a href={`mailto:${row.email}`} className={styles.contactLink} onClick={(e) => e.stopPropagation()}><Mail size={13} />{row.email}</a>
          : <span className={styles.empty}>—</span>,
    },
    {
      key: 'phone',
      header: 'Телефон',
      renderCell: (row) =>
        row.phone
          ? <a href={`tel:${row.phone}`} className={styles.contactLink} onClick={(e) => e.stopPropagation()}><Phone size={13} />{row.phone}</a>
          : <span className={styles.empty}>—</span>,
    },
    {
      key: 'lastActivity',
      header: 'Активность',
      sortable: true,
      renderCell: (row) => <span className={styles.dateCell}>{formatActivityDate(row.lastActivity)}</span>,
    },
  ]

  const bulkActions = [
    {
      id: 'assign',
      label: 'Назначить',
      icon: <UserCheck size={13} />,
      onClick: (ids: string[]) => console.log('assign', ids),
    },
    {
      id: 'tag',
      label: 'Теги',
      icon: <Tag size={13} />,
      onClick: (ids: string[]) => console.log('tag', ids),
    },
    {
      id: 'export',
      label: 'Экспорт',
      icon: <Download size={13} />,
      onClick: (ids: string[]) => console.log('export', ids),
    },
    {
      id: 'delete',
      label: 'Удалить',
      icon: <Trash2 size={13} />,
      variant: 'danger' as const,
      onClick: (ids: string[]) => {
        Promise.all(ids.map((id) => crmAPI.deleteContact(currentOrganization!.id, Number(id))))
          .then(() => queryClient.invalidateQueries({ queryKey: ['crm', currentOrganization?.id, 'contacts'] }))
      },
    },
  ]

  const statusTabs = [
    { id: 'all', label: 'Все', count: data?.total },
    { id: 'active', label: 'Активные' },
    { id: 'prospect', label: 'Перспективные' },
    { id: 'inactive', label: 'Неактивные' },
  ]

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Контакты"
          breadcrumb={[{ label: 'CRM' }]}
          actions={
            <>
              <Button variant="secondary" size="sm" iconLeft={<Upload size={13} />}>
                Импорт
              </Button>
              <Button variant="secondary" size="sm" iconLeft={<Download size={13} />}>
                Экспорт
              </Button>
              <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => { setEditContact(null); setFormOpen(true) }}>
                Добавить контакт
              </Button>
            </>
          }
          tabs={statusTabs}
          activeTab={statusFilter}
          onTabChange={(id) => { setStatusFilter(id as ContactStatus | 'all'); setPage(1) }}
        />

        <FilterBar
          chips={activeChips}
          onRemoveChip={(id) => {
            if (id === 'status') setStatusFilter('all')
            if (id === 'search') setSearch('')
          }}
          onClearAll={() => { setStatusFilter('all'); setSearch('') }}
          totalCount={data?.total}
          filteredCount={contacts.length}
        >
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Поиск по имени, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </FilterBar>

        <div className={styles.tableWrap}>
          <DataTable
            columns={columns}
            data={contacts}
            loading={isLoading}
            onRowClick={(row) => setPanelContact(row)}
            activeRowId={panelContact?.id}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key, dir) => { setSortKey(key); setSortDir(dir) }}
            bulkActions={bulkActions}
            emptyState={
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <p className={styles.emptyTitle}>Нет контактов</p>
                <p className={styles.emptyText}>
                  {search || statusFilter !== 'all'
                    ? 'Попробуйте изменить фильтры'
                    : 'Добавьте первый контакт, чтобы начать работу'}
                </p>
                {!search && statusFilter === 'all' && (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => { setEditContact(null); setFormOpen(true) }}>
                    Добавить контакт
                  </Button>
                )}
              </div>
            }
          />
        </div>

        {/* Contact detail panel */}
        <ContextPanel
          open={panelContact !== null}
          onClose={() => setPanelContact(null)}
          title={panelContact?.name ?? 'Контакт'}
          subtitle={panelContact?.position ?? panelContact?.company ?? undefined}
        >
          {panelContact && (
            <div className={styles.panelContent}>
              <div className={styles.panelAvatar} style={{ background: getAvatarColor(panelContact.name) }}>
                {panelContact.initials}
              </div>
              <h3 className={styles.panelName}>{panelContact.name}</h3>
              {panelContact.position && <p className={styles.panelPos}>{panelContact.position}</p>}

              <div className={styles.panelFields}>
                {panelContact.email && (
                  <div className={styles.panelField}>
                    <Mail size={14} className={styles.panelFieldIcon} />
                    <a href={`mailto:${panelContact.email}`} className={styles.panelFieldValue}>
                      {panelContact.email}
                    </a>
                  </div>
                )}
                {panelContact.phone && (
                  <div className={styles.panelField}>
                    <Phone size={14} className={styles.panelFieldIcon} />
                    <a href={`tel:${panelContact.phone}`} className={styles.panelFieldValue}>
                      {panelContact.phone}
                    </a>
                  </div>
                )}
                {panelContact.company && (
                  <div className={styles.panelField}>
                    <Building2 size={14} className={styles.panelFieldIcon} />
                    <span className={styles.panelFieldValue}>{panelContact.company}</span>
                  </div>
                )}
              </div>

              <div className={styles.panelStatus}>
                {(() => {
                  const cfg = STATUS_CONFIG[panelContact.status]
                  return (
                    <span className={styles.statusPill} style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                  )
                })()}
              </div>

              <div className={styles.panelActions}>
                <Button variant="primary" size="sm" iconLeft={<Mail size={13} />} fullWidth>
                  Написать
                </Button>
                <Button variant="secondary" size="sm" iconLeft={<Phone size={13} />} fullWidth>
                  Позвонить
                </Button>
              </div>

              <div className={styles.panelSection}>
                <h4 className={styles.panelSectionTitle}>Последняя активность</h4>
                <p className={styles.panelMeta}>{formatActivityDate(panelContact.lastActivity)}</p>
              </div>
            </div>
          )}
        </ContextPanel>

        <ContactForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditContact(null) }}
          existing={editContact}
        />
      </div>
    </AppLayout>
  )
}
