import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Plus,
  Download,
  LayoutGrid,
  List,
  Phone,
  Mail,
  Users,
  Building2,
} from 'lucide-react'
import { AppLayout } from 'shared/ui'
import {
  DEMO_CONTACTS,
  type CrmContact,
  type ContactStatus,
  formatRubles,
} from 'shared/lib/crmDemoData'
import styles from './ContactsPage.module.css'

const STATUS_LABELS: Record<ContactStatus, string> = {
  active: 'Активный',
  inactive: 'Неактивный',
  prospect: 'Перспективный',
}

const AVATAR_COLORS = [
  '#4361ee', '#7c3aed', '#0f766e', '#dc2626',
  '#d97706', '#0369a1', '#1a7f37', '#9d174d',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function StatusBadge({ status }: { status: ContactStatus }) {
  const cls =
    status === 'active'
      ? styles.statusActive
      : status === 'inactive'
        ? styles.statusInactive
        : styles.statusProspect

  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

function ContactRow({ contact }: { contact: CrmContact }) {
  const avatarColor = getAvatarColor(contact.name)
  return (
    <tr>
      <td>
        <div className={styles.contactCell}>
          <div className={styles.avatar} style={{ background: avatarColor }}>
            {contact.avatar}
          </div>
          <div>
            <div className={styles.contactName}>{contact.name}</div>
            <div className={styles.contactPosition}>{contact.position}</div>
          </div>
        </div>
      </td>
      <td>
        <Link to={`/crm/companies`} className={styles.companyLink}>
          {contact.company}
        </Link>
      </td>
      <td>
        <div className={styles.contactInfo}>
          <span className={styles.contactEmail}>{contact.email}</span>
          <span className={styles.contactPhone}>{contact.phone}</span>
        </div>
      </td>
      <td>
        <div className={styles.tagsList}>
          {contact.tags.map((t) => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>
      </td>
      <td>
        <StatusBadge status={contact.status} />
      </td>
      <td>
        <div className={styles.dealsCount}>
          {contact.deals}
          {contact.deals > 0 && (
            <span className={styles.dealsValue}>· {formatRubles(contact.totalValue)}</span>
          )}
        </div>
      </td>
      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
        {new Date(contact.lastActivity).toLocaleDateString('ru-RU')}
      </td>
    </tr>
  )
}

function ContactCard({ contact }: { contact: CrmContact }) {
  const avatarColor = getAvatarColor(contact.name)
  return (
    <div className={styles.contactCard}>
      <div className={styles.contactCardHead}>
        <div className={styles.contactCardAvatar} style={{ background: avatarColor }}>
          {contact.avatar}
        </div>
        <div className={styles.contactCardBody}>
          <div className={styles.contactCardName}>{contact.name}</div>
          <div className={styles.contactCardCompany}>{contact.position} · {contact.company}</div>
        </div>
        <StatusBadge status={contact.status} />
      </div>
      <div className={styles.contactCardMeta}>
        <div className={styles.contactCardMetaRow}>
          <Mail size={12} />
          {contact.email}
        </div>
        <div className={styles.contactCardMetaRow}>
          <Phone size={12} />
          {contact.phone}
        </div>
      </div>
      {contact.tags.length > 0 && (
        <div className={styles.tagsList}>
          {contact.tags.map((t) => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>
      )}
      <div className={styles.contactCardFooter}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          Активность: {new Date(contact.lastActivity).toLocaleDateString('ru-RU')}
        </span>
        {contact.deals > 0 && (
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {contact.deals} сделок · {formatRubles(contact.totalValue)}
          </span>
        )}
      </div>
    </div>
  )
}

export function ContactsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ContactStatus | 'all'>('all')
  const [view, setView] = useState<'table' | 'grid'>('table')

  const filtered = useMemo(() => {
    return DEMO_CONTACTS.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.company.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || c.status === filter
      return matchSearch && matchFilter
    })
  }, [search, filter])

  const stats = useMemo(() => ({
    total: DEMO_CONTACTS.length,
    active: DEMO_CONTACTS.filter((c) => c.status === 'active').length,
    prospects: DEMO_CONTACTS.filter((c) => c.status === 'prospect').length,
    totalValue: DEMO_CONTACTS.reduce((s, c) => s + c.totalValue, 0),
  }), [])

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Контакты</h1>
            <p className={styles.pageSubtitle}>
              Управление клиентами и партнёрами · {DEMO_CONTACTS.length} записей
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn}>
              <Download size={14} />
              Экспорт
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={14} />
              Новый контакт
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {/* Stats row */}
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>Всего</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.active}</span>
              <span className={styles.statLabel}>Активных</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.prospects}</span>
              <span className={styles.statLabel}>Перспективных</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatRubles(stats.totalValue)}</span>
              <span className={styles.statLabel}>Общая ценность</span>
            </div>
          </div>

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Поиск по имени, компании, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.filterTabs}>
              {(['all', 'active', 'prospect', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Все' : STATUS_LABELS[f]}
                </button>
              ))}
            </div>

            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
                onClick={() => setView('table')}
                title="Таблица"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
                onClick={() => setView('grid')}
                title="Карточки"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <Users size={40} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>Контакты не найдены</h3>
              <p className={styles.emptyDesc}>Попробуйте изменить критерии поиска или фильтры</p>
            </div>
          ) : view === 'table' ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Контакт</th>
                    <th>Компания</th>
                    <th>Контакты</th>
                    <th>Теги</th>
                    <th>Статус</th>
                    <th>Сделки</th>
                    <th>Последняя активность</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <ContactRow key={c.id} contact={c} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {filtered.map((c) => (
                <ContactCard key={c.id} contact={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
