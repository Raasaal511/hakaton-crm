import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Receipt,
  FileText,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Search,
} from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { KPICard } from 'shared/ui/KPICard/KPICard'
import { organizationModel } from 'entities/organization'
import { crmAPI, type SalesInvoice, type SalesQuote, type CrmDeal } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { formatRubles } from 'shared/lib/crmDemoData'
import { InvoiceForm } from 'features/finance/InvoiceForm'
import { QuoteForm } from 'features/finance/QuoteForm'
import styles from './FinancePage.module.css'

const DEAL_STATUS_COLOR: Record<string, string> = {
  open: 'var(--color-accent)',
  won: 'var(--color-success)',
  lost: '#ef4444',
}

const AVATAR_COLORS = ['#4361ee', '#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1']

function avatarColor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + h * 31
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(str: string) {
  return str.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isOverdue(iso?: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: styles.statusDraft },
  sent: { label: 'Отправлен', cls: styles.statusSent },
  paid: { label: 'Оплачен', cls: styles.statusPaid },
  overdue: { label: 'Просрочен', cls: styles.statusOverdue },
  cancelled: { label: 'Отменён', cls: styles.statusCancelled },
}

const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: styles.statusDraft },
  sent: { label: 'Отправлено', cls: styles.statusSent },
  accepted: { label: 'Принято', cls: styles.statusAccepted },
  rejected: { label: 'Отклонено', cls: styles.statusRejected },
  expired: { label: 'Истекло', cls: styles.statusExpired },
}

const INVOICE_STATUS_OPTIONS = Object.entries(INVOICE_STATUS).map(([value, { label }]) => ({ value, label }))
const QUOTE_STATUS_OPTIONS = Object.entries(QUOTE_STATUS).map(([value, { label }]) => ({ value, label }))

function CompanyCell({ name }: { name?: string }) {
  if (!name) return <span className={styles.noCompany}>—</span>
  return (
    <div className={styles.companyCell}>
      <span className={styles.companyAvatar} style={{ background: avatarColor(name) }}>{initials(name)}</span>
      <span>{name}</span>
    </div>
  )
}

type Tab = 'invoices' | 'quotes' | 'deals'

