import { useChatStore, type ChatSession } from '@/stores/chatStore'
import type { ChatMessage } from '@/types/chat'

// 3 个初始 demo 会话（启动时自动加载）
const SEED_SESSIONS: ChatSession[] = [
  {
    id: 's-demo-1',
    title: 'example.com 渗透测试',
    project_id: 'proj-1',
    model: 'gpt-4o',
    created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
    message_count: 6,
  },
  {
    id: 's-demo-2',
    title: '内网安全审计',
    project_id: 'proj-2',
    model: 'claude-3.5-sonnet',
    created_at: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 60000).toISOString(),
    message_count: 12,
  },
  {
    id: 's-demo-3',
    title: 'API 安全测试方案',
    project_id: 'proj-3',
    model: 'deepseek-v4-pro',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
    message_count: 4,
  },
]

const SEED_MESSAGES: Record<string, ChatMessage[]> = {
  's-demo-1': [
    {
      id: 'm-d1-1', session_id: 's-demo-1', role: 'user', type: 'text',
      content: '帮我对 example.com 做一个完整的安全评估', created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: 'm-d1-2', session_id: 's-demo-1', role: 'assistant', type: 'text',
      content: '好的！我将对 example.com 进行完整的安全评估。已为您创建以下计划：\n\n1. **信息收集**：Whois、DNS、子域名枚举\n2. **端口扫描**：Nmap 全端口扫描\n3. **漏洞检测**：Web 应用 + 服务漏洞\n4. **漏洞利用**：验证高危漏洞\n5. **报告生成**：汇总所有发现\n\n预计耗时 2 小时，是否开始？',
      created_at: new Date(Date.now() - 29 * 60000).toISOString(),
    },
    {
      id: 'm-d1-3', session_id: 's-demo-1', role: 'user', type: 'text',
      content: '开始吧', created_at: new Date(Date.now() - 28 * 60000).toISOString(),
    },
    {
      id: 'm-d1-4', session_id: 's-demo-1', role: 'assistant', type: 'text',
      content: '扫描任务已启动...', created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: 'm-d1-5', session_id: 's-demo-1', role: 'assistant', type: 'text',
      content: '🔍 信息收集完成\n\n• 域名: example.com\n• IP: 93.184.216.34\n• 注册商: GoDaddy\n• 子域: 12 个已发现\n• 开放端口: 22, 80, 443, 8080\n\n下一步开始漏洞扫描。', created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    },
    {
      id: 'm-d1-6', session_id: 's-demo-1', role: 'assistant', type: 'text',
      content: '🎯 漏洞扫描完成，发现 3 个高危漏洞：\n\n1. SQL 注入（登录页）\n2. 硬编码 API 密钥\n3. CORS 配置错误\n\n请查看「漏洞管理」页面获取详情。',
      created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    },
  ],
  's-demo-2': [
    {
      id: 'm-d2-1', session_id: 's-demo-2', role: 'user', type: 'text',
      content: '扫描内网网段 192.168.1.0/24', created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
    },
    {
      id: 'm-d2-2', session_id: 's-demo-2', role: 'assistant', type: 'text',
      content: '已启动 Nmap 全端口扫描，发现 23 台活跃主机，其中 3 台存在高危漏洞。',
      created_at: new Date(Date.now() - 90 * 60000).toISOString(),
    },
  ],
  's-demo-3': [
    {
      id: 'm-d3-1', session_id: 's-demo-3', role: 'user', type: 'text',
      content: '设计一个 API 安全测试方案', created_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
    },
    {
      id: 'm-d3-2', session_id: 's-demo-3', role: 'assistant', type: 'text',
      content: '建议从以下维度进行 API 安全测试：身份认证、授权、输入验证、速率限制、日志审计、加密传输...',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60000 + 1000).toISOString(),
    },
  ],
}

// 一次性 seed（避免 HMR 重复）
let seeded = false
export function ensureSeedData() {
  if (seeded) return
  const state = useChatStore.getState()
  if (state.sessions.length === 0) {
    useChatStore.setState({
      sessions: SEED_SESSIONS,
      sessionMessages: SEED_MESSAGES,
    })
  }
  seeded = true
}

