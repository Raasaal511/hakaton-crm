import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Download,
  Upload,
  Phone,
  Mail,
  Building2,
  Trash2,
  Pencil,
  Tag,
} from 'lucide-react'
import { AppLayout, Button, PaginationBar } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { DataTable, type ColumnDef } from 'shared/ui/DataTable/DataTable'
import { FilterBar } from 'shared/ui/FilterBar/FilterBar'
import { FormModal, formStyles as formModalStyles } from 'shared/ui/FormModal/FormModal'
import { organizationModel } from 'entities/organization'
import { crmAPI, type CrmContact as ApiContact } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import {
  CONTACT_STATUS_CONFIG,
  normalizeContactStatus,
  type ContactStatus,
  CONTACT_STATUS_OPTIONS,
} from 'shared/lib/contactStatus'
import { ContactForm } from 'features/crm/ContactForm'
import { ContactImportModal } from 'features/crm/ContactImportModal'
import { LogCommunicationModal, type CommChannel } from 'features/crm/LogCommunicationModal'
import { ContactDetailPanel } from 'features/crm/ContactDetailPanel'
import { ContactStatusSelect } from 'features/crm/ContactStatusSelect'
import styles from './ContactsPage.module.css'

const PAGE_SIZE = 50

type ContactRow = {
  id: string
  raw: ApiContact
  name: string
  initials: string
  position: string | null
  company: string
  email: string | null
  phone: string | null
  source: string | null
  status: ContactStatus
  lastActivity: string
}

