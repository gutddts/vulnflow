import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  Clock,
  Target,
  AlertCircle,
  Terminal,
  Download,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TASK_STATUS_MAP, TASK_PRIORITY_MAP } from '@/lib/constants'
import { formatDate, formatDuration, cn } from '@/lib/utils'
import type { Task, TaskLog } from '@/types/task'
import api from '@/lib/api'
import { useTaskStore } from '@/stores/taskStore'

const MOCK_LOGS: TaskLog[] = [
  {
    id: 'log-1',
    task_id: '1',
    level: 'info',
    message: '任务初始化完成，开始执行...',
    timestamp: '2024-07-19T10:00:00Z',
  },
  {
    id: 'log-2',
    task_id: '1',
    level: 'info',
    message: '正在解析目标范围: 192.168.1.0/24',
    timestamp: '2024-07-19T10:00:05Z',
  },
  {
    id: 'log-3',
    task_id: '1',
    level: 'info',
    message: '发现 254 个活跃主机',
    timestamp: '2024-07-19T10:00:30Z',
  },
  {
    id: 'log-4',
    task_id: '1',
    level: 'success',
    message: '端口扫描完成: 192.168.1.1 - 发现 12 个开放端口',
    timestamp: '2024-07-19T10:05:00Z',
  },
  {
    id: 'log-5',
    task_id: '1',
    level: 'warn',
    message: '主机 192.168.1.50 响应超时，将在稍后重试',
    timestamp: '2024-07-19T10:10:00Z',
  },
  {
    id: 'log-6',
    task_id: '1',
    level: 'info',
    message: '开始服务版本检测...',
    timestamp: '2024-07-19T10:15:00Z',
  },
  {
    id: 'log-7',
    task_id: '1',
    level: 'error',
    message: '无法连接到 192.168.1.200:443 - 连接被拒绝',
    timestamp: '2024-07-19T10:20:00Z',
  },
  {
    id: 'log-8',
    task_id: '1',
    level: 'success',
    message: '服务检测完成: 识别 47 个服务',
    timestamp: '2024-07-19T10:25:00Z',
  },
  {
    id: 'log-9',
    task_id: '1',
    level: 'info',
    message: '开始漏洞扫描阶段...',
    timestamp: '2024-07-19T10:30:00Z',
  },
]

const LOG_ICONS = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  debug: { icon: Terminal, color: 'text-gray-400', bg: 'bg-gray-500/10' },
  success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
}

export function TaskDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const taskFromStore = useTaskStore((s) => s.tasks.find((t) => t.id === id))
  const updateTask = useTaskStore((s) => s.updateTask)
  const [task, setTask] = useState<Task | null>(taskFromStore ?? null)
  const [logs] = useState<TaskLog[]>(MOCK_LOGS)
  const [acting, setActing] = useState(false)

  // 当 store 中 task 变化时同步
  useEffect(() => {
    if (taskFromStore) setTask(taskFromStore)
  }, [taskFromStore])

  const handleCancel = async () => {
    if (!id) return
    if (!window.confirm('确定要停止该任务吗？')) return
    setActing(true)
    try {
      await api.post(`/tasks/${id}/cancel`)
    } catch {
      /* 演示模式忽略 */
    } finally {
      updateTask(id, {
        status: 'cancelled' as Task['status'],
        completed_at: new Date().toISOString(),
      })
      toast.success('任务已停止')
      setActing(false)
    }
  }

  const handleRetry = async () => {
    if (!id) return
    setActing(true)
    try {
      await api.post(`/tasks/${id}/retry`)
    } catch {
      /* 演示模式忽略 */
    } finally {
      updateTask(id, {
        status: 'running' as Task['status'],
        progress: 0,
        started_at: new Date().toISOString(),
        completed_at: undefined,
      })
      toast.success('任务已重启')
      setActing(false)
    }
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64 text-[#94a3b8]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">任务不存在或已被删除</p>
          <Button
            variant="outline"
            className="mt-4 border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
            onClick={() => navigate('/tasks')}
          >
            返回任务列表
          </Button>
        </div>
      </div>
    )
  }

  const statusConfig = TASK_STATUS_MAP[task.status]
  const priorityConfig = TASK_PRIORITY_MAP[task.priority]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e]"
              onClick={() => navigate('/tasks')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-white">{task.name}</h1>
            <Badge variant="outline" className={`border-[#1e293b] ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className={`border-[#1e293b] ${priorityConfig.color}`}>
              {priorityConfig.label}优先级
            </Badge>
          </div>
          <p className="text-sm text-[#94a3b8] ml-11">{task.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {task.status === 'running' && (
            <Button
              variant="outline"
              className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              onClick={handleCancel}
              disabled={acting}
            >
              <Square className="h-4 w-4 mr-1.5" />
              停止
            </Button>
          )}
          {task.status === 'failed' && (
            <Button
              variant="outline"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
              onClick={handleRetry}
              disabled={acting}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              重试
            </Button>
          )}
          <Button
            className="bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-black"
            onClick={handleRetry}
            disabled={acting}
          >
            <Play className="h-4 w-4 mr-1.5" />
            执行
          </Button>
        </div>
      </div>

      {/* Progress */}
      {task.status === 'running' && (
        <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#94a3b8]">执行进度</span>
            <span className="text-sm font-mono text-[#00d4aa]">{task.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#111827] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00d4aa] to-[#00b894] rounded-full transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Execution log */}
        <div className="col-span-2 rounded-xl border border-[#1e293b] bg-[#1a1f2e]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b]">
            <h2 className="text-sm font-semibold text-white">执行日志</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#94a3b8] hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-5 space-y-2 max-h-[500px] overflow-y-auto">
            {logs.map((log) => {
              const logConfig = LOG_ICONS[log.level]
              const Icon = logConfig.icon
              return (
                <div key={log.id} className="flex items-start gap-2.5 text-xs">
                  <div className={cn('flex h-5 w-5 items-center justify-center rounded', logConfig.bg)}>
                    <Icon className={cn('h-3 w-3', logConfig.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#64748b] font-mono">{formatDate(log.timestamp, 'HH:mm:ss')}</span>
                    </div>
                    <p className="text-[#e2e8f0] mt-0.5">{log.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Task info & parameters */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">任务信息</h2>
            <Separator className="bg-[#1e293b]" />
            <div className="space-y-2 text-xs">
              <InfoRow label="任务 ID" value={task.id} />
              <InfoRow label="类型" value={task.type} />
              <InfoRow label="目标" value={task.target} />
              <InfoRow label="创建者" value={task.created_by} />
              <InfoRow label="创建时间" value={formatDate(task.created_at)} />
              <InfoRow label="开始时间" value={task.started_at ? formatDate(task.started_at) : '-'} />
              <InfoRow label="重试次数" value={`${task.retry_count} / ${task.max_retries}`} />
            </div>
          </div>

          {task.parameters && Object.keys(task.parameters).length > 0 && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">执行参数</h2>
              <Separator className="bg-[#1e293b]" />
              <pre className="text-[10px] text-[#94a3b8] font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(task.parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-[#e2e8f0] font-mono truncate max-w-[60%] text-right">{value}</span>
    </div>
  )
}
