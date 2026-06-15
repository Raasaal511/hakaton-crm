import { QueryClient } from '@tanstack/react-query'

/**
 * Дефолты подобраны под админ/SaaS-режим:
 * - один пользователь чаще сам же и меняет данные;
 * - не нужна агрессивная синхронизация с фоном;
 * - важно минимизировать число сетевых запросов.
 *
 * Для совсем редких справочников (роли, теги отдела, колонки) можно
 * передать `staleTime` побольше прямо на конкретном `useQuery`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
