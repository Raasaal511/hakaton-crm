export type ColumnPolicies = {
  requireResponsibleOnEnter: boolean
  requireDeadLineOnEnter: boolean
  wipLimit: number | null
  isCompletedColumn: boolean
}

export const DEFAULT_COLUMN_POLICIES: ColumnPolicies = {
  requireResponsibleOnEnter: false,
  requireDeadLineOnEnter: false,
  wipLimit: null,
  isCompletedColumn: false,
}

export type ColumnPolicyKey = keyof ColumnPolicies

const POLICY_KEYS = Object.keys(DEFAULT_COLUMN_POLICIES) as ColumnPolicyKey[]

export function mergeColumnPolicies(
  raw: Partial<ColumnPolicies> | null | undefined,
): ColumnPolicies {
  const merged = { ...DEFAULT_COLUMN_POLICIES }
  if (!raw || typeof raw !== 'object') return merged
  for (const key of POLICY_KEYS) {
    if (key === 'wipLimit') {
      if (raw.wipLimit === null) merged.wipLimit = null
      else if (typeof raw.wipLimit === 'number' && raw.wipLimit > 0) {
        merged.wipLimit = Math.floor(raw.wipLimit)
      }
      continue
    }
    if (typeof raw[key] === 'boolean') {
      merged[key] = raw[key]
    }
  }
  return merged
}

export function parseColumnPoliciesPayload(body: unknown): Partial<ColumnPolicies> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const nested =
    src.policies != null && typeof src.policies === 'object'
      ? (src.policies as Record<string, unknown>)
      : src
  const out: Partial<ColumnPolicies> = {}
  for (const key of POLICY_KEYS) {
    if (key === 'wipLimit') {
      if (nested.wipLimit === null) out.wipLimit = null
      else if (typeof nested.wipLimit === 'number' && nested.wipLimit > 0) {
        out.wipLimit = Math.floor(nested.wipLimit)
      }
      continue
    }
    if (typeof nested[key] === 'boolean') {
      out[key] = nested[key] as boolean
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
