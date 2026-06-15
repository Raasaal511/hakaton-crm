/** Безопасная проверка токена (в приватном режиме / ограничениях storage localStorage может бросать). */
export function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(localStorage.getItem('token'))
  } catch {
    return false
  }
}
