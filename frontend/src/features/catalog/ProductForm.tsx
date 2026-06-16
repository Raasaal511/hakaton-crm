import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { catalogAPI, type Product } from 'shared/api/requests/catalog'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'

type Props = {
  open: boolean
  onClose: () => void
  existing?: Product | null
}

type FormData = {
  name: string
  sku: string
  description: string
  price: string
  costPrice: string
  unit: string
  stockQuantity: string
  categoryId: string
}

const EMPTY: FormData = {
  name: '', sku: '', description: '', price: '', costPrice: '',
  unit: 'шт', stockQuantity: '0', categoryId: '',
}

function toFormData(product: Product): FormData {
  return {
    name: product.name ?? '',
    sku: product.sku ?? '',
    description: product.description ?? '',
    price: String(product.price ?? 0),
    costPrice: String(product.costPrice ?? 0),
    unit: product.unit ?? 'шт',
    stockQuantity: String(product.stockQuantity ?? 0),
    categoryId: product.categoryId ? String(product.categoryId) : '',
  }
}

export function ProductForm({ open, onClose, existing }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (!open) return
    setForm(existing ? toFormData(existing) : EMPTY)
    setErrors({})
  }, [open, existing?.id])

  const { data: categoriesData } = useQuery({
    queryKey: qk.catalogCategories(org?.id ?? 0),
    queryFn: () => catalogAPI.getCategories(org!.id),
    enabled: Boolean(org?.id) && open,
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      catalogAPI.createProduct(org!.id, {
        name: data.name.trim(),
        sku: data.sku.trim() || undefined,
        description: data.description.trim() || undefined,
        price: Number(data.price) || 0,
        costPrice: Number(data.costPrice) || 0,
        unit: data.unit || 'шт',
        stockQuantity: Number(data.stockQuantity) || 0,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'products'] })
      onClose()
      setForm(EMPTY)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      catalogAPI.updateProduct(org!.id, existing!.id, {
        name: data.name.trim(),
        sku: data.sku.trim() || undefined,
        description: data.description.trim() || undefined,
        price: Number(data.price) || 0,
        costPrice: Number(data.costPrice) || 0,
        unit: data.unit || 'шт',
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'products'] })
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
    if (!form.name.trim()) errs.name = 'Введите название товара'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate(form)
  }

  const categories = categoriesData ?? []

  return (
    <FormModal
      title={existing ? 'Редактировать товар' : 'Новый товар'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button type="button" className={s.submitBtn} onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 size={13} className={s.spin} />}
            {existing ? 'Сохранить' : 'Создать товар'}
          </button>
        </>
      }
    >
      <div className={s.form}>
        <div className={s.fieldRow}>
          <div className={`${s.field} ${s.full}`}>
            <label className={s.label}>Название <span className={s.required}>*</span></label>
            <input className={s.input} placeholder="Meridian CRM Pro" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className={s.error}>{errors.name}</span>}
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Артикул (SKU)</label>
            <input className={s.input} placeholder="MCP-001" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Категория</label>
            <select className={s.select} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">— без категории —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Цена продажи (₽)</label>
            <input className={s.input} type="number" placeholder="45000" value={form.price} onChange={(e) => set('price', e.target.value)} min={0} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Себестоимость (₽)</label>
            <input className={s.input} type="number" placeholder="12000" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} min={0} />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label}>Единица измерения</label>
            <input className={s.input} placeholder="шт, лицензия/мес, кг..." value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </div>
          {!existing && (
            <div className={s.field}>
              <label className={s.label}>Начальный остаток</label>
              <input className={s.input} type="number" placeholder="0" value={form.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} min={0} />
            </div>
          )}
        </div>

        <div className={s.field}>
          <label className={s.label}>Описание</label>
          <textarea className={s.textarea} placeholder="Краткое описание товара..." value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </div>

        {mutation.isError && (
          <div className={s.error}>Ошибка: {(mutation.error as Error)?.message ?? 'Не удалось сохранить'}</div>
        )}
      </div>
    </FormModal>
  )
}
