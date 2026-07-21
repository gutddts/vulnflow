import { SkillCard } from './SkillCard'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Puzzle } from 'lucide-react'
import type { Skill } from '@/types/skill'

interface SkillGridProps {
  skills: Skill[]
  isLoading: boolean
  onDelete?: (id: string) => void
}

export function SkillGrid({ skills, isLoading, onDelete }: SkillGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" text="加载技能列表..." />
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Puzzle}
        title="暂无技能"
        description="当前分类下没有找到相关技能，请尝试其他筛选条件。"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} onDelete={onDelete} />
      ))}
    </div>
  )
}
