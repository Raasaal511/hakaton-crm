import type { AccentId } from '../types/userPreferences'

export type { AccentId } from '../types/userPreferences'
import type { ResolvedTheme } from './theme'
import { updateThemeColorMeta } from './theme'

export const ACCENT_STORAGE_KEY = 'rasl_accent'

export type AccentTokens = {
  accent: string
  accentHover: string
  accentSecondary: string
  accentSecondaryHover: string
  accentTint: string
  accentSecondaryTint: string
  accentLight: string
  accentSecondaryLight: string
  accentBorder: string
  shadowFocus: string
  shadowAccent: string
  dragIndicator: string
  dropzoneStripe: string
  dropzoneStripeFade: string
  themeColor: string
}

export type AccentPaletteItem = {
  id: AccentId
  label: string
  swatch: string
  light: AccentTokens
  dark: AccentTokens
}

export const ACCENT_PALETTE: AccentPaletteItem[] = [
  {
    id: 'blue',
    label: 'Синий',
    swatch: '#4361ee',
    light: {
      accent: '#4361ee',
      accentHover: '#3651dd',
      accentSecondary: '#5e7bff',
      accentSecondaryHover: '#2c40b3',
      accentTint: '#4361ee29',
      accentSecondaryTint: '#5e7bff1f',
      accentLight: '#eef2ff',
      accentSecondaryLight: '#d1deff',
      accentBorder: 'color-mix(in srgb, #4361ee 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(67, 97, 238, 0.25)',
      shadowAccent: '0 4px 14px rgba(67, 97, 238, 0.18)',
      dragIndicator: 'rgba(67, 97, 238, 0.45)',
      dropzoneStripe: 'rgba(67, 97, 238, 0.12)',
      dropzoneStripeFade: 'rgba(67, 97, 238, 0.06)',
      themeColor: '#4361ee',
    },
    dark: {
      accent: '#6b80f7',
      accentHover: '#8898f9',
      accentSecondary: '#8b7cf6',
      accentSecondaryHover: '#a18bf9',
      accentTint: '#6b80f72e',
      accentSecondaryTint: '#8b7cf62e',
      accentLight: 'color-mix(in srgb, #6b80f7 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #8b7cf6 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #6b80f7 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(107, 128, 247, 0.35)',
      shadowAccent: '0 4px 14px rgba(107, 128, 247, 0.22)',
      dragIndicator: 'rgba(107, 128, 247, 0.45)',
      dropzoneStripe: 'rgba(107, 128, 247, 0.2)',
      dropzoneStripeFade: 'rgba(107, 128, 247, 0.08)',
      themeColor: '#161b22',
    },
  },
  {
    id: 'violet',
    label: 'Фиолетовый',
    swatch: '#7c3aed',
    light: {
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      accentSecondary: '#8b5cf6',
      accentSecondaryHover: '#5b21b6',
      accentTint: '#7c3aed29',
      accentSecondaryTint: '#8b5cf61f',
      accentLight: '#f5f3ff',
      accentSecondaryLight: '#ede9fe',
      accentBorder: 'color-mix(in srgb, #7c3aed 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(124, 58, 237, 0.25)',
      shadowAccent: '0 4px 14px rgba(124, 58, 237, 0.18)',
      dragIndicator: 'rgba(124, 58, 237, 0.45)',
      dropzoneStripe: 'rgba(124, 58, 237, 0.12)',
      dropzoneStripeFade: 'rgba(124, 58, 237, 0.06)',
      themeColor: '#7c3aed',
    },
    dark: {
      accent: '#a78bfa',
      accentHover: '#c4b5fd',
      accentSecondary: '#c084fc',
      accentSecondaryHover: '#d8b4fe',
      accentTint: '#a78bfa2e',
      accentSecondaryTint: '#c084fc2e',
      accentLight: 'color-mix(in srgb, #a78bfa 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #c084fc 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #a78bfa 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(167, 139, 250, 0.35)',
      shadowAccent: '0 4px 14px rgba(167, 139, 250, 0.22)',
      dragIndicator: 'rgba(167, 139, 250, 0.45)',
      dropzoneStripe: 'rgba(167, 139, 250, 0.2)',
      dropzoneStripeFade: 'rgba(167, 139, 250, 0.08)',
      themeColor: '#161b22',
    },
  },
  {
    id: 'teal',
    label: 'Бирюзовый',
    swatch: '#0d9488',
    light: {
      accent: '#0d9488',
      accentHover: '#0f766e',
      accentSecondary: '#14b8a6',
      accentSecondaryHover: '#115e59',
      accentTint: '#0d948829',
      accentSecondaryTint: '#14b8a61f',
      accentLight: '#f0fdfa',
      accentSecondaryLight: '#ccfbf1',
      accentBorder: 'color-mix(in srgb, #0d9488 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(13, 148, 136, 0.25)',
      shadowAccent: '0 4px 14px rgba(13, 148, 136, 0.18)',
      dragIndicator: 'rgba(13, 148, 136, 0.45)',
      dropzoneStripe: 'rgba(13, 148, 136, 0.12)',
      dropzoneStripeFade: 'rgba(13, 148, 136, 0.06)',
      themeColor: '#0d9488',
    },
    dark: {
      accent: '#2dd4bf',
      accentHover: '#5eead4',
      accentSecondary: '#5eead4',
      accentSecondaryHover: '#99f6e4',
      accentTint: '#2dd4bf2e',
      accentSecondaryTint: '#5eead42e',
      accentLight: 'color-mix(in srgb, #2dd4bf 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #5eead4 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #2dd4bf 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(45, 212, 191, 0.35)',
      shadowAccent: '0 4px 14px rgba(45, 212, 191, 0.22)',
      dragIndicator: 'rgba(45, 212, 191, 0.45)',
      dropzoneStripe: 'rgba(45, 212, 191, 0.2)',
      dropzoneStripeFade: 'rgba(45, 212, 191, 0.08)',
      themeColor: '#161b22',
    },
  },
  {
    id: 'green',
    label: 'Зелёный',
    swatch: '#16a34a',
    light: {
      accent: '#16a34a',
      accentHover: '#15803d',
      accentSecondary: '#22c55e',
      accentSecondaryHover: '#166534',
      accentTint: '#16a34a29',
      accentSecondaryTint: '#22c55e1f',
      accentLight: '#f0fdf4',
      accentSecondaryLight: '#dcfce7',
      accentBorder: 'color-mix(in srgb, #16a34a 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(22, 163, 74, 0.25)',
      shadowAccent: '0 4px 14px rgba(22, 163, 74, 0.18)',
      dragIndicator: 'rgba(22, 163, 74, 0.45)',
      dropzoneStripe: 'rgba(22, 163, 74, 0.12)',
      dropzoneStripeFade: 'rgba(22, 163, 74, 0.06)',
      themeColor: '#16a34a',
    },
    dark: {
      accent: '#4ade80',
      accentHover: '#86efac',
      accentSecondary: '#86efac',
      accentSecondaryHover: '#bbf7d0',
      accentTint: '#4ade802e',
      accentSecondaryTint: '#86efac2e',
      accentLight: 'color-mix(in srgb, #4ade80 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #86efac 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #4ade80 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(74, 222, 128, 0.35)',
      shadowAccent: '0 4px 14px rgba(74, 222, 128, 0.22)',
      dragIndicator: 'rgba(74, 222, 128, 0.45)',
      dropzoneStripe: 'rgba(74, 222, 128, 0.2)',
      dropzoneStripeFade: 'rgba(74, 222, 128, 0.08)',
      themeColor: '#161b22',
    },
  },
  {
    id: 'orange',
    label: 'Оранжевый',
    swatch: '#ea580c',
    light: {
      accent: '#ea580c',
      accentHover: '#c2410c',
      accentSecondary: '#f97316',
      accentSecondaryHover: '#9a3412',
      accentTint: '#ea580c29',
      accentSecondaryTint: '#f973161f',
      accentLight: '#fff7ed',
      accentSecondaryLight: '#ffedd5',
      accentBorder: 'color-mix(in srgb, #ea580c 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(234, 88, 12, 0.25)',
      shadowAccent: '0 4px 14px rgba(234, 88, 12, 0.18)',
      dragIndicator: 'rgba(234, 88, 12, 0.45)',
      dropzoneStripe: 'rgba(234, 88, 12, 0.12)',
      dropzoneStripeFade: 'rgba(234, 88, 12, 0.06)',
      themeColor: '#ea580c',
    },
    dark: {
      accent: '#fb923c',
      accentHover: '#fdba74',
      accentSecondary: '#fdba74',
      accentSecondaryHover: '#fed7aa',
      accentTint: '#fb923c2e',
      accentSecondaryTint: '#fdba742e',
      accentLight: 'color-mix(in srgb, #fb923c 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #fdba74 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #fb923c 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(251, 146, 60, 0.35)',
      shadowAccent: '0 4px 14px rgba(251, 146, 60, 0.22)',
      dragIndicator: 'rgba(251, 146, 60, 0.45)',
      dropzoneStripe: 'rgba(251, 146, 60, 0.2)',
      dropzoneStripeFade: 'rgba(251, 146, 60, 0.08)',
      themeColor: '#161b22',
    },
  },
  {
    id: 'rose',
    label: 'Розовый',
    swatch: '#e11d48',
    light: {
      accent: '#e11d48',
      accentHover: '#be123c',
      accentSecondary: '#f43f5e',
      accentSecondaryHover: '#9f1239',
      accentTint: '#e11d4829',
      accentSecondaryTint: '#f43f5e1f',
      accentLight: '#fff1f2',
      accentSecondaryLight: '#ffe4e6',
      accentBorder: 'color-mix(in srgb, #e11d48 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(225, 29, 72, 0.25)',
      shadowAccent: '0 4px 14px rgba(225, 29, 72, 0.18)',
      dragIndicator: 'rgba(225, 29, 72, 0.45)',
      dropzoneStripe: 'rgba(225, 29, 72, 0.12)',
      dropzoneStripeFade: 'rgba(225, 29, 72, 0.06)',
      themeColor: '#e11d48',
    },
    dark: {
      accent: '#fb7185',
      accentHover: '#fda4af',
      accentSecondary: '#fda4af',
      accentSecondaryHover: '#fecdd3',
      accentTint: '#fb71852e',
      accentSecondaryTint: '#fda4af2e',
      accentLight: 'color-mix(in srgb, #fb7185 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #fda4af 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #fb7185 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(251, 113, 133, 0.35)',
      shadowAccent: '0 4px 14px rgba(251, 113, 133, 0.22)',
      dragIndicator: 'rgba(251, 113, 133, 0.45)',
      dropzoneStripe: 'rgba(251, 113, 133, 0.2)',
      dropzoneStripeFade: 'rgba(251, 113, 133, 0.08)',
      themeColor: '#161b22',
    },
  },
  {
    id: 'slate',
    label: 'Графит',
    swatch: '#475569',
    light: {
      accent: '#475569',
      accentHover: '#334155',
      accentSecondary: '#64748b',
      accentSecondaryHover: '#1e293b',
      accentTint: '#47556929',
      accentSecondaryTint: '#64748b1f',
      accentLight: '#f8fafc',
      accentSecondaryLight: '#e2e8f0',
      accentBorder: 'color-mix(in srgb, #475569 35%, transparent)',
      shadowFocus: '0 0 0 3px rgba(71, 85, 105, 0.25)',
      shadowAccent: '0 4px 14px rgba(71, 85, 105, 0.18)',
      dragIndicator: 'rgba(71, 85, 105, 0.45)',
      dropzoneStripe: 'rgba(71, 85, 105, 0.12)',
      dropzoneStripeFade: 'rgba(71, 85, 105, 0.06)',
      themeColor: '#475569',
    },
    dark: {
      accent: '#94a3b8',
      accentHover: '#cbd5e1',
      accentSecondary: '#cbd5e1',
      accentSecondaryHover: '#e2e8f0',
      accentTint: '#94a3b82e',
      accentSecondaryTint: '#cbd5e12e',
      accentLight: 'color-mix(in srgb, #94a3b8 18%, #21262d)',
      accentSecondaryLight: 'color-mix(in srgb, #cbd5e1 18%, #21262d)',
      accentBorder: 'color-mix(in srgb, #94a3b8 45%, #30363d)',
      shadowFocus: '0 0 0 3px rgba(148, 163, 184, 0.35)',
      shadowAccent: '0 4px 14px rgba(148, 163, 184, 0.22)',
      dragIndicator: 'rgba(148, 163, 184, 0.45)',
      dropzoneStripe: 'rgba(148, 163, 184, 0.2)',
      dropzoneStripeFade: 'rgba(148, 163, 184, 0.08)',
      themeColor: '#161b22',
    },
  },
]

