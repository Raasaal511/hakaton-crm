import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI, type CrmDealStage, type CrmLead } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: CrmLead | null
  defaultStage?: string
  stages?: CrmDealStage[]
}

type FormData = {
  title: string
  amount: string
  stage: string
  priority: string
  probability: string
  source: string
  description: string
  companyId: string
  contactId: string
  expectedCloseDate: string
}

const EMPTY: FormData = {
  title: '', amount: '', stage: 'new', priority: 'medium',
  probability: '20', source: '', description: '',
  companyId: '', contactId: '', expectedCloseDate: '',
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
]

const SOURCE_OPTIONS = [
  { value: '', label: 'Не указан' },
  { value: 'Рекомендации', label: 'Рекомендации' },
  { value: 'Холодный звонок', label: 'Холодный звонок' },
  { value: 'Сайт / входящий', label: 'Сайт' },
  { value: 'Выставка', label: 'Выставка' },
  { value: 'Реклама', label: 'Реклама' },
  { value: 'Партнёры', label: 'Партнёры' },
]

function toForm(existing: CrmLead): FormData {
  return {
    title: existing.title ?? '',
    amount: String(existing.amount ?? 0),
    stage: existing.stage ?? 'new',
    priority: existing.priority ?? 'medium',
    probability: String(existing.probability ?? 20),
    source: existing.source ?? '',
    description: existing.description ?? '',
    companyId: existing.companyId ? String(existing.companyId) : '',
    contactId: existing.contactId ? String(existing.contactId) : '',
    expectedCloseDate: existing.expectedCloseDate?.slice(0, 10) ?? '',
  }
}

