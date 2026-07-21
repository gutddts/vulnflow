import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserInfo, LoginResponse } from '@/types/api'
import api from '@/lib/api'

interface AuthState {
  user: UserInfo | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setTokens: (response: LoginResponse) => void
  fetchUser: () => Promise<void>
  updateUser: (user: Partial<UserInfo>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await api.post('/auth/login', { email, password })
          const data = response.data as LoginResponse
          get().setTokens(data)
          await get().fetchUser()
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      setTokens: (response: LoginResponse) => {
        localStorage.setItem('access_token', response.access_token)
        localStorage.setItem('refresh_token', response.refresh_token)
        set({
          token: response.access_token,
          refreshToken: response.refresh_token,
          isAuthenticated: true,
        })
      },

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me')
          const user = response.data as UserInfo
          set({ user, isLoading: false })
        } catch {
          set({ isLoading: false })
          get().logout()
        }
      },

      updateUser: (userData: Partial<UserInfo>) => {
        const current = get().user
        if (current) {
          set({ user: { ...current, ...userData } })
        }
      },
    }),
    {
      name: 'vulnflow-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
