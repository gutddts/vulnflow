import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  AlertTriangle,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  Trash2,
  Check,
  Square,
  Copy,
  ExternalLink,
  Sparkles,
  BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useFindingStore, useSeverityStats, type SeverityLevel, type Finding } from '@/stores/findingStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const SEVERITY_CONFIG: Record<SeverityLevel, { label: string; color: string; bg: string; border: string; text: string; bar: string }> = {
  critical: { label: '严重', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-300', bar: 'bg-pink-500' },
  high:     { label: '高危', color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30',   text: 'text-red-300',   bar: 'bg-red-500' },
  medium:   { label: '中危', color: 'text-orange-400',bg: 'bg-orange-500/10',border: 'border-orange-500/30',text: 'text-orange-300',bar: 'bg-orange-500' },
  low:      { label: '低危', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  text: 'text-blue-300',  bar: 'bg-blue-500' },
  info:     { label: '信息', color: 'text-gray-400',  bg: 'bg-gray-500/10',  border: 'border-gray-500/30',  text: 'text-gray-300',  bar: 'bg-gray-500' },
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  open:          { label: '待处理', icon: Clock,        color: 'text-yellow-400' },
  verified:      { label: '已验证', icon: BadgeCheck,   color: 'text-cyan-400' },
  confirmed:     { label: '已确认', icon: CheckCircle2, color: 'text-red-400' },
  mitigated:     { label: '已修复', icon: Shield,       color: 'text-green-400' },
  false_positive:{ label: '误报',   icon: XCircle,      color: 'text-gray-400' },
}
const DEFAULT_STATUS = { label: '未知', icon: Clock, color: 'text-gray-400' }

type FilterSeverity = SeverityLevel | 'all'
type FilterStatus = Finding['status'] | 'all'

export function FindingsPage() {
  const navigate = useNavigate()
  const findings = useFindingStore((s) => s.findings)
  const removeFinding = useFindingStore((s) => s.removeFinding)
  const stats = useSeverityStats()
  const [detailFinding, setDetailFinding] = useState<Finding | null>(null)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      const matchSearch = !search ||
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        f.target.toLowerCase().includes(search.toLowerCase()) ||
        f.cve_id?.toLowerCase().includes(search.toLowerCase()) ||
        f.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchSev = severityFilter === 'all' || f.severity === severityFilter
      const matchStatus = statusFilter === 'all' || f.status === statusFilter
      return matchSearch && matchSev && matchStatus
    })
  }, [findings, search, severityFilter, statusFilter])

  const severityCards: { value: SeverityLevel | 'all'; label: string; count: number; color: string }[] = [
    { value: 'all',      label: '全部', count: stats.total,    color: 'text-[#94a3b8]' },
    { value: 'critical', label: '严重', count: stats.critical, color: 'text-pink-400' },
    { value: 'high',     label: '高危', count: stats.high,     color: 'text-red-400' },
    { value: 'medium',   label: '中危', count: stats.medium,   color: 'text-orange-400' },
    { value: 'low',      label: '低危', count: stats.low,      color: 'text-blue-400' },
    { value: 'info',     label: '信息', count: stats.info,     color: 'text-gray-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-pink-400" />
            漏洞管理
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            共 <span className="text-pink-400 font-semibold">{stats.total}</span> 个漏洞 ·{' '}
            <span className="text-red-400">{stats.critical + stats.high}</span> 个高危及以上 ·{' '}
            <span className="text-orange-400">{stats.medium}</span> 个中危
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e]"
            onClick={() => navigate('/reports')}
          >
            <TrendingUp className="h-4 w-4 mr-1.5" />
            生成报告
          </Button>
        </div>
      </div>

      {/* 严重性统计卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {severityCards.map((card) => {
          const cfg = card.value !== 'all' ? SEVERITY_CONFIG[card.value] : null
          return (
            <button
              key={card.value}
              onClick={() => setSeverityFilter(card.value)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all duration-300',
                severityFilter === card.value
                  ? 'border-cyber-cyan/50 bg-cyber-cyan/5 shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                  : 'border-[#1e293b] bg-[#1a1f2e] hover:border-[#334155]',
              )}
            >
              <div className="text-xs text-[#94a3b8]">{card.label}</div>
              <div className={cn('text-2xl font-bold mt-1 tabular-nums', card.color)}>
                {card.count}
              </div>
              {cfg && (
                <div className="mt-2 h-0.5 w-full rounded-full bg-[#1e293b] overflow-hidden">
                  <div
                    className={cn('h-full', cfg.bar)}
                    style={{ width: `${stats.total > 0 ? (card.count / stats.total) * 100 : 0}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 搜索 + 状态过滤 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索漏洞标题、目标、CVE、标签..."
            className="pl-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-lg"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#94a3b8]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="h-10 rounded-lg border border-[#1e293b] bg-[#111827] px-3 text-sm text-[#e2e8f0]"
          >
            <option value="all">所有状态</option>
            <option value="open">待处理</option>
            <option value="confirmed">已确认</option>
            <option value="mitigated">已修复</option>
            <option value="false_positive">误报</option>
          </select>
        </div>

        {/* 全选 / 反选 / 删除选中 */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedIds.size === filtered.length) {
                setSelectedIds(new Set())
              } else {
                setSelectedIds(new Set(filtered.map((f) => f.id)))
              }
            }}
            className="border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-cyber-cyan hover:border-cyber-cyan/30 rounded-lg"
          >
            {selectedIds.size === filtered.length && filtered.length > 0 ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                全不选
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5 mr-1" />
                一键全选
              </>
            )}
            <span className="ml-1.5 text-[10px] text-[#64748b]">
              {selectedIds.size > 0 ? `${selectedIds.size}/${filtered.length}` : `${filtered.length}`}
            </span>
          </Button>

          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm(`确定删除选中的 ${selectedIds.size} 个漏洞？`)) {
                  selectedIds.forEach((id) => removeFinding(id))
                  setSelectedIds(new Set())
                }
              }}
              className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              删除 ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* 漏洞列表 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] py-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-[#64748b] opacity-30 mb-3" />
          <p className="text-[#94a3b8]">没有符合条件的漏洞</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((finding) => {
            const sevCfg = SEVERITY_CONFIG[finding.severity]
            const stCfg = STATUS_CONFIG[finding.status] || DEFAULT_STATUS
            const StatusIcon = stCfg.icon
            const isSelected = selectedIds.has(finding.id)
            return (
              <div
                key={finding.id}
                className={cn(
                  'group flex items-start gap-3 rounded-xl border p-4 transition-all',
                  isSelected
                    ? 'border-cyber-cyan/40 bg-cyber-cyan/5'
                    : 'border-[#1e293b] bg-[#1a1f2e] hover:border-cyber-cyan/30 hover:bg-[#0d1321]',
                )}
              >
                {/* 选择 checkbox */}
                <button
                  onClick={() => {
                    const next = new Set(selectedIds)
                    if (next.has(finding.id)) next.delete(finding.id)
                    else next.add(finding.id)
                    setSelectedIds(next)
                  }}
                  className="mt-1 flex-shrink-0 text-[#94a3b8] hover:text-cyber-cyan transition-colors"
                  title={isSelected ? '取消选择' : '选择'}
                >
                  {isSelected ? <Check className="h-4 w-4 text-cyber-cyan" /> : <Square className="h-4 w-4" />}
                </button>
                <div
                  className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setDetailFinding(finding)}
                >
                  {/* 严重性标识 */}
                  <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', sevCfg.bg)}>
                    <AlertTriangle className={cn('h-5 w-5', sevCfg.color)} />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold', sevCfg.bg, sevCfg.text)}>
                        {sevCfg.label}
                      </span>
                      <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 bg-[#111827]', stCfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {stCfg.label}
                      </span>
                      {finding.cve_id && (
                        <span className="rounded-md bg-[#111827] px-2 py-0.5 text-[10px] font-mono text-[#94a3b8]">
                          {finding.cve_id}
                        </span>
                      )}
                      {finding.cvss_score !== undefined && (
                        <span className="rounded-md bg-[#111827] px-2 py-0.5 text-[10px] font-mono text-[#94a3b8]">
                          CVSS {finding.cvss_score}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-white mt-2">{finding.title}</h3>
                    <p className="text-xs text-[#94a3b8] mt-1 line-clamp-2">{finding.description}</p>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[11px] font-mono text-[#64748b]">{finding.target}</span>
                      {finding.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded bg-[#111827] px-1.5 py-0.5 text-[10px] text-[#64748b]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 时间 + 跳转 + 删除 */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-[#64748b]">
                      {new Date(finding.discovered_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`确定删除漏洞「${finding.title}」？`)) {
                            removeFinding(finding.id)
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#64748b] hover:text-red-400 transition-all"
                        title="删除漏洞"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 漏洞详情弹窗 */}
      {detailFinding && (
        <FindingDetailDialog
          finding={detailFinding}
          onClose={() => setDetailFinding(null)}
          onDelete={() => {
            if (confirm(`确定删除漏洞「${detailFinding.title}」？`)) {
              removeFinding(detailFinding.id)
              setDetailFinding(null)
              toast.success('漏洞已删除')
            }
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// 漏洞详情弹窗
// ============================================================
function FindingDetailDialog({
  finding,
  onClose,
  onDelete,
}: {
  finding: Finding
  onClose: () => void
  onDelete: () => void
}) {
  const sevCfg = SEVERITY_CONFIG[finding.severity]
  const stCfg = STATUS_CONFIG[finding.status] || DEFAULT_STATUS
  const StatusIcon = stCfg.icon

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-[#1e293b] bg-[#0d1321] p-0 overflow-hidden">
        {/* Header */}
        <div className={cn('p-5 border-b border-[#1e293b]', sevCfg.bg)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={cn('text-[10px] border', sevCfg.color, 'bg-black/30')}>
                  {sevCfg.label}
                </Badge>
                {finding.cvss_score !== undefined && (
                  <span className="text-[10px] font-mono text-white/80">CVSS {finding.cvss_score}</span>
                )}
                {finding.cve_id && (
                  <span className="text-[10px] font-mono text-white/80">{finding.cve_id}</span>
                )}
                <span className={cn('flex items-center gap-1 text-[10px]', stCfg.color)}>
                  <StatusIcon className="h-3 w-3" />
                  {stCfg.label}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{finding.title}</h2>
              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/60 flex-wrap">
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" />
                  <span className="font-mono">{finding.target}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(finding.discovered_at).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">漏洞描述</h3>
            <div className="rounded-lg border border-[#1e293b] bg-[#1a1f2e] p-3 text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">
              {finding.description}
            </div>
          </div>

          {finding.evidence && (
            <div>
              <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">证据 / POC</h3>
              <pre className="rounded-lg border border-[#1e293b] bg-[#0a0f1a] p-3 text-xs text-[#94a3b8] whitespace-pre-wrap font-mono leading-relaxed">
                {finding.evidence}
              </pre>
            </div>
          )}

          {finding.remediation && (
            <div>
              <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">修复建议</h3>
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">
                {finding.remediation}
              </div>
            </div>
          )}

          {finding.tags && finding.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">标签</h3>
              <div className="flex flex-wrap gap-1.5">
                {finding.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-[#1e293b] bg-[#111827] px-2 py-0.5 text-[10px] text-[#94a3b8] font-mono"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">元数据</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-[#1e293b] bg-[#1a1f2e] px-3 py-2">
                <div className="text-[#64748b]">漏洞 ID</div>
                <div className="font-mono text-white truncate">{finding.id}</div>
              </div>
              <div className="rounded border border-[#1e293b] bg-[#1a1f2e] px-3 py-2">
                <div className="text-[#64748b]">状态</div>
                <div className={cn('font-semibold', stCfg.color)}>{stCfg.label}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[#1e293b] bg-[#0a0f1a] px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(finding, null, 2))
              toast.success('已复制 JSON')
            }}
            className="border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-white"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            复制 JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              toast.loading('AI 正在生成 POC...')
              try {
                const { generatePOCFromAI } = await import('@/lib/generatePOC')
                await generatePOCFromAI(finding.id)
                toast.dismiss()
                toast.success('POC 已生成 ✓')
              } catch (e) {
                toast.dismiss()
                toast.error(`生成失败: ${e instanceof Error ? e.message : '请检查 AI 配置'}`)
              }
            }}
            className="border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            AI 生成 POC
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              删除
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black"
            >
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

