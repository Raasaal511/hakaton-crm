import { useState, useMemo } from 'react'
import { Plus, Search, LayoutGrid, List, Briefcase, Clock, Users } from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { DEMO_SERVICES, type CrmService, type ServiceCategory, formatRubles } from 'shared/lib/crmDemoData'
import styles from './ServicesPage.module.css'

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  consulting: 'Консалтинг',
  support: 'Поддержка',
  training: 'Обучение',
  development: 'Разработка',
}

function ServiceCard({ service }: { service: CrmService }) {
  return (
    <div className={styles.serviceCard}>
      <div className={styles.serviceCardHeader}>
        <div className={styles.serviceIcon} style={{ background: service.color }}>
          <Briefcase size={18} color="#fff" />
        </div>
        <span className={styles.catBadge} style={{ color: service.color, background: `color-mix(in srgb, ${service.color} 12%, var(--color-bg))` }}>
          {CATEGORY_LABELS[service.category]}
        </span>
      </div>
      <div className={styles.serviceName}>{service.name}</div>
      <div className={styles.serviceDesc}>{service.description}</div>
      <div className={styles.serviceFooter}>
        <div className={styles.servicePrice}>{formatRubles(service.price)} <span className={styles.priceUnit}>/ {service.unit}</span></div>
        <div className={styles.serviceMeta}>
          {service.duration && (
            <span className={styles.metaItem}><Clock size={11} />{service.duration}</span>
          )}
          <span className={styles.metaItem}><Users size={11} />{service.executors.length} исп.</span>
        </div>
      </div>
    </div>
  )
}

function ServiceRow({ service }: { service: CrmService }) {
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: service.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Briefcase size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{service.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{service.description.slice(0, 60)}...</div>
          </div>
        </div>
      </td>
      <td>
        <span style={{ fontSize: '0.8125rem', color: service.color, background: `color-mix(in srgb, ${service.color} 12%, var(--color-bg))`, padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 600 }}>
          {CATEGORY_LABELS[service.category]}
        </span>
      </td>
      <td>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{formatRubles(service.price)}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.25rem' }}>/ {service.unit}</span>
      </td>
      <td>
        {service.duration ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <Clock size={12} />{service.duration}
          </span>
        ) : '—'}
      </td>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          <Users size={12} />{service.executors}
        </span>
      </td>
    </tr>
  )
}

export function ServicesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ServiceCategory | 'all'>('all')
  const [view, setView] = useState<'grid' | 'table'>('grid')

  const filtered = useMemo(() =>
    DEMO_SERVICES.filter((s) => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      const matchCat = category === 'all' || s.category === category
      return matchSearch && matchCat
    }), [search, category])

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Каталог услуг</h1>
            <p className={styles.pageSubtitle}>{DEMO_SERVICES.length} услуг · {[...new Set(DEMO_SERVICES.map((s) => s.category))].length} категорий</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={14} />
              Новая услуга
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input className={styles.searchInput} type="text" placeholder="Поиск услуг..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className={styles.filterTabs}>
              {(['all', 'consulting', 'support', 'training', 'development'] as const).map((c) => (
                <button key={c} type="button" className={`${styles.filterTab} ${category === c ? styles.filterTabActive : ''}`} onClick={() => setCategory(c)}>
                  {c === 'all' ? 'Все' : CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            <div className={styles.viewToggle}>
              <button type="button" className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setView('grid')} title="Сетка"><LayoutGrid size={14} /></button>
              <button type="button" className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`} onClick={() => setView('table')} title="Список"><List size={14} /></button>
            </div>
          </div>

          {view === 'grid' ? (
            <div className={styles.serviceGrid}>
              {filtered.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Услуга</th><th>Категория</th><th>Стоимость</th><th>Длительность</th><th>Исполнители</th></tr></thead>
                <tbody>{filtered.map((s) => <ServiceRow key={s.id} service={s} />)}</tbody>
              </table>
            </div>
          )}

          {filtered.length === 0 && (
            <div className={styles.empty}><Briefcase size={40} strokeWidth={1.5} /><p>Услуги не найдены</p></div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
