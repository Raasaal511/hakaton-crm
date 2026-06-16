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
  Clock,
  Loader2,
  Trash2,
} from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { KPICard } from 'shared/ui/KPICard/KPICard'
import { Card } from 'shared/ui/Card/Card'
import { organizationModel } from 'entities/organization'
import { crmAPI, type SalesInvoice, type SalesQuote, type CrmDeal } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { formatRubles } from 'shared/lib/crmDemoData'
import { InvoiceForm } from 'features/finance/InvoiceForm'
import { QuoteForm } from 'features/finance/QuoteForm'
import styles from './FinancePage.module.css'

const DEAL_STATUS_COLOR: Record<string, string> = {
  open: 'var(--color-accent)',
  won:  'var(--color-success)',
  lost: '#ef4444',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Invoice status ─────────────────────────────────────────────────────────────
const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Черновик',  cls: styles.statusDraft },
  sent:      { label: 'Отправлен', cls: styles.statusSent },
  paid:      { label: 'Оплачен',   cls: styles.statusPaid },
  overdue:   { label: 'Просрочен', cls: styles.statusOverdue },
  cancelled: { label: 'Отменён',   cls: styles.statusCancelled },
}
const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Черновик',  cls: styles.statusDraft },
  sent:     { label: 'Отправлено', cls: styles.statusSent },
  accepted: { label: 'Принято',   cls: styles.statusAccepted },
  rejected: { label: 'Отклонено', cls: styles.statusRejected },
  expired:  { label: 'Истекло',   cls: styles.statusExpired },
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const cfg = map[status] ?? { label: status, cls: styles.statusDraft }
  return (
    <span className={`${styles.badge} ${cfg.cls}`}>
      <span className={styles.badgeDot} />
      {cfg.label}
    </span>
  )
}

