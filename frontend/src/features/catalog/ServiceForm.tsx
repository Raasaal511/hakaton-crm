import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { catalogAPI, type CatalogService } from 'shared/api/requests/catalog'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: CatalogService | null
  categorySuggestions?: string[]
}

type FormData = {
  name: string
  description: string
  category: string
  price: string
  unit: string
  durationHours: string
  active: string
}

const EMPTY: FormData = {
  name: '',
  description: '',
  category: '',
  price: '',
  unit: 'час',
  durationHours: '',
  active: 'true',
}

function toFormData(service: CatalogService): FormData {
  return {
    name: service.name ?? '',
    description: service.description ?? '',
    category: service.category ?? '',
    price: String(service.price ?? 0),
    unit: service.unit ?? 'час',
    durationHours: service.durationHours != null ? String(service.durationHours) : '',
    active: service.active ? 'true' : 'false',
  }
}

export function ServiceForm({ open, onClose, existing, categorySuggestions = [] }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (!open) return
    setForm(existing ? toFormData(existing) : EMPTY)
    setErrors({})
  }, [open, existing?.id])

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      catalogAPI.createService(org!.id, {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        category: data.category.trim() || undefined,
        price: Number(data.price) || 0,
        unit: data.unit || 'час',
        durationHours: data.durationHours ? Number(data.durationHours) : undefined,
        active: data.active === 'true',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'services'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      catalogAPI.updateService(org!.id, existing!.id, {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        category: data.category.trim() || undefined,
        price: Number(data.price) || 0,
        unit: data.unit || 'час',
        durationHours: data.durationHours ? Number(data.durationHours) : null,
        active: data.active === 'true',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'services'] })
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
    if (!form.name.trim()) errs.name = 'Введите название услуги'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate(form)
  }

  return (
    <FormModal
      title={existing ? 'Редактировать услугу' : 'Новая услуга'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 size={13} className={s.spin} />}
            {existing ? 'Сохранить' : 'Создать услугу'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={`${s.field} ${s.full}`}>
            <label className={s.label}>Название <span className={s.required}>*</span></label>
            <input className={s.input} placeholder="Внедрение CRM" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className={s.error}>{errors.name}</span>}
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Категория</label>
            <input
              className={s.input}
              placeholder="Консалтинг, поддержка..."
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              list="service-categories"
            />
            {categorySuggestions.length > 0 && (
              <datalist id="service-categories">
                {categorySuggestions.map((c) => <option key={c} value={c} />)}
              </datalist>
            )}
          </div>
          <div className={s.field}>
            <label className={s.label}>Статус</label>
            <select className={s.select} value={form.active} onChange={(e) => set('active', e.target.value)}>
              <option value="true">Активна</option>
              <option value="false">Скрыта</option>
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Цена (₽)</label>
            <input className={s.input} type="number" placeholder="15000" value={form.price} onChange={(e) => set('price', e.target.value)} min={0} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Единица</label>
            <input className={s.input} placeholder="час, проект, мес..." value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </div>
        </div>

        <div className={s.field}>
          <label className={s.label}>Длительность (часы)</label>
          <input className={s.input} type="number" placeholder="8" value={form.durationHours} onChange={(e) => set('durationHours', e.target.value)} min={0} step={0.5} />
        </div>

        <div className={s.field}>
          <label className={s.label}>Описание</label>
          <textarea className={s.textarea} placeholder="Краткое описание услуги..." value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </div>

        {mutation.isError && (
          <div className={s.error}>Ошибка: {(mutation.error as Error)?.message ?? 'Не удалось сохранить'}</div>
        )}
      </div>
    </FormModal>
  )
}
