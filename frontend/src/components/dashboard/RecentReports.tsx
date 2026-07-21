import { FileText, Download, ArrowRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ReportData {
  id: string
  title: string
  description: string
  status: 'completed' | 'generating' | 'draft' | 'failed'
  format: 'pdf' | 'html' | 'markdown' | 'json'
  created_at: string
  severity_summary: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    total: number
  }
}

interface RecentReportsProps {
  reports: ReportData[]
  className?: string
}

const SEVERITY_BAR_CONFIG = [
  { key: 'critical', color: 'bg-[#ff3385]', label: '严重' },
  { key: 'high', color: 'bg-red-500', label: '高危' },
  { key: 'medium', color: 'bg-amber-500', label: '中危' },
  { key: 'low', color: 'bg-blue-500', label: '低危' },
  { key: 'info', color: 'bg-gray-500', label: '信息' },
] as const

const FORMAT_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/10 text-red-400 border-red-500/20',
  html: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  markdown: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  json: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export function RecentReports({ reports, className }: RecentReportsProps) {
  if (reports.length === 0) {
    return (
      <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">最近报告</h3>
          <Link
            to="/reports"
            className="text-xs text-cyber-cyan hover:underline flex items-center gap-1"
          >
            查看全部 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
          <FileText className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">暂无报告</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">最近报告</h3>
        <Link
          to="/reports"
          className="text-xs text-cyber-cyan hover:underline flex items-center gap-1 transition-colors"
        >
          查看全部 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {reports.slice(0, 5).map((report) => {
          const total = report.severity_summary.total || 0

          return (
            <Link
              key={report.id}
              to={`/reports/${report.id}`}
              className="group block rounded-lg border border-[#1e293b] bg-[#111827] p-3.5 transition-all duration-300 hover:border-cyber-cyan/30 hover:bg-[#111827]/80"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 group-hover:border-purple-500/30 transition-colors">
                  <FileText className="h-5 w-5 text-purple-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-medium text-[#e2e8f0] group-hover:text-cyber-cyan transition-colors truncate">
                        {report.title}
                      </h4>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        {formatRelativeTime(report.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          report.status === 'completed' && 'text-green-400 border-green-500/20',
                          report.status === 'generating' && 'text-yellow-400 border-yellow-500/20',
                          report.status === 'draft' && 'text-gray-400 border-gray-500/20',
                          report.status === 'failed' && 'text-red-400 border-red-500/20',
                        )}
                      >
                        {report.status === 'completed' ? '已完成' :
                         report.status === 'generating' ? '生成中' :
                         report.status === 'draft' ? '草稿' : '失败'}
                      </Badge>
                    </div>
                  </div>

                  {/* Severity breakdown mini bars */}
                  {total > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
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
                      <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
                        <span>共 {total} 个发现</span>
                        <div className="flex items-center gap-1.5">
                          {report.severity_summary.critical > 0 && (
                            <span className="text-[#ff3385]">● {report.severity_summary.critical}</span>
                          )}
                          {report.severity_summary.high > 0 && (
                            <span className="text-red-400">● {report.severity_summary.high}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Format badge */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border',
                      FORMAT_COLORS[report.format] || 'text-gray-400 border-gray-500/20',
                    )}>
                      {report.format.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Download button (visible on hover) */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
