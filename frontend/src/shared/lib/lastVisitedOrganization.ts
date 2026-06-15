const STORAGE_KEY = 'rasl_last_org_id'

export function readLastVisitedOrganizationId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return null
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

export function persistLastVisitedOrganizationId(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    /* ignore quota / private mode */
  }
}
