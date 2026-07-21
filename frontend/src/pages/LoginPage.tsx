import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  User,
  Zap,
  ArrowRight,
  Code2,
  Globe,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱或用户名'),
  password: z.string().min(1, '请输入密码'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password)
    } catch {
      // Error handled by hook
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0a0e1a]">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#0d1525] to-[#0a0e1a]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00d4aa]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7c3aed]/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff3385]/3 rounded-full blur-3xl" />

        {/* Grid background */}
        <div className="absolute inset-0 grid-bg" />

        {/* Content */}
        <div className="relative flex flex-col items-center justify-center w-full p-12">
          <div className="max-w-md text-center space-y-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#00d4aa] to-[#7c3aed] blur-xl opacity-50" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4aa] to-[#7c3aed] shadow-[0_0_30px_rgba(0,212,170,0.3)]">
                  <Shield className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Vuln<span className="text-[#00d4aa] text-glow-cyan">Flow</span>
                </h1>
                <p className="mt-2 text-lg text-[#94a3b8]">
                  AI 驱动的渗透测试智能体平台
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Zap, label: 'AI 智能', desc: '多模型驱动' },
                { icon: Globe, label: '全场景', desc: 'Web/网络/云' },
                { icon: Terminal, label: '自动化', desc: '端到端渗透' },
              ].map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[#1e293b] bg-[#111827]/50 p-4 backdrop-blur-sm"
                  >
                    <Icon className="h-6 w-6 text-[#00d4aa]" />
                    <span className="text-sm font-medium text-white">{feature.label}</span>
                    <span className="text-xs text-[#64748b]">{feature.desc}</span>
                  </div>
                )
              })}
            </div>

            {/* Version */}
            <p className="text-xs text-[#475569]">Version 1.0.0 · Enterprise Edition</p>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c3aed]">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Vuln<span className="text-[#00d4aa]">Flow</span>
            </h1>
          </div>

          {/* Form */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">欢迎回来</h2>
            <p className="text-sm text-[#94a3b8]">请登录您的账户以继续</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">邮箱 / 用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <Input
                  {...register('email')}
                  type="text"
                  placeholder="请输入邮箱或用户名"
                  className={cn(
                    'pl-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-11 rounded-xl focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/30',
                    errors.email && 'border-red-500/50 focus:border-red-500/50',
                  )}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#e2e8f0]">密码</label>
                <a href="#" className="text-xs text-[#00d4aa] hover:underline">
                  忘记密码？
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  className={cn(
                    'pl-10 pr-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-11 rounded-xl focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/30',
                    errors.password && 'border-red-500/50 focus:border-red-500/50',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00b894] hover:from-[#00d4aa]/90 hover:to-[#00b894]/90 text-black font-semibold shadow-[0_0_15px_rgba(0,212,170,0.3)] transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  登录中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  登录 <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer links */}
          <div className="flex items-center justify-center gap-6 text-xs text-[#64748b]">
            <a href="#" className="hover:text-[#00d4aa] transition-colors">
              <Code2 className="h-4 w-4 inline mr-1" />
              GitHub
            </a>
            <span>·</span>
            <a href="#" className="hover:text-[#00d4aa] transition-colors">
              文档
            </a>
            <span>·</span>
            <a href="#" className="hover:text-[#00d4aa] transition-colors">
              支持
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
