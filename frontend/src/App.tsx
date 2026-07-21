import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { router } from '@/routes'
import { useSettingsStore } from '@/stores/settingsStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  // 启动时同步应用主题模式 + 主题色（避免从 localStorage 恢复后未应用）
  const theme = useSettingsStore((s) => s.theme)
  const accentColor = useSettingsStore((s) => s.accentColor)
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--primary', accentColor)
    root.style.setProperty('--accent', accentColor)
    root.style.setProperty('--cyber-cyan', accentColor)
    const r = parseInt(accentColor.slice(1, 3), 16)
    const g = parseInt(accentColor.slice(3, 5), 16)
    const b = parseInt(accentColor.slice(5, 7), 16)
    root.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.3)`)
  }, [accentColor])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1f2e',
                border: '1px solid #1e293b',
                color: '#e2e8f0',
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
