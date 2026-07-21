import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout, fetchUser } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        await login(email, password)
        toast.success('登录成功')
        navigate('/')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '登录失败，请检查邮箱和密码'
        toast.error(message)
        throw error
      }
    },
    [login, navigate],
  )

  const handleLogout = useCallback(() => {
    logout()
    toast.info('已退出登录')
    navigate('/login')
  }, [logout, navigate])

  return {
    user,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    fetchUser,
  }
}
