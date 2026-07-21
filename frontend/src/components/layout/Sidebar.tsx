import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  Workflow,
  Puzzle,
  ListTodo,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Search,
  FolderOpen,
  User,
  LogOut,
  Command,
  Bug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/chat', icon: MessageSquare, label: 'AI 对话' },
  { to: '/workflows', icon: Workflow, label: '工作流' },
  { to: '/skills', icon: Puzzle, label: '技能市场' },
  { to: '/tasks', icon: ListTodo, label: '任务监控' },
  { to: '/findings', icon: Bug, label: '漏洞管理' },
  { to: '/reports', icon: FileText, label: '报告中心' },
  { to: '/settings', icon: Settings, label: '设置' },
]

const DEMO_PROJECTS = [
  { id: 'proj-1', name: '内部安全审计', color: 'bg-cyber-cyan' },
  { id: 'proj-2', name: 'Web 渗透测试', color: 'bg-purple-500' },
  { id: 'proj-3', name: '云安全评估', color: 'bg-blue-500' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside
      className={cn(
        'flex flex-col bg-[#0d1321] border-r border-[#1e293b] transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[250px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-[#1e293b]">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            {/* Logo 图标 - 带呼吸光晕 */}
            <div className="relative flex h-9 w-9 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyber-cyan to-[#7c3aed] opacity-60 blur-md animate-pulse-glow" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-cyan via-[#00b894] to-[#7c3aed] shadow-[0_0_15px_rgba(0,212,170,0.4)]">
                <Shield className="h-5 w-5 text-white drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-extrabold text-white tracking-tight">
                渗透<span className="bg-gradient-to-r from-cyber-cyan to-[#00b894] bg-clip-text text-transparent">工坊</span>
              </span>
              <span className="text-[9px] text-[#64748b] tracking-widest uppercase mt-0.5">HackFlow v1.0</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <div className="relative flex h-9 w-9 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyber-cyan to-[#7c3aed] opacity-60 blur-md animate-pulse-glow" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-cyan via-[#00b894] to-[#7c3aed]">
                <Shield className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e] rounded-lg transition-all',
            collapsed && 'hidden',
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick search */}
      {!collapsed && (
        <div className="px-3 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="快速搜索..."
              className="w-full rounded-lg border border-[#1e293b] bg-[#111827] py-2 pl-9 pr-3 text-sm text-[#e2e8f0] placeholder-[#64748b] outline-none transition-all focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/30"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#1e293b] bg-[#0d1321] px-1 py-0.5 text-[10px] text-[#64748b]">
              <Command className="h-3 w-3 inline" />K
            </kbd>
          </div>
        </div>
      )}

      <Separator className="bg-[#1e293b]" />

      {/* Project selector */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <button
            onClick={() => setShowProjects(!showProjects)}
            className="flex w-full items-center justify-between rounded-lg border border-[#1e293b] bg-[#111827] px-3 py-2 text-sm transition-all hover:border-[#334155]"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-cyber-cyan" />
              <span className="text-[#e2e8f0]">当前项目</span>
            </div>
            <ChevronLeft className={cn(
              'h-3.5 w-3.5 text-[#64748b] transition-transform',
              showProjects && '-rotate-90',
            )} />
          </button>

          {showProjects && (
            <div className="mt-1 space-y-0.5">
              {DEMO_PROJECTS.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setShowProjects(false)
                    navigate(`/projects/${project.id}`)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#94a3b8] hover:bg-[#1a1f2e] hover:text-white transition-all cursor-pointer"
                >
                  <div className={cn('h-1.5 w-1.5 rounded-full', project.color)} />
                  {project.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to

            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-cyber-cyan/10 text-cyber-cyan shadow-[0_0_10px_rgba(0,212,170,0.05)]'
                    : 'text-[#94a3b8] hover:bg-[#1a1f2e] hover:text-white',
                  collapsed && 'justify-center px-2',
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-cyber-cyan shadow-[0_0_8px_rgba(0,212,170,0.5)]" />
                )}

                <Icon className={cn(
                  'h-5 w-5 flex-shrink-0 transition-colors',
                  isActive ? 'text-cyber-cyan' : 'text-[#94a3b8] group-hover:text-white',
                )} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#1a1f2e] border-[#1e293b] text-[#e2e8f0] text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-[#1e293b] p-3">
        {!collapsed ? (
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-[#1a1f2e] transition-all cursor-pointer group text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#ff3385] flex-shrink-0">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#e2e8f0] font-medium truncate">Admin</p>
              <p className="text-[10px] text-[#64748b]">管理员</p>
            </div>
            <LogOut className="h-3.5 w-3.5 text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => navigate('/settings')}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#ff3385] cursor-pointer hover:scale-110 transition-transform"
            >
              <User className="h-4 w-4 text-white" />
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="mt-2 rounded-lg bg-[#111827] p-2.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="text-[#94a3b8]">系统运行中</span>
            </div>
            <div className="mt-1 text-[10px] text-[#475569]">v1.0.0 · 社区版</div>
          </div>
        )}
      </div>

      {/* Collapse toggle (bottom, always visible when collapsed) */}
      {collapsed && (
        <div className="border-t border-[#1e293b] p-2 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e] rounded-lg"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </aside>
  )
}
