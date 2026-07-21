import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Target,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Cpu,
  Activity,
  Sparkles,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/stores/chatStore'
import { useTaskStore } from '@/stores/taskStore'
import { useFindingStore, useSeverityStats } from '@/stores/findingStore'
import { cn, formatRelativeTime } from '@/lib/utils'

const STATUS_DOT = {
  completed: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-400' },
  success: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-400' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
  running: { color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', border: 'border-cyber-cyan/30', dot: 'bg-cyber-cyan animate-pulse' },
  in_progress: { color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', border: 'border-cyber-cyan/30', dot: 'bg-cyber-cyan animate-pulse' },
  pending: { color: 'text-gray-400', bg: 'bg-gray-500/5', border: 'border-gray-500/20', dot: 'bg-gray-500' },
  queued: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  cancelled: { color: 'text-gray-500', bg: 'bg-gray-500/5', border: 'border-gray-500/20', dot: 'bg-gray-500' },
} as const

const SEVERITY_DOT = {
  critical: 'bg-pink-500 shadow-[0_0_6px_rgba(255,51,133,0.6)]',
  high: 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]',
  medium: 'bg-orange-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]',
  low: 'bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)]',
  info: 'bg-gray-400',
} as const

const SEVERITY_LABEL = {
  critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息',
} as const

export function ContextPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  // 从 store 派生数据 - 完全跟随 currentSession
  const currentSessionId = useChatStore((s) => s.currentSessionId)
  const sessions = useChatStore((s) => s.sessions)
  const sessionMessages = useChatStore((s) => s.sessionMessages)

  const currentSession = sessions.find((s) => s.id === currentSessionId)
  const messages = currentSessionId ? sessionMessages[currentSessionId] || [] : []
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')

  // 关联任务和漏洞（从其他 store）
  const tasks = useTaskStore((s) => s.tasks)
  const sessionTasks = tasks.filter((t) => t.type === 'exploit' || t.type === 'scan').slice(0, 5)
  const findings = useFindingStore((s) => s.findings)
  const topFindings = [...findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    return order[a.severity] - order[b.severity]
  }).slice(0, 5)
  const severityStats = useSeverityStats()

  if (collapsed) {
    return (
      <div className="flex items-start pt-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e]"
          onClick={() => setCollapsed(false)}
          title="展开上下文面板"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full rounded-xl border border-[#1e293b] bg-[#1a1f2e] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-cyber-cyan/10">
            <Target className="h-3.5 w-3.5 text-cyber-cyan" />
          </div>
          <h3 className="text-sm font-semibold text-white">上下文面板</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#94a3b8] hover:text-white hover:bg-[#111827]"
          onClick={() => setCollapsed(true)}
          title="收起"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* 当前会话信息 - 始终跟随 currentSession */}
          <div className="rounded-lg border border-cyber-cyan/20 bg-cyber-cyan/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-cyber-cyan" />
              <span className="text-xs font-semibold text-[#e2e8f0]">当前会话</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#64748b]">标题</span>
                <span className="text-white truncate ml-2 max-w-[180px]">{currentSession?.title || '新对话'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">模型</span>
                <span className="text-white font-mono">{currentSession?.model || 'gpt-4o'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">消息数</span>
                <span className="text-white tabular-nums">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">最后活动</span>
                <span className="text-white">
                  {currentSession ? formatRelativeTime(currentSession.updated_at) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 最新对话上下文 */}
          {lastUserMsg && (
            <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-[#e2e8f0]">最近提问</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] line-clamp-3 leading-relaxed">
                {lastUserMsg.content}
              </p>
            </div>
          )}

          {lastAssistantMsg && (
            <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-cyber-cyan" />
                <span className="text-xs font-semibold text-[#e2e8f0]">最近回复</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] line-clamp-3 leading-relaxed">
                {lastAssistantMsg.content}
              </p>
            </div>
          )}

          {/* 关联任务 */}
          {sessionTasks.length > 0 && (
            <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-3.5 w-3.5 text-cyber-cyan" />
                <span className="text-xs font-semibold text-[#e2e8f0]">关联任务</span>
                <span className="ml-auto text-[10px] text-[#64748b]">{sessionTasks.length}</span>
              </div>
              <div className="space-y-1.5">
                {sessionTasks.map((task) => {
                  const cfg = STATUS_DOT[task.status as keyof typeof STATUS_DOT] || STATUS_DOT.pending
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-[#0d1321] rounded px-1 py-0.5"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                      <span className="truncate flex-1 text-[#e2e8f0]">{task.name}</span>
                      <span className={cn('text-[10px]', cfg.color)}>
                        {task.progress}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 漏洞分布 */}
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-xs font-semibold text-[#e2e8f0]">已发现漏洞</span>
              <span className="ml-auto text-[10px] text-pink-400 tabular-nums">
                {severityStats.total}
              </span>
            </div>
            <div className="space-y-1.5">
              {topFindings.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-[11px]">
                  <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', SEVERITY_DOT[f.severity])} />
                  <span className="truncate flex-1 text-[#e2e8f0]">{f.title}</span>
                  <span className="text-[10px] text-[#64748b] flex-shrink-0">
                    {SEVERITY_LABEL[f.severity]}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/findings')}
              className="w-full mt-2 h-7 text-[10px] text-[#94a3b8] hover:text-cyber-cyan"
            >
              查看全部 →
            </Button>
          </div>

          {/* 系统信息 */}
          <div className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-3.5 w-3.5 text-[#94a3b8]" />
              <span className="text-xs font-semibold text-[#e2e8f0]">系统资源</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#64748b]">模型</span>
                <span className="text-white">{currentSession?.model || 'gpt-4o'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Token 消耗</span>
                <span className="text-white tabular-nums">
                  {messages.reduce((sum, m) => sum + (m.metadata?.tokens?.total_tokens || 0), 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">活跃任务</span>
                <span className="text-white tabular-nums">
                  {tasks.filter((t) => t.status === 'running').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
