import { type LucideIcon, ArrowRight, Clock, BarChart3, CheckCircle2, Package, Code, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Skill, SkillCategory } from '@/types/skill'
import { CATEGORY_MAP, SEVERITY_MAP } from '@/lib/constants'

interface SkillCardProps {
  skill: Skill
  onDelete?: (id: string) => void
}

const CATEGORY_BG_COLORS: Record<string, string> = {
  reconnaissance: 'bg-blue-500/10 border-blue-500/20',
  scanning: 'bg-cyan-500/10 border-cyan-500/20',
  exploitation: 'bg-red-500/10 border-red-500/20',
  post_exploitation: 'bg-purple-500/10 border-purple-500/20',
  social_engineering: 'bg-orange-500/10 border-orange-500/20',
  web_application: 'bg-green-500/10 border-green-500/20',
  network: 'bg-yellow-500/10 border-yellow-500/20',
  wireless: 'bg-pink-500/10 border-pink-500/20',
  cloud: 'bg-indigo-500/10 border-indigo-500/20',
  cryptography: 'bg-teal-500/10 border-teal-500/20',
  forensics: 'bg-amber-500/10 border-amber-500/20',
  reporting: 'bg-gray-500/10 border-gray-500/20',
}

const SEVERITY_BORDER_COLORS: Record<string, string> = {
  critical: 'border-[#ff3385]/50 text-[#ff3385]',
  high: 'border-red-500/50 text-red-400',
  medium: 'border-amber-500/50 text-amber-400',
  low: 'border-blue-500/50 text-blue-400',
  info: 'border-gray-500/50 text-gray-400',
}

export function SkillCard({ skill, onDelete }: SkillCardProps) {
  const category = CATEGORY_MAP[skill.category as SkillCategory] || {
    icon: Package as LucideIcon,
    color: 'text-gray-400',
    label: skill.category,
  }
  const CategoryIcon = category.icon ?? Code
  const severity = SEVERITY_MAP[skill.severity] || { label: skill.severity, color: 'text-gray-400' }
  const categoryBg = CATEGORY_BG_COLORS[skill.category] || 'bg-gray-500/10 border-gray-500/20'
  const severityBorder = SEVERITY_BORDER_COLORS[skill.severity] || 'border-gray-500/50 text-gray-400'

  return (
    <div className="relative group">
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (window.confirm(`确定删除自上传的技能"${skill.display_name}"吗？`)) {
              onDelete(skill.id)
            }
          }}
          className="absolute top-2 right-2 z-20 h-6 w-6 flex items-center justify-center rounded bg-red-500/10 border border-red-500/30 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/30 transition-all"
          title="删除自上传技能"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <Link
        to={`/skills/${skill.id}`}
        className="group relative block rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-5 transition-all duration-300 hover:border-cyber-cyan/30 hover:shadow-[0_0_20px_rgba(0,212,170,0.1)] hover:-translate-y-1"
      >
      {/* 自上传徽章 */}
      {skill.id.startsWith('uploaded-') && (
        <div className="absolute -top-2 -right-2 rounded-full bg-[#00d4aa] text-black text-[9px] font-bold px-2 py-0.5 shadow-[0_0_10px_rgba(0,212,170,0.5)] z-10">
          自上传
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
          categoryBg,
        )}>
          <CategoryIcon className={cn('h-5 w-5', category.color)} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={cn('text-[10px] border px-1.5 py-0', severityBorder)}
          >
            {severity.label}
          </Badge>
          <span className="text-[10px] text-[#475569]">v{skill.version}</span>
        </div>
      </div>

      {/* Content */}
      <h3 className="text-sm font-semibold text-white group-hover:text-cyber-cyan transition-colors mb-1">
        {skill.display_name}
      </h3>
      <p className="text-xs text-[#94a3b8] line-clamp-2 mb-3 min-h-[2.5em]">
        {skill.description}
      </p>

      {/* Category badge */}
      <div className="flex items-center gap-2 mb-3">
        <Badge
          variant="outline"
          className="text-[10px] border-[#1e293b] text-[#64748b] px-1.5 py-0"
        >
          {category.label}
        </Badge>
        <div className="flex items-center gap-1 text-[10px] text-[#64748b]">
          <Clock className="h-3 w-3" />
          {skill.estimated_time >= 60
            ? `${Math.floor(skill.estimated_time / 60)}m ${skill.estimated_time % 60}s`
            : `${skill.estimated_time}s`}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between pt-3 border-t border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-[#64748b]">
            <BarChart3 className="h-3 w-3 text-green-400" />
            <span className="text-green-400 font-medium">{skill.success_rate}%</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#64748b]">
            <CheckCircle2 className="h-3 w-3" />
            <span>{skill.usage_count}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-cyber-cyan opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          详情 <ArrowRight className="h-3 w-3" />
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-t from-cyber-cyan/5 to-transparent" />
      </Link>
    </div>
  )
}
