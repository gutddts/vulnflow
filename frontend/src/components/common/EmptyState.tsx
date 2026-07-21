import { type LucideIcon, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1f2e] border border-[#1e293b] mb-4">
        <Icon className="h-8 w-8 text-[#475569]" />
      </div>
      <h3 className="text-lg font-medium text-[#e2e8f0]">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[#94a3b8] max-w-sm">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-4 bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
