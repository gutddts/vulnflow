import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SeverityItem {
  label: string
  value: number
  color: string
}

interface SeverityChartProps {
  data: { critical: number; high: number; medium: number; low: number; info: number }
  className?: string
}

const CHART_CONFIG = {
  critical: { label: '严重', color: '#ff3385', cssColor: 'text-[#ff3385]', bgColor: 'bg-[#ff3385]/10' },
  high: { label: '高危', color: '#ef4444', cssColor: 'text-red-400', bgColor: 'bg-red-500/10' },
  medium: { label: '中危', color: '#f59e0b', cssColor: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  low: { label: '低危', color: '#3b82f6', cssColor: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  info: { label: '信息', color: '#6b7280', cssColor: 'text-gray-400', bgColor: 'bg-gray-500/10' },
}

export function SeverityChart({ data, className }: SeverityChartProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const items: SeverityItem[] = [
    { label: '严重', value: data.critical, color: CHART_CONFIG.critical.color },
    { label: '高危', value: data.high, color: CHART_CONFIG.high.color },
    { label: '中危', value: data.medium, color: CHART_CONFIG.medium.color },
    { label: '低危', value: data.low, color: CHART_CONFIG.low.color },
    { label: '信息', value: data.info, color: CHART_CONFIG.info.color },
  ]

  const total = items.reduce((sum, item) => sum + item.value, 0)

  const radius = 55
  const strokeWidth = 16
  const circumference = 2 * Math.PI * radius
  const size = 180
  const center = size / 2

  let cumulativeOffset = 0

  return (
    <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
      <h3 className="text-base font-semibold text-white mb-5">漏洞严重性分布</h3>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
          <div className="h-20 w-20 rounded-full border-2 border-dashed border-[#1e293b] flex items-center justify-center mb-3">
            <span className="text-2xl">0</span>
          </div>
          <p className="text-sm">暂无漏洞数据</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
              {/* Glow filter */}
              <defs>
                <filter id="chart-glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {items.map((item) => {
                const percentage = item.value / total
                const dashArray = circumference * percentage
                const dashOffset = cumulativeOffset
                cumulativeOffset += dashArray

                return (
                  <circle
                    key={item.label}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${animated ? dashArray : 0} ${circumference}`}
                    strokeDashoffset={animated ? -dashOffset : 0}
                    transform={`rotate(-90 ${center} ${center})`}
                    className="transition-all duration-1000 ease-out"
                    opacity={item.value > 0 ? 1 : 0.2}
                    filter={item.value > 0 ? 'url(#chart-glow)' : undefined}
                  />
                )
              })}

              {/* Center circle */}
              <circle cx={center} cy={center} r={radius - strokeWidth} fill="#1a1f2e" />

              {/* Center text */}
              <text
                x={center}
                y={center - 6}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="22"
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
              >
                {total}
              </text>
              <text
                x={center}
                y={center + 14}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
              >
                总计
              </text>
            </svg>

            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border border-cyber-cyan/10 animate-[spin_20s_linear_infinite] pointer-events-none" />
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2.5">
            {items.map((item) => {
              const config = Object.values(CHART_CONFIG).find((c) => c.label === item.label)
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'

              return (
                <div key={item.label} className="group flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10 transition-transform group-hover:scale-125"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-[#e2e8f0]">{config?.label || item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {/* Mini bar */}
                      <div className="h-1.5 w-12 rounded-full bg-[#1e293b] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${animated ? percentage : 0}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[#94a3b8] w-5 text-right">
                        {item.value}
                      </span>
                    </div>
                    <span className="text-xs text-[#64748b] w-10 text-right">{percentage}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
