import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

export type CommChannel = 'phone' | 'email'
type TargetType = 'contact' | 'lead' | 'company'

const TARGET_LABELS: Record<TargetType, string> = {
  contact: 'Контакт',
  lead:    'Лид',
  company: 'Компания',
}

type Props = {
  open: boolean
  channel: CommChannel
  onClose: () => void
  /** Pre-fill with a specific contact */
  defaultContactId?: number
  defaultContactName?: string
}

export function LogCommunicationModal({ open, channel, onClose, defaultContactId, defaultContactName }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const queryClient = useQueryClient()

  const [targetType, setTargetType] = useState<TargetType>(defaultContactId ? 'contact' : 'contact')
  const [targetId, setTargetId]   = useState(defaultContactId ? String(defaultContactId) : '')
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!open) return
    setTargetType('contact')
    setTargetId(defaultContactId ? String(defaultContactId) : '')
    setSubject(channel === 'phone' ? 'Звонок клиенту' : 'Письмо клиенту')
    setBody('')
    setError('')
  }, [open, channel, defaultContactId])

  const { data: contactsData } = useQuery({
    queryKey: qk.crmContacts(orgId, { limit: 100 }),
    queryFn: () => crmAPI.getContacts(orgId, { limit: 100 }),
    enabled: Boolean(orgId) && open && targetType === 'contact',
    staleTime: 60_000,
  })
  const { data: leadsData } = useQuery({
    queryKey: qk.crmLeads(orgId, { limit: 100 }),
    queryFn: () => crmAPI.getLeads(orgId, { limit: 100 }),
    enabled: Boolean(orgId) && open && targetType === 'lead',
    staleTime: 60_000,
  })
  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(orgId, { limit: 100 }),
    queryFn: () => crmAPI.getCompanies(orgId, { limit: 100 }),
    enabled: Boolean(orgId) && open && targetType === 'company',
    staleTime: 60_000,
  })

  const contacts  = contactsData?.items ?? []
  const leads     = leadsData?.items    ?? []
  const companies = companiesData?.items ?? []

  const options =
    targetType === 'contact'
      ? contacts.map((c) => ({ id: c.id, label: [c.firstName, c.lastName].filter(Boolean).join(' ') || `Контакт #${c.id}` }))
      : targetType === 'lead'
        ? leads.map((l) => ({ id: l.id, label: l.title }))
        : companies.map((co) => ({ id: co.id, label: co.name }))

  const mutation = useMutation({
    mutationFn: () =>
      crmAPI.createCommunication(orgId, {
        entityType: targetType,
        entityId: Number(targetId),
        channel,
        direction: 'outbound',
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        status: channel === 'phone' ? 'completed' : 'sent',
      }),
    onSuccess: (comm) => {
      queryClient.invalidateQueries({ queryKey: qk.crmCommunications(orgId, comm.entityType, comm.entityId) })
      queryClient.invalidateQueries({ queryKey: qk.crmActivity(orgId, comm.entityType, comm.entityId) })
      queryClient.invalidateQueries({ queryKey: qk.crmRecentActivity(orgId) })
      onClose()
    },
  })

  function handleSubmit() {
    if (!targetId) { setError('Выберите, к кому привязать действие'); return }
    setError('')
    mutation.mutate()
  }

  const isLocked = Boolean(defaultContactId)

  return (
    <FormModal
      title={channel === 'phone' ? 'Зафиксировать звонок' : 'Зафиксировать письмо'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Тип</label>
            <select
              className={s.select}
              value={targetType}
              disabled={isLocked}
              onChange={(e) => { setTargetType(e.target.value as TargetType); setTargetId(''); setError('') }}
            >
              {(Object.keys(TARGET_LABELS) as TargetType[]).map((t) => (
                <option key={t} value={t}>{TARGET_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Объект <span className={s.required}>*</span></label>
            {isLocked ? (
              <input className={s.input} value={defaultContactName ?? `Контакт #${defaultContactId}`} disabled />
            ) : (
              <select
                className={s.select}
                value={targetId}
                onChange={(e) => { setTargetId(e.target.value); setError('') }}
              >
                <option value="">— выберите —</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className={s.field}>
          <label className={s.label}>Тема</label>
          <input
            className={s.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={channel === 'phone' ? 'Итоги звонка' : 'Тема письма'}
          />
        </div>

        <div className={s.field}>
          <label className={s.label}>Заметка</label>
          <textarea
            className={s.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={channel === 'phone' ? 'О чём договорились...' : 'Краткое содержание письма...'}
            rows={4}
          />
        </div>

        {error && <div className={s.error}>{error}</div>}
        {mutation.isError && (
          <div className={s.error}>Ошибка: {(mutation.error as Error)?.message ?? 'Не удалось сохранить'}</div>
        )}
      </div>
    </FormModal>
  )
}
