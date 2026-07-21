import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = '搜索...',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#1e293b] bg-[#111827] py-2.5 pl-10 pr-10 text-sm text-[#e2e8f0] placeholder-[#64748b] outline-none transition-all focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/30"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