// ── Invoices tab ──────────────────────────────────────────────────────────────
function InvoicesTab({
  invoices,
  isLoading,
  onNew,
  onDelete,
}: {
  invoices: SalesInvoice[]
  isLoading: boolean
  onNew: () => void
  onDelete: (id: number) => void
}) {
  if (isLoading) return (
    <div className={styles.loadingWrap}>
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
    </div>
  )

  if (invoices.length === 0) return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><Receipt size={40} strokeWidth={1.5} /></span>
      <p className={styles.emptyTitle}>Счетов пока нет</p>
      <p className={styles.emptyText}>Создайте первый счёт для клиента</p>
      <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={onNew}>
        Создать счёт
      </Button>
    </div>
  )

  const totalSum = invoices.reduce((s, i) => s + i.total, 0)
  const paidSum = invoices.reduce((s, i) => s + i.paidAmount, 0)

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Номер</th>
            <th>Сумма</th>
            <th>Оплачено</th>
            <th>Статус</th>
            <th>Выставлен</th>
            <th>Срок оплаты</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const pct = inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0
            const overdue = isOverdue(inv.dueAt) && inv.status !== 'paid' && inv.status !== 'cancelled'
            return (
              <tr key={inv.id}>
                <td>
                  <div className={styles.numCell}>{inv.number}</div>
                  <div className={styles.numSub}>ID {inv.id}</div>
                </td>
                <td>
                  <div className={styles.amount}>{formatRubles(inv.total)}</div>
                  <div className={styles.amountSecondary}>{inv.currency}</div>
                </td>
                <td>
                  <div className={styles.payProgress}>
                    <div className={styles.payTrack}>
                      <div
                        className={styles.payFill}
                        style={{ width: `${pct}%`, background: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)' }}
                      />
                    </div>
                    <span className={styles.payLabel}>{formatRubles(inv.paidAmount)} ({pct}%)</span>
                  </div>
                </td>
                <td>
                  <StatusBadge status={inv.status} map={INVOICE_STATUS} />
                </td>
                <td className={styles.dateCell}>{fmtDate(inv.issuedAt)}</td>
                <td className={`${styles.dateCell} ${overdue ? styles.dateOverdue : ''}`}>
                  {fmtDate(inv.dueAt)}
                  {overdue && <AlertCircle size={12} style={{ marginLeft: 4, display: 'inline' }} />}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => onDelete(inv.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4 }}
                    title="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className={styles.summaryRow}>
            <td colSpan={2}>Итого: {formatRubles(totalSum)}</td>
            <td colSpan={5}>Оплачено: {formatRubles(paidSum)} ({totalSum > 0 ? Math.round((paidSum / totalSum) * 100) : 0}%)</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Quotes tab ────────────────────────────────────────────────────────────────
function QuotesTab({
  quotes,
  isLoading,
  onNew,
  onDelete,
}: {
  quotes: SalesQuote[]
  isLoading: boolean
  onNew: () => void
  onDelete: (id: number) => void
}) {
  if (isLoading) return (
    <div className={styles.loadingWrap}>
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
    </div>
  )

  if (quotes.length === 0) return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><FileText size={40} strokeWidth={1.5} /></span>
      <p className={styles.emptyTitle}>КП пока нет</p>
      <p className={styles.emptyText}>Создайте коммерческое предложение для клиента</p>
      <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={onNew}>
        Создать КП
      </Button>
    </div>
  )

  const totalSum = quotes.reduce((s, q) => s + q.total, 0)
  const accepted = quotes.filter((q) => q.status === 'accepted').length

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Номер</th>
            <th>Сумма</th>
            <th>Скидка</th>
            <th>Итого</th>
            <th>Статус</th>
            <th>Действует до</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const expired = isOverdue(q.validUntil) && q.status !== 'accepted' && q.status !== 'rejected'
            return (
              <tr key={q.id}>
                <td>
                  <div className={styles.numCell}>{q.number}</div>
                  <div className={styles.numSub}>ID {q.id}</div>
                </td>
                <td className={styles.amount}>{formatRubles(q.subtotal)}</td>
                <td style={{ color: 'var(--color-text-secondary)' }}>
                  {q.discount > 0 ? `-${formatRubles(q.discount)}` : '—'}
                </td>
                <td>
                  <div className={styles.amount}>{formatRubles(q.total)}</div>
                  <div className={styles.amountSecondary}>{q.currency}</div>
                </td>
                <td><StatusBadge status={q.status} map={QUOTE_STATUS} /></td>
                <td className={`${styles.dateCell} ${expired ? styles.dateOverdue : ''}`}>
                  {fmtDate(q.validUntil)}
                  {expired && <AlertCircle size={12} style={{ marginLeft: 4, display: 'inline' }} />}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => onDelete(q.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4 }}
                    title="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className={styles.summaryRow}>
            <td colSpan={4}>Всего КП: {quotes.length} · Сумма: {formatRubles(totalSum)}</td>
            <td colSpan={3}>Принято: {accepted} из {quotes.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Deals tab ─────────────────────────────────────────────────────────────────
function DealsTab({ deals, isLoading }: { deals: CrmDeal[]; isLoading: boolean }) {
  if (isLoading) return (
    <div className={styles.loadingWrap}>
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
    </div>
  )

  if (deals.length === 0) return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><TrendingUp size={40} strokeWidth={1.5} /></span>
      <p className={styles.emptyTitle}>Сделок пока нет</p>
      <p className={styles.emptyText}>Создавайте сделки из раздела CRM → Лиды</p>
    </div>
  )

  return (
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
          {deals.map((d) => {
            const stageColor = DEAL_STATUS_COLOR[d.status] ?? '#6b7280'
            const statusLabel = d.status === 'won' ? 'Выиграна' : d.status === 'lost' ? 'Проиграна' : 'Открыта'
            const statusCls = d.status === 'won' ? styles.statusPaid : d.status === 'lost' ? styles.statusRejected : styles.statusSent
            return (
              <tr key={d.id}>
                <td>
                  <div className={styles.numCell}>{d.title}</div>
                </td>
                <td>
                  <div className={styles.amount}>{formatRubles(d.amount)}</div>
                  <div className={styles.amountSecondary}>{d.currency}</div>
                </td>
                <td>
                  <div className={styles.probBar}>
                    <div className={styles.probTrack}>
                      <div className={styles.probFill} style={{ width: `${d.probability}%`, background: stageColor }} />
                    </div>
                    <span className={styles.probPct}>{d.probability}%</span>
                  </div>
                </td>
                <td>
                  <span className={`${styles.badge} ${statusCls}`}>
                    <span className={styles.badgeDot} />
                    {statusLabel}
                  </span>
                </td>
                <td className={styles.dateCell}>{fmtDate(d.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className={styles.summaryRow}>
            <td colSpan={2}>
              Всего: {formatRubles(deals.reduce((s, d) => s + d.amount, 0))}
            </td>
            <td colSpan={3}>
              Выиграно: {formatRubles(deals.filter((d) => d.status === 'won').reduce((s, d) => s + d.amount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = 'invoices' | 'quotes' | 'deals'

export function FinancePage() {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('invoices')
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [quoteFormOpen, setQuoteFormOpen] = useState(false)

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: invoicesRaw = [], isLoading: invLoading } = useQuery({
    queryKey: qk.financeInvoices(org?.id ?? 0),
    queryFn: () => crmAPI.getInvoices(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const { data: quotesRaw = [], isLoading: qLoading } = useQuery({
    queryKey: qk.financeQuotes(org?.id ?? 0),
    queryFn: () => crmAPI.getQuotes(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const { data: dealsData, isLoading: dealLoading } = useQuery({
    queryKey: qk.crmDeals(org?.id ?? 0, {}),
    queryFn: () => crmAPI.getDeals(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const { data: dealStats } = useQuery({
    queryKey: qk.crmDealStats(org?.id ?? 0),
    queryFn: () => crmAPI.getDealStats(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 60_000,
  })

  // Arrays
  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : (invoicesRaw as { items?: SalesInvoice[] }).items ?? []
  const quotes = Array.isArray(quotesRaw) ? quotesRaw : (quotesRaw as { items?: SalesQuote[] }).items ?? []
  const deals = dealsData?.items ?? []

  // ── Delete mutations ────────────────────────────────────────────────────────
  // (soft-delete via list refresh — backend returns empty after deletion since no delete endpoint for quotes/invoices yet)
  // For now we just remove locally via refetch
  function handleDeleteInvoice(_id: number) {
    // No delete endpoint exists yet — show message
    alert('Функция удаления счёта будет добавлена в следующей версии')
  }
  function handleDeleteQuote(_id: number) {
    alert('Функция удаления КП будет добавлена в следующей версии')
  }

  // ── KPI derived values ──────────────────────────────────────────────────────
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
  const wonAmount = dealStats?.wonAmount ?? 0
  const pipeline = dealStats?.weightedPipeline ?? 0

  const tabConfig = [
    { id: 'invoices', label: 'Счета', count: invoices.length },
    { id: 'quotes',   label: 'КП',    count: quotes.length },
    { id: 'deals',    label: 'Сделки', count: deals.length },
  ]

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Финансы"
          breadcrumb={[]}
          description="Счета, коммерческие предложения и сделки"
          actions={
            <>
              {tab === 'invoices' && (
                <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => setInvoiceFormOpen(true)}>
                  Новый счёт
                </Button>
              )}
              {tab === 'quotes' && (
                <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => setQuoteFormOpen(true)}>
                  Новое КП
                </Button>
              )}
              {tab === 'deals' && (
                <Button variant="secondary" size="sm" onClick={() => window.location.assign('/crm/leads')}>
                  Перейти в CRM
                </Button>
              )}
            </>
          }
          tabs={tabConfig}
          activeTab={tab}
          onTabChange={(id) => setTab(id as Tab)}
        />

        <div className={styles.body}>
          {/* KPI row */}
          <div className={styles.kpiGrid}>
            <KPICard
              label="Выручка (Won)"
              value={formatRubles(wonAmount)}
              deltaLabel="из выигранных сделок"
              trend="up"
              icon={<DollarSign size={16} strokeWidth={1.75} />}
              loading={!dealStats}
            />
            <KPICard
              label="Взвешенный пайплайн"
              value={formatRubles(pipeline)}
              deltaLabel="прогноз по вероятности"
              trend="neutral"
              icon={<TrendingUp size={16} strokeWidth={1.75} />}
              loading={!dealStats}
              accentColor="var(--color-accent)"
            />
            <KPICard
              label="Выставлено счетов"
              value={formatRubles(totalInvoiced)}
              deltaLabel={`оплачено ${formatRubles(totalPaid)}`}
              trend={totalPaid >= totalInvoiced * 0.7 ? 'up' : 'neutral'}
              icon={<CheckCircle2 size={16} strokeWidth={1.75} />}
              loading={invLoading}
              accentColor="var(--color-success)"
            />
            <KPICard
              label="Требуют внимания"
              value={String(overdueCount + pendingQuotes)}
              deltaLabel={`${overdueCount} просроч. · ${pendingQuotes} КП на отв.`}
              trend={overdueCount > 0 ? 'down' : 'neutral'}
              icon={<AlertCircle size={16} strokeWidth={1.75} />}
              loading={invLoading || qLoading}
              accentColor={overdueCount > 0 ? '#ef4444' : 'var(--color-warning)'}
            />
          </div>

          {/* Tab content */}
          <div className={styles.tabContent}>
            {tab === 'invoices' && (
              <InvoicesTab
                invoices={invoices}
                isLoading={invLoading}
                onNew={() => setInvoiceFormOpen(true)}
                onDelete={handleDeleteInvoice}
              />
            )}
            {tab === 'quotes' && (
              <QuotesTab
                quotes={quotes}
                isLoading={qLoading}
                onNew={() => setQuoteFormOpen(true)}
                onDelete={handleDeleteQuote}
              />
            )}
            {tab === 'deals' && (
              <DealsTab deals={deals} isLoading={dealLoading} />
            )}
          </div>
        </div>
      </div>

      <InvoiceForm open={invoiceFormOpen} onClose={() => setInvoiceFormOpen(false)} />
      <QuoteForm open={quoteFormOpen} onClose={() => setQuoteFormOpen(false)} />
    </AppLayout>
  )
}
