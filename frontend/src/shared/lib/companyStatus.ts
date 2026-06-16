export type CompanyStatus = 'active' | 'inactive' | 'prospect'

export const COMPANY_STATUS_OPTIONS: { value: CompanyStatus; label: string }[] = [
  { value: 'active', label: 'Активная' },
  { value: 'inactive', label: 'Неактивная' },
  { value: 'prospect', label: 'Перспективная' },
]

export const COMPANY_STATUS_CONFIG: Record<
  CompanyStatus,
  { label: string; color: string; bg: string }
> = {
  active: {
    label: 'Активная',
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
  },
  inactive: {
    label: 'Неактивная',
    color: 'var(--color-text-secondary)',
    bg: 'var(--color-bg-secondary)',
  },
  prospect: {
    label: 'Перспективная',
    color: 'var(--color-accent)',
    bg: 'var(--color-accent-light)',
  },
}

export function normalizeCompanyStatus(status: string): CompanyStatus {
  if (status === 'active' || status === 'inactive' || status === 'prospect') {
    return status
  }
  return 'active'
}
