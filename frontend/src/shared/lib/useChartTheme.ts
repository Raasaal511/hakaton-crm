import { useMemo } from 'react'
import { useTheme } from './useTheme'

export type ChartTheme = {
  accent: string
  active: string
  completed: string
  overdue: string
  created: string
  grid: string
  axis: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

export function useChartTheme(): ChartTheme {
  const { resolved } = useTheme()
  const isDark = resolved === 'dark'

  return useMemo(
    () => ({
      accent: isDark ? '#6b80f7' : '#4361ee',
      active: isDark ? '#64b5f6' : '#5e7bff',
      completed: isDark ? '#3fb950' : '#1a7f37',
      overdue: isDark ? '#f85149' : '#cf222e',
      created: isDark ? '#8898f9' : '#4361ee',
      grid: isDark ? '#30363d' : 'var(--color-border)',
      axis: isDark ? '#9198a1' : '#57606a',
      tooltipBg: isDark ? '#21262d' : '#FFFFFF',
      tooltipBorder: isDark ? '#30363d' : 'var(--color-border)',
      tooltipText: isDark ? '#e6edf3' : '#24292f',
    }),
    [isDark],
  )
}
