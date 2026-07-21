import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  color?: 'cyan' | 'purple' | 'pink' | 'blue' | 'green' | 'orange'
  className?: string
  href?: string  // 点击卡片跳转的 URL（可选）
}

const COLOR_MAP = {
  cyan: {
    border: 'border-cyber-cyan/20',
    glow: 'hover:shadow-[0_0_20px_rgba(0,212,170,0.2),0_0_40px_rgba(0,212,170,0.05)]',
    icon: 'text-cyber-cyan',
    iconBg: 'bg-cyber-cyan/10',
    iconBorder: 'border-cyber-cyan/20',
    accent: 'bg-gradient-to-r from-cyber-cyan/10 to-transparent',
    ring: 'ring-cyber-cyan/20',
  },
  purple: {
    border: 'border-[#7c3aed]/20',
    glow: 'hover:shadow-[0_0_20px_rgba(124,58,237,0.2),0_0_40px_rgba(124,58,237,0.05)]',
    icon: 'text-[#7c3aed]',
    iconBg: 'bg-[#7c3aed]/10',
    iconBorder: 'border-[#7c3aed]/20',
    accent: 'bg-gradient-to-r from-[#7c3aed]/10 to-transparent',
    ring: 'ring-[#7c3aed]/20',
  },
  pink: {
    border: 'border-[#ff3385]/20',
    glow: 'hover:shadow-[0_0_20px_rgba(255,51,133,0.2),0_0_40px_rgba(255,51,133,0.05)]',
    icon: 'text-[#ff3385]',
    iconBg: 'bg-[#ff3385]/10',
    iconBorder: 'border-[#ff3385]/20',
    accent: 'bg-gradient-to-r from-[#ff3385]/10 to-transparent',
    ring: 'ring-[#ff3385]/20',
  },
  blue: {
    border: 'border-blue-500/20',
    glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.2),0_0_40px_rgba(59,130,246,0.05)]',
    icon: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    iconBorder: 'border-blue-500/20',
    accent: 'bg-gradient-to-r from-blue-500/10 to-transparent',
    ring: 'ring-blue-500/20',
  },
  green: {
    border: 'border-green-500/20',
    glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.2),0_0_40px_rgba(16,185,129,0.05)]',
    icon: 'text-green-400',
    iconBg: 'bg-green-500/10',
    iconBorder: 'border-green-500/20',
    accent: 'bg-gradient-to-r from-green-500/10 to-transparent',
    ring: 'ring-green-500/20',
  },
  orange: {
    border: 'border-orange-500/20',
    glow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.2),0_0_40px_rgba(249,115,22,0.05)]',
    icon: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    iconBorder: 'border-orange-500/20',
    accent: 'bg-gradient-to-r from-orange-500/10 to-transparent',
    ring: 'ring-orange-500/20',
  },
}

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const animationRef = useRef<number>()

  useEffect(() => {
    const duration = 1200
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      countRef.current = Math.round(target * eased)
      setCount(countRef.current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [target])

  return <>{count}</>
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel = '较昨日',
  color = 'cyan',
  className,
  href,
}: StatsCardProps) {
  const colors = COLOR_MAP[color]
  const isTrendUp = (trend ?? 0) >= 0
  const navigate = useNavigate()

  const handleClick = () => {
    if (href) navigate(href)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-[#1a1f2e] p-5 transition-all duration-500',
        colors.border,
        colors.glow,
        'hover:border-opacity-60 hover:scale-[1.02]',
        href && 'cursor-pointer',
        className,
      )}
    >
      {/* Animated gradient border on hover */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, transparent, var(--tw-gradient-from), transparent)',
        }}
      />

      {/* Background glow dot */}
      <div className={cn(
        'absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-3xl transition-all duration-500 group-hover:opacity-20 group-hover:scale-150',
        color === 'cyan' && 'bg-cyber-cyan',
        color === 'purple' && 'bg-[#7c3aed]',
        color === 'pink' && 'bg-[#ff3385]',
        color === 'blue' && 'bg-blue-500',
        color === 'green' && 'bg-green-500',
        color === 'orange' && 'bg-orange-500',
      )} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-[#94a3b8] font-medium">{title}</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            <AnimatedCounter target={value} />
          </p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                isTrendUp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
              )}>
                {isTrendUp ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(trend)}%</span>
              </div>
              <span className="text-xs text-[#64748b]">{trendLabel}</span>
            </div>
          )}
        </div>

        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
          colors.iconBg,
          colors.iconBorder,
        )}>
          <Icon className={cn('h-6 w-6 transition-transform duration-300 group-hover:rotate-12', colors.icon)} />
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className={cn(
        'absolute bottom-0 left-0 h-0.5 rounded-b-xl transition-all duration-500',
        colors.accent,
        'w-1/3 group-hover:w-full',
      )} />

      {/* Corner glow line */}
      <div className={cn(
        'absolute top-0 right-0 h-8 w-[1px] bg-gradient-to-b to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500',
        color === 'cyan' && 'from-cyber-cyan/30',
        color === 'purple' && 'from-[#7c3aed]/30',
        color === 'pink' && 'from-[#ff3385]/30',
        color === 'blue' && 'from-blue-400/30',
        color === 'green' && 'from-green-400/30',
        color === 'orange' && 'from-orange-400/30',
      )} />
    </div>
  )
}
