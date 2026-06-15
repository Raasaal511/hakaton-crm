import { useEffect, useLayoutEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { userModel } from 'entities/user'
import { authCheckRequested } from 'processes/auth'
import { clearUser } from 'shared/api/events/auth'
import { clearFavoritePipelines } from 'entities/pipeline/model/favorites'
import { queryClient } from 'shared/api/queryClient'
import { hasAuthToken, useTheme } from 'shared/lib'
import { syncWebPushIfAlreadyGranted } from 'shared/lib/webPushSubscription'
import { AppRouter } from './router'
import { PwaReloadPrompt } from './PwaReloadPrompt'

const PUBLIC_PATHS = ['/auth', '/register']

export default function App() {
  useTheme()
  userModel.selectors.useUser()
  const navigate = useNavigate()

  const location = useLocation()

  useEffect(() => {
    authCheckRequested()
  }, [])

  useEffect(() => {
    const handleLogout = () => {
      clearFavoritePipelines()
      queryClient.clear()
      clearUser()
      navigate('/auth', { replace: true })
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [navigate])

  /** До отрисовки контента: надёжный редирект в PWA / мобильных Safari, где отложенный useEffect давал пустой экран. */
  useLayoutEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))
    if (isPublic) return
    if (!hasAuthToken()) {
      navigate('/auth', { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))
    if (isPublic) return
    if (!hasAuthToken()) return
    void syncWebPushIfAlreadyGranted()
  }, [location.pathname])

  return (
    <>
      <AppRouter />
      <PwaReloadPrompt />
    </>
  )
}
