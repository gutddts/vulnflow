import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Archive,
  Trash2,
  Shield,
  Target,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common/EmptyState'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProjectStore } from '@/stores/projectStore'
import { formatRelativeTime, cn } from '@/lib/utils'

const MOCK_PROJECTS = [
  {
    id: 'proj-1',
    name: '内网安全评估',
    description: '对公司内部网络进行全面安全评估',
    status: 'active' as const,
    target: '192.168.1.0/24',
    vulnerability_count: 155,
    created_at: '2024-07-01T00:00:00Z',
    updated_at: '2024-07-19T10:00:00Z',
  },
  {
    id: 'proj-2',
    name: 'Web 应用渗透测试',
    description: '针对客户 Web 应用的渗透测试',
    status: 'active' as const,
    target: 'example.com',
    vulnerability_count: 46,
    created_at: '2024-07-10T00:00:00Z',
    updated_at: '2024-07-18T16:00:00Z',
  },
  {
    id: 'proj-3',
    name: '云安全审计',
    description: 'AWS 基础设施安全审计',
    status: 'active' as const,
    target: 'aws-env',
    vulnerability_count: 25,
    created_at: '2024-07-15T00:00:00Z',
    updated_at: '2024-07-19T11:00:00Z',
  },
  {
    id: 'proj-4',
    name: '无线网络安全测试',
    description: '办公区域 WiFi 安全检测',
    status: 'completed' as const,
    target: 'Office-WiFi',
    vulnerability_count: 8,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-15T00:00:00Z',
  },
]

export function ProjectsPage() {
  const navigate = useNavigate()
  const { id: projectIdParam } = useParams<{ id: string }>()
  const [search, setSearch] = useState('')
  const [projects] = useState(MOCK_PROJECTS)
  const { setCurrentProject, currentProject } = useProjectStore()

  // 路由 :id 进来时自动选中该 project
  useEffect(() => {
    if (projectIdParam) {
      const p = projects.find((x) => x.id === projectIdParam)
      if (p) setCurrentProject(p)
    }
  }, [projectIdParam, projects, setCurrentProject])

  const filteredProjects = projects.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">项目管理</h1>
          <p className="text-sm text-[#94a3b8] mt-1">管理渗透测试项目</p>
        </div>
        <Button className="bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-black">
          <Plus className="h-4 w-4 mr-1.5" />
          新建项目
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索项目..."
          className="pl-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-[#00d4aa]/50"
        />
      </div>

      {/* Projects grid */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="暂无项目"
          description="创建您的第一个渗透测试项目"
          action={{ label: '新建项目', onClick: () => {} }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className={cn(
                'rounded-xl border p-5 transition-all duration-300 cursor-pointer',
                currentProject?.id === project.id
                  ? 'border-[#00d4aa]/40 bg-[#00d4aa]/5 shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                  : 'border-[#1e293b] bg-[#1a1f2e] hover:border-[#00d4aa]/20',
              )}
              onClick={() => setCurrentProject(project)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111827] border border-[#1e293b]">
                  <FolderKanban className="h-5 w-5 text-[#00d4aa]" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#64748b] hover:text-white"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1a1f2e] border-[#1e293b]">
                    <DropdownMenuItem className="text-[#e2e8f0] hover:bg-[#111827] cursor-pointer">
                      <Play className="h-4 w-4 mr-2" />
                      设为当前项目
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[#e2e8f0] hover:bg-[#111827] cursor-pointer">
                      <Archive className="h-4 w-4 mr-2" />
                      归档项目
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-400 hover:bg-[#111827] cursor-pointer">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除项目
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="text-sm font-semibold text-white mb-1">{project.name}</h3>
              <p className="text-xs text-[#94a3b8] mb-4 line-clamp-2">{project.description}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748b] flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    目标
                  </span>
                  <span className="text-[#e2e8f0] font-mono">{project.target}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748b] flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    漏洞数
                  </span>
                  <span className="text-[#ff3385] font-mono">{project.vulnerability_count}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748b] flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    更新时间
                  </span>
                  <span className="text-[#94a3b8]">{formatRelativeTime(project.updated_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#1e293b]">
                <Badge
                  variant="outline"
                  className={cn(
                    'border-[#1e293b] text-[10px]',
                    project.status === 'active'
                      ? 'text-green-400'
                      : project.status === 'completed'
                        ? 'text-blue-400'
                        : 'text-[#94a3b8]',
                  )}
                >
                  {project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '已归档'}
                </Badge>
                {currentProject?.id === project.id && (
                  <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] text-[10px] border-0">
                    当前项目
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