function adaptContact(c: ApiContact, companyMap: Map<number, string>): ContactRow {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  const initials = [c.firstName?.[0], c.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return {
    id: String(c.id),
    raw: c,
    name,
    initials,
    position: c.position ?? null,
    company: c.companyId ? (companyMap.get(c.companyId) ?? '') : '',
    email: c.email ?? null,
    phone: c.phone ?? null,
    source: c.source ?? null,
    status: normalizeContactStatus(c.status),
    lastActivity: c.updatedAt ?? c.createdAt ?? '',
  }
}

const AVATAR_COLORS = ['#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1', '#1a7f37', '#9d174d', '#4f46e5']

function getAvatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function formatActivityDate(iso: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return 'Сегодня'
    if (diff === 1) return 'Вчера'
    if (diff < 7) return `${diff} дн. назад`
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}

export function ContactsPage() {
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()
  const orgId = currentOrganization?.id ?? 0
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all')
  const [page, setPage] = useState(1)
  const [selectedContact, setSelectedContact] = useState<ApiContact | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editContact, setEditContact] = useState<ApiContact | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [commChannel, setCommChannel] = useState<CommChannel | null>(null)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatusIds, setBulkStatusIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<ContactStatus>('active')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const filter = useMemo(() => ({
    q: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    companyId: companyFilter !== 'all' ? companyFilter : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }), [debouncedSearch, statusFilter, companyFilter, page])

  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(orgId, { limit: 200 }),
    queryFn: () => crmAPI.getCompanies(orgId, { limit: 200 }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const companyMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of companiesData?.items ?? []) {
      map.set(c.id, c.name)
    }
    return map
  }, [companiesData?.items])

  const { data, isLoading, isError } = useQuery({
    queryKey: qk.crmContacts(orgId, filter),
    queryFn: () => crmAPI.getContacts(orgId, filter),
    enabled: Boolean(orgId),
    placeholderData: (prev) => prev,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ContactStatus }) =>
      crmAPI.updateContact(orgId, id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'contacts'] })
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ContactStatus }) => {
      await Promise.all(ids.map((id) => crmAPI.updateContact(orgId, Number(id), { status })))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'contacts'] })
      setBulkStatusOpen(false)
      setBulkStatusIds([])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => crmAPI.deleteContact(orgId, id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'contacts'] })
      if (selectedContact?.id === id) {
        setSelectedContact(null)
      }
    },
  })

  const contacts = useMemo(
    () => (data?.items ?? []).map((c) => adaptContact(c, companyMap)),
    [data?.items, companyMap],
  )

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selectedCompanyName = selectedContact?.companyId
    ? companyMap.get(selectedContact.companyId)
    : undefined

  function openEdit(contact: ApiContact) {
    setEditContact(contact)
    setFormOpen(true)
  }

  function handleRowClick(row: ContactRow) {
    setSelectedContact(row.raw)
  }

  function handleStatusChange(contactId: number, status: ContactStatus) {
    updateStatusMutation.mutate({ id: contactId, status })
    if (selectedContact?.id === contactId) {
      setSelectedContact((prev) => (prev ? { ...prev, status } : prev))
    }
  }

  async function handleExport() {
    if (!orgId) return
    setExporting(true)
    try {
      const all = await crmAPI.getContacts(orgId, {
        q: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        companyId: companyFilter !== 'all' ? companyFilter : undefined,
        limit: 5000,
        offset: 0,
      })
      const rows = all.items
      const header = 'firstName,lastName,email,phone,position,status,company'
      const body = rows.map((c) =>
        [
          c.firstName,
          c.lastName ?? '',
          c.email ?? '',
          c.phone ?? '',
          c.position ?? '',
          c.status,
          c.companyId ? (companyMap.get(c.companyId) ?? '') : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ).join('\n')
      const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const activeChips = [
    ...(statusFilter !== 'all'
      ? [{ id: 'status', label: 'Статус', value: CONTACT_STATUS_CONFIG[statusFilter].label }]
      : []),
    ...(companyFilter !== 'all'
      ? [{ id: 'company', label: 'Компания', value: companyMap.get(companyFilter) ?? String(companyFilter) }]
      : []),
    ...(debouncedSearch ? [{ id: 'search', label: 'Поиск', value: debouncedSearch }] : []),
  ]

  const columns: ColumnDef<ContactRow>[] = [
    {
      key: 'name',
      header: 'Контакт',
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
      renderCell: (row) => (
        <div className={styles.companyCell}>
          {row.company
            ? <><Building2 size={13} className={styles.cellIcon} />{row.company}</>
            : <span className={styles.empty}>—</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      renderCell: (row) => (
        <ContactStatusSelect
          value={row.status}
          onChange={(status) => handleStatusChange(row.raw.id, status)}
          disabled={updateStatusMutation.isPending}
        />
      ),
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
      key: 'source',
      header: 'Источник',
      renderCell: (row) =>
        row.source
          ? <span className={styles.sourceCell}>{row.source}</span>
          : <span className={styles.empty}>—</span>,
    },
    {
      key: 'lastActivity',
      header: 'Активность',
      renderCell: (row) => <span className={styles.dateCell}>{formatActivityDate(row.lastActivity)}</span>,
    },
    {
      key: 'actions',
      header: '',
      renderCell: (row) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.rowActionBtn}
            title="Редактировать"
            onClick={() => openEdit(row.raw)}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className={`${styles.rowActionBtn} ${styles.rowActionDanger}`}
            title="Удалить"
            onClick={() => {
              if (!window.confirm(`Удалить контакт «${row.name}»?`)) return
              deleteMutation.mutate(row.raw.id)
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  const bulkActions = [
    {
      id: 'status',
      label: 'Сменить статус',
      icon: <Tag size={13} />,
      onClick: (ids: string[]) => {
        setBulkStatusIds(ids)
        setBulkStatus('active')
        setBulkStatusOpen(true)
      },
    },
    {
      id: 'export',
      label: 'Экспорт',
      icon: <Download size={13} />,
      onClick: (ids: string[]) => {
        const selected = (data?.items ?? []).filter((c) => ids.includes(String(c.id)))
        if (selected.length === 0) return
        const header = 'firstName,lastName,email,phone,position,status'
        const body = selected.map((c) =>
          [c.firstName, c.lastName ?? '', c.email ?? '', c.phone ?? '', c.position ?? '', c.status]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        ).join('\n')
        const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `contacts_selected_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      },
    },
    {
      id: 'delete',
      label: 'Удалить',
      icon: <Trash2 size={13} />,
      variant: 'danger' as const,
      onClick: (ids: string[]) => {
        if (!window.confirm(`Удалить ${ids.length} контакт(ов)?`)) return
        Promise.all(ids.map((id) => crmAPI.deleteContact(orgId, Number(id))))
          .then(() => queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'contacts'] }))
      },
    },
  ]

  const statusTabs = [
    { id: 'all', label: 'Все', count: total },
    { id: 'active', label: 'Активные' },
    { id: 'prospect', label: 'Перспективные' },
    { id: 'inactive', label: 'Неактивные' },
  ]

  if (!orgId) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <PageHeader title="Контакты" breadcrumb={[{ label: 'CRM' }]} />
          <div className={styles.noOrgHint}>
            Выберите организацию в меню слева, чтобы просмотреть контакты.
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Контакты"
          breadcrumb={[{ label: 'CRM' }]}
          description={isLoading ? 'Загрузка…' : `${total} контактов`}
          actions={
            <>
              <Button variant="secondary" size="sm" iconLeft={<Upload size={13} />} onClick={() => setImportOpen(true)}>
                Импорт
              </Button>
              <Button variant="secondary" size="sm" iconLeft={<Download size={13} />} onClick={handleExport} disabled={exporting}>
                {exporting ? 'Экспорт...' : 'Экспорт'}
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
            if (id === 'company') setCompanyFilter('all')
            if (id === 'search') setSearch('')
            setPage(1)
          }}
          onClearAll={() => {
            setStatusFilter('all')
            setCompanyFilter('all')
            setSearch('')
            setPage(1)
          }}
          totalCount={total}
          filteredCount={contacts.length}
        >
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Поиск по имени, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select
            className={styles.filterSelect}
            value={companyFilter === 'all' ? '' : String(companyFilter)}
            onChange={(e) => {
              setCompanyFilter(e.target.value ? Number(e.target.value) : 'all')
              setPage(1)
            }}
          >
            <option value="">Все компании</option>
            {(companiesData?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FilterBar>

        {isError && (
          <div className={styles.errorBanner}>Не удалось загрузить контакты. Попробуйте обновить страницу.</div>
        )}

        <div className={styles.tableWrap}>
          <DataTable
            columns={columns}
            data={contacts}
            loading={isLoading}
            onRowClick={handleRowClick}
            activeRowId={selectedContact ? String(selectedContact.id) : undefined}
            rowClassName={(row) => (selectedContact?.id === row.raw.id ? styles.activeRow : '')}
            bulkActions={bulkActions}
            emptyState={
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <p className={styles.emptyTitle}>Нет контактов</p>
                <p className={styles.emptyText}>
                  {debouncedSearch || statusFilter !== 'all' || companyFilter !== 'all'
                    ? 'Попробуйте изменить фильтры'
                    : 'Добавьте первый контакт, чтобы начать работу'}
                </p>
                {!debouncedSearch && statusFilter === 'all' && companyFilter === 'all' && (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => { setEditContact(null); setFormOpen(true) }}>
                    Добавить контакт
                  </Button>
                )}
              </div>
            }
          />
        </div>

        <div className={styles.paginationWrap}>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={isLoading}
          />
        </div>

        <ContactDetailPanel
          contact={selectedContact}
          companyName={selectedCompanyName}
          open={selectedContact !== null}
          onClose={() => setSelectedContact(null)}
          onEdit={(c) => openEdit(c)}
          onDeleted={() => setSelectedContact(null)}
          onCommChannel={setCommChannel}
        />

        <ContactForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditContact(null) }}
          existing={editContact}
        />

        <ContactImportModal open={importOpen} onClose={() => setImportOpen(false)} />

        {selectedContact && (
          <LogCommunicationModal
            open={commChannel !== null}
            channel={commChannel ?? 'email'}
            defaultContactId={selectedContact.id}
            defaultContactName={[selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(' ')}
            onClose={() => setCommChannel(null)}
          />
        )}

        <FormModal
          title="Сменить статус"
          open={bulkStatusOpen}
          onClose={() => setBulkStatusOpen(false)}
          footer={
            <>
              <button type="button" className={formModalStyles.cancelBtn} onClick={() => setBulkStatusOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className={formModalStyles.submitBtn}
                disabled={bulkStatusMutation.isPending}
                onClick={() => bulkStatusMutation.mutate({ ids: bulkStatusIds, status: bulkStatus })}
              >
                Применить к {bulkStatusIds.length}
              </button>
            </>
          }
        >
          <div className={formModalStyles.form}>
            <div className={formModalStyles.field}>
              <label className={formModalStyles.label}>Новый статус</label>
              <select
                className={formModalStyles.select}
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as ContactStatus)}
              >
                {CONTACT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </FormModal>
      </div>
    </AppLayout>
  )
}
