import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useTaskStore,
  ATTACK_CHAIN_STAGES,
  type AttackChainStageType,
} from '@/stores/taskStore'
import type { Task, TaskStatus } from '@/types/task'

// 阶段状态：与任务状态同语义，但增加 'empty'（没有任何任务）
type StageStatus = 'success' | 'failed' | 'running' | 'pending' | 'empty'

const STATUS_COLORS: Record<StageStatus, { fill: string; stroke: string; text: string }> = {
  success: { fill: '#10b981', stroke: '#34d399', text: 'text-green-400' },
  failed:  { fill: '#ef4444', stroke: '#f87171', text: 'text-red-400' },
  running: { fill: '#3b82f6', stroke: '#60a5fa', text: 'text-blue-400' },
  pending: { fill: '#4b5563', stroke: '#6b7280', text: 'text-gray-400' },
  empty:   { fill: '#374151', stroke: '#4b5563', text: 'text-gray-500' },
}

// 从一组任务中派生阶段状态（最差状态优先）
function deriveStageStatus(tasks: Task[]): { status: StageStatus; running: number; total: number; avgProgress: number } {
  if (tasks.length === 0) return { status: 'empty', running: 0, total: 0, avgProgress: 0 }
  const running = tasks.filter((t) => t.status === 'running').length
  const failed = tasks.filter((t) => t.status === 'failed').length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const avgProgress = Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)

  let status: StageStatus
  if (running > 0) status = 'running'
  else if (failed > 0) status = 'failed'
  else if (completed === tasks.length) status = 'success'
  else status = 'pending'

  return { status, running, total: tasks.length, avgProgress }
}

interface StageDisplay {
  type: AttackChainStageType
  label: string
  icon: string
  desc: string
  status: StageStatus
  running: number
  total: number
  avgProgress: number
  tasks: Task[]
}

