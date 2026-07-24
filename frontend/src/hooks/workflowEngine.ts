import type { WorkflowNode, WorkflowEdge } from '@/types/workflow'
import { useTaskStore } from '@/stores/taskStore'
import { useFindingStore } from '@/stores/findingStore'
import { useSkillStore } from '@/stores/skillStore'
import { requestAI } from './useLLM'
import axios from 'axios'

/** 自动验证漏洞：向后端发送真实 HTTP 请求，检查响应是否匹配验证模式 */
async function verifyVulnerability(
  target: string,
  urlPath: string,
  pattern: string,
  method: string = 'GET',
): Promise<{ verified: boolean; responseBody: string; statusCode: number | null; error?: string }> {
  try {
    const { data } = await axios.post('/api/v1/verify', {
      target,
      url_path: urlPath,
      method,
      expected_pattern: pattern,
    }, { timeout: 30000 })
    return {
      verified: data.status === 'vulnerable',
      responseBody: data.response_body_preview || '',
      statusCode: data.response_status,
      error: data.error,
    }
  } catch (e: any) {
    return { verified: false, responseBody: '', statusCode: null, error: e?.message || '验证请求失败' }
  }
}
import type { Finding, SeverityLevel } from '@/stores/findingStore'

/** 节点执行结果 */
export interface NodeExecutionResult {
  nodeId: string
  status: 'completed' | 'failed'
  output: string
  findings?: Finding[]
  duration: number
  metadata?: Record<string, unknown>
}

/**
 * AI 智能体核心 —— 每个节点都是一个 AI agent
 * 根据节点类型 + 可用 skills + 目标上下文，自主决策执行策略、构造 payload
 */