export function LeadForm({ open, onClose, existing, defaultStage, stages: stagesProp }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const { data: stagesData = [] } = useQuery({
    queryKey: qk.crmDealStages(orgId),
    queryFn: () => crmAPI.getDealStages(orgId),
    enabled: Boolean(orgId) && open && !stagesProp?.length,
    staleTime: 60_000,
  })

  const stages = stagesProp?.length ? stagesProp : stagesData

  useEffect(() => {
    if (!open) return
    const stageList = stagesProp?.length ? stagesProp : stagesData
    if (existing) {
      setForm(toForm(existing))
    } else {
      const stageMeta = stageList.find((st) => st.code === (defaultStage ?? 'new'))
      setForm({
        ...EMPTY,
        stage: defaultStage ?? 'new',
        probability: String(stageMeta?.probability ?? 20),
      })
    }
    setErrors({})
  }, [open, existing?.id, defaultStage, stagesProp, stagesData])

  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(orgId, { limit: 200 }),
    queryFn: () => crmAPI.getCompanies(orgId, { limit: 200 }),
    enabled: Boolean(orgId) && open,
    staleTime: 60_000,
  })

  const { data: contactsData } = useQuery({
    queryKey: qk.crmContacts(orgId, { limit: 200 }),
    queryFn: () => crmAPI.getContacts(orgId, { limit: 200 }),
    enabled: Boolean(orgId) && open,
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.createLead(orgId, {
        title: data.title.trim(),
        amount: Number(data.amount) || 0,
        stage: data.stage,
        priority: data.priority,
        probability: Number(data.probability) || 0,
        source: data.source || undefined,
        description: data.description.trim() || undefined,
        companyId: data.companyId ? Number(data.companyId) : undefined,
        contactId: data.contactId ? Number(data.contactId) : undefined,
        expectedCloseDate: data.expectedCloseDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'leads'] })
      queryClient.invalidateQueries({ queryKey: qk.crmLeadStats(orgId) })
      queryClient.invalidateQueries({ queryKey: qk.crmDealStats(orgId) })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.updateLead(orgId, existing!.id, {
        title: data.title.trim(),
        amount: Number(data.amount) || 0,
        stage: data.stage,
        priority: data.priority,
        probability: Number(data.probability) || 0,
        source: data.source || undefined,
        description: data.description.trim() || undefined,
        companyId: data.companyId ? Number(data.companyId) : null,
        contactId: data.contactId ? Number(data.contactId) : null,
        expectedCloseDate: data.expectedCloseDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'leads'] })
      queryClient.invalidateQueries({ queryKey: qk.crmLeadStats(orgId) })
      queryClient.invalidateQueries({ queryKey: qk.crmDealStats(orgId) })
      onClose()
    },
  })

  const mutation = existing ? updateMutation : createMutation
  const isLoading = mutation.isPending

  function set(field: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'stage') {
        const stageMeta = stages.find((st) => st.code === value)
        if (stageMeta) next.probability = String(stageMeta.probability)
      }
      if (field === 'companyId' && value && !prev.contactId) {
        const contact = contacts.find((c) => c.companyId === Number(value))
        if (contact) next.contactId = String(contact.id)
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.title.trim()) errs.title = 'Введите название сделки'
    if (form.amount && isNaN(Number(form.amount))) errs.amount = 'Введите число'
    if (!existing && !form.companyId && !form.contactId) {
      errs.companyId = 'Выберите компанию или контакт'
      errs.contactId = 'Выберите компанию или контакт'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate(form)
  }

  const companies = companiesData?.items ?? []
  const contacts = contactsData?.items ?? []
  const filteredContacts = form.companyId
    ? contacts.filter((c) => c.companyId === Number(form.companyId))
    : contacts

  const stageOptions = stages.length
    ? stages.map((st) => ({ value: st.code, label: st.name }))
    : [
        { value: 'new', label: 'Новый' },
        { value: 'qualification', label: 'Квалификация' },
        { value: 'proposal', label: 'Предложение' },
        { value: 'negotiation', label: 'Переговоры' },
        { value: 'won', label: 'Выиграно' },
        { value: 'lost', label: 'Проиграно' },
      ]

  return (
    <FormModal
      title={existing ? 'Редактировать лид' : 'Новый лид'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 size={13} className={s.spin} />}
            {existing ? 'Сохранить' : 'Создать лид'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.field}>
          <label className={s.label}>Название сделки <span className={s.required}>*</span></label>
          <input className={s.input} placeholder="Внедрение CRM в ООО «Ромашка»" value={form.title} onChange={(e) => set('title', e.target.value)} />
          {errors.title && <span className={s.error}>{errors.title}</span>}
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Компания {!existing && <span className={s.required}>*</span>}</label>
            <select className={s.select} value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
              <option value="">— не выбрана —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.companyId && <span className={s.error}>{errors.companyId}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label}>Контакт {!existing && <span className={s.required}>*</span>}</label>
            <select className={s.select} value={form.contactId} onChange={(e) => set('contactId', e.target.value)}>
              <option value="">— не выбран —</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
            {errors.contactId && <span className={s.error}>{errors.contactId}</span>}
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Сумма (₽)</label>
            <input className={s.input} type="number" placeholder="500000" value={form.amount} onChange={(e) => set('amount', e.target.value)} min={0} />
            {errors.amount && <span className={s.error}>{errors.amount}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label}>Вероятность (%)</label>
            <input className={s.input} type="number" placeholder="50" value={form.probability} onChange={(e) => set('probability', e.target.value)} min={0} max={100} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Этап</label>
            <select className={s.select} value={form.stage} onChange={(e) => set('stage', e.target.value)}>
              {stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Приоритет</label>
            <select className={s.select} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Источник</label>
            <select className={s.select} value={form.source} onChange={(e) => set('source', e.target.value)}>
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Ожидаемое закрытие</label>
            <input className={s.input} type="date" value={form.expectedCloseDate} onChange={(e) => set('expectedCloseDate', e.target.value)} />
          </div>
        </div>

        <div className={s.field}>
          <label className={s.label}>Описание</label>
          <textarea className={s.textarea} placeholder="Подробности о сделке..." value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </div>

        {!existing && (
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Укажите компанию или контакт — так лид будет связан с CRM.
          </p>
        )}

        {mutation.isError && (
          <div className={s.error}>
            Ошибка: {(mutation.error as Error)?.message ?? 'Не удалось сохранить'}
          </div>
        )}
      </div>
    </FormModal>
  )
}
