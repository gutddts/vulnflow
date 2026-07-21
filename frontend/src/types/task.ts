export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskType =
  | 'scan'
  | 'exploit'
  | 'recon'
  | 'report'
  | 'custom'
  | 'workflow'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  name: string
  description: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  project_id: string
  workflow_id?: string
  assigned_to?: string
  created_by: string
  target: string
  parameters: Record<string, unknown>
  progress: number
  started_at?: string
  completed_at?: string
  estimated_duration?: number
  actual_duration?: number
  error_message?: string
  retry_count: number
  max_retries: number
  created_at: string
  updated_at: string
  tags: string[]
}

export interface TaskLog {
  id: string
  task_id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug' | 'success'
  message: string
  source?: string
  metadata?: Record<string, unknown>
}

export interface TaskResult {
  task_id: string
  success: boolean
  summary: string
  findings: TaskFinding[]
  artifacts: TaskArtifact[]
  duration: number
}

export interface TaskFinding {
  id: string
  title: string
  description: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  category: string
  cve_id?: string
  cvss_score?: number
  evidence: string
  remediation: string
  affected_target: string
  discovered_at: string
}

export interface TaskArtifact {
  id: string
  name: string
  type: string
  size: number
  mime_type: string
  url: string
  created_at: string
}

export interface TaskStats {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  cancelled: number
  success_rate: number
  avg_duration: number
}
