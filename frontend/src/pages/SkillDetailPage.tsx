import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Play,
  Clock,
  AlertTriangle,
  BarChart3,
  Tag,
  User,
  Calendar,
  Terminal,
  CheckCircle2,
  Loader2,
  FileText,
  Server,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SEVERITY_MAP, CATEGORY_MAP } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import type { Skill, SkillCategory } from '@/types/skill'
import api from '@/lib/api'

// Fallback mock（API 不可用时）
const MOCK_FALLBACK: Record<string, Skill> = {
  '1': {
    id: '1', name: 'nmap_scan', display_name: 'Nmap 端口扫描',
    description: '使用 Nmap 进行全面的端口扫描和服务识别', long_description: '该技能利用 Nmap 工具对目标主机进行全面扫描，包括端口发现、服务版本检测、操作系统识别等功能。',
    category: 'reconnaissance', severity: 'low', status: 'active', icon: 'Search',
    author: 'VulnFlow Team', version: '1.0.0', parameters: [], dependencies: [],
    estimated_time: 120, risk_level: 'low', tags: ['nmap', 'scan'],
    usage_count: 1534, success_rate: 98.5,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z',
  },
}

export function SkillDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)
  const [rawContent, setRawContent] = useState<string>('')

  useEffect(() => {
    if (!id) return
    setLoading(true)

    // 优先用 API 获取技能
    api.get(`/skills/${id}`)
      .then((res) => {
        const data = res.data
        const s = data?.id ? data : data?.items?.[0]
        if (s) {
          // 从 parameters.raw_content 提取原始 .md
          if (s.parameters && typeof s.parameters === 'object' && s.parameters.raw_content) {
            setRawContent(s.parameters.raw_content)
          }
          setSkill(apiToSkill(s))
        } else {
          // fallback to mock
          setSkill(MOCK_FALLBACK[id] ?? null)
        }
      })
      .catch(() => {
        // fallback
        setSkill(MOCK_FALLBACK[id] ?? null)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#94a3b8]">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> 加载中...
      </div>
    )
  }

  if (!skill) {
    return (
      <div className="flex items-center justify-center h-64 text-[#94a3b8]">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">未找到该技能</p>
          <Button
            variant="outline"
            className="mt-4 border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
            onClick={() => navigate('/skills')}
          >
            返回技能列表
          </Button>
        </div>
      </div>
    )
  }

  const category = CATEGORY_MAP[skill.category as SkillCategory] || { label: skill.category, color: 'text-gray-400', icon: null }
  const severity = SEVERITY_MAP[skill.severity] || { label: skill.severity, color: 'text-gray-400' }
  const CategoryIcon = category.icon ?? FileText

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        className="text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e] -ml-3"
        onClick={() => navigate('/skills')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回技能列表
      </Button>

      {/* Hero */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl border',
            category.bg || 'bg-[#111827]',
            category.borderColor || 'border-[#1e293b]',
          )}>
            <CategoryIcon className={cn('h-7 w-7', category.color || 'text-[#00d4aa]')} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{skill.display_name}</h1>
              <Badge variant="outline" className="border-[#1e293b] text-[#94a3b8]">
                v{skill.version}
              </Badge>
              <Badge variant="outline" className={cn('border-[#1e293b]', severity.color)}>
                {severity.label}
              </Badge>
            </div>
            <p className="text-sm text-[#94a3b8] mb-4">{skill.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#94a3b8]">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {skill.author}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {skill.estimated_time}s
              </div>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                成功率 {skill.success_rate}%
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                更新于 {formatDate(skill.updated_at)}
              </div>
            </div>
          </div>

          <Button
            className="bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.3)]"
            onClick={() => toast.info('技能执行功能待开发')}
          >
            <Play className="h-4 w-4 mr-1.5" />
            执行技能
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">技能详情</h2>
            <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">
              {skill.long_description || skill.description}
            </p>
          </div>

          {/* 原始 .md 内容 */}
          {rawContent && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                原始文档
              </h2>
              <pre className="text-xs text-[#94a3b8] font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto bg-[#0a0e1a] p-3 rounded">
                {rawContent}
              </pre>
            </div>
          )}

          {/* Parameters */}
          {skill.parameters && Array.isArray(skill.parameters) && skill.parameters.length > 0 && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">参数配置</h2>
              <div className="space-y-4">
                {skill.parameters.map((param: any, i: number) => (
                  <div key={i} className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{param.label || param.name}</span>
                      {param.required && (
                        <Badge variant="outline" className="border-red-500/30 text-red-400 text-[10px]">必填</Badge>
                      )}
                      <span className="text-[10px] text-[#64748b]">类型: {param.type}</span>
                    </div>
                    {param.description && (
                      <p className="text-xs text-[#94a3b8] mb-2">{param.description}</p>
                    )}
                    {param.placeholder && (
                      <p className="text-[10px] text-[#64748b] font-mono">占位: {param.placeholder}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* 统计信息 */}
          <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6 space-y-3">
            <h2 className="text-sm font-semibold text-white">统计信息</h2>
            <Separator className="bg-[#1e293b]" />
            <div className="space-y-2 text-xs">
              <InfoRow label="使用次数" value={skill.usage_count} />
              <InfoRow label="成功率" value={`${skill.success_rate}%`} />
              <InfoRow label="风险等级" value={skill.risk_level} />
              <InfoRow label="预计耗时" value={`${skill.estimated_time}s`} />
              <InfoRow label="创建时间" value={formatDate(skill.created_at)} />
            </div>
          </div>

          {/* 标签 */}
          {skill.tags && skill.tags.length > 0 && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6 space-y-3">
              <h2 className="text-sm font-semibold text-white">标签</h2>
              <Separator className="bg-[#1e293b]" />
              <div className="flex flex-wrap gap-2">
                {skill.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="border-[#1e293b] text-[#94a3b8] text-[10px]">
                    <Tag className="h-3 w-3 mr-1" /> {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Docker 信息（如果有） */}
          {(skill as any).image && (skill as any).image !== 'local' && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6 space-y-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Server className="h-4 w-4" /> Docker 配置
              </h2>
              <Separator className="bg-[#1e293b]" />
              <div className="space-y-2 text-xs">
                <InfoRow label="镜像" value={(skill as any).image} />
                <InfoRow label="入口" value={(skill as any).entrypoint} />
              </div>
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
      <span className="text-[#e2e8f0] font-mono">{value}</span>
    </div>
  )
}

// API 返回映射
function apiToSkill(s: any): Skill {
  return {
    id: s.id,
    name: s.name,
    display_name: s.display_name,
    description: s.description || '',
    long_description: '',
    category: s.category || 'custom',
    severity: s.severity || 'medium',
    status: s.is_enabled !== false ? 'active' : 'deprecated',
    icon: 'Code',
    author: s.author || 'unknown',
    version: s.version || '1.0.0',
    parameters: Array.isArray(s.parameters) ? s.parameters : [],
    dependencies: [],
    estimated_time: s.timeout || 60,
    risk_level: s.risk_level || s.severity || 'medium',
    tags: s.tags || [],
    usage_count: 0,
    success_rate: 0,
    created_at: s.created_at || new Date().toISOString(),
    updated_at: s.updated_at || new Date().toISOString(),
  }
}
