import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI, type CrmContact } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: CrmContact | null
}

type FormData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  source: string
  status: string
  notes: string
  companyId: string
}

const EMPTY: FormData = {
  firstName: '', lastName: '', email: '', phone: '',
  position: '', source: '', status: 'active', notes: '', companyId: '',
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активный' },
  { value: 'inactive', label: 'Неактивный' },
  { value: 'prospect', label: 'Перспективный' },
]

const SOURCE_OPTIONS = [
  { value: '', label: 'Не указан' },
  { value: 'Рекомендации', label: 'Рекомендации' },
  { value: 'Холодный звонок', label: 'Холодный звонок' },
  { value: 'Сайт / входящий', label: 'Сайт / входящий' },
  { value: 'Выставка', label: 'Выставка' },
  { value: 'Реклама', label: 'Реклама' },
  { value: 'Партнёры', label: 'Партнёры' },
]

export function ContactForm({ open, onClose, existing }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormData>(() =>
    existing
      ? {
          firstName: existing.firstName ?? '',
          lastName: existing.lastName ?? '',
          email: existing.email ?? '',
          phone: existing.phone ?? '',
          position: existing.position ?? '',
          source: existing.source ?? '',
          status: existing.status ?? 'active',
          notes: existing.notes ?? '',
          companyId: existing.companyId ? String(existing.companyId) : '',
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(org?.id ?? 0, { limit: 100 }),
    queryFn: () => crmAPI.getCompanies(org!.id, { limit: 100 }),
    enabled: Boolean(org?.id) && open,
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.createContact(org!.id, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim() || undefined,
        email: data.email.trim() || undefined,
        phone: data.phone.trim() || undefined,
        position: data.position.trim() || undefined,
        source: data.source || undefined,
        status: data.status,
        notes: data.notes.trim() || undefined,
        companyId: data.companyId ? Number(data.companyId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'contacts'] })
      onClose()
      setForm(EMPTY)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.updateContact(org!.id, existing!.id, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim() || undefined,
        email: data.email.trim() || undefined,
        phone: data.phone.trim() || undefined,
        position: data.position.trim() || undefined,
        source: data.source || undefined,
        status: data.status,
        notes: data.notes.trim() || undefined,
        companyId: data.companyId ? Number(data.companyId) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'contacts'] })
      onClose()
    },
  })

  const mutation = existing ? updateMutation : createMutation
  const isLoading = mutation.isPending

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.firstName.trim()) errs.firstName = 'Введите имя'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Некорректный email'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate(form)
  }

  const companies = companiesData?.items ?? []

  return (
    <FormModal
      title={existing ? 'Редактировать контакт' : 'Новый контакт'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            type="button"
            className={s.submitBtn}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading && <Loader2 size={13} className={s.spin} />}
            {existing ? 'Сохранить' : 'Создать контакт'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Имя <span className={s.required}>*</span></label>
            <input className={s.input} placeholder="Иван" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            {errors.firstName && <span className={s.error}>{errors.firstName}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label}>Фамилия</label>
            <input className={s.input} placeholder="Петров" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Email</label>
            <input className={s.input} type="email" placeholder="ivan@company.ru" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {errors.email && <span className={s.error}>{errors.email}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label}>Телефон</label>
            <input className={s.input} type="tel" placeholder="+7 999 000-00-00" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Должность</label>
            <input className={s.input} placeholder="Директор по закупкам" value={form.position} onChange={(e) => set('position', e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Компания</label>
            <select className={s.select} value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
              <option value="">— без компании —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
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
            <label className={s.label}>Статус</label>
            <select className={s.select} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className={s.field}>
          <label className={s.label}>Заметки</label>
          <textarea className={s.textarea} placeholder="Дополнительная информация..." value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </div>

        {mutation.isError && (
          <div className={s.error}>
            Ошибка: {(mutation.error as Error)?.message ?? 'Не удалось сохранить'}
          </div>
        )}
      </div>
    </FormModal>
  )
}
