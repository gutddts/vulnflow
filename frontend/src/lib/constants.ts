import {
  Shield,
  Search,
  Crosshair,
  Terminal,
  Users,
  Globe,
  Network,
  Wifi,
  Cloud,
  Key,
  FileSearch,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import type { SkillCategory } from '@/types/skill'
import type { TaskStatus, TaskPriority } from '@/types/task'

export const APP_NAME = 'VulnFlow'
export const APP_DESCRIPTION = 'AI 驱动的渗透测试智能体平台'
export const APP_VERSION = '1.0.0'

export const CATEGORY_MAP: Record<SkillCategory, { label: string; icon: LucideIcon; color: string }> = {
  reconnaissance: { label: '信息收集', icon: Search, color: 'text-blue-400' },
  scanning: { label: '漏洞扫描', icon: Crosshair, color: 'text-cyan-400' },
  exploitation: { label: '漏洞利用', icon: Terminal, color: 'text-red-400' },
  post_exploitation: { label: '后渗透', icon: Shield, color: 'text-purple-400' },
  social_engineering: { label: '社会工程', icon: Users, color: 'text-orange-400' },
  web_application: { label: 'Web 应用', icon: Globe, color: 'text-green-400' },
  network: { label: '网络', icon: Network, color: 'text-yellow-400' },
  wireless: { label: '无线', icon: Wifi, color: 'text-pink-400' },
  cloud: { label: '云安全', icon: Cloud, color: 'text-indigo-400' },
  cryptography: { label: '密码学', icon: Key, color: 'text-teal-400' },
  forensics: { label: '取证', icon: FileSearch, color: 'text-amber-400' },
  reporting: { label: '报告', icon: FileText, color: 'text-gray-400' },
}

export const SEVERITY_MAP = {
  critical: { label: '严重', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50' },
  high: { label: '高危', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/50' },
  medium: { label: '中危', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' },
  low: { label: '低危', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
  info: { label: '信息', color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/50' },
}

export const TASK_STATUS_MAP: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '等待中', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  queued: { label: '已排队', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  running: { label: '运行中', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  paused: { label: '已暂停', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  completed: { label: '已完成', color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { label: '失败', color: 'text-red-400', bg: 'bg-red-500/20' },
  cancelled: { label: '已取消', color: 'text-gray-400', bg: 'bg-gray-500/20' },
}

export const TASK_PRIORITY_MAP: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: '低', color: 'text-blue-400' },
  medium: { label: '中', color: 'text-yellow-400' },
  high: { label: '高', color: 'text-orange-400' },
  critical: { label: '紧急', color: 'text-red-400' },
}

export const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
}

export const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'deepseek-v3', label: 'DeepSeek V3' },
  { value: 'qwen-max', label: '通义千问 Max' },
  { value: 'glm-4', label: '智谱 GLM-4' },
]
