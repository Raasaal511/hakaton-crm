import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Loader2,
  Globe,
  MapPin,
  Users,
  Banknote,
} from 'lucide-react'
import { ContextPanel } from 'shared/ui/ContextPanel/ContextPanel'
import { Button } from 'shared/ui'
import { crmAPI, type CrmCommunication, type CrmCompany } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'
import { formatRubles } from 'shared/lib/crmDemoData'
import { CompanyStatusSelect } from './CompanyStatusSelect'
import { type CompanyStatus } from 'shared/lib/companyStatus'
import styles from './ContactDetailPanel.module.css'

type ActivityRow = {
  id: number
  kind: string
  payload: Record<string, unknown>
  actorUserId: number | null
  createdAt: string | null
}

type TimelineItem = {
  id: string
  title: string
  meta: string
  at: number
}

const AVATAR_COLORS = ['#4361ee', '#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1', '#1a7f37', '#9d174d']

function getAvatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function companyInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return 'Сегодня'
    if (diff === 1) return 'Вчера'
    if (diff < 7) return `${diff} дн. назад`
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function activityTitle(kind: string, payload: Record<string, unknown>) {
  switch (kind) {
    case 'created':
      return `Компания создана${payload.name ? `: ${String(payload.name)}` : ''}`
    case 'updated':
      return 'Компания обновлена'
    case 'deleted':
      return 'Компания удалена'
    case 'communication_created':
      return `Коммуникация: ${String(payload.subject ?? payload.channel ?? 'запись')}`
    default:
      return kind.replace(/_/g, ' ')
  }
}

function communicationTitle(c: CrmCommunication) {
  const channel = c.channel === 'phone' ? 'Звонок' : c.channel === 'email' ? 'Email' : c.channel
  return c.subject ? `${channel}: ${c.subject}` : channel
}

type Props = {
  company: CrmCompany | null
  open: boolean
  onClose: () => void
  onEdit: (company: CrmCompany) => void
  onDeleted: () => void
  onUpdated?: (company: CrmCompany) => void
  onCommChannel: (channel: 'email' | 'phone') => void
}

