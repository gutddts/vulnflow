import { useCallback } from 'react'
import { useSettingsStore, type Theme } from '@/stores/settingsStore'

export function useTheme() {
  const { theme, setTheme, scanlines, setScanlines } = useSettingsStore()

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }, [theme, setTheme])

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return {
    theme,
    isDark,
    scanlines,
    setTheme,
    toggleTheme,
    setScanlines,
  }
}