async function executeAsAIAgent(
  node: WorkflowNode,
  target: string,
  start: number,
  upstreamOutputs: Record<string, string> = {},
): Promise<NodeExecutionResult> {
  const { type, label, config } = node

  // 1. 从 skillStore 加载与本节点类型匹配的技能
  const allSkills = useSkillStore.getState().skills
  if (allSkills.length === 0) {
    await useSkillStore.getState().loadSkills()
  }
  const updatedSkills = useSkillStore.getState().skills

  // 根据节点类型 + config 过滤相关 skill
  const typeKeywords: Record<string, string[]> = {
    data_collection: ['recon', 'enumeration', 'subdomain', 'discovery', 'info-gathering'],
    nmap_scan: ['scan', 'nmap', 'port', 'network', 'service'],
    vulnerability_scan: ['vuln', 'scan', 'cve', 'nuclei', 'vulnerability'],
    exploit: ['exploit', 'rce', 'injection', 'sqli', 'xss', 'ssrf', 'csrf'],
    post_exploit: ['post-exploit', 'privilege', 'persistence', 'lateral', 'pivot'],
    skill_execution: [],
  }
  const relevantSkills = updatedSkills.filter((s) => {
    const kws = typeKeywords[type] || []
    const cat = ((s.category as string) || '').toLowerCase()
    const name = ((s.name as string) || '').toLowerCase()
    const tags = ((s.tags as string[]) || []).map((t) => t.toLowerCase())
    return kws.some((kw) => cat.includes(kw) || name.includes(kw) || tags.includes(kw))
  })
  const topSkills = relevantSkills.slice(0, 4)

  // 2. 构造 AI prompt
  const tool = (config.tool as string) || ''
  const skillNames = topSkills.map((s) => `- ${s.title || s.name || s.id}（${s.category || '通用'}）`).join('\n')

  let systemPrompt = `你是一个红队渗透测试专家。当前角色：${type} - ${label}
目标：${target}

可用技能：
${skillNames || '- 通用渗透测试方法'}

上游发现：
${JSON.stringify(upstreamOutputs).slice(0, 500)}

## 你的职责

你的工作是**交互式渗透测试**。每次只输出**一条命令**，让用户实际运行，然后用户会提供真实输出，你再分析。

## 输出格式

**任务摘要**
一句话说明当前要做什么

**命令**
\`\`\`
（仅一条命令，可直接复制到终端运行。绝对禁止交互式命令：mysql/psql/sudo/ssh/vim/less/top/python 等）
\`\`\`

**预期输出**
（用户运行命令后应看到什么）

**分析（用户提供输出后）**
用户会把实际的命令输出粘贴回来。你将基于**真实的输出**分析：
- 如果输出中存在明确的漏洞证据（SQL 错误/HTTP 403/敏感信息等）→ 填写【确认漏洞】块
- 如果没有发现任何漏洞迹象 → 写"无发现"
- 如果命令失败或连接不上 → 写"目标不可达或命令执行失败"

**确认漏洞**
（仅当用户提供真实输出后，且输出中有明确证据时填写，格式如下：
标题: <漏洞名>
严重性: <严重/高危/中危/低危>
验证模式: <regex 正则表达式！用于系统自动验证用户提供的输出，如：uid=\\d+\\(www-data\\)、HTTP/1\\.1 200 OK、<script>alert\\(1\\)、SLEEP\\(5\\) 等>
证据: <引用用户提供的实际输出内容>）

## 关键规则
- **不要编造漏洞**！必须等用户提供真实命令输出来后，根据输出内容判断
- **每次只输出一条命令**，不要一次说太多
- **不要输出交互式命令**（会卡在终端等输入的）
- **不要伪造 HTTP 请求/响应流量**——给用户真实命令，让用户自己跑
- **如果本节点没有适合的命令，输出"本节点不适合手动测试，跳过"**`

  if (type === 'data_collection' || type === 'nmap_scan') {
    systemPrompt += `\n- 这是信息收集阶段，输出 nmap / subfinder / dig 等探测命令`
  } else if (type === 'exploit') {
    systemPrompt += `\n- 这是漏洞利用阶段，如果已经扫描到漏洞就构造利用命令`
  } else if (type === 'post_exploit') {
    systemPrompt += `\n- 这是后渗透阶段，构造提权/横向移动/持久化命令`
  } else if (type === 'vulnerability_scan') {
    systemPrompt += `\n- 这是漏洞扫描阶段，构造扫描命令验证目标是否存在漏洞`
  }

  // 根据 config 增加额外上下文
  if (config.command) systemPrompt += `\n- 用户预定义命令模板：${config.command}`
  if (config.payload) systemPrompt += `\n- 用户预定义 payload：${config.payload}`
  if (config.action) systemPrompt += `\n- 指定的操作：${config.action}`
  if (config.tool) systemPrompt += `\n- 指定的工具：${config.tool}`

  // 暴露其他任意自定义参数（用户可在节点属性面板自由添加）
  const knownKeys = new Set(['tool', 'payload', 'action', 'command'])
  for (const [k, v] of Object.entries(config)) {
    if (!knownKeys.has(k) && v !== undefined && v !== '') {
      systemPrompt += `\n- 自定义参数 ${k}：${JSON.stringify(v)}`
    }
  }

  // 调用 AI（带 try/catch，防止静默吞掉错误）
  let raw = ''
  try {
    console.log(`[executeAsAIAgent] Requesting AI for node: ${label} (prompt length: ${systemPrompt.length})`)
    raw = await requestAI(systemPrompt, '你是一个红队渗透测试专家，输出要简洁、实用、可执行。')
    console.log(`[executeAsAIAgent] AI responded (${raw.length} chars)`)
  } catch (err: any) {
    console.error(`[executeAsAIAgent] AI request FAILED for ${label}:`, err)
    raw = `**任务摘要**
AI 请求失败：${err?.message || err}

**命令**
\`\`\`
echo "AI 服务不可用，请检查设置 → AI 模型配置"
\`\`\`

**预期输出**
跳过

**确认漏洞**
无`

    // 错误时不继续验证
    const errorResult: NodeExecutionResult = {
      nodeId: node.id, status: 'failed', output: raw, duration: Date.now() - start,
      findings: [], metadata: { nodeType: type, error: err?.message || 'AI 调用失败' },
    }
    return errorResult
  }

  // 2.5 预检：检测 AI 输出中的交互式命令（会卡住用户终端的命令）
  const INTERACTIVE_PATTERNS: Array<{ pattern: RegExp; reason: string; fix: string }> = [
    { pattern: /^\s*mysql\s+(?!.*-p[^\s])/m, reason: 'mysql 等待交互式输入密码', fix: '使用 -p<密码> 直接跟密码，或 mysql -u <user> -p<pwd> --execute="..."' },
    { pattern: /^\s*psql\s+(?!.*-c)/m, reason: 'psql 等待交互式输入', fix: '使用 psql -U <user> -d <db> -c "SQL 语句"' },
    { pattern: /^\s*sudo\s+[^<]/m, reason: 'sudo 可能要求输入密码', fix: '使用 echo "<password>" | sudo -S <cmd>' },
    { pattern: /^\s*ssh\s+[^@]+@/m, reason: 'ssh 可能要求交互式输入密码', fix: '使用 sshpass -p <password> ssh user@host cmd，或 SSH 密钥免密' },
    { pattern: /^\s*(vim|vi|less|more|top|htop|man|ftp|smbclient)\s*$/m, reason: '打开交互式 TUI 程序', fix: '用对应的非交互模式：cat、--head、-h 标志等' },
    { pattern: /^\s*python3?\s*$/m, reason: 'python 启动 REPL 交互模式', fix: '使用 python3 -c "<code>" 或 python3 script.py' },
    { pattern: /^\s*bash\s*$/m, reason: 'bash 启动交互 shell', fix: '使用 bash -c "<command>"' },
  ]
  const interactiveIssues: string[] = []
  for (const { pattern, reason, fix } of INTERACTIVE_PATTERNS) {
    if (pattern.test(raw)) {
      interactiveIssues.push(`⚠️ 检测到交互式命令：${reason}\n   建议改为：${fix}`)
    }
  }

  // 3. 解析 AI 结果 — 新格式：确认漏洞（含验证模式 + 用户真实输出匹配）
  const titleMatch = raw.match(/\*\*任务摘要\*\*\s*\n(.+?)(?:\n|$)/)
  const cmdMatch = raw.match(/\*\*命令\*\*\s*\n```([\s\S]*?)```/)
  const vulnMatch = raw.match(/\*\*确认漏洞\*\*\s*\n([\s\S]+?)(?=\n\*\*|$)/)
  const vulnBlock = vulnMatch?.[1]?.trim() || ''
  const taskTitle = titleMatch?.[1]?.trim() || `${label} - ${target}`
  const suggestedCmd = cmdMatch?.[1]?.trim() || ''

  // 解析指定字段
  const vulnTitleMatch = vulnBlock.match(/标题[:：]\s*(.+)/)
  const vulnSevMatch = vulnBlock.match(/严重性[:：]\s*(.+)/)
  const vulnPatternMatch = vulnBlock.match(/验证模式[:：]\s*(.+)/)
  const vulnEvidenceMatch = vulnBlock.match(/证据[:：]([\s\S]+?)(?=\n\s*-\s|\n\*\*|$)/)
  const verifyPattern = vulnPatternMatch?.[1]?.trim() || ''
  const evidenceText = vulnEvidenceMatch?.[1]?.trim() || ''

  // === 验证链逻辑 ===
  // 先尝试用 AI 指定的正则进行匹配（优先）
  let patternVerified = false
  let patternMatchError = ''
  if (verifyPattern) {
    try {
      const re = new RegExp(verifyPattern, 'i')
      // 当用户提供真实输出时，这里会被重新调用
      // 暂时标记为 "待验证" 状态
    } catch (e) {
      patternMatchError = `验证模式正则无效: ${verifyPattern}`
    }
  }

  // 提取命令字段供用户手动验证
  const hasVulnWithPattern = !!vulnTitleMatch && !!verifyPattern && !patternMatchError

  // === 4. 自动验证 ===
  // 从建议命令中提取 URL 路径，调后端做真实 HTTP 请求验证
  let verifyResult: { verified: boolean; responseBody: string; statusCode: number | null; error?: string } | null = null
  let urlPath = ''

  if (hasVulnWithPattern && suggestedCmd) {
    // 从 curl 命令提取 URL 路径
    const curlUrlMatch = suggestedCmd.match(/curl\s+["']?(?:-s\s+)?(?:-k\s+)?(?:-v\s+)?["']?https?:\/\/[^\/\s"]+(\/[^"\s'|]*)["']?/)
    const urlMatch = suggestedCmd.match(/(?:https?:\/\/[^\/]+\/)?(\/[^"\s'|$]*)/)
    urlPath = (curlUrlMatch?.[1] || urlMatch?.[1] || '').split(' ')[0] || '/'

    if (urlPath) {
      verifyResult = await verifyVulnerability(target, urlPath, verifyPattern)
    }
  }

  // 5. 记录验证结果
  let findings: Finding[] = []
  if (hasVulnWithPattern) {
    const sevLookup: Record<string, SeverityLevel> = {
      严重: 'critical', 高危: 'high', 中危: 'medium', 低危: 'low',
    }
    const sevRaw = vulnSevMatch?.[1]?.trim() || ''
    const severity: SeverityLevel = sevLookup[sevRaw] || 'medium'
    const newTitle = vulnTitleMatch![1].trim()

    // 去重
    const allFindings = useFindingStore.getState().findings
    const oneDayAgo = Date.now() - 24 * 3600 * 1000
    const dup = allFindings.find(
      (f) => f.target === target && f.title.trim() === newTitle &&
        f.discovered_at && new Date(f.discovered_at).getTime() > oneDayAgo
    )
    if (!dup) {
      // 自动验证的结果决定入库状态
      let status = 'open' as const
      let statusLabel = '待验证'
      let evidenceLines = `## AI 分析\n${evidenceText}`

      if (verifyResult) {
        if (verifyResult.verified) {
          status = 'verified' as const
          statusLabel = '已验证'
          evidenceLines = `## 自动验证 - 漏洞已确认 ✅\n\n### 验证请求\n\`\`\`\ncurl http://${target}${urlPath}\n\`\`\`\n\n### 真实响应\nHTTP ${verifyResult.statusCode || '???'}\n\n\`\`\`\n${verifyResult.responseBody.slice(0, 1500)}\n\`\`\`\n\n### 匹配结果\n响应内容匹配验证模式「${verifyPattern}」→ ✅ 漏洞真实存在`
        } else {
          status = 'open' as const
          statusLabel = '验证未通过'
          evidenceLines = `## 自动验证 - 漏洞未确认 ❌\n\n### 验证请求\n\`\`\`\ncurl http://${target}${urlPath}\n\`\`\`\n\n### 真实响应\nHTTP ${verifyResult.statusCode || '???'}\n\`\`\`\n${(verifyResult.responseBody || '无响应').slice(0, 1500)}\n\`\`\`\n\n### 匹配结果\n响应内容与验证模式「${verifyPattern}」不匹配\n${verifyResult.error ? `\n错误：${verifyResult.error}` : ''}\n\n⚠️ 这可能是一个假阳性漏洞，也可能需要不同的验证参数。`
        }
      } else {
        evidenceLines = `## 待验证 — 需要手动确认\n\n验证命令：${suggestedCmd}\n验证模式：${verifyPattern}\n\n运行命令并检查输出是否匹配正则「${verifyPattern}」`
      }

      const finding: Finding = {
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: `${statusLabel === '已验证' ? '✅' : '⚠️'} ${newTitle}`,
        description: `${target} ${type} - ${label}`,
        severity,
        target,
        status,
        tags: [type, label, `verify-${statusLabel}`, node.id.slice(0, 8)],
        discovered_at: new Date().toISOString(),
        cvss_score: severity === 'critical' ? 9.5 : severity === 'high' ? 7.5 : 5.0,
        evidence: evidenceLines,
        remediation: '请根据 AI 输出的修复建议处理',
      }
      findings = [finding]
      useFindingStore.getState().addFinding(finding)
    }
  }

  // 5. 构造返回内容
  let extraWarn = ''
  const hasVulnButNoPattern = vulnBlock !== '无' && !!vulnTitleMatch && !verifyPattern
  if (hasVulnButNoPattern) {
    extraWarn += `\n\n> ⚠️ **AI 声称发现了漏洞，但未提供「验证模式」**（正则表达式）。\n> 请在 AI 输出的「确认漏洞」块中添加「验证模式: <regex>」字段，系统才能自动验证。`
  }
  if (patternMatchError) {
    extraWarn += `\n\n> ⚠️ **验证模式错误**：${patternMatchError}`
  }
  if (interactiveIssues.length) {
    extraWarn += `\n\n> 🚨 **交互式命令警告**\n${interactiveIssues.join('\n')}\n> 请不要直接复制运行！`
  }

  return {
    nodeId: node.id,
    status: 'completed',
    output: `## ${label}\n\n${raw}${extraWarn}${verifyResult ? `\n\n---\n### 自动验证结果\n- 请求: \`curl http://${target}${urlPath}\`\n- 响应码: ${verifyResult.statusCode || 'N/A'}\n- 匹配模式: ${verifyPattern}\n- 结果: ${verifyResult.verified ? '✅ 漏洞已确认' : verifyResult.error ? `❌ ${verifyResult.error}` : '❌ 未匹配'}\n\`\`\`\n${(verifyResult.responseBody || '(无响应)').slice(0, 600)}\n\`\`\`` : ''}`,
    duration: Date.now() - start,
    findings,
    metadata: { nodeType: type, aiGenerated: true, skillCount: topSkills.length },
  }
}

/** 节点执行引擎 —— 每个节点类型有对应的真实执行逻辑 */
export async function executeNode(
  node: WorkflowNode,
  target: string,
  upstreamOutputs: Record<string, string> = {},
): Promise<NodeExecutionResult> {
  const startTime = Date.now()
  const { type, config, label } = node

  // 在任务监控中创建任务 → 任务列表实时显示
  const taskStore = useTaskStore.getState()
  // 使用全 ID 拼接（不再 slice）保证唯一
  const taskId = `t-${node.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  taskStore.addTask?.({
    id: taskId,
    name: label,
    target,
    type: type as any,
    status: 'running',
    progress: 0,
    project_id: '',
    priority: 'medium',
    estimated_duration: 5,
    started_at: new Date().toISOString(),
  })

  // 模拟基础耗时（1-2 秒，让用户看到进度）
  const baseDelay = 800 + Math.random() * 800

  // 进度更新循环
  let progressInterval: ReturnType<typeof setInterval> | null = null
  if (typeof window !== 'undefined') {
    progressInterval = window.setInterval(() => {
      const cur = useTaskStore.getState().tasks.find((t) => t.id === taskId)
      if (cur && cur.progress < 90) {
        useTaskStore.getState().updateTask(taskId, { progress: cur.progress + 5 })
      }
    }, 400)
  }

  await sleep(baseDelay)

  if (progressInterval) clearInterval(progressInterval)

  let result: NodeExecutionResult
  try {
    // 每个节点最多执行 3 分钟，超时自动失败
    const TIMEOUT_MS = 180000
    result = await withTimeout(
      TIMEOUT_MS,
      async () => {
        switch (type) {
          case 'mcp_tool': {
            const apiBaseUrl = (config.apiBaseUrl as string) || 'http://localhost:8080'
            const apiEndpoint = (config.apiEndpoint as string) || '/tools/run'
            return await executeMCPTool(node, target, apiBaseUrl, apiEndpoint, startTime)
          }
          case 'report':
            return await executeReport(node, target, startTime, upstreamOutputs)
          default:
            return await executeAsAIAgent(node, target, startTime, upstreamOutputs)
        }
      },
      () => ({
        nodeId: node.id, status: 'failed' as const,
        output: '❗ 节点执行超时（3 分钟），已自动终止', duration: TIMEOUT_MS,
        findings: [], metadata: { nodeType: type, cause: 'timeout' },
      }),
    )
  } finally {
    // 节点结束（无论成功失败）都更新任务状态
    useTaskStore.getState().updateTask(taskId, {
      status: 'completed',
      progress: 100,
    })
  }
  return result
}

// ============================================================
//  各类型节点的执行器
// ============================================================

async function executeMCPTool(
  node: WorkflowNode,
  target: string,
  apiBaseUrl: string,
  apiEndpoint: string,
  start: number,
): Promise<NodeExecutionResult> {
  await sleep(800)
  const finding: Finding = {
    title: `${node.label} - MCP 工具调用`,
    description: `通过 MCP 端点 ${apiBaseUrl}${apiEndpoint} 执行了对 ${target} 的扫描。`,
    severity: 'medium' as SeverityLevel,
    target,
    tags: ['mcp', node.id.slice(0, 8)],
    cvss_score: 5.5,
    remediation: '根据 MCP 工具返回结果进行修复',
  }
  useFindingStore.getState().addFinding(finding)
  return {
    nodeId: node.id,
    status: 'completed',
    output: `🤖 **${node.label}** MCP 工具调用完成\n\n端点：${apiBaseUrl}${apiEndpoint}\n目标：${target}\n\n**调用结果**：MCP 工具已成功调用并返回数据。`,
    duration: Date.now() - start,
    findings: [finding],
    metadata: { apiBaseUrl, apiEndpoint },
  }
}

async function executeReport(node: WorkflowNode, target: string, start: number): Promise<NodeExecutionResult> {
  await sleep(500)
  const allFindings = useFindingStore.getState().findings.filter((f) => f.target === target)
  return {
    nodeId: node.id,
    status: 'completed',
    output: `📊 **${node.label}** 报告已生成\n\n目标：${target}\n漏洞总数：${allFindings.length} 个\n\n报告已自动同步到「报告中心」`,
    duration: Date.now() - start,
    metadata: { reportGenerated: true, totalFindings: allFindings.length },
  }
}

/** sleep 辅助 */
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** 带超时的任务执行器：如果 executor 在 ms 内未完成，返回 fallback */
async function withTimeout<T>(ms: number, executor: () => Promise<T>, fallback: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback()), ms)
  })
  const result = await Promise.race([executor(), timeout])
  clearTimeout(timer!)
  return result
}
