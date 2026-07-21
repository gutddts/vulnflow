import { Puzzle, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillExecutionInfo } from '@/types/chat'

interface SkillExecutionCardProps {
  execution: SkillExecutionInfo
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-gray-400', label: '等待执行' },
  running: { icon: Loader2, color: 'text-[#00d4aa]', label: '执行中' },
  completed: { icon: CheckCircle2, color: 'text-green-400', label: '已完成' },
  failed: { icon: XCircle, color: 'text-red-400', label: '执行失败' },
}

export function SkillExecutionCard({ execution }: SkillExecutionCardProps) {
  const status = STATUS_CONFIG[execution.status]
  const StatusIcon = status.icon
  const progress = execution.progress || 0

  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0d1321] overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e293b]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00d4aa]/10">
            <Puzzle className="h-4 w-4 text-[#00d4aa]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#e2e8f0]">{execution.skill_name}</p>
            <p className="text-xs text-[#64748b]">发现 {execution.findings} 个问题</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn('h-3.5 w-3.5', status.color, execution.status === 'running' && 'animate-spin')} />
          <span className={cn('text-xs', status.color)}>{status.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      {execution.status === 'running' && (
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#94a3b8]">进度</span>
            <span className="text-xs text-[#00d4aa] font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#1e293b] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00d4aa] to-[#7c3aed] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
