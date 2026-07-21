export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  status: 'idle' | 'running' | 'completed' | 'failed' | 'skipped'
}

export type WorkflowNodeType =
  | 'nmap_scan'
  | 'vulnerability_scan'
  | 'exploit'
  | 'post_exploit'
  | 'report'
  | 'decision'
  | 'input'
  | 'output'
  | 'skill_execution'
  | 'data_collection'
  | 'mcp_tool'

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  project_id: string
  status: 'draft' | 'running' | 'completed' | 'failed' | 'paused'
  created_at: string
  updated_at: string
  created_by: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  icon: string
  usage_count: number
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at?: string
  current_node?: string
  progress: number
  logs: ExecutionLog[]
}

export interface ExecutionLog {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  node_id?: string
  message: string
}
