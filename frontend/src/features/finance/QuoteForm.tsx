import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI, type SalesQuote } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: SalesQuote | null
  onCreateInvoiceFromQuote?: (quote: SalesQuote) => void
}

type FormData = {
  number: string
  subtotal: string
  discount: string
  status: string
  currency: string
  validUntil: string
  companyId: string
  dealId: string
}

const EMPTY: FormData = {
  number: '',
  subtotal: '',
  discount: '0',
  status: 'draft',
  currency: 'RUB',
  validUntil: '',
  companyId: '',
  dealId: '',
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'sent', label: 'Отправлено' },
  { value: 'accepted', label: 'Принято' },
  { value: 'rejected', label: 'Отклонено' },
  { value: 'expired', label: 'Истекло' },
]

const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR', 'KZT']

function toFormData(q: SalesQuote): FormData {
  return {
    number: q.number,
    subtotal: String(q.subtotal),
    discount: String(q.discount),
    status: q.status,
    currency: q.currency,
    validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
    companyId: q.companyId ? String(q.companyId) : '',
    dealId: q.dealId ? String(q.dealId) : '',
  }
}

export function QuoteForm({ open, onClose, existing, onCreateInvoiceFromQuote }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (!open) return
    setForm(existing ? toFormData(existing) : EMPTY)
    setErrors({})
  }, [open, existing?.id])

  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(org?.id ?? 0, { limit: 100 }),
    queryFn: () => crmAPI.getCompanies(org!.id, { limit: 100 }),
    enabled: Boolean(org?.id) && open,
    staleTime: 60_000,
  })

  const { data: dealsData } = useQuery({
    queryKey: qk.crmDeals(org?.id ?? 0, {}),
    queryFn: () => crmAPI.getDeals(org!.id),
    enabled: Boolean(org?.id) && open,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const sub = Number(data.subtotal) || 0
      const disc = Number(data.discount) || 0
      const payload = {
        number: data.number.trim(),
        subtotal: sub,
        discount: disc,
        total: Math.max(0, sub - disc),
        status: data.status,
        currency: data.currency,
        validUntil: data.validUntil || undefined,
        companyId: data.companyId ? Number(data.companyId) : undefined,
        dealId: data.dealId ? Number(data.dealId) : undefined,
      }
      if (existing) {
        return crmAPI.updateQuote(org!.id, existing.id, payload)
      }
      return crmAPI.createQuote(org!.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.financeQuotes(org?.id ?? 0) })
      onClose()
    },
  })

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.number.trim()) errs.number = 'Введите номер КП'
    if (!form.subtotal || isNaN(Number(form.subtotal))) errs.subtotal = 'Введите сумму'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    saveMutation.mutate(form)
  }

  const sub = Number(form.subtotal) || 0
  const disc = Number(form.discount) || 0
  const total = Math.max(0, sub - disc)
  const companies = companiesData?.items ?? []
  const deals = dealsData?.items ?? []
  const isEdit = Boolean(existing)
  const canCreateInvoice = isEdit && existing?.status === 'accepted' && onCreateInvoiceFromQuote

  return (
    <FormModal
      title={isEdit ? 'Редактировать КП' : 'Новое коммерческое предложение'}
      open={open}
      onClose={onClose}
      footer={
        <>
          {canCreateInvoice && (
            <button
              type="button"
              className={s.cancelBtn}
              onClick={() => {
                onCreateInvoiceFromQuote!(existing!)
                onClose()
              }}
            >
              Создать счёт из КП
            </button>
          )}
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 size={13} className={s.spin} />}
            {isEdit ? 'Сохранить' : 'Создать КП'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Номер КП <span className={s.required}>*</span></label>
            <input className={s.input} placeholder="КП-2026-001" value={form.number} onChange={(e) => set('number', e.target.value)} />
            {errors.number && <span className={s.error}>{errors.number}</span>}
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
            <label className={s.label}>Сумма (до скидки) <span className={s.required}>*</span></label>
            <input className={s.input} type="number" placeholder="200000" value={form.subtotal} onChange={(e) => set('subtotal', e.target.value)} min={0} />
            {errors.subtotal && <span className={s.error}>{errors.subtotal}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label}>Скидка (₽)</label>
            <input className={s.input} type="number" placeholder="0" value={form.discount} onChange={(e) => set('discount', e.target.value)} min={0} />
          </div>
        </div>

        {sub > 0 && (
          <div style={{ padding: '10px 12px', background: 'var(--color-accent-light, rgba(99,102,241,0.08))', borderRadius: 8, fontSize: 13, color: 'var(--color-accent)' }}>
            Итого к оплате: <strong>{total.toLocaleString('ru-RU')} {form.currency}</strong>
          </div>
        )}

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Действует до</label>
            <input className={s.input} type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Валюта</label>
            <select className={s.select} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Компания</label>
            <select className={s.select} value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
              <option value="">— не выбрана —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {deals.length > 0 && (
            <div className={s.field}>
              <label className={s.label}>Сделка</label>
              <select className={s.select} value={form.dealId} onChange={(e) => set('dealId', e.target.value)}>
                <option value="">— не привязана —</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          )}
        </div>

        {saveMutation.isError && (
          <div className={s.error}>Ошибка: {(saveMutation.error as Error)?.message ?? 'Не удалось сохранить КП'}</div>
        )}
      </div>
    </FormModal>
  )
}
