import { Terminal, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolCall } from '@/types/chat'

interface ToolCallCardProps {
  toolCall: ToolCall
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/10', label: '等待中' },
  running: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: '执行中' },
  completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: '已完成' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: '失败' },
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const status = STATUS_CONFIG[toolCall.status]
  const StatusIcon = status.icon

  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0d1321] overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b]">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-6 w-6 items-center justify-center rounded', status.bg)}>
            <Terminal className={cn('h-3.5 w-3.5', status.color)} />
          </div>
          <span className="text-sm font-medium text-[#e2e8f0]">{toolCall.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn('h-3.5 w-3.5', status.color, toolCall.status === 'running' && 'animate-spin')} />
          <span className={cn('text-xs', status.color)}>{status.label}</span>
        </div>
      </div>

      {/* Arguments */}
      <div className="px-3 py-2">
        <pre className="text-xs text-[#94a3b8] font-mono overflow-x-auto">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </div>

      {/* Result or error */}
      {toolCall.result && (
        <div className="border-t border-[#1e293b] px-3 py-2 bg-[#0a0f18]">
          <pre className="text-xs text-[#00d4aa] font-mono overflow-x-auto whitespace-pre-wrap">
            {toolCall.result}
          </pre>
        </div>
      )}

      {toolCall.error && (
        <div className="border-t border-[#1e293b] px-3 py-2 bg-[#0a0f18]">
          <pre className="text-xs text-red-400 font-mono overflow-x-auto whitespace-pre-wrap">
            {toolCall.error}
          </pre>
        </div>
      )}
    </div>
  )
}
