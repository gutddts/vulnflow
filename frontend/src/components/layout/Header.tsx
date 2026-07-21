import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  LogOut,
  Settings,
  User,
  Sun,
  Moon,
  Plus,
  Server,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Breadcrumb } from './Breadcrumb'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTheme } from '@/hooks/useTheme'
import { getInitials, cn } from '@/lib/utils'
import { toast } from 'sonner'

export function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { currentProject } = useProjectStore()
  const { isDark, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#1e293b] bg-[#0d1321]/80 backdrop-blur-sm px-6">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-4">
        <Breadcrumb />
      </div>

      {/* Center: Project selector */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e] hover:border-[#00d4aa]/30 hover:text-[#00d4aa]"
          onClick={() => navigate('/projects')}
        >
          <Plus className="mr-2 h-4 w-4" />
          {currentProject ? currentProject.name : '选择项目'}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[#94a3b8] hover:text-white hover:bg-[#1a1f2e]"
          onClick={toggleTheme}
          title={isDark ? '切换到亮色' : '切换到暗色'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[#1a1f2e] transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-cyber-cyan/30">
                <AvatarFallback className="bg-gradient-to-br from-cyber-cyan to-purple-500 text-black text-sm font-bold">
                  {user ? getInitials(user.username || user.email) : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-white">{user?.username || '用户'}</span>
              <ChevronDown className="h-4 w-4 text-[#94a3b8]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 border-[#1e293b] bg-[#0d1321] text-[#e2e8f0]"
          >
            <DropdownMenuLabel className="text-[#94a3b8]">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#1e293b]" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => navigate('/projects')}
                className="cursor-pointer focus:bg-[#1a1f2e] focus:text-white"
              >
                <Server className="mr-2 h-4 w-4" />
                切换项目
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/settings')}
                className="cursor-pointer focus:bg-[#1a1f2e] focus:text-white"
              >
                <Settings className="mr-2 h-4 w-4" />
                设置
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/skills')}
                className="cursor-pointer focus:bg-[#1a1f2e] focus:text-white"
              >
                <User className="mr-2 h-4 w-4" />
                技能市场
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-[#1e293b]" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

