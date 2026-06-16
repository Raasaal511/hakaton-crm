import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI, type SalesInvoice } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: SalesInvoice | null
  prefill?: {
    quoteId?: number
    total?: number
    dealId?: number
    number?: string
  }
}

type FormData = {
  number: string
  total: string
  paidAmount: string
  status: string
  currency: string
  issuedAt: string
  dueAt: string
  dealId: string
  quoteId: string
}

const EMPTY: FormData = {
  number: '',
  total: '',
  paidAmount: '0',
  status: 'draft',
  currency: 'RUB',
  issuedAt: new Date().toISOString().slice(0, 10),
  dueAt: '',
  dealId: '',
  quoteId: '',
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'sent', label: 'Отправлен' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'overdue', label: 'Просрочен' },
  { value: 'cancelled', label: 'Отменён' },
]

const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR', 'KZT']

function toFormData(inv: SalesInvoice): FormData {
  return {
    number: inv.number,
    total: String(inv.total),
    paidAmount: String(inv.paidAmount),
    status: inv.status,
    currency: inv.currency,
    issuedAt: inv.issuedAt ? inv.issuedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueAt: inv.dueAt ? inv.dueAt.slice(0, 10) : '',
    dealId: inv.dealId ? String(inv.dealId) : '',
    quoteId: inv.quoteId ? String(inv.quoteId) : '',
  }
}

export function InvoiceForm({ open, onClose, existing, prefill }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm(toFormData(existing))
    } else if (prefill) {
      setForm({
        ...EMPTY,
        number: prefill.number ?? '',
        total: prefill.total != null ? String(prefill.total) : '',
        dealId: prefill.dealId ? String(prefill.dealId) : '',
        quoteId: prefill.quoteId ? String(prefill.quoteId) : '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, existing?.id, prefill?.quoteId])

  const { data: dealsData } = useQuery({
    queryKey: qk.crmDeals(org?.id ?? 0, {}),
    queryFn: () => crmAPI.getDeals(org!.id),
    enabled: Boolean(org?.id) && open,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        number: data.number.trim(),
        total: Number(data.total) || 0,
        paidAmount: Number(data.paidAmount) || 0,
        status: data.status,
        currency: data.currency,
        issuedAt: data.issuedAt || undefined,
        dueAt: data.dueAt || undefined,
        dealId: data.dealId ? Number(data.dealId) : undefined,
        quoteId: data.quoteId ? Number(data.quoteId) : undefined,
      }
      if (existing) {
        return crmAPI.updateInvoice(org!.id, existing.id, payload)
      }
      return crmAPI.createInvoice(org!.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.financeInvoices(org?.id ?? 0) })
      onClose()
    },
  })

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.number.trim()) errs.number = 'Введите номер счёта'
    if (!form.total || isNaN(Number(form.total))) errs.total = 'Введите сумму'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    saveMutation.mutate(form)
  }

  const deals = dealsData?.items ?? []
  const isEdit = Boolean(existing)

  return (
    <FormModal
      title={isEdit ? 'Редактировать счёт' : prefill?.quoteId ? 'Счёт из КП' : 'Новый счёт'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 size={13} className={s.spin} />}
            {isEdit ? 'Сохранить' : 'Создать счёт'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Номер счёта <span className={s.required}>*</span></label>
            <input className={s.input} placeholder="ИНВ-2026-001" value={form.number} onChange={(e) => set('number', e.target.value)} />
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
            <label className={s.label}>Сумма <span className={s.required}>*</span></label>
            <input className={s.input} type="number" placeholder="150000" value={form.total} onChange={(e) => set('total', e.target.value)} min={0} />
            {errors.total && <span className={s.error}>{errors.total}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label}>Оплачено</label>
            <input className={s.input} type="number" placeholder="0" value={form.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} min={0} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Дата выставления</label>
            <input className={s.input} type="date" value={form.issuedAt} onChange={(e) => set('issuedAt', e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Срок оплаты</label>
            <input className={s.input} type="date" value={form.dueAt} onChange={(e) => set('dueAt', e.target.value)} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Валюта</label>
            <select className={s.select} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
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
          <div className={s.error}>Ошибка: {(saveMutation.error as Error)?.message ?? 'Не удалось сохранить счёт'}</div>
        )}
      </div>
    </FormModal>
  )
}
