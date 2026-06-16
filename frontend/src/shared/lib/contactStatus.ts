export type ContactStatus = 'active' | 'inactive' | 'prospect'

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: 'active', label: 'Активный' },
  { value: 'inactive', label: 'Неактивный' },
  { value: 'prospect', label: 'Перспективный' },
]

export const CONTACT_STATUS_CONFIG: Record<
  ContactStatus,
  { label: string; color: string; bg: string }
> = {
  active: {
    label: 'Активный',
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
  },
  inactive: {
    label: 'Неактивный',
    color: 'var(--color-text-secondary)',
    bg: 'var(--color-bg-secondary)',
  },
  prospect: {
    label: 'Перспективный',
    color: 'var(--color-accent)',
    bg: 'var(--color-accent-light)',
  },
}

export function normalizeContactStatus(status: string): ContactStatus {
  if (status === 'active' || status === 'inactive' || status === 'prospect') {
    return status
  }
  return 'active'
}
