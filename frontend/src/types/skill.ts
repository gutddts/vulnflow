export type SkillCategory =
  | 'reconnaissance'
  | 'scanning'
  | 'exploitation'
  | 'post_exploitation'
  | 'social_engineering'
  | 'web_application'
  | 'network'
  | 'wireless'
  | 'cloud'
  | 'cryptography'
  | 'forensics'
  | 'reporting'

export type SkillSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type SkillStatus = 'active' | 'deprecated' | 'beta' | 'coming_soon'

export interface SkillParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'target' | 'port'
  label: string
  description: string
  required: boolean
  default?: unknown
  options?: { label: string; value: string }[]
  placeholder?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface Skill {
  id: string
  name: string
  display_name: string
  description: string
  long_description: string
  category: SkillCategory
  severity: SkillSeverity
  status: SkillStatus
  icon: string
  author: string
  version: string
  parameters: SkillParameter[]
  dependencies: string[]
  estimated_time: number
  risk_level: 'low' | 'medium' | 'high'
  tags: string[]
  usage_count: number
  success_rate: number
  created_at: string
  updated_at: string
}

export interface SkillExecution {
  id: string
  skill_id: string
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  parameters: Record<string, unknown>
  started_at?: string
  completed_at?: string
  output?: string
  error?: string
  progress: number
}

export interface SkillResult {
  execution_id: string
  success: boolean
  output: string
  findings: SkillFinding[]
  artifacts: SkillArtifact[]
  duration: number
}

export interface SkillFinding {
  id: string
  type: 'vulnerability' | 'information' | 'warning' | 'error'
  title: string
  description: string
  severity: SkillSeverity
  cve_id?: string
  cvss_score?: number
  evidence: string
  remediation?: string
}

export interface SkillArtifact {
  id: string
  name: string
  type: string
  size: number
  url: string
  created_at: string
}
