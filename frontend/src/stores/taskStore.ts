import { create } from 'zustand'
import type { Task, TaskStatus } from '@/types/task'

// 攻击链的 5 个固定阶段（与任务 type 字段对应）
export const ATTACK_CHAIN_STAGES = [
  { type: 'recon', label: '侦察', icon: '🔍', desc: '信息收集' },
  { type: 'scan', label: '漏洞扫描', icon: '🎯', desc: '漏洞检测' },
  { type: 'exploit', label: '漏洞利用', icon: '⚡', desc: '渗透攻击' },
  { type: 'post_exploit', label: '后渗透', icon: '🛡️', desc: '权限提升' },
  { type: 'report', label: '报告', icon: '📊', desc: '汇总输出' },
] as const

export type AttackChainStageType = (typeof ATTACK_CHAIN_STAGES)[number]['type']

interface TaskState {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  addTask: (task: Task) => void
  getTask: (id: string) => Task | undefined
  // 新增：自动推进 running 任务的进度（模拟实时执行）
  tickProgress: () => void
}

const INITIAL_TASKS: Task[] = [
  {
    id: '1', name: '全面安全扫描 - 192.168.1.0/24', description: '对内部网络进行全面安全扫描',
    type: 'scan', status: 'running', priority: 'high', project_id: 'proj-1',
    target: '192.168.1.0/24', parameters: {}, progress: 67,
    started_at: new Date().toISOString(), estimated_duration: 1800,
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['scan', 'network'],
  },
  {
    id: '2', name: 'Web 应用漏洞检测 - example.com', description: '针对 Web 应用的漏洞扫描',
    type: 'scan', status: 'completed', priority: 'critical', project_id: 'proj-1',
    target: 'example.com', parameters: {}, progress: 100,
    started_at: new Date(Date.now() - 3600_000).toISOString(),
    completed_at: new Date().toISOString(),
    estimated_duration: 3600, actual_duration: 5400,
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['web', 'scan'],
  },
  {
    id: '3', name: 'SQL 注入利用测试', description: '对发现的 SQL 注入漏洞进行利用验证',
    type: 'exploit', status: 'running', priority: 'high', project_id: 'proj-2',
    target: 'db.example.com', parameters: {}, progress: 45,
    started_at: new Date().toISOString(), estimated_duration: 1200,
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['sql', 'exploit'],
  },
  {
    id: '4', name: '生成渗透测试报告', description: '汇总所有发现并生成最终报告',
    type: 'report', status: 'pending', priority: 'medium', project_id: 'proj-1',
    target: '-', parameters: {}, progress: 0,
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['report'],
  },
  {
    id: '5', name: 'AWS S3 存储桶审计', description: '检查 S3 存储桶的公开访问权限',
    type: 'scan', status: 'queued', priority: 'medium', project_id: 'proj-3',
    target: 'aws-s3', parameters: {}, progress: 0,
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['aws', 'cloud', 'audit'],
  },
  {
    id: '6', name: 'WiFi 安全审计 - Office', description: '办公区域 WiFi 安全检测',
    type: 'scan', status: 'cancelled', priority: 'low', project_id: 'proj-4',
    target: 'Office-WiFi', parameters: {}, progress: 12,
    started_at: new Date(Date.now() - 86400_000).toISOString(),
    completed_at: new Date(Date.now() - 86340_000).toISOString(),
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date(Date.now() - 86400_000).toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['wifi', 'wireless'],
  },
  {
    id: '7', name: '子域名暴力枚举', description: '使用多字典对目标域进行子域名枚举',
    type: 'recon', status: 'running', priority: 'high', project_id: 'proj-5',
    target: 'example.com', parameters: {}, progress: 34,
    started_at: new Date().toISOString(), estimated_duration: 600,
    retry_count: 0, max_retries: 2, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['subdomain', 'recon'],
  },
  {
    id: '8', name: '权限提升 - 内网漫游', description: '利用已控主机在内网横向移动',
    type: 'post_exploit', status: 'pending', priority: 'high', project_id: 'proj-1',
    target: 'internal-net', parameters: {}, progress: 0,
    retry_count: 0, max_retries: 3, created_by: 'admin',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    tags: ['lateral', 'privesc'],
  },
]

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: INITIAL_TASKS,
  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t,
      ),
    })),

  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  getTask: (id) => get().tasks.find((t) => t.id === id),

  // 每 1.5s 给 running 任务 +5% 进度，到 100% 自动转 completed
  tickProgress: () => {
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.status !== 'running') return t
        const next = Math.min(100, t.progress + 5)
        if (next >= 100) {
          return {
            ...t,
            progress: 100,
            status: 'completed' as TaskStatus,
            completed_at: new Date().toISOString(),
            actual_duration: t.estimated_duration || 0,
            updated_at: new Date().toISOString(),
          }
        }
        return { ...t, progress: next, updated_at: new Date().toISOString() }
      }),
    }))
  },
}))

// 启动全局进度定时器（在模块加载时启动一次，整个应用共享）
if (typeof window !== 'undefined') {
  // 避免 HMR 重复注册
  const w = window as unknown as { __taskProgressInterval?: number }
  if (!w.__taskProgressInterval) {
    w.__taskProgressInterval = window.setInterval(() => {
      useTaskStore.getState().tickProgress()
    }, 1500)
  }
}
