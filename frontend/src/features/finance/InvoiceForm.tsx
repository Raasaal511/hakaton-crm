import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
}

type FormData = {
  number: string
  total: string
  paidAmount: string
  status: string
  currency: string
  issuedAt: string
  dueAt: string
  companyId: string
  dealId: string
  notes: string
}

const EMPTY: FormData = {
  number: '',
  total: '',
  paidAmount: '0',
  status: 'draft',
  currency: 'RUB',
  issuedAt: new Date().toISOString().slice(0, 10),
  dueAt: '',
  companyId: '',
  dealId: '',
  notes: '',
}

const STATUS_OPTIONS = [
  { value: 'draft',    label: 'Черновик' },
  { value: 'sent',     label: 'Отправлен' },
  { value: 'paid',     label: 'Оплачен' },
  { value: 'overdue',  label: 'Просрочен' },
  { value: 'cancelled', label: 'Отменён' },
]

const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR', 'KZT']

export function InvoiceForm({ open, onClose }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

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

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      crmAPI.createInvoice(org!.id, {
        number: data.number.trim(),
        total: Number(data.total) || 0,
        paidAmount: Number(data.paidAmount) || 0,
        status: data.status,
        currency: data.currency,
        issuedAt: data.issuedAt || undefined,
        dueAt: data.dueAt || undefined,
        companyId: data.companyId ? Number(data.companyId) : undefined,
        dealId: data.dealId ? Number(data.dealId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.financeInvoices(org?.id ?? 0) })
      onClose()
      setForm(EMPTY)
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
    createMutation.mutate(form)
  }

  const companies = companiesData?.items ?? []
  const deals = dealsData?.items ?? []

  return (
    <FormModal
      title="Новый счёт"
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 size={13} className={s.spin} />}
            Создать счёт
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
            <label className={s.label}>Компания</label>
            <select className={s.select} value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
              <option value="">— не выбрана —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label}>Валюта</label>
            <select className={s.select} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
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

        {createMutation.isError && (
          <div className={s.error}>Ошибка: {(createMutation.error as Error)?.message ?? 'Не удалось создать счёт'}</div>
        )}
      </div>
    </FormModal>
  )
}
