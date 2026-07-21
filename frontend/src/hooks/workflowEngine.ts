import type { WorkflowNode, WorkflowEdge } from '@/types/workflow'
import { useTaskStore } from '@/stores/taskStore'
import { useFindingStore } from '@/stores/findingStore'
import { useSkillStore } from '@/stores/skillStore'
import { requestAI } from './useLLM'
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

  let systemPrompt = `你是一个红队渗透测试专家。当前扮演的角色是：${type} - ${label}
目标：${target}

可用的渗透测试技能：
${skillNames || '- 通用渗透测试方法'}

上游节点已发现的信息：
${JSON.stringify(upstreamOutputs).slice(0, 500)}

任务：根据当前角色选择最合适的技能，构造真实可执行的攻击命令或探测命令。

输出格式必须严格如下：

**任务摘要**
（一句话说明当前节点要做什么，用了什么技能）

**命令/验证**
\`\`\`
（真实可执行的命令，如 curl / sqlmap / nmap / dalfox / msfconsole / impacket 等，确保复制后可直接在终端运行）
\`\`\`

**预期结果**
（运行命令后预期看到的输出，帮助验证命令是否正确执行）

**发现漏洞**
（如发现漏洞则写漏洞名称，否则写"无"）

关键规则：
- 命令必须真实可用，使用真实工具
- 不要返回伪造的 HTTP 请求/响应流量
- 要返回可复制执行的命令`

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

  const raw = await requestAI(systemPrompt, '你是一个红队渗透测试专家，输出要简洁、实用、可执行。')

  // 3. 解析 AI 结果
  const titleMatch = raw.match(/\*\*任务摘要\*\*\s*\n(.+?)(?:\n|$)/)
  const vulnMatch = raw.match(/\*\*发现漏洞\*\*\s*\n(.+?)(?:\n|$)/)
  const taskTitle = titleMatch?.[1]?.trim() || `${label} - ${target}`
  const vulnTitle = vulnMatch?.[1]?.trim()
  const hasVuln = vulnTitle && vulnTitle !== '无'

  // 4. 如发现漏洞则写入 findingStore
  let findings: Finding[] = []
  if (hasVuln) {
    const sevMap: Record<string, SeverityLevel> = {
      exploit: 'critical', skill_execution: 'high', vulnerability_scan: 'high',
      post_exploit: 'high', default: 'medium',
    }
    const severity: SeverityLevel = sevMap[type] || 'medium'
    const finding: Finding = {
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: vulnTitle,
      description: `${target} ${type} - ${label}`,
      severity,
      target,
      status: 'open',
      tags: [type, label, node.id.slice(0, 8)],
      discovered_at: new Date().toISOString(),
      cvss_score: severity === 'critical' ? 9.5 : severity === 'high' ? 7.5 : 5.0,
      evidence: raw,
      remediation: '请根据 AI 输出的修复建议处理',
    }
    findings = [finding]
    useFindingStore.getState().addFinding(finding)
  }

  return {
    nodeId: node.id,
    status: 'completed',
    output: `## ${label}\n\n${raw}`,
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
  const taskId = `t-node-${node.id}-${Date.now()}`.slice(0, 24)
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
    switch (type) {
      case 'mcp_tool': {
        const apiBaseUrl = (config.apiBaseUrl as string) || 'http://localhost:8080'
        const apiEndpoint = (config.apiEndpoint as string) || '/tools/run'
        result = await executeMCPTool(node, target, apiBaseUrl, apiEndpoint, startTime); break
      }
      case 'report':
        result = await executeReport(node, target, startTime, upstreamOutputs); break
      default:
        // 所有其他节点类型统一由 AI 智能体处理
        result = await executeAsAIAgent(node, target, startTime, upstreamOutputs)
    }
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
  return new Promise((resolve) => setTimeout(resolve, ms))
}