export function AttackChainGraph({ className }: { className?: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const tickProgress = useTaskStore((s) => s.tickProgress)
  const navigate = useNavigate()
  const [animated, setAnimated] = useState(false)

  // 5 个阶段显示数据（严格对应 taskStore 里 type 字段相同的任务）
  const stages: StageDisplay[] = useMemo(
    () =>
      ATTACK_CHAIN_STAGES.map((s) => {
        const matched = tasks.filter((t) => t.type === s.type)
        const { status, running, total, avgProgress } = deriveStageStatus(matched)
        return {
          type: s.type,
          label: s.label,
          icon: s.icon,
          desc: s.desc,
          status,
          running,
          total,
          avgProgress,
          tasks: matched,
        }
      }),
    [tasks],
  )

  // 计算"当前活跃阶段"：第一个 status=running 的阶段，否则第一个非 success/empty 的
  const activeStageIndex = useMemo(() => {
    const runningIdx = stages.findIndex((s) => s.status === 'running')
    if (runningIdx >= 0) return runningIdx
    const pendingIdx = stages.findIndex((s) => s.status === 'pending' || s.status === 'failed')
    if (pendingIdx >= 0) return pendingIdx
    return stages.length - 1
  }, [stages])

  // 启动入场动画
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200)
    return () => clearTimeout(t)
  }, [])

  // 启动进度推进（保险起见这里再调一次，taskStore 已经在模块加载时启动了全局 interval）
  useEffect(() => {
    const id = setInterval(tickProgress, 1500)
    return () => clearInterval(id)
  }, [tickProgress])

  // 几何参数
  const nodeRadius = 26
  const paddingX = 40
  const stageWidth = 130
  const totalWidth = stages.length * stageWidth + paddingX * 2
  const height = 200
  const centerY = height / 2
  const nodeY = centerY - 16
  const lineY = nodeY + nodeRadius
  const lineStartX = paddingX + nodeRadius
  const lineEndX = totalWidth - paddingX - nodeRadius
  const progressFraction = activeStageIndex / (stages.length - 1)

  // 阶段状态描述
  function statusDescription(stage: StageDisplay): string {
    if (stage.status === 'empty') return '尚无任务'
    if (stage.status === 'running') return `执行中 ${stage.avgProgress}%`
    if (stage.status === 'success') return `${stage.total} 个已完成`
    if (stage.status === 'failed') return `${stage.total} 个有失败`
    return `${stage.total} 个待执行`
  }

  return (
    <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">攻击链</h3>
          <p className="text-[11px] text-[#64748b] mt-0.5">
            5 阶段 × 实时任务同步 · 当前活跃：{stages[activeStageIndex]?.label || '-'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#64748b]">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
            <span>成功</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.6)] animate-pulse" />
            <span>运行中</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-400" />
            <span>失败</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-gray-500" />
            <span>等待</span>
          </div>
        </div>
      </div>

      {/* SVG 节点 + 连线 */}
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${totalWidth} ${height}`} className="w-full" style={{ minWidth: '560px' }}>
          {/* 背景线 */}
          <line
            x1={lineStartX} y1={lineY} x2={lineEndX} y2={lineY}
            stroke="#1e293b" strokeWidth="3" strokeLinecap="round"
          />
          {/* 进度线 */}
          <line
            x1={lineStartX} y1={lineY}
            x2={lineStartX + (lineEndX - lineStartX) * progressFraction}
            y2={lineY}
            stroke="#00d4aa" strokeWidth="3" strokeLinecap="round"
            className="transition-all duration-700" opacity={0.7}
          />
          {/* 进度光晕 */}
          <line
            x1={lineStartX} y1={lineY}
            x2={lineStartX + (lineEndX - lineStartX) * progressFraction}
            y2={lineY}
            stroke="#00d4aa" strokeWidth="10" strokeLinecap="round"
            className="transition-all duration-700" opacity={0.15}
          />

          {/* 节点 */}
          {stages.map((stage, i) => {
            const x = paddingX + i * stageWidth + stageWidth / 2
            const colors = STATUS_COLORS[stage.status]
            return (
              <g key={stage.type}>
                {/* running 内嵌辉光 */}
                {stage.status === 'running' && (
                  <circle cx={x} cy={nodeY} r={nodeRadius - 6}
                    fill={colors.fill} opacity={0.22} />
                )}

                {/* 节点外环 */}
                <circle cx={x} cy={nodeY} r={nodeRadius}
                  fill="#111827" stroke={colors.stroke} strokeWidth="2.5" />

                {/* running 内部脉冲环 */}
                {stage.status === 'running' && (
                  <circle cx={x} cy={nodeY} r={nodeRadius - 4}
                    fill="none" stroke={colors.stroke} strokeWidth="1.5"
                    className="animate-pulse" opacity={0.7} />
                )}

                {/* 图标 */}
                <text x={x} y={nodeY + 6} textAnchor="middle" fontSize="18" className="pointer-events-none">
                  {stage.icon}
                </text>

                {/* 阶段名 */}
                <text x={x} y={nodeY + nodeRadius + 20} textAnchor="middle"
                  fill="#e2e8f0" fontSize="12" fontWeight="600" className="pointer-events-none">
                  {stage.label}
                </text>

                {/* 状态点 */}
                <circle cx={x} cy={nodeY + nodeRadius + 34} r={3} fill={colors.fill} />

                {/* 描述 */}
                <text x={x} y={nodeY + nodeRadius + 50} textAnchor="middle"
                  fill="#64748b" fontSize="10" className="pointer-events-none">
                  {statusDescription(stage)}
                </text>
              </g>
            )
          })}

          {/* 流动粒子 */}
          {animated && stages[activeStageIndex]?.status === 'running' && (
            <circle r="3.5" fill="#00d4aa" opacity="0.9">
              <animateMotion dur="2.5s" repeatCount="indefinite"
                path={`M${lineStartX + (lineEndX - lineStartX) * progressFraction},${lineY} L${lineStartX + (lineEndX - lineStartX) * Math.min(1, progressFraction + 0.15)},${lineY}`} />
            </circle>
          )}
        </svg>
      </div>

      {/* 5 个阶段卡片 - 1:1 对应上方节点 */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {stages.map((stage, i) => {
          const colors = STATUS_COLORS[stage.status]
          return (
            <button
              key={stage.type}
              onClick={() => navigate(`/tasks?type=${stage.type}`)}
              className={cn(
                'group relative rounded-lg border p-2.5 text-left transition-all duration-300',
                'border-[#1e293b] bg-[#111827]',
                'hover:border-cyber-cyan/30 hover:bg-[#0d1321]',
                stage.status === 'running' && 'border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
                stage.status === 'success' && 'border-green-500/30',
                stage.status === 'failed'  && 'border-red-500/30',
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn('text-xs font-semibold', colors.text)}>
                  {i + 1}. {stage.label}
                </div>
                <div className="text-[10px] text-[#64748b] tabular-nums">
                  {stage.total > 0 ? `${stage.total} 个` : '空'}
                </div>
              </div>
              <div className="text-[10px] text-[#94a3b8] mt-1 truncate">
                {statusDescription(stage)}
              </div>
              {/* 阶段进度条 */}
              {stage.total > 0 && (
                <div className="mt-1.5 h-0.5 w-full rounded-full bg-[#1e293b] overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${stage.avgProgress}%`,
                      backgroundColor: colors.fill,
                    }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
