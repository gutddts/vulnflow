import { Link } from 'react-router-dom'
import { Home, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="text-center space-y-6">
        {/* 404 visual */}
        <div className="relative inline-block">
          <div className="text-[120px] font-bold leading-none bg-gradient-to-r from-[#00d4aa] via-[#7c3aed] to-[#ff3385] bg-clip-text text-transparent opacity-20 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4aa]/20 to-[#7c3aed]/20 border border-[#1e293b]">
              <Shield className="h-10 w-10 text-[#00d4aa]" />
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">页面未找到</h1>
          <p className="text-sm text-[#94a3b8] mt-2 max-w-md mx-auto">
            您访问的页面不存在或已被移除。请检查 URL 是否正确，或返回首页。
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button className="bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.2)]">
              <Home className="h-4 w-4 mr-1.5" />
              返回首页
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e]"
            onClick={() => window.history.back()}
          >
            返回上页
          </Button>
        </div>

        {/* Decorative elements */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#64748b]">
          <span>VulnFlow</span>
          <span>·</span>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  )
}
