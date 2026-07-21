export interface DashboardMetrics {
  total_projects: number
  active_tasks: number
  completed_tasks: number
  total_vulnerabilities: number
  critical_vulnerabilities: number
  high_vulnerabilities: number
  skills_available: number
  skills_executed: number
  reports_generated: number
  scan_coverage: number
  avg_response_time: number
}

export interface DashboardChartData {
  label: string
  value: number
  color: string
}

export interface ActivityItem {
  id: string
  type: 'task_completed' | 'vulnerability_found' | 'scan_started' | 'report_generated' | 'skill_executed' | 'user_login'
  title: string
  description: string
  timestamp: string
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical'
  project_id?: string
  task_id?: string
}

export interface SeverityDistribution {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface TimeSeriesData {
  date: string
  scans: number
  vulnerabilities: number
  exploits: number
}

export interface TopVulnerability {
  name: string
  count: number
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  trend: 'up' | 'down' | 'stable'
}

export interface ProjectSummary {
  id: string
  name: string
  status: 'active' | 'completed' | 'archived'
  vulnerability_count: number
  last_scan: string
  progress: number
}
