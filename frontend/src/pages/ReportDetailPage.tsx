import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import axios from 'axios'
import {
  ArrowLeft,
  Download,
  FileText,
  Share2,
  Printer,
  User,
  Calendar,
  AlertTriangle,
  Shield,
  ExternalLink,
  Sparkles,
  Bug,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, cn } from '@/lib/utils'
import { useReportStore } from '@/stores/reportStore'
import { useFindingStore } from '@/stores/findingStore'

const SEV_LABEL: Record<string, string> = {
  critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息',
}
const SEV_COLOR: Record<string, string> = {
  critical: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export function ReportDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const reports = useReportStore((s) => s.reports)
  const findings = useFindingStore((s) => s.findings)

  const report = reports.find((r) => r.id === id)

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <FileText className="h-16 w-16 text-[#64748b] opacity-30 mb-4" />
        <h2 className="text-xl font-semibold text-white">报告不存在</h2>
        <p className="text-sm text-[#94a3b8] mt-2">该报告可能已被删除</p>
        <Button onClick={() => navigate('/reports')} className="mt-4 bg-cyber-cyan text-black">
          返回报告列表
        </Button>
      </div>
    )
  }

  const { severity_summary, tags } = report

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        className="text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e] -ml-3"
        onClick={() => navigate('/reports')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回报告列表
      </Button>

      {/* Header */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20">
              <FileText className="h-7 w-7 text-[#7c3aed]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{report.title}</h1>
              <p className="text-sm text-[#94a3b8] mt-1">{report.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-[#94a3b8] flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {report.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDate(report.created_at)}
                </span>
                {report.target && (
                  <span className="flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> {report.target}
                  </span>
                )}
                {report.source && (
                  <Badge variant="outline" className="border-[#1e293b] text-cyber-cyan text-[10px]">
                    {report.source === 'chat' ? 'AI 对话' : report.source === 'workflow' ? '工作流' : '手动'}
                  </Badge>
                )}
                <Badge variant="outline" className="border-[#1e293b] text-green-400 text-[10px]">
                  已完成
                </Badge>
              </div>
              {tags && tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded bg-[#111827] px-1.5 py-0.5 text-[10px] text-[#64748b]">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-[#1e293b] bg-[#111827] text-[#e2e8f0]">
              <Share2 className="h-4 w-4 mr-1.5" />
              分享
            </Button>
            <Button
              variant="outline"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
              onClick={() => {
                // 真实下载：将报告导出为 Markdown 文件
                const md = `# ${report?.title || '渗透测试报告'}\n\n${report?.content || ''}`
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${(report?.title || 'report').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`
                a.click()
                URL.revokeObjectURL(url)
                toast.success('已下载 Markdown 文件')
              }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              下载 .md
            </Button>
            <Button
              variant="outline"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              打印
            </Button>
            <Button
              className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black"
              onClick={async () => {
                // 真实 PDF 导出：调后端 fpdf2 生成 PDF
                toast.loading('正在生成 PDF...', { id: 'pdf-gen' })
                try {
                  const { data } = await axios.post(
                    '/api/v1/reports/export-pdf',
                    { title: report?.title || '渗透测试报告', content: report?.content || '', target: report?.target || '' },
                    { responseType: 'blob', timeout: 30000 },
                  )
                  const blob = new Blob([data], { type: 'application/pdf' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${(report?.title || 'report').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
                  a.click()
                  URL.revokeObjectURL(url)
                  toast.success('PDF 已下载', { id: 'pdf-gen' })
                } catch (e: any) {
                  toast.error('PDF 生成失败：' + (e?.message || e), { id: 'pdf-gen' })
                }
              }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              下载 PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content - 报告正文 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 执行摘要（来自 report.content 的第一段）*/}
          {report.content && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyber-cyan" />
                报告内容
              </h2>
              <pre className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap font-sans">
                {report.content}
              </pre>
            </div>
          )}

          {!report.content && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6 text-center text-[#64748b]">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>该报告没有详细内容</p>
            </div>
          )}

          {/* 关联发现 - 从 findingStore 真实数据 */}
          {findings.length > 0 && (
            <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bug className="h-5 w-5 text-pink-400" />
                漏洞库（共 {findings.length} 条）
              </h2>
              <p className="text-xs text-[#94a3b8] mb-3">以下是从漏洞库（findingStore）读取的真实数据</p>
              <div className="space-y-3">
                {findings.slice(0, 10).map((f) => (
                  <div key={f.id} className="rounded-lg border border-[#1e293b] bg-[#111827] p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={cn('text-[10px] border', SEV_COLOR[f.severity])}>
                        {SEV_LABEL[f.severity]}
                      </Badge>
                      {f.cvss_score !== undefined && (
                        <span className="text-[10px] font-mono text-[#94a3b8]">CVSS {f.cvss_score}</span>
                      )}
                      {f.cve_id && (
                        <span className="text-[10px] font-mono text-[#94a3b8]">{f.cve_id}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-1">{f.title}</h3>
                    <p className="text-[11px] text-[#94a3b8] mt-1 line-clamp-2">{f.description}</p>
                    <p className="text-[10px] font-mono text-[#64748b] mt-1">{f.target}</p>
                  </div>
                ))}
                {findings.length > 10 && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/findings')}
                    className="w-full border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-white"
                  >
                    查看全部 {findings.length} 条漏洞 →
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* 漏洞统计 */}
          <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyber-cyan" />
              漏洞统计
            </h3>
            <div className="space-y-2">
              {[
                { k: 'critical', label: '严重', color: 'text-pink-400' },
                { k: 'high', label: '高危', color: 'text-red-400' },
                { k: 'medium', label: '中危', color: 'text-orange-400' },
                { k: 'low', label: '低危', color: 'text-blue-400' },
                { k: 'info', label: '信息', color: 'text-gray-400' },
              ].map((s) => {
                const count = severity_summary[s.k as keyof typeof severity_summary] as number
                return (
                  <div key={s.k} className="flex items-center justify-between text-sm">
                    <span className="text-[#94a3b8]">{s.label}</span>
                    <span className={cn('font-semibold tabular-nums', s.color)}>{count}</span>
                  </div>
                )
              })}
              <div className="border-t border-[#1e293b] pt-2 mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">总计</span>
                <span className="text-base font-bold text-cyber-cyan tabular-nums">{severity_summary.total}</span>
              </div>
            </div>
          </div>

          {/* 报告状态 */}
          <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-4">
            <h3 className="text-sm font-semibold text-white mb-3">报告信息</h3>
            <div className="space-y-2 text-xs text-[#94a3b8]">
              <div className="flex justify-between">
                <span>状态</span>
                <span className="text-green-400">已完成</span>
              </div>
              <div className="flex justify-between">
                <span>格式</span>
                <span className="text-white uppercase">{report.format}</span>
              </div>
              <div className="flex justify-between">
                <span>来源</span>
                <span className="text-white">
                  {report.source === 'chat' ? 'AI 对话' : report.source === 'workflow' ? '工作流' : '手动'}
                </span>
              </div>
              {report.workflow_name && (
                <div className="flex justify-between">
                  <span>工作流</span>
                  <span className="text-white">{report.workflow_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* 操作 */}
          <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyber-cyan" />
              操作
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => navigate('/findings')}
                className="w-full justify-start border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                查看漏洞库
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/chat')}
                className="w-full justify-start border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                AI 对话分析
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

