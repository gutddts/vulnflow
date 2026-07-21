import { useMemo, useState } from 'react'
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Save,
  RotateCcw,
  Cpu,
  Eye,
  Key,
  Shield,
  Bell,
  Zap,
  Globe,
  AlertTriangle,
  Info,
  Server,
  Terminal,
  Clock,
  Palette,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ModelConfig } from '@/components/settings/ModelConfig'
import { useSettingsStore, type Theme } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const ACCENT_COLORS = [
  { color: '#00d4aa', name: 'Cyan', class: 'bg-[#00d4aa]' },
  { color: '#7c3aed', name: 'Purple', class: 'bg-[#7c3aed]' },
  { color: '#ff3385', name: 'Pink', class: 'bg-[#ff3385]' },
  { color: '#3b82f6', name: 'Blue', class: 'bg-blue-500' },
  { color: '#10b981', name: 'Green', class: 'bg-green-500' },
  { color: '#f59e0b', name: 'Orange', class: 'bg-amber-500' },
]

export function SettingsPage() {
  const {
    theme,
    accentColor,
    temperature,
    maxTokens,
    apiKeys,
    autoExecute,
    scanlines,
    notifications,
    setTheme,
    setAccentColor,
    setTemperature,
    setMaxTokens,
    setApiKey,
    removeApiKey,
    setAutoExecute,
    setScanlines,
    setNotifications,
    resetAll,
  } = useSettingsStore()

  const [openAIKey, setOpenAIKey] = useState(apiKeys['openai'] || '')
  const [claudeKey, setClaudeKey] = useState(apiKeys['claude'] || '')

  // 根据当前 accentColor 反查索引（持久化恢复时高亮正确的圆点）
  const selectedAccentIndex = useMemo(
    () => ACCENT_COLORS.findIndex((c) => c.color.toLowerCase() === accentColor.toLowerCase()),
    [accentColor],
  )

  const handleSave = () => {
    if (openAIKey) setApiKey('openai', openAIKey)
    if (claudeKey) setApiKey('claude', claudeKey)
    toast.success('设置已保存')
  }

  const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">系统设置</h1>
        <p className="text-sm text-[#94a3b8] mt-1">配置 VulnFlow 平台参数</p>
      </div>

      {/* Model Configuration */}
      <ModelConfig />

      {/* Appearance */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20">
            <Palette className="h-5 w-5 text-cyber-cyan" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">外观</h2>
            <p className="text-xs text-[#94a3b8]">自定义界面主题和显示效果</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Theme */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">主题模式</label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-all border',
                      theme === opt.value
                        ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 shadow-[0_0_10px_rgba(0,212,170,0.1)]'
                        : 'bg-[#111827] text-[#94a3b8] border-[#1e293b] hover:text-white hover:border-[#334155]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Accent color picker */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">主题色</label>
            <div className="flex gap-3">
              {ACCENT_COLORS.map((color, i) => {
                const isActive = i === selectedAccentIndex
                return (
                  <button
                    key={color.color}
                    onClick={() => setAccentColor(color.color)}
                    style={{ backgroundColor: color.color }}
                    className={cn(
                      'relative h-10 w-10 rounded-xl border-2 transition-all hover:scale-110',
                      isActive
                        ? 'border-white scale-110 shadow-[0_0_15px_var(--primary-glow)]'
                        : 'border-transparent',
                    )}
                    title={color.name}
                  >
                    {isActive && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-[#94a3b8] whitespace-nowrap">
                        {color.name}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scanlines toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-[#e2e8f0]">扫描线效果</span>
              <p className="text-xs text-[#94a3b8]">显示 CRT 扫描线视觉效果</p>
            </div>
            <button
              onClick={() => setScanlines(!scanlines)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                scanlines ? 'bg-cyber-cyan' : 'bg-[#1e293b]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-md',
                  scanlines ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          {/* Auto execute */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-[#e2e8f0]">自动执行</span>
              <p className="text-xs text-[#94a3b8]">AI 助手自动执行技能，无需手动确认</p>
            </div>
            <button
              onClick={() => setAutoExecute(!autoExecute)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                autoExecute ? 'bg-cyber-cyan' : 'bg-[#1e293b]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-md',
                  autoExecute ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-[#e2e8f0]">桌面通知</span>
              <p className="text-xs text-[#94a3b8]">任务完成或发现漏洞时推送通知</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                notifications ? 'bg-cyber-cyan' : 'bg-[#1e293b]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-md',
                  notifications ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Server className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">系统信息</h2>
            <p className="text-xs text-[#94a3b8]">VulnFlow 平台运行状态</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">版本</p>
            <p className="text-sm font-mono text-cyber-cyan mt-1">v1.0.0</p>
          </div>
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">后端状态</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
              <p className="text-sm text-green-400">运行中</p>
            </div>
          </div>
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">Python</p>
            <p className="text-sm font-mono text-[#e2e8f0] mt-1">3.12.0</p>
          </div>
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">前端框架</p>
            <p className="text-sm font-mono text-[#7c3aed] mt-1">React 19</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">运行时间</p>
            <p className="text-sm font-mono text-[#e2e8f0] mt-1">72h 15m</p>
          </div>
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">内存使用</p>
            <p className="text-sm font-mono text-yellow-400 mt-1">1.2 GB</p>
          </div>
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">活跃会话</p>
            <p className="text-sm font-mono text-blue-400 mt-1">3</p>
          </div>
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="text-xs text-[#94a3b8]">技能总数</p>
            <p className="text-sm font-mono text-purple-400 mt-1">12</p>
          </div>
        </div>
      </div>

      {/* License Management */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Key className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">许可证管理</h2>
            <p className="text-xs text-[#94a3b8]">管理 VulnFlow 许可证和激活状态</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-sm text-[#e2e8f0] font-medium">社区版</p>
              <p className="text-xs text-[#94a3b8]">功能完整的免费版本，适合个人和小团队使用</p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">升级到企业版</span>
            </div>
            <p className="text-[10px] text-[#64748b] mt-1">
              企业版提供团队协作、高级报表、API 集成等高级功能。请联系销售团队获取更多信息。
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="输入许可证密钥..."
              className="bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50 flex-1"
            />
            <Button className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black rounded-xl">
              激活
            </Button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <Button
          onClick={handleSave}
          className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black shadow-[0_0_15px_rgba(0,212,170,0.3)] rounded-xl"
        >
          <Save className="h-4 w-4 mr-1.5" />
          保存设置
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            resetAll()
            toast.info('已重置为默认设置')
          }}
          className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e] rounded-xl"
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          重置默认
        </Button>
      </div>
    </div>
  )
}
