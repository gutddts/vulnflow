import { useEffect, useState, useMemo } from 'react'
import {
  Target,
  Bot,
  AlertTriangle,
  FileText,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { SeverityChart } from '@/components/dashboard/SeverityChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { RecentReports } from '@/components/dashboard/RecentReports'
import { LivePenTestPanel } from '@/components/dashboard/LivePenTestPanel'
import { ResourceMonitor } from '@/components/dashboard/ResourceMonitor'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/stores/taskStore'
import { useFindingStore, useSeverityStats } from '@/stores/findingStore'
import { cn } from '@/lib/utils'

const DEMO_ACTIVITIES = [
  {
    id: '1',
    type: 'vulnerability_found' as const,
    title: '发现严重 SQL 注入漏洞',
    description: '在 example.com/login 页面发现盲注 SQL 注入漏洞',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    severity: 'critical' as const,
  },
  {
    id: '2',
    type: 'scan_started' as const,
    title: '开始全端口扫描',
    description: '目标: 192.168.1.0/24 网段，预计耗时 15 分钟',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'skill_executed' as const,
    title: '执行 Nmap 端口扫描',
    description: '发现 23 个开放端口，5 个服务已识别',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'task_completed' as const,
    title: 'Web 应用漏洞检测完成',
    description: 'example.com 扫描完成，发现 47 个漏洞',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'report_generated' as const,
    title: '生成渗透测试报告',
    description: '内网安全评估报告已生成，PDF 格式',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    type: 'vulnerability_found' as const,
    title: '发现 XSS 反射型漏洞',
    description: '在 search 参数中发现反射型 XSS 漏洞',
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    severity: 'high' as const,
  },
  {
    id: '7',
    type: 'scan_started' as const,
    title: '开始子域名枚举',
    description: '目标域: example.com，使用多个数据源',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8',
    type: 'user_login' as const,
    title: '用户登录',
    description: 'admin 从 10.0.0.1 登录系统',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '9',
    type: 'skill_executed' as const,
    title: '执行目录爆破',
    description: '发现 /admin, /backup, /config 等敏感路径',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '10',
    type: 'task_completed' as const,
    title: 'AWS 安全审计完成',
    description: '发现 3 个 S3 存储桶公开访问',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
]

const DEMO_REPORTS = [
  {
    id: '1',
    title: '内网安全评估报告 - 2024Q3',
    description: '第三季度内部网络安全评估',
    status: 'completed' as const,
    format: 'pdf' as const,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    severity_summary: { critical: 3, high: 12, medium: 28, low: 45, info: 67, total: 155 },
  },
  {
    id: '2',
    title: 'Web 应用渗透测试报告',
    description: '针对 example.com 的完整安全评估',
    status: 'completed' as const,
    format: 'pdf' as const,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    severity_summary: { critical: 1, high: 5, medium: 8, low: 12, info: 20, total: 46 },
  },
  {
    id: '3',
    title: '云安全合规审计报告',
    description: 'AWS 环境安全合规性审计',
    status: 'generating' as const,
    format: 'html' as const,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    severity_summary: { critical: 0, high: 3, medium: 7, low: 5, info: 10, total: 25 },
  },
  {
    id: '4',
    title: 'API 安全测试报告',
    description: 'REST API 端点安全评估',
    status: 'completed' as const,
    format: 'json' as const,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    severity_summary: { critical: 2, high: 4, medium: 6, low: 3, info: 8, total: 23 },
  },
]

export function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // 订阅 taskStore - 任务数据实时变化（每 1.5s tickProgress 推进）
  const tasks = useTaskStore((s) => s.tasks)

  // 实时统计派生
  const todayStats = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTasks = tasks.filter((t) => new Date(t.created_at) >= startOfToday)
    return {
      total: todayTasks.length,
      trend: 18, // 较昨日（mock 趋势）
    }
  }, [tasks])

  const agentStats = useMemo(() => {
    // 活跃 Agent = 正在 running 的任务数（每个任务由一个 Agent 执行）
    const running = tasks.filter((t) => t.status === 'running').length
    return { total: Math.max(running, 1), trend: running > 0 ? 50 : 0 }
  }, [tasks])

  const reportStats = useMemo(() => {
    // 报告数量 = 任务里 type=report 的数量
    const reports = tasks.filter((t) => t.type === 'report').length
    return { total: reports, trend: 33 }
  }, [tasks])

  // 漏洞统计 - 来自 findingStore（保证与 SeverityChart 和 /findings 页面完全一致）
  const severityStats = useSeverityStats()
  const findingStats = useMemo(
    () => ({ total: severityStats.total, trend: -8 }),
    [severityStats.total],
  )

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setLastRefresh(new Date())
    }, 600)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 bg-[#1e293b]" />
            <Skeleton className="h-4 w-48 mt-2 bg-[#1e293b]" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-[#1a1f2e] border border-[#1e293b]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Skeleton className="h-80 lg:col-span-3 rounded-xl bg-[#1a1f2e] border border-[#1e293b]" />
          <Skeleton className="h-80 lg:col-span-2 rounded-xl bg-[#1a1f2e] border border-[#1e293b]" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl bg-[#1a1f2e] border border-[#1e293b]" />
          <div className="space-y-6">
            <Skeleton className="h-72 rounded-xl bg-[#1a1f2e] border border-[#1e293b]" />
            <Skeleton className="h-72 rounded-xl bg-[#1a1f2e] border border-[#1e293b]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">仪表盘</h1>
          <p className="text-sm text-[#94a3b8] mt-1">安全态势概览</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <Clock className="h-3.5 w-3.5" />
            <span>更新于 {lastRefresh.toLocaleTimeString('zh-CN')}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e] rounded-lg"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* Top row: Stats - 实时统计 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="今日任务"
          value={todayStats.total}
          icon={Target}
          color="cyan"
          trend={todayStats.trend}
          trendLabel="较昨日"
          href="/tasks"
        />
        <StatsCard
          title="活跃Agent"
          value={agentStats.total}
          icon={Bot}
          color="purple"
          trend={agentStats.trend}
          trendLabel="较昨日"
          href="/chat"
        />
        <StatsCard
          title="发现漏洞"
          value={findingStats.total}
          icon={AlertTriangle}
          color="pink"
          trend={findingStats.trend}
          trendLabel="较昨日"
          href="/findings"
        />
        <StatsCard
          title="报告数量"
          value={reportStats.total}
          icon={FileText}
          color="blue"
          trend={reportStats.trend}
          trendLabel="较上周"
          href="/reports"
        />
      </div>

      {/* Middle row: Attack Chain + Severity Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <LivePenTestPanel />
        </div>
        <div className="lg:col-span-2">
          <SeverityChart
            data={{
              critical: severityStats.critical,
              high: severityStats.high,
              medium: severityStats.medium,
              low: severityStats.low,
              info: severityStats.info,
            }}
          />
        </div>
      </div>

      {/* Bottom row: Activity Feed + Resource Monitor + Recent Reports */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityFeed activities={DEMO_ACTIVITIES} />
        <div className="space-y-6">
          <ResourceMonitor />
          <RecentReports reports={DEMO_REPORTS} />
        </div>
      </div>
    </div>
  )
}
