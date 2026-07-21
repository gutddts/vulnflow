import { create } from 'zustand'

/** AI 自主决定的渗透测试阶段 */
export interface AIPhase {
  name: string
  status: 'running' | 'completed' | 'failed'
  findings: string[]
}

export interface PenTestState {
  target: string
  active: boolean
  phases: AIPhase[]
  totalFindings: number
}

interface PenTestStore {
  state: PenTestState | null
  startPentest: (target: string) => void
  completePhase: (name: string) => void
  addPhase: (name: string) => void
  addFinding: (phase: string, title: string) => void
  endPentest: () => void
}

export const usePenTestStore = create<PenTestStore>((set) => ({
  state: null,

  startPentest: (target) => {
    set({ state: { target, active: true, phases: [], totalFindings: 0 } })
  },

  addPhase: (name) =>
    set((s) => {
      if (!s.state) return s
      return { state: { ...s.state, phases: [...s.state.phases, { name, status: 'running', findings: [] }] } }
    }),

  completePhase: (name) =>
    set((s) => {
      if (!s.state) return s
      return {
        state: {
          ...s.state,
          phases: s.state.phases.map((p) => (p.name === name ? { ...p, status: 'completed' as const } : p)),
        },
      }
    }),

  addFinding: (phase, title) =>
    set((s) => {
      if (!s.state) return s
      return {
        state: {
          ...s.state,
          totalFindings: s.state.totalFindings + 1,
          phases: s.state.phases.map((p) =>
            p.name === phase ? { ...p, findings: [...p.findings, title] } : p
          ),
        },
      }
    }),

  endPentest: () =>
    set((s) => {
      if (!s.state) return s
      return { state: { ...s.state, active: false } }
    }),
}))
