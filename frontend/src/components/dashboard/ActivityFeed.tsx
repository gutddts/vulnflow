import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Puzzle,
  LogIn,
  Wifi,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ActivityItem {
  id: string
  type: 'task_completed' | 'vulnerability_found' | 'scan_started' | 'report_generated' | 'skill_executed' | 'user_login'
  title: string
  description: string
  timestamp: string
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical'
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  className?: string
}

const ACTIVITY_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  task_completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  vulnerability_found: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  scan_started: { icon: Play, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  report_generated: { icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  skill_executed: { icon: Puzzle, color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', border: 'border-cyber-cyan/20' },
  user_login: { icon: LogIn, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  const [visibleItems, setVisibleItems] = useState<number[]>([])

  useEffect(() => {
    const timers = activities.map((_, i) =>
      setTimeout(() => {
        setVisibleItems((prev) => [...prev, i])
      }, i * 80),
    )
    return () => timers.forEach(clearTimeout)
  }, [activities])

  if (activities.length === 0) {
    return (
      <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">最近活动</h3>
          <div className="flex items-center gap-1 text-xs text-[#64748b]">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span>实时</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
          <Activity className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">暂无活动记录</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">最近活动</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-[#64748b]">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
            <span>实时</span>
          </div>
          <span className="text-xs text-[#64748b]">{activities.length} 条</span>
        </div>
      </div>

      <div className="relative space-y-0">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-[1px] bg-[#1e293b]" />

        <div className="space-y-0">
          {activities.slice(0, 10).map((activity, index) => {
            const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.user_login
            const Icon = config.icon

            return (
              <div
                key={activity.id || index}
                className={cn(
                  'relative flex items-start gap-3 py-2.5 transition-all duration-500',
                  visibleItems.includes(index) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4',
                )}
              >
                {/* Timeline dot */}
                <div className={cn(
                  'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-all duration-300 hover:scale-110',
                  config.bg,
                  config.border,
                )}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-[#e2e8f0] truncate">{activity.title}</p>
                    <span className="text-xs text-[#64748b] flex-shrink-0 mt-0.5">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  {activity.description && (
                    <p className="text-xs text-[#64748b] mt-0.5 line-clamp-1">{activity.description}</p>
                  )}
                  {activity.severity && (
                    <span className={cn(
                      'inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full',
                      activity.severity === 'critical' && 'bg-red-500/10 text-red-400',
                      activity.severity === 'high' && 'bg-orange-500/10 text-orange-400',
                      activity.severity === 'medium' && 'bg-yellow-500/10 text-yellow-400',
                      activity.severity === 'low' && 'bg-blue-500/10 text-blue-400',
                      activity.severity === 'info' && 'bg-gray-500/10 text-gray-400',
                    )}>
                      {activity.severity === 'critical' ? '严重' :
                       activity.severity === 'high' ? '高危' :
                       activity.severity === 'medium' ? '中危' :
                       activity.severity === 'low' ? '低危' : '信息'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Re-export Activity icon for component use
import { Activity as ActivityIcon } from 'lucide-react'
const Activity = ActivityIcon
