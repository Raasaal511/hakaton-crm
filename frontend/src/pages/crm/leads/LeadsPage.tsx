import { useState, useMemo } from 'react'
import { Plus, Search, Columns, List, Target, Zap } from 'lucide-react'
import { AppLayout } from 'shared/ui'
import {
  DEMO_LEADS,
  type CrmLead,
  type LeadStage,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_COLORS,
  PRIORITY_COLORS,
  formatRubles,
} from 'shared/lib/crmDemoData'
import styles from './LeadsPage.module.css'

const STAGES: LeadStage[] = ['new', 'qualification', 'proposal', 'negotiation', 'won', 'lost']

function LeadKanbanCard({ lead }: { lead: CrmLead }) {
  const priorityColor = PRIORITY_COLORS[lead.priority]
  return (
    <div className={styles.leadCard}>
      <div className={styles.leadCardTop}>
        <span className={styles.leadTitle}>{lead.title}</span>
        <span className={styles.priorityDot} style={{ background: priorityColor }} title={`Приоритет: ${lead.priority}`} />
      </div>
      <div className={styles.leadContact}>
        <span className={styles.contactAvatar}>{lead.contactAvatar}</span>
        {lead.contactName} · {lead.company}
      </div>
      <div className={styles.leadAmount}>{formatRubles(lead.amount)}</div>
      {lead.tags.length > 0 && (
        <div className={styles.leadTags}>
          {lead.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
        </div>
      )}
      <div className={styles.leadCardBottom}>
        <span className={styles.leadSource}>{lead.source}</span>
        <span className={styles.probBadge}>{lead.probability}%</span>
      </div>
    </div>
  )
}

function LeadTableRow({ lead }: { lead: CrmLead }) {
  const stageColor = LEAD_STAGE_COLORS[lead.stage]
  const priorityColor = PRIORITY_COLORS[lead.priority]

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{lead.company}</div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
          <span className={styles.contactAvatar} style={{ width: 22, height: 22 }}>{lead.contactAvatar}</span>
          {lead.contactName}
        </div>
      </td>
      <td><span className={styles.amountCell}>{formatRubles(lead.amount)}</span></td>
      <td>
        <span
          className={styles.stageBadge}
          style={{ color: stageColor, background: `color-mix(in srgb, ${stageColor} 12%, var(--color-bg))` }}
        >
          {LEAD_STAGE_LABELS[lead.stage]}
        </span>
      </td>
      <td>
        <div className={styles.responsibleCell}>
          <span className={styles.responsibleAvatar}>{lead.responsibleAvatar}</span>
          {lead.responsible}
        </div>
      </td>
      <td>
        <span className={styles.priorityBadge} style={{ color: priorityColor }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: priorityColor, display: 'inline-block' }} />
          {lead.priority === 'high' ? 'Высокий' : lead.priority === 'medium' ? 'Средний' : 'Низкий'}
        </span>
      </td>
      <td>
        <div className={styles.probCell}>
          <div className={styles.probTrack}>
            <div className={styles.probFill} style={{ width: `${lead.probability}%`, background: stageColor }} />
          </div>
          <span className={styles.probText}>{lead.probability}%</span>
        </div>
      </td>
    </tr>
  )
}

export function LeadsPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')

  const filtered = useMemo(() =>
    DEMO_LEADS.filter((l) =>
      !search ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.contactName.toLowerCase().includes(search.toLowerCase()),
    ), [search])

  const byStage = useMemo(() => {
    const map: Record<LeadStage, CrmLead[]> = {
      new: [], qualification: [], proposal: [], negotiation: [], won: [], lost: [],
    }
    filtered.forEach((l) => map[l.stage].push(l))
    return map
  }, [filtered])

  const totalAmount = filtered.reduce((s, l) => s + l.amount, 0)
  const wonAmount = filtered.filter((l) => l.stage === 'won').reduce((s, l) => s + l.amount, 0)

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Лиды и сделки</h1>
            <p className={styles.pageSubtitle}>
              Воронка продаж · {filtered.length} лидов · {formatRubles(totalAmount)} в работе
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={14} />
              Новый лид
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Поиск по лидам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`}
                onClick={() => setView('kanban')}
                title="Воронка"
              >
                <Columns size={14} />
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
          </div>

          {view === 'kanban' ? (
            <div className={styles.kanban}>
              {STAGES.map((stage) => {
                const leads = byStage[stage]
                const stageColor = LEAD_STAGE_COLORS[stage]
                const stageSum = leads.reduce((s, l) => s + l.amount, 0)
                return (
                  <div key={stage} className={styles.kanbanColumn}>
                    <div
                      className={styles.columnHeader}
                      style={{ '--col-color': stageColor } as React.CSSProperties}
                    >
                      <div className={styles.columnTitleGroup}>
                        <span className={styles.columnTitle}>{LEAD_STAGE_LABELS[stage]}</span>
                        <span className={styles.columnCount}>{leads.length}</span>
                      </div>
                      {stageSum > 0 && (
                        <span className={styles.columnSum}>{formatRubles(stageSum)}</span>
                      )}
                    </div>
                    <div className={styles.columnCards}>
                      {leads.map((lead) => (
                        <LeadKanbanCard key={lead.id} lead={lead} />
                      ))}
                      {leads.length === 0 && (
                        <div style={{
                          padding: '1.5rem',
                          textAlign: 'center',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.8125rem',
                          border: '1.5px dashed var(--color-border)',
                          borderRadius: 10,
                        }}>
                          Нет лидов
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Сделка</th>
                    <th>Контакт</th>
                    <th>Сумма</th>
                    <th>Этап</th>
                    <th>Ответственный</th>
                    <th>Приоритет</th>
                    <th>Вероятность</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <LeadTableRow key={lead.id} lead={lead} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
