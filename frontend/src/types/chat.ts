export type ChatRole = 'user' | 'assistant' | 'system' | 'tool'

export type ChatMessageType = 'text' | 'tool_call' | 'tool_result' | 'skill_execution' | 'error' | 'action_vuln' | 'action_phase'

export interface ChatMessage {
  id: string
  session_id: string
  role: ChatRole
  content: string
  type: ChatMessageType
  created_at: string
  metadata?: ChatMessageMetadata
  streaming?: boolean
}

export interface ChatMessageMetadata {
  tool_calls?: ToolCall[]
  skill_execution?: SkillExecutionInfo
  attack_path?: AttackPathStep[]
  model?: string
  tokens?: TokenUsage
  /** AI 推理/思考过程（如 DeepSeek reasoning_content） */
  reasoning?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
  error?: string
  started_at?: string
  completed_at?: string
}

export interface SkillExecutionInfo {
  skill_id: string
  skill_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  findings: number
}

export interface AttackPathStep {
  order: number
  action: string
  target: string
  result: string
  status: 'success' | 'failed' | 'in_progress' | 'pending'
  timestamp?: string
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatSession {
  id: string
  title: string
  project_id: string
  model: string
  created_at: string
  updated_at: string
  message_count: number
  last_message?: string
}

export interface ChatContext {
  project_id?: string
  target?: string
  scope?: string[]
  active_skills?: string[]
  active_workflow_id?: string
}
