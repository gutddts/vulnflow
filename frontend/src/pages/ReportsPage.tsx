import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Search,
  Download,
  Eye,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  FileBarChart,
  TrendingUp,
  Calendar,
  Sparkles,
  Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common/EmptyState'
import { useReportStore, type Report, type ReportFormat } from '@/stores/reportStore'
import { useFindingStore, useSeverityStats } from '@/stores/findingStore'
import { useTaskStore } from '@/stores/taskStore'
import { notify } from '@/lib/notifications'
import { formatRelativeTime, cn } from '@/lib/utils'
import { toast } from 'sonner'

const FORMAT_BADGES: Record<ReportFormat, { label: string; class: string }> = {
  pdf: { label: 'PDF', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
  html: { label: 'HTML', class: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  markdown: { label: 'MD', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  json: { label: 'JSON', class: 'bg-green-500/10 text-green-400 border-green-500/20' },
}

const SEVERITY_BAR_CONFIG = [
  { key: 'critical', color: 'bg-[#ff3385]', label: '严重' },
  { key: 'high', color: 'bg-red-500', label: '高危' },
  { key: 'medium', color: 'bg-amber-500', label: '中危' },
  { key: 'low', color: 'bg-blue-500', label: '低危' },
  { key: 'info', color: 'bg-gray-500', label: '信息' },
] as const

export function ReportsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showGenDialog, setShowGenDialog] = useState(false)
  const [genTarget, setGenTarget] = useState('')
  const [genType, setGenType] = useState<'full' | 'web' | 'internal' | 'cloud'>('full')

  // 从 store 读取报告
  const reports = useReportStore((s) => s.reports)
  const addReport = useReportStore((s) => s.addReport)
  const removeReport = useReportStore((s) => s.removeReport)

  // 关联数据 - 实时统计
  const severityStats = useSeverityStats()
  const tasks = useTaskStore((s) => s.tasks)

  const filteredReports = reports.filter(
    (r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  )

  const stats = {
    total: reports.length,
    thisMonth: reports.filter((r) => {
      const d = new Date(r.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
    totalCritical: severityStats.critical,
    totalHigh: severityStats.high,
  }

  /** 生成报告 - 基于当前真实数据 */
  const handleGenerateReport = () => {
    if (!genTarget.trim()) {
      toast.error('请输入目标')
      return
    }

    // 生成报告内容（基于真实漏洞数据 + 任务进度）
    const relatedTasks = tasks.filter((t) => t.target?.includes(genTarget) || t.name.includes(genTarget))
    const completedTasks = relatedTasks.filter((t) => t.status === 'completed')
    const failedTasks = relatedTasks.filter((t) => t.status === 'failed')

    const reportTypeMap = {
      full: '完整外网渗透',
      web: 'Web 应用渗透',
      internal: '内网渗透',
      cloud: '云环境渗透',
    }

    const content = `# ${reportTypeMap[genType]}测试报告

## 测试信息
- **目标**：${genTarget}
- **报告类型**：${reportTypeMap[genType]}
- **生成时间**：${new Date().toLocaleString('zh-CN')}
- **执行 Agent**：VulnFlow AI 渗透测试智能体

## 执行摘要

本次测试针对 **${genTarget}** 进行了${reportTypeMap[genType]}测试，覆盖了漏洞识别、风险评估、攻击面分析等关键环节。

### 关键数据
- 总任务数：${relatedTasks.length}
- 已完成任务：${completedTasks.length}
- 失败任务：${failedTasks.length}
- 已发现漏洞：${severityStats.total} 个
  - 严重：${severityStats.critical} 个
  - 高危：${severityStats.high} 个
  - 中危：${severityStats.medium} 个
  - 低危：${severityStats.low} 个
  - 信息：${severityStats.info} 个

## 风险评估

${
      severityStats.critical > 0
        ? `🔴 **严重风险**：发现 ${severityStats.critical} 个严重漏洞，建议立即修复。`
        : '🟢 **风险等级**：未发现严重漏洞。'
    }
${
      severityStats.high > 0
        ? `🟠 **高风险**：发现 ${severityStats.high} 个高危漏洞，建议优先处理。`
        : ''
    }

## 建议

1. 修复所有严重和高危漏洞
2. 实施纵深防御策略
3. 定期进行安全评估
4. 加强员工安全意识培训

## 附录

- 测试工具：VulnFlow AI 智能体
- 数据来源：实际渗透测试结果
- 报告生成：AI 自动生成

---
*本报告由 VulnFlow AI 自动生成*
`

    addReport({
      title: `${reportTypeMap[genType]}测试报告 - ${genTarget}`,
      description: `AI 智能体对 ${genTarget} 的${reportTypeMap[genType]}测试结果`,
      status: 'completed',
      format: 'markdown',
      author: 'admin',
      content,
      source: 'chat',
      target: genTarget,
      severity_summary: {
        critical: severityStats.critical,
        high: severityStats.high,
        medium: severityStats.medium,
        low: severityStats.low,
        info: severityStats.info,
        total: severityStats.total,
      },
      tags: [genType, 'ai-generated', 'penetration-test'],
    })

    toast.success('报告已生成', { description: `${reportTypeMap[genType]}测试报告 - ${genTarget}` })
    notify.success('报告已生成', `${reportTypeMap[genType]}测试报告 - ${genTarget}`, { target: genTarget, link: `/reports` })
    setShowGenDialog(false)
    setGenTarget('')
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">报告中心</h1>
          <p className="text-sm text-[#94a3b8] mt-1">管理和查看渗透测试报告 · 在 AI 对话点击「导入报告」可一键同步</p>
        </div>
        <Button
          onClick={() => setShowGenDialog(true)}
          className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.2)] rounded-xl"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          生成报告
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94a3b8]">总报告</span>
            <FileBarChart className="h-4 w-4 text-cyber-cyan" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94a3b8]">本月</span>
            <Calendar className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.thisMonth}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4" title="来自漏洞库（findingStore）总览">
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-400">严重漏洞（库）</span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.totalCritical}</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4" title="来自漏洞库（findingStore）总览">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-400">高危漏洞（库）</span>
            <TrendingUp className="h-4 w-4 text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-orange-400 mt-1">{stats.totalHigh}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索报告名称或标签..."
          className="pl-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
        />
      </div>

      {/* Report cards */}
      {filteredReports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="暂无报告"
          description="还没有生成任何渗透测试报告"
          action={{ label: '生成第一份报告', onClick: () => setShowGenDialog(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredReports.map((report) => {
            const total = report.severity_summary.total || 0
            const formatBadge = FORMAT_BADGES[report.format] || FORMAT_BADGES.pdf

            return (
              <div
                key={report.id}
                className="group rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-5 hover:border-cyber-cyan/30 hover:shadow-[0_0_20px_rgba(0,212,170,0.08)] transition-all cursor-pointer"
                onClick={() => navigate(`/reports/${report.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border transition-all group-hover:scale-110',
                      report.status === 'completed' && 'bg-purple-500/10 border-purple-500/20',
                      report.status === 'generating' && 'bg-yellow-500/10 border-yellow-500/20',
                      report.status === 'draft' && 'bg-gray-500/10 border-gray-500/20',
                      report.status === 'failed' && 'bg-red-500/10 border-red-500/20',
                    )}>
                      <FileText className={cn(
                        'h-6 w-6',
                        report.status === 'completed' && 'text-purple-400',
                        report.status === 'generating' && 'text-yellow-400',
                        report.status === 'draft' && 'text-gray-400',
                        report.status === 'failed' && 'text-red-400',
                      )} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-cyber-cyan transition-colors">
                        {report.title}
                      </h3>
                      <p className="text-xs text-[#94a3b8] mt-0.5">{report.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] border px-1.5 py-0',
                        report.status === 'completed' && 'text-green-400 border-green-500/20 bg-green-500/5',
                        report.status === 'generating' && 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
                        report.status === 'draft' && 'text-gray-400 border-gray-500/20 bg-gray-500/5',
                        report.status === 'failed' && 'text-red-400 border-red-500/20 bg-red-500/5',
                      )}
                    >
                      {report.status === 'completed' ? '已完成' :
                       report.status === 'generating' ? '生成中' :
                       report.status === 'draft' ? '草稿' : '失败'}
                    </Badge>
                    <span className={cn('text-[10px] border px-1.5 py-0 rounded', formatBadge.class)}>
                      {formatBadge.label}
                    </span>
                  </div>
                </div>

                {/* Severity summary */}
                <div className="space-y-2">
                  {/* Mini bars */}
                  {total > 0 && (
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                      {SEVERITY_BAR_CONFIG.map(({ key, color }) => {
                        const count = report.severity_summary[key as keyof typeof report.severity_summary] as number
                        const pct = (count / total) * 100
                        if (pct === 0) return null
                        return (
                          <div
                            key={key}
                            className={cn('h-full first:rounded-l-full last:rounded-r-full', color)}
                            style={{ width: `${pct}%` }}
                            title={`${key}: ${count}`}
                          />
                        )
                      })}
                    </div>
                  )}

                  {/* Severity labels */}
                  <div className="flex items-center gap-3 text-[10px] text-[#64748b]">
                    {report.severity_summary.critical > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff3385]" />
                        严重 {report.severity_summary.critical}
                      </span>
                    )}
                    {report.severity_summary.high > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        高危 {report.severity_summary.high}
                      </span>
                    )}
                    {report.severity_summary.medium > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        中危 {report.severity_summary.medium}
                      </span>
                    )}
                    <span className="ml-auto">共 {total} 个发现</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1e293b]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-[#64748b]">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(report.created_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      {report.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] text-[#475569] bg-[#111827] px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
                      onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}`) }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#94a3b8] hover:text-red-400 hover:bg-[#1e293b]"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`确定删除报告「${report.title}」吗？`)) {
                          removeReport(report.id)
                          toast.success('报告已删除')
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 生成报告对话框 */}
      {showGenDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[480px] rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20">
                <Sparkles className="h-5 w-5 text-cyber-cyan" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI 生成渗透测试报告</h3>
                <p className="text-xs text-[#94a3b8]">基于当前漏洞和任务数据自动生成</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#e2e8f0] mb-1.5 block">测试目标</label>
                <Input
                  value={genTarget}
                  onChange={(e) => setGenTarget(e.target.value)}
                  placeholder="如 example.com / 192.168.1.0/24"
                  className="bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#e2e8f0] mb-1.5 block">报告类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'full', label: '完整外网', icon: '🌐' },
                    { v: 'web', label: 'Web 应用', icon: '🔴' },
                    { v: 'internal', label: '内网渗透', icon: '🏢' },
                    { v: 'cloud', label: '云环境', icon: '☁️' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setGenType(opt.v as 'full' | 'web' | 'internal' | 'cloud')}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                        genType === opt.v
                          ? 'border-cyber-cyan/30 bg-cyber-cyan/10 text-cyber-cyan'
                          : 'border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-white hover:border-[#334155]',
                      )}
                    >
                      <div className="text-base mb-0.5">{opt.icon}</div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#1e293b] bg-[#0d1321] p-3">
                <div className="text-[10px] text-[#64748b] mb-1">报告将包含</div>
                <div className="text-[11px] text-[#94a3b8] space-y-0.5">
                  <div>· 测试信息与目标</div>
                  <div>· 执行摘要（任务 / 漏洞统计）</div>
                  <div>· 漏洞分布（{severityStats.total} 个）</div>
                  <div>· 风险评估与修复建议</div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGenDialog(false)}
                  className="flex-1 border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:bg-[#1a1f2e] rounded-xl"
                >
                  取消
                </Button>
                <Button
                  onClick={handleGenerateReport}
                  className="flex-1 bg-cyber-cyan hover:bg-cyber-cyan/90 text-black rounded-xl"
                >
                  <Bot className="h-4 w-4 mr-1.5" />
                  生成报告
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
