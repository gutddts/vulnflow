import { CATEGORY_MAP } from '@/lib/constants'
import { SearchInput } from '@/components/common/SearchInput'
import { cn } from '@/lib/utils'
import type { SkillCategory } from '@/types/skill'

interface SkillSearchProps {
  search: string
  onSearchChange: (value: string) => void
  selectedCategory: SkillCategory | 'all'
  onCategoryChange: (category: SkillCategory | 'all') => void
}

const CATEGORIES = Object.entries(CATEGORY_MAP) as [SkillCategory, typeof CATEGORY_MAP[SkillCategory]][]

export function SkillSearch({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: SkillSearchProps) {
  return (
    <div className="space-y-4">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="搜索技能名称、描述或标签..."
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange('all')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            selectedCategory === 'all'
              ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30'
              : 'bg-[#111827] text-[#94a3b8] border border-[#1e293b] hover:text-white hover:border-[#334155]',
          )}
        >
          全部
        </button>
        {CATEGORIES.map(([key, config]) => {
          const Icon = config.icon
          return (
            <button
              key={key}
              onClick={() => onCategoryChange(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                selectedCategory === key
                  ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1e293b] hover:text-white hover:border-[#334155]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
