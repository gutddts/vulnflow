import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Finding {
  id: string
  title: string
  description: string
  severity: SeverityLevel
  target: string
  task_id?: string
  project_id?: string
  cve_id?: string
  cvss_score?: number
  status: 'open' | 'confirmed' | 'mitigated' | 'false_positive'
  discovered_at: string
  tags: string[]
  evidence?: string
  remediation?: string
}

interface FindingState {
  findings: Finding[]
  // 按严重性分布（自动派生，但暴露 set 用于手动调整）
  setFindings: (findings: Finding[]) => void
  addFinding: (finding: Omit<Finding, 'id' | 'discovered_at' | 'status'>) => void
  removeFinding: (id: string) => void
  updateFinding: (id: string, updates: Partial<Finding>) => void
  // 自动从 task 进度模拟发现漏洞（task type=exploit 且 progress 推进时调用）
  generateFromTasks: (tasks: { id: string; type: string; target: string; progress: number }[]) => void
}

const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
}

const DEFAULT_FINDINGS: Finding[] = []

let counter = 1000
const newId = () => `f-auto-${Date.now()}-${counter++}`

export const useFindingStore = create<FindingState>()(
  persist(
    (set, get) => ({
      findings: DEFAULT_FINDINGS,
      setFindings: (findings) => set({ findings }),
      addFinding: (finding) =>
        set((state) => ({
          findings: [
            {
              id: newId(),
              discovered_at: new Date().toISOString(),
              status: 'open',
              ...finding,
            },
            ...state.findings,
          ],
        })),
      removeFinding: (id) =>
        set((state) => ({ findings: state.findings.filter((f) => f.id !== id) })),
      updateFinding: (id, updates) =>
        set((state) => ({
          findings: state.findings.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),
      // 根据 task 进度自动派生漏洞
      generateFromTasks: (tasks) => {
        const exploitTasks = tasks.filter((t) => t.type === 'exploit' && t.progress >= 30)
        const currentIds = new Set(get().findings.filter((f) => f.task_id).map((f) => f.task_id))
        exploitTasks.forEach((t) => {
          if (currentIds.has(t.id)) return
          // 根据进度决定严重性
          let severity: SeverityLevel = 'low'
          if (t.progress >= 90) severity = 'critical'
          else if (t.progress >= 70) severity = 'high'
          else if (t.progress >= 50) severity = 'medium'
          else severity = 'low'
          get().addFinding({
            title: `${t.target} 漏洞利用发现`,
            description: `通过自动化渗透发现，任务进度 ${t.progress}%`,
            severity,
            target: t.target,
            task_id: t.id,
            tags: ['auto', 'exploit'],
          })
        })
      },
    }),
    {
      name: 'vulnflow-findings-v2',
      partialize: (state) => ({ findings: state.findings }),
    },
  ),
)

// 派生：按严重性统计
export function useSeverityStats() {
  const findings = useFindingStore((s) => s.findings)
  const stats = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  }
  findings.forEach((f) => {
    stats[f.severity]++
    stats.total++
  })
  return stats
}

