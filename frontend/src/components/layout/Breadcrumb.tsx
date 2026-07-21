import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  '/': '仪表盘',
  '/chat': 'AI 对话',
  '/workflows': '工作流',
  '/skills': '技能市场',
  '/tasks': '任务监控',
  '/reports': '报告中心',
  '/settings': '设置',
  '/projects': '项目管理',
}

export function Breadcrumb() {
  const location = useLocation()
  const paths = location.pathname.split('/').filter(Boolean)

  if (paths.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Home className="h-4 w-4 text-[#00d4aa]" />
        <span className="text-[#00d4aa] font-medium">{ROUTE_LABELS['/']}</span>
      </div>
    )
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        to="/"
        className={cn(
          'flex items-center gap-1.5 transition-colors',
          location.pathname === '/'
            ? 'text-[#00d4aa]'
            : 'text-[#94a3b8] hover:text-white',
        )}
      >
        <Home className="h-4 w-4" />
      </Link>
      {paths.map((path, index) => {
        const href = `/${paths.slice(0, index + 1).join('/')}`
        const isLast = index === paths.length - 1
        const label = ROUTE_LABELS[href] || decodeURIComponent(path)

        return (
          <div key={href} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-[#475569]" />
            <Link
              to={href}
              className={cn(
                'transition-colors',
                isLast
                  ? 'text-[#00d4aa] font-medium'
                  : 'text-[#94a3b8] hover:text-white',
              )}
            >
              {label}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
