import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

const SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2
        className={cn(
          'animate-spin text-[#00d4aa]',
          SIZE_MAP[size],
        )}
      />
      {text && (
        <p className="text-sm text-[#94a3b8] animate-pulse">{text}</p>
      )}
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-[#1e293b]" />
          <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-t-[#00d4aa] animate-spin" />
        </div>
        <p className="text-sm text-[#94a3b8]">加载中...</p>
      </div>
    </div>
  )
}
