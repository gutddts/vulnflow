import { useState, useEffect } from 'react'
import { Cpu, HardDrive, MemoryStick, Zap, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResourceData {
  cpu: number
  memory: number
  disk: number
  activeTasks: number
  uptime: string
}

const DEMO_RESOURCES: ResourceData = {
  cpu: 42,
  memory: 67,
  disk: 38,
  activeTasks: 3,
  uptime: '72h 15m',
}

function ResourceBar({ label, value, icon: Icon, color }: {
  label: string
  value: number
  icon: typeof Cpu
  color: string
}) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = (v: number) => {
    if (v >= 90) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
    if (v >= 70) return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]'
    return cn(color)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111827] border border-[#1e293b]">
            <Icon className="h-3.5 w-3.5 text-[#94a3b8]" />
          </div>
          <span className="text-sm text-[#e2e8f0]">{label}</span>
        </div>
        <span className={cn(
          'text-sm font-mono font-medium',
          value >= 90 ? 'text-red-400' : value >= 70 ? 'text-yellow-400' : 'text-[#94a3b8]',
        )}>
          {value}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#111827] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-out',
            getStatusColor(value),
          )}
          style={{ width: `${animated ? value : 0}%` }}
        />
      </div>
      {value >= 70 && (
        <p className={cn('text-[10px]', value >= 90 ? 'text-red-400' : 'text-yellow-400')}>
          {value >= 90 ? '⚠ 资源不足' : '⚡ 高负载'}
        </p>
      )}
    </div>
  )
}

export function ResourceMonitor({ className }: { className?: string }) {
  const [resources] = useState<ResourceData>(DEMO_RESOURCES)

  return (
    <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-white">系统资源</h3>
        <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
          <Activity className="h-3.5 w-3.5 text-green-400" />
          <span>运行 {resources.uptime}</span>
        </div>
      </div>

      <div className="space-y-5">
        <ResourceBar label="CPU" value={resources.cpu} icon={Cpu} color="bg-cyber-cyan" />
        <ResourceBar label="内存" value={resources.memory} icon={MemoryStick} color="bg-[#7c3aed]" />
        <ResourceBar label="磁盘" value={resources.disk} icon={HardDrive} color="bg-[#3b82f6]" />

        {/* Active tasks */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1e293b]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20">
              <Zap className="h-4 w-4 text-cyber-cyan" />
            </div>
            <div>
              <p className="text-sm text-[#e2e8f0]">活跃任务</p>
              <p className="text-[10px] text-[#64748b]">当前运行中</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: resources.activeTasks }).map((_, i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
            <span className="text-lg font-bold text-white ml-1">{resources.activeTasks}</span>
          </div>
        </div>

        {/* Health check */}
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
            <span className="text-xs text-green-400 font-medium">系统健康</span>
          </div>
          <p className="text-[10px] text-[#64748b] mt-1">所有服务运行正常，响应时间 &lt; 50ms</p>
        </div>
      </div>
    </div>
  )
}
