import { useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ChatMessage } from '@/types/chat'

interface LLMConfig {
  provider: string
  model: string
  apiBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
  apiKey: string
  temperature: number
  maxTokens: number
}

/** 从 settingsStore 读取当前 AI 连接配置 */
export function getLLMConfig(): LLMConfig {
  const s = useSettingsStore.getState()
  return {
    provider: s.provider,
    model: s.model,
    apiBaseUrl: s.apiBaseUrl,
    apiFormat: s.apiFormat,
    apiKey: s.apiKeys[s.provider] || '',
    temperature: s.temperature,
    maxTokens: s.maxTokens,
  }
}

/** 调用 OpenAI 兼容格式的 API */
export async function callOpenAI(config: LLMConfig, messages: { role: string; content: string }[]): Promise<string> {
  // OpenAI 格式：保留原路径，追加 /chat/completions
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  const body = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`API 请求失败 (${res.status}): ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  // 兼容 OpenAI 和 Anthropic 两种响应格式
  return extractContent(data)
}

/** 从 API 响应里提取内容（兼容 OpenAI / Anthropic 两种格式） */
function extractContent(data: any): string {
  // OpenAI 格式: { choices: [{ message: { content: "..." } }] }
  const openaiContent = data?.choices?.[0]?.message?.content
  if (openaiContent && typeof openaiContent === 'string') return openaiContent

  // OpenAI 兼容（含 reasoning_content 字段，DeepSeek 会用）
  const openaiReasoning = data?.choices?.[0]?.message?.reasoning_content
  if (openaiReasoning && typeof openaiReasoning === 'string' && !openaiContent) return openaiReasoning

  // Anthropic 格式: { content: [{ type: "text", text: "..." }] }
  if (Array.isArray(data?.content)) {
    const text = data.content
      .filter((c: any) => c?.type === 'text' || typeof c?.text === 'string')
      .map((c: any) => c.text)
      .filter(Boolean)
      .join('\n')
    if (text) return text
  }

  // 兜底：返回原始 JSON 让用户看到服务端实际响应
  console.warn('无法解析 API 响应，原始数据:', JSON.stringify(data).slice(0, 500))
  return ''
}

/** 调用 Anthropic 兼容格式的 API */
export async function callAnthropic(config: LLMConfig, messages: { role: string; content: string }[]): Promise<string> {
  // Anthropic 格式：保留原路径（如 /anthropic），追加 /messages
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/messages`
  const systemMsg = messages.find((m) => m.role === 'system')
  const userMsgs = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    messages: userMsgs.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  }
  if (systemMsg) body.system = systemMsg.content

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic API 请求失败 (${res.status}): ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return extractContent(data)
}

/** 系统提示词：让 AI 知道自己是什么 */
const SYSTEM_PROMPT = `你是 VulnFlow AI 渗透测试助手，一个专业的安全测试智能体。

能力范围：
- 渗透测试方案设计与执行
- 漏洞分析（SQL注入、XSS、SSRF、RCE 等）
- 安全工具使用指导（Nmap、sqlmap、Burp Suite 等）
- 安全报告生成
- 代码审计与安全修复建议

回答风格：专业、简洁、实用，直接给出可操作的建议。如果需要工具命令，直接给出可执行的命令。`

/**
 * 直接请求 AI 的通用函数（不依赖 hook，可在任意位置调用）
 * 内部读取 settingsStore 的配置，自动切换 OpenAI / Anthropic 格式
 */
export async function requestAI(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getLLMConfig()
  const messages: { role: string; content: string }[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  if (config.apiFormat === 'anthropic') {
    return await callAnthropic(config, messages)
  }
  return await callOpenAI(config, messages)
}

export function useLLM() {
  const sendToLLM = useCallback(async (
    userMessage: string,
    history: Pick<ChatMessage, 'role' | 'content'>[],
  ): Promise<string> => {
    const config = getLLMConfig()

    if (!config.apiKey) {
      // 无 API Key 时返回提示
      return `⚠️ 请先在「设置 → AI 模型配置」中配置 API 密钥。\n\n当前配置：\n- 提供商：${config.provider}\n- 模型：${config.model}\n- API 地址：${config.apiBaseUrl}`
    }

    // 构建消息历史（取最近的 20 条 + 系统提示）
    const recentHistory = history.slice(-20)
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...recentHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    try {
      let reply: string
      if (config.apiFormat === 'anthropic') {
        reply = await callAnthropic(config, messages)
      } else {
        reply = await callOpenAI(config, messages)
      }
      return reply || '(AI 返回了空回复)'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `❌ AI 请求失败：${msg}\n\n请检查「设置 → AI 模型配置」中的连接参数是否正确。`
    }
  }, [])

  const config = getLLMConfig()
  const isConfigured = !!config.apiKey

  return { sendToLLM, isConfigured, config }
}