const VALID_ACCENT_IDS = new Set(ACCENT_PALETTE.map((p) => p.id))

export function getAccentPaletteItem(id: string): AccentPaletteItem {
  return ACCENT_PALETTE.find((p) => p.id === id) ?? ACCENT_PALETTE[0]
}

export function getAccentIdFromStorage(): AccentId {
  if (typeof window === 'undefined') return 'blue'
  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY)
    if (raw && VALID_ACCENT_IDS.has(raw as AccentId)) return raw as AccentId
  } catch {
    /* ignore */
  }
  return 'blue'
}

export function setAccentIdInStorage(id: AccentId): void {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function applyAccentTokens(tokens: AccentTokens): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--color-accent', tokens.accent)
  root.style.setProperty('--color-accent-hover', tokens.accentHover)
  root.style.setProperty('--color-accent-secondary', tokens.accentSecondary)
  root.style.setProperty('--color-accent-secondary-hover', tokens.accentSecondaryHover)
  root.style.setProperty('--color-accent-tint', tokens.accentTint)
  root.style.setProperty('--color-accent-secondary-tint', tokens.accentSecondaryTint)
  root.style.setProperty('--color-accent-light', tokens.accentLight)
  root.style.setProperty('--color-accent-secondary-light', tokens.accentSecondaryLight)
  root.style.setProperty('--color-accent-border', tokens.accentBorder)
  root.style.setProperty('--color-link', tokens.accent)
  root.style.setProperty('--color-link-hover', tokens.accentHover)
  root.style.setProperty('--color-drag-indicator', tokens.dragIndicator)
  root.style.setProperty('--color-dropzone-stripe', tokens.dropzoneStripe)
  root.style.setProperty('--color-dropzone-stripe-fade', tokens.dropzoneStripeFade)
  root.style.setProperty('--color-accent-glass-edge', `color-mix(in srgb, #ffffff 16%, ${tokens.accent})`)
  root.style.setProperty('--shadow-focus', tokens.shadowFocus)
  root.style.setProperty('--shadow-accent', tokens.shadowAccent)
}

export function applyAccent(accentId: string, resolvedTheme: ResolvedTheme): void {
  const item = getAccentPaletteItem(accentId)
  const tokens = resolvedTheme === 'dark' ? item.dark : item.light
  applyAccentTokens(tokens)
  document.documentElement.setAttribute('data-accent-id', item.id)
  updateThemeColorMeta(resolvedTheme, tokens.themeColor)
}

export function initAccentFromStorage(resolvedTheme: ResolvedTheme): void {
  applyAccent(getAccentIdFromStorage(), resolvedTheme)
}
