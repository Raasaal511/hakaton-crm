export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'rasl_theme'

export const THEME_COLOR_LIGHT = '#4361ee'
export const THEME_COLOR_DARK = '#161b22'

const VALID_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system']

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return getSystemTheme()
  return preference
}

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && VALID_PREFERENCES.includes(raw as ThemePreference)) {
      return raw as ThemePreference
    }
  } catch {
    /* ignore */
  }
  return 'system'
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }
}

export function updateThemeColorMeta(resolved: ResolvedTheme, overrideColor?: string): void {
  if (typeof document === 'undefined') return
  const color = overrideColor ?? (resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)

  const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (appleStatus) {
    appleStatus.setAttribute('content', resolved === 'dark' ? 'black-translucent' : 'default')
  }
}

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolved)
  updateThemeColorMeta(resolved)
}

export function initThemeFromStorage(): ResolvedTheme {
  const preference = getThemePreference()
  const resolved = resolveTheme(preference)
  applyTheme(resolved)
  return resolved
}

export function subscribeSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange(getSystemTheme())
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
