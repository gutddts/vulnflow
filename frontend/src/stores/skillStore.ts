import { create } from 'zustand'
import { loadBuiltinSkills, type ParsedSkill } from '@/lib/loadSkills'

interface SkillState {
  skills: ParsedSkill[]
  loading: boolean
  loaded: boolean
  error: string | null
  loadSkills: () => Promise<void>
  getSkill: (id: string) => ParsedSkill | undefined
  getSkillsByCategory: (category: string) => ParsedSkill[]
}

/**
 * 全局 Skills Store —— 把 102 个内置 skill 暴露给所有模块
 * workflowEngine / FindingsPage / ChatWindow 都可以从这里取 skill 详情
 */
export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  loading: false,
  loaded: false,
  error: null,

  loadSkills: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true, error: null })
    try {
      const skills = await loadBuiltinSkills()
      set({ skills, loaded: true, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  getSkill: (id) => {
    return get().skills.find((s) => s.id === id || s.name === id)
  },

  getSkillsByCategory: (category) => {
    return get().skills.filter((s) =>
      s.category === category ||
      s.tags?.some((t) => t.toLowerCase() === category.toLowerCase()),
    )
  },
}))

// 模块加载时立即开始加载
if (typeof window !== 'undefined') {
  useSkillStore.getState().loadSkills()
}
