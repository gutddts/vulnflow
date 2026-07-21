import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'system'

export type ApiFormat = 'openai' | 'anthropic'

interface SettingsState {
  theme: Theme
  accentColor: string
  model: string
  temperature: number
  maxTokens: number
  apiKeys: Record<string, string>
  autoExecute: boolean
  scanlines: boolean
  notifications: boolean

  // AI 模型连接配置
  provider: string       // openai / deepseek / ollama / vllm / anthropic
  apiBaseUrl: string     // API 基础地址（如 https://api.deepseek.com）
  apiFormat: ApiFormat   // openai / anthropic

  setTheme: (theme: Theme) => void
  setAccentColor: (color: string) => void
  setModel: (model: string) => void
  setTemperature: (temp: number) => void
  setMaxTokens: (tokens: number) => void
  setApiKey: (provider: string, key: string) => void
  removeApiKey: (provider: string) => void
  setAutoExecute: (enabled: boolean) => void
  setScanlines: (enabled: boolean) => void
  setNotifications: (enabled: boolean) => void

  // AI 连接配置
  setProvider: (provider: string) => void
  setApiBaseUrl: (url: string) => void
  setApiFormat: (fmt: ApiFormat) => void
  // 一键保存完整的 AI 配置
  setAiConfig: (config: { provider: string; model: string; apiBaseUrl: string; apiFormat: ApiFormat; apiKey: string; temperature: number; maxTokens: number }) => void

  resetAll: () => void
}

const defaultSettings = {
  theme: 'dark' as Theme,
  accentColor: '#00d4aa',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
  apiKeys: {} as Record<string, string>,
  autoExecute: false,
  scanlines: false,
  notifications: true,

  provider: 'deepseek',
  apiBaseUrl: 'https://api.deepseek.com',
  apiFormat: 'openai' as ApiFormat,
}

// 将主题模式应用到 <html> 上的 class
function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    root.classList.add(theme)
  }
}

// 将主题色应用到 CSS 变量（--primary / --accent / --cyber-cyan）
function applyAccentColor(color: string) {
  const root = document.documentElement
  root.style.setProperty('--primary', color)
  root.style.setProperty('--accent', color)
  root.style.setProperty('--cyber-cyan', color)
  // 推导 hover 态颜色（叠加一点透明度）
  root.style.setProperty('--primary-hover', `${color}dd`)
  // 推导 glow 颜色（用作 box-shadow）
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  root.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.3)`)
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme) => {
        set({ theme })
        applyThemeClass(theme)
      },

      setAccentColor: (accentColor) => {
        set({ accentColor })
        applyAccentColor(accentColor)
      },

      setModel: (model) => set({ model }),
      setTemperature: (temperature) => set({ temperature }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      setApiKey: (provider, key) =>
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
      removeApiKey: (provider) =>
        set((state) => {
          const keys = { ...state.apiKeys }
          delete keys[provider]
          return { apiKeys: keys }
        }),
      setAutoExecute: (autoExecute) => set({ autoExecute }),
      setScanlines: (scanlines) => set({ scanlines }),
      setNotifications: (notifications) => set({ notifications }),

      setProvider: (provider) => set({ provider }),
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setApiFormat: (apiFormat) => set({ apiFormat }),
      setAiConfig: (config) => {
        const { provider, model, apiBaseUrl, apiFormat, apiKey, temperature, maxTokens } = config
        set((state) => ({
          provider,
          model,
          apiBaseUrl,
          apiFormat,
          temperature,
          maxTokens,
          apiKeys: { ...state.apiKeys, [provider]: apiKey },
        }))
      },

      resetAll: () => {
        set(defaultSettings)
        applyThemeClass(defaultSettings.theme)
        applyAccentColor(defaultSettings.accentColor)
      },
    }),
    {
      name: 'vulnflow-settings',
      partialize: (state) => ({
        theme: state.theme,
        accentColor: state.accentColor,
        model: state.model,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        apiKeys: state.apiKeys,
        autoExecute: state.autoExecute,
        scanlines: state.scanlines,
        notifications: state.notifications,
        provider: state.provider,
        apiBaseUrl: state.apiBaseUrl,
        apiFormat: state.apiFormat,
      }),
      onRehydrateStorage: () => (state) => {
        // 持久化恢复后立即应用主题和主题色
        if (state) {
          applyThemeClass(state.theme)
          if (state.accentColor) {
            applyAccentColor(state.accentColor)
          }
        }
      },
    },
  ),
)
