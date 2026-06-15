import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI, type CrmCompany } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: CrmCompany | null
}

type FormData = {
  name: string
  industry: string
  website: string
  email: string
  phone: string
  city: string
  address: string
  employeesCount: string
  annualRevenue: string
  status: string
  notes: string
}

const EMPTY: FormData = {
  name: '', industry: '', website: '', email: '', phone: '',
  city: '', address: '', employeesCount: '', annualRevenue: '',
  status: 'active', notes: '',
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активная' },
  { value: 'inactive', label: 'Неактивная' },
  { value: 'prospect', label: 'Перспективная' },
]

const INDUSTRY_OPTIONS = [
  '', 'IT и технологии', 'Промышленность', 'Финансы', 'Строительство',
  'Логистика', 'Розничная торговля', 'Здравоохранение', 'Образование',
  'Сельское хозяйство', 'Энергетика', 'Медиа и реклама', 'Другое',
]

export function CompanyForm({ open, onClose, existing }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormData>(() =>
    existing
      ? {
          name: existing.name ?? '',
          industry: existing.industry ?? '',
          website: existing.website ?? '',
          email: existing.email ?? '',
          phone: existing.phone ?? '',
          city: existing.city ?? '',
          address: existing.address ?? '',
          employeesCount: existing.employeesCount != null ? String(existing.employeesCount) : '',
          annualRevenue: existing.annualRevenue != null ? String(existing.annualRevenue) : '',
          status: existing.status ?? 'active',
          notes: existing.notes ?? '',
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.createCompany(org!.id, {
        name: data.name.trim(),
        industry: data.industry || undefined,
        website: data.website.trim() || undefined,
        email: data.email.trim() || undefined,
        phone: data.phone.trim() || undefined,
        city: data.city.trim() || undefined,
        address: data.address.trim() || undefined,
        employeesCount: data.employeesCount ? Number(data.employeesCount) : undefined,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
        status: data.status,
        notes: data.notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'companies'] })
      onClose()
      setForm(EMPTY)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.updateCompany(org!.id, existing!.id, {
        name: data.name.trim(),
        industry: data.industry || undefined,
        website: data.website.trim() || undefined,
        email: data.email.trim() || undefined,
        phone: data.phone.trim() || undefined,
        city: data.city.trim() || undefined,
        address: data.address.trim() || undefined,
        employeesCount: data.employeesCount ? Number(data.employeesCount) : null,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : null,
        status: data.status,
        notes: data.notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'companies'] })
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
    if (!form.name.trim()) errs.name = 'Введите название компании'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate(form)
  }

  return (
    <FormModal
      title={existing ? 'Редактировать компанию' : 'Новая компания'}
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
            {existing ? 'Сохранить' : 'Создать компанию'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={`${s.field} ${s.full}`}>
            <label className={s.label}>Название <span className={s.required}>*</span></label>
            <input className={s.input} placeholder="ООО «Рога и Копыта»" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className={s.error}>{errors.name}</span>}
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Отрасль</label>
            <select className={s.select} value={form.industry} onChange={(e) => set('industry', e.target.value)}>
              {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o || '— не указана —'}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Статус</label>
            <select className={s.select} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Email</label>
            <input className={s.input} type="email" placeholder="info@company.ru" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Телефон</label>
            <input className={s.input} type="tel" placeholder="+7 495 000-00-00" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Город</label>
            <input className={s.input} placeholder="Москва" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Сайт</label>
            <input className={s.input} placeholder="https://company.ru" value={form.website} onChange={(e) => set('website', e.target.value)} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Сотрудников</label>
            <input className={s.input} type="number" placeholder="150" value={form.employeesCount} onChange={(e) => set('employeesCount', e.target.value)} min={0} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Годовая выручка (₽)</label>
            <input className={s.input} type="number" placeholder="5000000" value={form.annualRevenue} onChange={(e) => set('annualRevenue', e.target.value)} min={0} />
          </div>
        </div>

        <div className={s.field}>
          <label className={s.label}>Заметки</label>
          <textarea className={s.textarea} placeholder="Контекст, история, важные детали..." value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
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
