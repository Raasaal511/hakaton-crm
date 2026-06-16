import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import { ContextPanel } from 'shared/ui/ContextPanel/ContextPanel'
import { Button } from 'shared/ui'
import { crmAPI, type CrmCommunication, type CrmContact } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'
import { ContactStatusSelect } from './ContactStatusSelect'
import { type ContactStatus } from 'shared/lib/contactStatus'
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

const AVATAR_COLORS = ['#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1', '#1a7f37', '#9d174d', '#4f46e5']

function getAvatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function contactName(c: CrmContact) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '(без имени)'
}

function contactInitials(c: CrmContact) {
  return [c.firstName?.[0], c.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
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
      return `Контакт создан${payload.title ? `: ${String(payload.title)}` : ''}`
    case 'updated':
      return 'Контакт обновлён'
    case 'deleted':
      return 'Контакт удалён'
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
  contact: CrmContact | null
  companyName?: string
  open: boolean
  onClose: () => void
  onEdit: (contact: CrmContact) => void
  onDeleted: () => void
  onCommChannel: (channel: 'email' | 'phone') => void
}

export function ContactDetailPanel({
  contact,
  companyName,
  open,
  onClose,
  onEdit,
  onDeleted,
  onCommChannel,
}: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const queryClient = useQueryClient()

  const { data: activityRaw, isLoading: activityLoading } = useQuery({
    queryKey: qk.crmActivity(orgId, 'contact', contact?.id ?? 0),
    queryFn: async () => {
      const data = await crmAPI.getActivity(orgId, 'contact', contact!.id)
      return Array.isArray(data) ? data : (data as { items?: ActivityRow[] }).items ?? []
    },
    enabled: Boolean(orgId && contact?.id && open),
    staleTime: 30_000,
  })

  const { data: communications = [], isLoading: commsLoading } = useQuery({
    queryKey: qk.crmCommunications(orgId, 'contact', contact?.id ?? 0),
    queryFn: () => crmAPI.getCommunications(orgId, 'contact', contact!.id),
    enabled: Boolean(orgId && contact?.id && open),
    staleTime: 30_000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: ContactStatus) =>
      crmAPI.updateContact(orgId, contact!.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'contacts'] })
      queryClient.invalidateQueries({ queryKey: qk.crmActivity(orgId, 'contact', contact!.id) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => crmAPI.deleteContact(orgId, contact!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'contacts'] })
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

  if (!contact) return null

  const name = contactName(contact)
  const statusUpdating = updateStatusMutation.isPending

  function handleDelete() {
    if (!window.confirm(`Удалить контакт «${name}»?`)) return
    deleteMutation.mutate()
  }

  return (
    <ContextPanel
      open={open}
      onClose={onClose}
      title={name}
      subtitle={contact.position ?? companyName ?? undefined}
      width={420}
    >
      <div className={styles.panelContent}>
        <div className={styles.headerBlock}>
          <div className={styles.panelAvatar} style={{ background: getAvatarColor(name) }}>
            {contactInitials(contact)}
          </div>
          <h3 className={styles.panelName}>{name}</h3>
          {contact.position && <p className={styles.panelPos}>{contact.position}</p>}
          {companyName && (
            <span className={styles.panelCompany}>
              <Building2 size={13} />
              {companyName}
            </span>
          )}
          <div className={styles.statusRow}>
            <ContactStatusSelect
              value={contact.status}
              disabled={statusUpdating}
              onChange={(status) => updateStatusMutation.mutate(status)}
            />
          </div>
        </div>

        <div className={styles.fields}>
          {contact.email && (
            <div className={styles.field}>
              <Mail size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Email</span>
                <a href={`mailto:${contact.email}`} className={styles.fieldValue}>{contact.email}</a>
              </div>
            </div>
          )}
          {contact.phone && (
            <div className={styles.field}>
              <Phone size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Телефон</span>
                <a href={`tel:${contact.phone}`} className={styles.fieldValue}>{contact.phone}</a>
              </div>
            </div>
          )}
          {contact.source && (
            <div className={styles.field}>
              <MessageSquare size={14} className={styles.fieldIcon} />
              <div className={styles.fieldBody}>
                <span className={styles.fieldLabel}>Источник</span>
                <span className={styles.fieldValue}>{contact.source}</span>
              </div>
            </div>
          )}
        </div>

        {contact.notes && (
          <div className={styles.notesBlock}>
            <h4 className={styles.notesTitle}>Заметки</h4>
            <p className={styles.notesText}>{contact.notes}</p>
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
            onClick={() => onEdit(contact)}
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
          Обновлён: {formatWhen(contact.updatedAt)}
        </p>
      </div>
    </ContextPanel>
  )
}
