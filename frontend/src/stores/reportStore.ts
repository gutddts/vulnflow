import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ReportStatus = 'completed' | 'generating' | 'draft' | 'failed'
export type ReportFormat = 'pdf' | 'html' | 'markdown' | 'json'

export interface ReportFindingSummary {
  critical: number
  high: number
  medium: number
  low: number
  info: number
  total: number
}

export interface Report {
  id: string
  title: string
  description: string
  status: ReportStatus
  format: ReportFormat
  author: string
  created_at: string
  generated_at?: string
  // 完整内容（AI 对话生成）
  content?: string
  // 关联信息
  source?: 'manual' | 'chat' | 'workflow' | 'task'
  source_ref?: string  // 关联的 chat session id / workflow id / task id
  target?: string      // 报告目标
  severity_summary: ReportFindingSummary
  tags: string[]
  // 漏洞列表（关联到 findingStore）
  finding_ids?: string[]
  // 元数据
  workflow_name?: string
  progress?: number  // 0-100，生成中时显示
}

interface ReportState {
  reports: Report[]
  addReport: (report: Omit<Report, 'id' | 'created_at'>) => Report
  updateReport: (id: string, updates: Partial<Report>) => void
  removeReport: (id: string) => void
  /** 从 AI 对话内容创建报告 */
  createFromChat: (params: {
    title: string
    content: string
    target?: string
    source_session_id?: string
    severity_summary?: ReportFindingSummary
    tags?: string[]
  }) => Report
}

let counter = 1000
const newId = () => `rpt-${Date.now()}-${counter++}`

const defaultReports: Report[] = []

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      reports: defaultReports,

      addReport: (report) => {
        const newReport: Report = {
          ...report,
          id: newId(),
          created_at: new Date().toISOString(),
        }
        set((state) => ({ reports: [newReport, ...state.reports] }))
        return newReport
      },

      updateReport: (id, updates) => {
        set((state) => ({
          reports: state.reports.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }))
      },

      removeReport: (id) => {
        set((state) => ({ reports: state.reports.filter((r) => r.id !== id) }))
      },

      createFromChat: ({ title, content, target, source_session_id, severity_summary, tags }) => {
        const newReport: Report = {
          id: newId(),
          title,
          description: `AI 对话生成的报告 - ${target || '未指定目标'}`,
          status: 'completed',
          format: 'markdown',
          author: 'admin',
          content,
          source: 'chat',
          source_ref: source_session_id,
          target,
          severity_summary: severity_summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
          tags: tags || ['ai-generated', 'chat'],
          created_at: new Date().toISOString(),
          generated_at: new Date().toISOString(),
        }
        set((state) => ({ reports: [newReport, ...state.reports] }))
        return newReport
      },
    }),
    {
      name: 'vulnflow-reports-v2',
      partialize: (state) => ({ reports: state.reports }),
    },
  ),
)

