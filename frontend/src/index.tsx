import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from 'app'
import { queryClient } from 'shared/api/queryClient'
import './index.css'
import { initAccentFromStorage } from 'shared/lib/accent'
import { initThemeFromStorage } from 'shared/lib/theme'

const resolved = initThemeFromStorage()
initAccentFromStorage(resolved)

const root = createRoot(document.getElementById('root')!)

root.render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
)