export function FinancePage() {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('invoices')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [quoteFormOpen, setQuoteFormOpen] = useState(false)
  const [editInvoice, setEditInvoice] = useState<SalesInvoice | null>(null)
  const [editQuote, setEditQuote] = useState<SalesQuote | null>(null)
  const [invoicePrefill, setInvoicePrefill] = useState<{ quoteId?: number; total?: number; dealId?: number; number?: string } | undefined>()

  const { data: invoicesRaw = [], isLoading: invLoading, isError: invError, refetch: refetchInv } = useQuery({
    queryKey: qk.financeInvoices(orgId),
    queryFn: () => crmAPI.getInvoices(orgId),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })

  const { data: quotesRaw = [], isLoading: qLoading, isError: qError, refetch: refetchQuotes } = useQuery({
    queryKey: qk.financeQuotes(orgId),
    queryFn: () => crmAPI.getQuotes(orgId),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })

  const { data: dealsData, isLoading: dealLoading } = useQuery({
    queryKey: qk.crmDeals(orgId, {}),
    queryFn: () => crmAPI.getDeals(orgId),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })

  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(orgId, { limit: 200 }),
    queryFn: () => crmAPI.getCompanies(orgId, { limit: 200 }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: dealStats } = useQuery({
    queryKey: qk.crmDealStats(orgId),
    queryFn: () => crmAPI.getDealStats(orgId),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const companyMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of companiesData?.items ?? []) map.set(c.id, c.name)
    return map
  }, [companiesData])

  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : []
  const quotes = Array.isArray(quotesRaw) ? quotesRaw : []
  const deals = dealsData?.items ?? []

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase()
    return invoices.filter((inv) => {
      const matchSearch = !q || inv.number.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [invoices, search, statusFilter])

  const filteredQuotes = useMemo(() => {
    const q = search.toLowerCase()
    return quotes.filter((item) => {
      const companyName = item.companyId ? companyMap.get(item.companyId) ?? '' : ''
      const matchSearch = !q || item.number.toLowerCase().includes(q) || companyName.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || item.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [quotes, search, statusFilter, companyMap])

  const filteredDeals = useMemo(() => {
    const q = search.toLowerCase()
    return deals.filter((d) => !q || d.title.toLowerCase().includes(q))
  }, [deals, search])

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<SalesInvoice> }) =>
      crmAPI.updateInvoice(orgId, id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.financeInvoices(orgId) }),
  })

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<SalesQuote> }) =>
      crmAPI.updateQuote(orgId, id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.financeQuotes(orgId) }),
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id: number) => crmAPI.deleteInvoice(orgId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.financeInvoices(orgId) }),
  })

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: number) => crmAPI.deleteQuote(orgId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.financeQuotes(orgId) }),
  })

  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + i.total, 0), [invoices])
  const totalPaid = useMemo(() => invoices.reduce((s, i) => s + i.paidAmount, 0), [invoices])
  const overdueCount = useMemo(
    () => invoices.filter((i) => isOverdue(i.dueAt) && i.status !== 'paid' && i.status !== 'cancelled').length,
    [invoices],
  )
  const pendingQuotes = useMemo(
    () => quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length,
    [quotes],
  )

  function openCreateInvoice() {
    setEditInvoice(null)
    setInvoicePrefill(undefined)
    setInvoiceFormOpen(true)
  }

  function openEditInvoice(inv: SalesInvoice) {
    setEditInvoice(inv)
    setInvoicePrefill(undefined)
    setInvoiceFormOpen(true)
  }

  function openCreateQuote() {
    setEditQuote(null)
    setQuoteFormOpen(true)
  }

  function openEditQuote(q: SalesQuote) {
    setEditQuote(q)
    setQuoteFormOpen(true)
  }

  function handleCreateInvoiceFromQuote(quote: SalesQuote) {
    setEditInvoice(null)
    setInvoicePrefill({
      quoteId: quote.id,
      total: quote.total,
      dealId: quote.dealId ?? undefined,
      number: `ИНВ-${quote.number.replace(/^КП-/i, '')}`,
    })
    setInvoiceFormOpen(true)
  }

  function handleDeleteInvoice(id: number, number: string) {
    if (!window.confirm(`Удалить счёт «${number}»?`)) return
    deleteInvoiceMutation.mutate(id)
  }

  function handleDeleteQuote(id: number, number: string) {
    if (!window.confirm(`Удалить КП «${number}»?`)) return
    deleteQuoteMutation.mutate(id)
  }

  const statusOptions = tab === 'invoices' ? INVOICE_STATUS_OPTIONS : tab === 'quotes' ? QUOTE_STATUS_OPTIONS : []

  if (!orgId) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.noOrgHint}>Выберите организацию, чтобы просмотреть финансы.</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden />
          <div className={styles.heroContent}>
            <div className={styles.heroTop}>
              <div>
                <div className={styles.heroBreadcrumb}>CRM · Финансы</div>
                <h1 className={styles.heroTitle}>Финансы</h1>
                <p className={styles.heroSubtitle}>Счета, коммерческие предложения и сделки</p>
              </div>
              <div className={styles.heroActions}>
                {tab === 'invoices' && (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreateInvoice}>
                    Новый счёт
                  </Button>
                )}
                {tab === 'quotes' && (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreateQuote}>
                    Новое КП
                  </Button>
                )}
              </div>
            </div>

            <div className={styles.tabs}>
              {[
                { id: 'invoices' as Tab, label: 'Счета', count: invoices.length },
                { id: 'quotes' as Tab, label: 'КП', count: quotes.length },
                { id: 'deals' as Tab, label: 'Сделки', count: deals.length },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                  onClick={() => { setTab(t.id); setStatusFilter('all') }}
                >
                  {t.label}
                  <span className={styles.tabCount}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {(invError || qError) && (
          <div className={styles.errorBanner}>
            Не удалось загрузить данные.{' '}
            <button type="button" className={styles.errorRetry} onClick={() => { refetchInv(); refetchQuotes() }}>Повторить</button>
          </div>
        )}

        <div className={styles.body}>
          <div className={styles.kpiGrid}>
            <KPICard label="Выручка (Won)" value={formatRubles(dealStats?.wonAmount ?? 0)} deltaLabel="из выигранных сделок" trend="up" icon={<DollarSign size={16} />} loading={!dealStats} />
            <KPICard label="Взвешенный пайплайн" value={formatRubles(dealStats?.weightedPipeline ?? 0)} deltaLabel="прогноз" trend="neutral" icon={<TrendingUp size={16} />} loading={!dealStats} accentColor="var(--color-accent)" />
            <KPICard label="Выставлено счетов" value={formatRubles(totalInvoiced)} deltaLabel={`оплачено ${formatRubles(totalPaid)}`} trend="up" icon={<CheckCircle2 size={16} />} loading={invLoading} accentColor="var(--color-success)" />
            <KPICard label="Требуют внимания" value={String(overdueCount + pendingQuotes)} deltaLabel={`${overdueCount} просроч. · ${pendingQuotes} КП`} trend={overdueCount > 0 ? 'down' : 'neutral'} icon={<AlertCircle size={16} />} loading={invLoading || qLoading} accentColor={overdueCount > 0 ? '#ef4444' : 'var(--color-warning)'} />
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder={tab === 'deals' ? 'Поиск по сделкам...' : 'Поиск по номеру или компании...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {statusOptions.length > 0 && (
              <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Все статусы</option>
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          <div className={styles.tabContent}>
            {tab === 'invoices' && (
              invLoading ? (
                <div className={styles.loadingWrap}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}</div>
              ) : filteredInvoices.length === 0 ? (
                <div className={styles.empty}>
                  <Receipt size={40} strokeWidth={1.5} />
                  <p className={styles.emptyTitle}>Счетов пока нет</p>
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreateInvoice}>Создать счёт</Button>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Номер</th>
                        <th>Сумма</th>
                        <th>Оплачено</th>
                        <th>Статус</th>
                        <th>Выставлен</th>
                        <th>Срок</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => {
                        const pct = inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0
                        const overdue = isOverdue(inv.dueAt) && inv.status !== 'paid' && inv.status !== 'cancelled'
                        return (
                          <tr key={inv.id} className={styles.clickableRow} onClick={() => openEditInvoice(inv)}>
                            <td><div className={styles.numCell}>{inv.number}</div></td>
                            <td><div className={styles.amount}>{formatRubles(inv.total)}</div></td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className={styles.payProgress}>
                                <div className={styles.payTrack}><div className={styles.payFill} style={{ width: `${pct}%` }} /></div>
                                <span className={styles.payLabel}>{formatRubles(inv.paidAmount)} ({pct}%)</span>
                              </div>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <select
                                className={styles.statusSelect}
                                value={inv.status}
                                onChange={(e) => updateInvoiceMutation.mutate({ id: inv.id, patch: { status: e.target.value } })}
                              >
                                {INVOICE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className={styles.dateCell}>{fmtDate(inv.issuedAt)}</td>
                            <td className={`${styles.dateCell} ${overdue ? styles.dateOverdue : ''}`}>{fmtDate(inv.dueAt)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteInvoice(inv.id, inv.number)} title="Удалить">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'quotes' && (
              qLoading ? (
                <div className={styles.loadingWrap}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}</div>
              ) : filteredQuotes.length === 0 ? (
                <div className={styles.empty}>
                  <FileText size={40} strokeWidth={1.5} />
                  <p className={styles.emptyTitle}>КП пока нет</p>
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={openCreateQuote}>Создать КП</Button>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Номер</th>
                        <th>Компания</th>
                        <th>Сумма</th>
                        <th>Итого</th>
                        <th>Статус</th>
                        <th>Действует до</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q) => {
                        const expired = isOverdue(q.validUntil) && q.status !== 'accepted' && q.status !== 'rejected'
                        const companyName = q.companyId ? companyMap.get(q.companyId) : undefined
                        return (
                          <tr key={q.id} className={styles.clickableRow} onClick={() => openEditQuote(q)}>
                            <td><div className={styles.numCell}>{q.number}</div></td>
                            <td><CompanyCell name={companyName} /></td>
                            <td className={styles.amount}>{formatRubles(q.subtotal)}</td>
                            <td><div className={styles.amount}>{formatRubles(q.total)}</div></td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <select
                                className={styles.statusSelect}
                                value={q.status}
                                onChange={(e) => updateQuoteMutation.mutate({ id: q.id, patch: { status: e.target.value } })}
                              >
                                {QUOTE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className={`${styles.dateCell} ${expired ? styles.dateOverdue : ''}`}>{fmtDate(q.validUntil)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteQuote(q.id, q.number)} title="Удалить">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'deals' && (
              dealLoading ? (
                <div className={styles.loadingWrap}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}</div>
              ) : filteredDeals.length === 0 ? (
                <div className={styles.empty}>
                  <TrendingUp size={40} strokeWidth={1.5} />
                  <p className={styles.emptyTitle}>Сделок пока нет</p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Сумма</th>
                        <th>Вероятность</th>
                        <th>Статус</th>
                        <th>Создана</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeals.map((d) => {
                        const stageColor = DEAL_STATUS_COLOR[d.status] ?? '#6b7280'
                        const statusLabel = d.status === 'won' ? 'Выиграна' : d.status === 'lost' ? 'Проиграна' : 'Открыта'
                        return (
                          <tr key={d.id}>
                            <td><div className={styles.numCell}>{d.title}</div></td>
                            <td><div className={styles.amount}>{formatRubles(d.amount)}</div></td>
                            <td>
                              <div className={styles.probBar}>
                                <div className={styles.probTrack}><div className={styles.probFill} style={{ width: `${d.probability}%`, background: stageColor }} /></div>
                                <span className={styles.probPct}>{d.probability}%</span>
                              </div>
                            </td>
                            <td><span className={styles.badge}>{statusLabel}</span></td>
                            <td className={styles.dateCell}>{fmtDate(d.createdAt)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <InvoiceForm
        open={invoiceFormOpen}
        onClose={() => { setInvoiceFormOpen(false); setEditInvoice(null); setInvoicePrefill(undefined) }}
        existing={editInvoice}
        prefill={invoicePrefill}
      />
      <QuoteForm
        open={quoteFormOpen}
        onClose={() => { setQuoteFormOpen(false); setEditQuote(null) }}
        existing={editQuote}
        onCreateInvoiceFromQuote={handleCreateInvoiceFromQuote}
      />
    </AppLayout>
  )
}