export function CompanyDetailPanel({
  company,
  open,
  onClose,
  onEdit,
  onDeleted,
  onUpdated,
  onCommChannel,
}: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const queryClient = useQueryClient()

  const { data: activityRaw, isLoading: activityLoading } = useQuery({
    queryKey: qk.crmActivity(orgId, 'company', company?.id ?? 0),
    queryFn: async () => {
      const data = await crmAPI.getActivity(orgId, 'company', company!.id)
      return Array.isArray(data) ? data : (data as { items?: ActivityRow[] }).items ?? []
    },
    enabled: Boolean(orgId && company?.id && open),
    staleTime: 30_000,
  })

  const { data: communications = [], isLoading: commsLoading } = useQuery({
    queryKey: qk.crmCommunications(orgId, 'company', company?.id ?? 0),
    queryFn: () => crmAPI.getCommunications(orgId, 'company', company!.id),
    enabled: Boolean(orgId && company?.id && open),
    staleTime: 30_000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: CompanyStatus) =>
      crmAPI.updateCompany(orgId, company!.id, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'companies'] })
      queryClient.invalidateQueries({ queryKey: qk.crmActivity(orgId, 'company', company!.id) })
      onUpdated?.(updated)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => crmAPI.deleteCompany(orgId, company!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'companies'] })
      onDeleted()
      onClose()
    },
  })

  const timeline = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = []
    for (const a of (activityRaw as ActivityRow[] | undefined) ?? []) {
      items.push({
        id: `act-${a.id}`,
        title: activityTitle(a.kind, a.payload ?? {}),
        meta: formatWhen(a.createdAt),
        at: a.createdAt ? new Date(a.createdAt).getTime() : 0,
      })
    }
    for (const c of communications) {
      items.push({
        id: `comm-${c.id}`,
        title: communicationTitle(c),
        meta: formatWhen(c.createdAt),
        at: c.createdAt ? new Date(c.createdAt).getTime() : 0,
      })
    }
    return items.sort((a, b) => b.at - a.at).slice(0, 15)
  }, [activityRaw, communications])

  if (!company) return null

  const name = company.name
  const statusUpdating = updateStatusMutation.isPending
  const subtitle = [company.industry, company.city].filter(Boolean).join(' · ') || undefined

  function handleDelete() {
    if (!window.confirm(`Удалить компанию «${name}»?`)) return
    deleteMutation.mutate()
  }

  return (
    <ContextPanel
      open={open}
      onClose={onClose}
      title={name}
      subtitle={subtitle}
      width={420}
    >
      <div className={styles.panelContent}>
        <div className={styles.headerBlock}>
          <div className={styles.panelAvatar} style={{ background: getAvatarColor(name) }}>
            {companyInitials(name)}
          </div>
          <h3 className={styles.panelName}>{name}</h3>
          {company.industry && (
            <span className={styles.panelCompany}>
              <Building2 size={13} />
              {company.industry}
            </span>
          )}
          {company.city && (
            <span className={styles.panelCompany}>
              <MapPin size={13} />
              {company.city}
            </span>
          )}
          <div className={styles.statusRow}>
            <CompanyStatusSelect
              value={company.status}
              disabled={statusUpdating}
              onChange={(status) => updateStatusMutation.mutate(status)}
            />
          </div>
        </div>

        <div className={styles.fields}>
          {company.email && (
            <div className={styles.field}>
              <Mail size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Email</span>
                <a href={`mailto:${company.email}`} className={styles.fieldValue}>{company.email}</a>
              </div>
            </div>
          )}
          {company.phone && (
            <div className={styles.field}>
              <Phone size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Телефон</span>
                <a href={`tel:${company.phone}`} className={styles.fieldValue}>{company.phone}</a>
              </div>
            </div>
          )}
          {company.website && (
            <div className={styles.field}>
              <Globe size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Сайт</span>
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  className={styles.fieldValue}
                  target="_blank"
                  rel="noreferrer"
                >
                  {company.website}
                </a>
              </div>
            </div>
          )}
          {company.employeesCount != null && (
            <div className={styles.field}>
              <Users size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Сотрудники</span>
                <span className={styles.fieldValue}>{company.employeesCount.toLocaleString('ru-RU')}</span>
              </div>
            </div>
          )}
          {company.annualRevenue != null && company.annualRevenue > 0 && (
            <div className={styles.field}>
              <Banknote size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Годовая выручка</span>
                <span className={styles.fieldValue}>{formatRubles(company.annualRevenue)}</span>
              </div>
            </div>
          )}
        </div>

        {company.notes && (
          <div className={styles.notesBlock}>
            <h4 className={styles.notesTitle}>Заметки</h4>
            <p className={styles.notesText}>{company.notes}</p>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="primary" size="sm" iconLeft={<Mail size={13} />} onClick={() => onCommChannel('email')}>
            Написать
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<Phone size={13} />} onClick={() => onCommChannel('phone')}>
            Позвонить
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Pencil size={13} />}
            className={styles.actionsWide}
            onClick={() => onEdit(company)}
          >
            Редактировать
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={deleteMutation.isPending ? <Loader2 size={13} className={styles.spin} /> : <Trash2 size={13} />}
            className={styles.actionsWide}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            Удалить
          </Button>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Активность</h4>
          {(activityLoading || commsLoading) && (
            <p className={styles.emptyTimeline}>
              <Loader2 size={13} className={styles.spin} /> Загрузка…
            </p>
          )}
          {!activityLoading && !commsLoading && timeline.length === 0 && (
            <p className={styles.emptyTimeline}>Пока нет активности</p>
          )}
          {!activityLoading && !commsLoading && timeline.length > 0 && (
            <div className={styles.timeline}>
              {timeline.map((item) => (
                <div key={item.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot} />
                  <div className={styles.timelineBody}>
                    <p className={styles.timelineTitle}>{item.title}</p>
                    <p className={styles.timelineMeta}>{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className={styles.timelineMeta} style={{ textAlign: 'center' }}>
          Обновлена: {formatWhen(company.updatedAt)}
        </p>
      </div>
    </ContextPanel>
  )
}
