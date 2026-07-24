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

/** 流式调用 OpenAI —— 逐 token 返回 */
export async function* streamOpenAI(config: LLMConfig, messages: { role: string; content: string }[]): AsyncGenerator<string> {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  const body = {
    model: config.model,
    stream: true,
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
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '')
    throw new Error(`流式 API 请求失败 (${res.status}): ${err.slice(0, 200)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t || !t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const obj = JSON.parse(data)
        const delta = obj?.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch { /* 忽略解析失败的数据行 */ }
    }
  }
}

/** 流式调用 Anthropic —— 逐 token 返回 */
export async function* streamAnthropic(config: LLMConfig, messages: { role: string; content: string }[]): AsyncGenerator<string> {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/messages`
  const systemMsg = messages.find((m) => m.role === 'system')
  const userMsgs = messages.filter((m) => m.role !== 'system')
  const body = {
    model: config.model,
    stream: true,
    system: systemMsg?.content || '',
    messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic 流式请求失败 (${res.status}): ${err.slice(0, 200)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t || !t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      try {
        const obj = JSON.parse(data)
        if (obj.type === 'content_block_delta' && obj.delta?.text) yield obj.delta.text
      } catch { /* 忽略 */ }
    }
  }
}

/** 流式调用统一入口 */
export async function* streamToAI(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig,
): AsyncGenerator<string> {
  const messages: { role: string; content: string }[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })
  if (config.apiFormat === 'anthropic') {
    yield* streamAnthropic(config, messages)
  } else {
    yield* streamOpenAI(config, messages)
  }
}

/** 非流式调用 OpenAI */
export async function callOpenAI(config: LLMConfig, messages: { role: string; content: string }[]): Promise<string> {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  const body = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  }

  // 策略：先试后端代理（绕过 CORS），失败则直连
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  }

  const doFetch = async (fetchUrl: string, fetchHeaders: Record<string, string>, signal: AbortSignal): Promise<string> => {
    console.log('[callOpenAI] Fetching:', fetchUrl, 'model:', config.model, 'prompt length:', JSON.stringify(body).length)
    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(body),
      signal,
    })
    console.log('[callOpenAI] Response status:', res.status)
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`API 请求失败 (${res.status}): ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    return extractContent(data)
  }

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 90000)
  const signal = abort.signal

  try {
    // 先用后端代理（本地 localhost:8000，没有 CORS 问题）
    const proxyUrl = `/api/v1/ai/chat`
    const proxyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const proxyBody = { url, method: 'POST', headers, body }
    console.log('[callOpenAI] Trying backend proxy...')
    const proxyRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify(proxyBody),
      signal,
    })
    console.log('[callOpenAI] Proxy response:', proxyRes.status)
    clearTimeout(timer)

    if (proxyRes.ok) {
      const proxyData = await proxyRes.json()
      if (proxyData.data) return extractContent(proxyData.data)
      if (proxyData.error) throw new Error(proxyData.error)
      throw new Error('代理返回格式异常')
    }
    // 代理失败，降级到直连
    console.log('[callOpenAI] Proxy failed, falling back to direct...')
    return await doFetch(url, headers, signal)
  } catch (err: any) {
    clearTimeout(timer)
    console.error('[callOpenAI] Error:', err?.name, err?.message)
    if (err?.name === 'AbortError') throw new Error('AI 请求超时（90 秒）—— 请检查网络或更换模型')
    // 尝试直连兜底
    if (err?.message?.includes('代理')) {
      console.log('[callOpenAI] Proxy error, retrying direct...')
      return await doFetch(url, headers, abort.signal)
    }
    throw err
  }
}

/** 从 API 响应里提取内容（兼容 OpenAI / Anthropic 两种格式），缓存推理过程 */

// 全局推理过程缓存
let _lastReasoningCache: string | undefined

export function getLastReasoning(): string | undefined {
  return _lastReasoningCache
}

function extractContent(data: any): string {
  const msg = data?.choices?.[0]?.message
  const openaiContent = msg?.content
  const openaiReasoning = msg?.reasoning_content

  // 缓存推理过程
  if (openaiReasoning && typeof openaiReasoning === 'string') {
    _lastReasoningCache = openaiReasoning
  } else {
    _lastReasoningCache = undefined
  }

  // OpenAI 内容
  if (openaiContent && typeof openaiContent === 'string') return openaiContent

  // 只有 reasoning（DeepSeek 深度思考模式）
  if (openaiReasoning && typeof openaiReasoning === 'string') return openaiReasoning

  // Anthropic 格式
  if (Array.isArray(data?.content)) {
    const text = data.content
      .filter((c: any) => c?.type === 'text' || typeof c?.text === 'string')
      .map((c: any) => c.text)
      .filter(Boolean)
      .join('\n')
    if (text) return text
  }

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
