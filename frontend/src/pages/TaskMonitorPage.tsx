import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ListTodo,
  Search,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Clock,
  AlertCircle,
  Pause,
  RotateCw,
  Filter,
  Target,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common/EmptyState'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TASK_STATUS_MAP, TASK_PRIORITY_MAP } from '@/lib/constants'
import { formatRelativeTime, formatDuration, cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import { addNotification } from '@/lib/notifications'

const MOCK_TASKS: Task[] = []  // 实际数据从 store 拿

export function TaskMonitorPage() {
  const navigate = useNavigate()
  const tasks = useTaskStore((s) => s.tasks)
  const removeTask = useTaskStore((s) => s.removeTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')

  const stats = useMemo(() => {
    const total = tasks.length
    const running = tasks.filter((t) => t.status === 'running').length
    const completed = tasks.filter((t) => t.status === 'completed').length
    const failed = tasks.filter((t) => t.status === 'failed').length
    return { total, running, completed, failed }
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.name.toLowerCase().includes(search.toLowerCase()) ||
        task.target.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [tasks, search, statusFilter])

  const STATUS_FILTERS: { value: TaskStatus | 'all'; label: string; count: number; color: string }[] = [
    { value: 'all', label: '全部', count: stats.total, color: 'text-[#94a3b8]' },
    { value: 'running', label: '运行中', count: stats.running, color: 'text-yellow-400' },
    { value: 'completed', label: '已完成', count: stats.completed, color: 'text-green-400' },
    { value: 'failed', label: '失败', count: stats.failed, color: 'text-red-400' },
    { value: 'pending', label: '等待中', count: tasks.filter((t) => t.status === 'pending').length, color: 'text-gray-400' },
    { value: 'queued', label: '已排队', count: tasks.filter((t) => t.status === 'queued').length, color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">任务监控</h1>
          <p className="text-sm text-[#94a3b8] mt-1">实时监控渗透测试任务执行状态</p>
        </div>
        <Button className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.2)] rounded-xl">
          <Play className="h-4 w-4 mr-1.5" />
          新建任务
        </Button>
      </div>

      {/* Stats mini cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#1e293b] bg-[#1a1f2e] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94a3b8]">总任务</span>
            <ListTodo className="h-4 w-4 text-[#94a3b8]" />
          </div>
          <p className="text-xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-yellow-400">运行中</span>
            <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
          </div>
          <p className="text-xl font-bold text-yellow-400 mt-1">{stats.running}</p>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-400">已完成</span>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </div>
          <p className="text-xl font-bold text-green-400 mt-1">{stats.completed}</p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-400">失败</span>
            <XCircle className="h-4 w-4 text-red-400" />
          </div>
          <p className="text-xl font-bold text-red-400 mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务名称或目标..."
            className="pl-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'rounded-lg text-xs transition-all',
                statusFilter === filter.value
                  ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#111827] border border-transparent',
              )}
            >
              {filter.label}
              <span className="ml-1.5 text-[#64748b]">({filter.count})</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="暂无任务"
          description="当前筛选条件下没有找到匹配的任务"
        />
      ) : (
        <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#1e293b] text-xs font-medium text-[#94a3b8] bg-[#0d1321]">
            <div className="col-span-4">任务名称</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2">优先级</div>
            <div className="col-span-2">进度</div>
            <div className="col-span-2">时间</div>
          </div>

          {/* Table body */}
          {filteredTasks.map((task) => {
            const statusConfig = TASK_STATUS_MAP[task.status]
            const priorityConfig = TASK_PRIORITY_MAP[task.priority]

            return (
              <div
                key={task.id}
                className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-[#1e293b] last:border-0 hover:bg-[#111827]/60 transition-all cursor-pointer group"
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                {/* Name */}
                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {task.status === 'running' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                      )}
                      {task.status === 'completed' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                      )}
                      {task.status === 'failed' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                      )}
                      {task.status === 'pending' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                      )}
                      {task.status === 'queued' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-[#e2e8f0] font-medium group-hover:text-cyber-cyan transition-colors truncate">
                        {task.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#64748b] font-mono">{task.target}</span>
                        {task.error_message && (
                          <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                            <AlertCircle className="h-3 w-3" />
                            错误
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] border px-1.5 py-0.5',
                      task.status === 'running' && 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
                      task.status === 'completed' && 'border-green-500/30 text-green-400 bg-green-500/10',
                      task.status === 'failed' && 'border-red-500/30 text-red-400 bg-red-500/10',
                      task.status === 'pending' && 'border-gray-500/30 text-gray-400 bg-gray-500/10',
                      task.status === 'queued' && 'border-blue-500/30 text-blue-400 bg-blue-500/10',
                    )}
                  >
                    {statusConfig.label}
                  </Badge>
                </div>

                {/* Priority */}
                <div className="col-span-2 flex items-center">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    task.priority === 'critical' && 'bg-red-500/10 text-red-400',
                    task.priority === 'high' && 'bg-orange-500/10 text-orange-400',
                    task.priority === 'medium' && 'bg-yellow-500/10 text-yellow-400',
                    task.priority === 'low' && 'bg-blue-500/10 text-blue-400',
                  )}>
                    {priorityConfig.label}
                  </span>
                </div>

                {/* Progress */}
                <div className="col-span-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        task.status === 'completed'
                          ? 'bg-green-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                          : task.status === 'failed'
                            ? 'bg-red-500'
                            : task.status === 'running'
                              ? 'bg-gradient-to-r from-cyber-cyan to-[#7c3aed]'
                              : 'bg-gray-500',
                      )}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className={cn(
                    'text-xs font-mono w-8 text-right',
                    task.status === 'completed' ? 'text-green-400' : 'text-[#94a3b8]',
                  )}>
                    {task.progress}%
                  </span>
                </div>

                {/* Time */}
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-xs text-[#64748b]">
                    {task.status === 'running'
                      ? `运行中 ${task.started_at ? formatRelativeTime(task.started_at) : ''}`
                      : formatRelativeTime(task.created_at)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#64748b] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1a1f2e] border-[#1e293b] min-w-[140px]">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          updateTask(task.id, { status: 'running' })
                        }}
                        className="text-[#e2e8f0] hover:bg-[#111827] cursor-pointer text-xs"
                      >
                        <RotateCw className="h-3.5 w-3.5 mr-2" />
                        重新运行
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          updateTask(task.id, { status: 'cancelled' })
                        }}
                        className="text-[#e2e8f0] hover:bg-[#111827] cursor-pointer text-xs"
                      >
                        <Square className="h-3.5 w-3.5 mr-2" />
                        停止任务
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`确定删除任务「${task.name}」吗？`)) {
                            removeTask(task.id)
                            addNotification({
                              type: 'success',
                              title: '任务已删除',
                              message: `「${task.name}」已成功删除`,
                              target: task.name,
                              task_id: task.id,
                            })
                          }
                        }}
                        className="text-red-400 hover:bg-[#111827] cursor-pointer text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        删除任务
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
