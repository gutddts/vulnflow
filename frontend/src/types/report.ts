export type ReportStatus = 'draft' | 'generating' | 'completed' | 'failed'

export type ReportFormat = 'pdf' | 'html' | 'markdown' | 'json'

export interface Report {
  id: string
  title: string
  description: string
  project_id: string
  task_id?: string
  workflow_id?: string
  status: ReportStatus
  format: ReportFormat
  author: string
  severity_summary: SeveritySummary
  executive_summary: string
  findings: ReportFinding[]
  sections: ReportSection[]
  attachments: ReportAttachment[]
  generated_at?: string
  created_at: string
  updated_at: string
  tags: string[]
}

export interface SeveritySummary {
  critical: number
  high: number
  medium: number
  low: number
  info: number
  total: number
}

export interface ReportFinding {
  id: string
  title: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  technical_details: string
  impact: string
  likelihood: string
  remediation: string
  references: string[]
  cve_ids: string[]
  cvss_score?: number
  cvss_vector?: string
  affected_systems: string[]
  proof_of_concept?: string
  discovered_at: string
}

export interface ReportSection {
  id: string
  title: string
  content: string
  order: number
  subsections?: ReportSection[]
}

export interface ReportAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  description?: string
}

export interface ReportTemplate {
  id: string
  name: string
  description: string
  sections: ReportSection[]
  is_default: boolean
  created_at: string
}
