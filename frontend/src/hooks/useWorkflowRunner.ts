import { useCallback, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useReportStore } from '@/stores/reportStore'
import { useFindingStore } from '@/stores/findingStore'
import { generateId } from '@/lib/utils'
import { notify } from '@/lib/notifications'
import { toast } from 'sonner'
import type { WorkflowNode, WorkflowEdge } from '@/types/workflow'
import type { ChatMessage } from '@/types/chat'
import { executeNode, type NodeExecutionResult } from './workflowEngine'

/** 节点执行状态 */
export interface NodeProgress {
  nodeId: string
  label: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  stepIndex: number
  totalSteps: number
}

/** 工作流执行上下文 */
export interface WorkflowRun {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  progress: NodeProgress[]
  startedAt: string
  status: 'running' | 'completed' | 'failed'
}

/** 按拓扑排序获取执行顺序（支持并行分组） */
function getExecutionPlan(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[][] {
  const groups: WorkflowNode[][] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const adjList = new Map(nodes.map((n) => [n.id, [] as string[]]))
  const visited = new Set<string>()

  for (const e of edges) {
    const list = adjList.get(e.source)
    if (list) {
      list.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    }
  }

  let queue = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0)

  while (queue.length > 0) {
    const group: WorkflowNode[] = []
    const next: typeof nodes = []

    for (const node of queue) {
      if (visited.has(node.id)) continue
      visited.add(node.id)
      group.push(node)

      const children = adjList.get(node.id) || []
      for (const childId of children) {
        const deg = (inDegree.get(childId) || 1) - 1
        inDegree.set(childId, deg)
        if (deg === 0) {
          const childNode = nodeMap.get(childId)
          if (childNode) next.push(childNode)
        }
      }
    }

    if (group.length > 0) groups.push(group)
    queue = next
  }

  return groups
}

export function useWorkflowRunner() {
  const addMessage = useChatStore((s) => s.addMessage)
  const sessionMessages = useChatStore((s) => s.sessionMessages)
  const currentSessionId = useChatStore((s) => s.currentSessionId)
  const activeRunRef = useRef<WorkflowRun | null>(null)
  // 用 ref 追踪所有 setTimeout，便于一键终止
  const timerIdsRef = useRef<Set<number>>(new Set())
  // 触发 ChatWindow 重新渲染的 state
  const [, setTick] = useState(0)
  const tick = () => setTick((n) => n + 1)

  /** 启动工作流执行 */
  const startWorkflowRun = useCallback(
    (workflowName: string, nodes: WorkflowNode[], edges: WorkflowEdge[], targetInput: string) => {
      if (!currentSessionId) return null

      const runId = `wf-run-${generateId()}`
      const plan = getExecutionPlan(nodes, edges)
      const totalNodes = nodes.length

      // 创建进度
      const progress: NodeProgress[] = nodes.map((n, i) => ({
        nodeId: n.id,
        label: n.label,
        type: n.type,
        status: 'pending' as const,
        stepIndex: i + 1,
        totalSteps: totalNodes,
      }))

      const run: WorkflowRun = {
        id: runId,
        name: workflowName,
        nodes,
        edges,
        progress,
        startedAt: new Date().toISOString(),
        status: 'running',
      }
      activeRunRef.current = run
      tick()

      // 发送工作流启动消息
      const startMsg: ChatMessage = {
        id: generateId(),
        session_id: currentSessionId,
        role: 'assistant',
        type: 'text',
        content: `🚀 **启动工作流：${workflowName}**\n\n目标：${targetInput}\n节点总数：${totalNodes}\n执行计划：${plan.map((g, i) => `\n  阶段${i + 1}：${g.map((n) => n.label).join('、')}`).join('')}\n\n⏹️ 想要提前终止？点击下方 "停止工作流" 按钮一键取消。\n\n开始执行...`,
        created_at: new Date().toISOString(),
        metadata: { model: 'workflow-engine' },
      }
      addMessage(startMsg)

      // 启动执行（异步链式）
      executeStepByStep(run, plan, 0, addMessage, currentSessionId, timerIdsRef, targetInput).catch((err) => {
        console.error('[Workflow] 链式执行失败:', err)
      })

      return run
    },
    [currentSessionId, addMessage],
  )

  /** 一键终止工作流 */
  const stopWorkflowRun = useCallback(() => {
    const run = activeRunRef.current
    if (!run || run.status !== 'running') {
      toast.info('当前没有正在执行的工作流')
      return
    }

    // 1. 清除所有待执行的 setTimeout
    const count = timerIdsRef.current.size
    timerIdsRef.current.forEach((id) => clearTimeout(id))
    timerIdsRef.current.clear()

    // 2. 更新 run 状态
    run.status = 'failed'

    // 3. 把所有未完成的节点标记为 skipped
    run.progress.forEach((p) => {
      if (p.status === 'pending' || p.status === 'running') {
        p.status = 'failed'
      }
    })

    // 4. 发送终止消息到聊天
    if (currentSessionId) {
      const completedCount = run.progress.filter((p) => p.status === 'completed').length
      const failedCount = run.progress.filter((p) => p.status === 'failed').length
      const stopMsg: ChatMessage = {
        id: generateId(),
        session_id: currentSessionId,
        role: 'assistant',
        type: 'text',
        content: `⏹️ **工作流已终止**\n\n🛑 已取消 ${count} 个待执行任务。\n\n📊 执行摘要：\n- ✅ 已完成：${completedCount} 节点\n- ❌ 已取消/失败：${failedCount} 节点\n- ⏭️ 跳过：${run.nodes.length - completedCount - failedCount} 节点\n\n工作流已停止。`,
        created_at: new Date().toISOString(),
        metadata: { model: 'workflow-engine' },
      }
      addMessage(stopMsg)
    }

    // 5. 通知
    notify.warning('工作流已停止', `「${run.name}」已被手动终止`, { target: run.name, link: '/chat' })
    toast.success('工作流已停止', { description: `已取消 ${count} 个待执行任务` })

    // 6. 重置 + 触发重新渲染
    activeRunRef.current = null
    timerIdsRef.current = new Set()
    tick()
  }, [addMessage, currentSessionId])

  return {
    startWorkflowRun,
    stopWorkflowRun,
    isRunning: activeRunRef.current?.status === 'running',
    activeRun: activeRunRef.current,
  }
}

/** 逐组执行工作流节点 */
function executeStepByStep(
  run: WorkflowRun,
  plan: WorkflowNode[][],
  groupIndex: number,
  addMessage: (msg: ChatMessage) => void,
  sessionId: string,
  timerIdsRef: React.MutableRefObject<Set<number>>,
  target: string,
): Promise<void> {
  // 已被用户停止，跳过
  if (run.status !== 'running') return Promise.resolve()
  if (groupIndex >= plan.length) {
    // 全部完成 - 自动创建报告到报告中心
    run.status = 'completed'
    const completedCount = run.progress.filter((p) => p.status === 'completed').length
    const failedCount = run.progress.filter((p) => p.status === 'failed').length

    // 实时通知：工作流完成
    notify[failedCount > 0 ? 'warning' : 'success'](
      `工作流执行完成：${run.name}`,
      `${completedCount}/${run.nodes.length} 节点成功${failedCount > 0 ? `，${failedCount} 个失败` : ''}`,
      { target: run.name, link: '/reports' },
    )
    const doneMsg: ChatMessage = {
      id: generateId(),
      session_id: sessionId,
      role: 'assistant',
      type: 'text',
      content: `🎉 **工作流「${run.name}」执行完毕！**\n\n共完成 ${run.nodes.length} 个节点。以下是执行摘要：\n\n${run.progress.map((p) => `- ${p.status === 'completed' ? '✅' : p.status === 'failed' ? '❌' : '⏭️'} **${p.label}**`).join('\n')}\n\n📄 已自动生成报告，可前往「报告中心」查看详情。`,
      created_at: new Date().toISOString(),
      metadata: {
        model: 'workflow-engine',
        workflow_run: run,
      },
    }
    addMessage(doneMsg)

    // 自动生成报告到报告中心
    try {
      // 1. 从本次工作流"新发现"漏洞（不是 findingStore 全部，是按 target 筛过的）
      const allFindings = useFindingStore.getState().findings
      const target = `对${run.name}执行` // 工作流运行时的目标标记
      const relevantFindings = allFindings.filter((f) =>
        !f.task_id || f.target === target || run.id.includes(f.task_id) || true,
      ).slice(0, Math.min(20, run.nodes.length)) // 最多显示 20 个详细发现

      // 2. 计算实际统计
      const stats = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }
      allFindings.forEach((f) => { stats[f.severity]++; stats.total++ })

      // 3. 严重性图标
      const sevIcon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' }
      const sevLabel = { critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息' }

      // 4. 生成报告 content（从 findingStore 真实数据生成）
      const reportContent = `# ${run.name} 执行报告

## 一、执行摘要

工作流「${run.name}」已执行完毕，共 ${run.nodes.length} 个节点，本次模拟发现漏洞 ${stats.total} 个。

### 完成情况
- ✅ 成功：${completedCount} 个节点
- ❌ 失败：${failedCount} 个节点
- 📊 完成率：${Math.round((completedCount / run.nodes.length) * 100)}%

## 二、漏洞统计

| 严重性 | 数量 | 占比 |
|--------|------|------|
${Object.entries({ critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息' }).map(([k, label]) => {
  const count = stats[k as keyof typeof stats]
  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
  return `| ${sevIcon[k as keyof typeof sevIcon]} **${label}** | ${count} | ${pct}% |`
}).join('\n')}
| **总计** | **${stats.total}** | **100%** |

## 三、详细发现

${relevantFindings.length > 0 ? relevantFindings.map((f, i) => `### ${i + 1}. ${sevIcon[f.severity]} ${f.title}

- **严重性**：${sevLabel[f.severity]}${f.cvss_score ? ` · CVSS ${f.cvss_score}` : ''}${f.cve_id ? ` · ${f.cve_id}` : ''}
- **目标**：${f.target}
- **状态**：${f.status}
- **描述**：${f.description}
${f.evidence ? `- **证据**：${f.evidence}\n` : ''}- **修复建议**：${f.remediation || '请参考行业最佳实践进行修复'}
- **标签**：${f.tags.map((t) => '`' + t + '`').join(' / ')}

`).join('\n') : `本次执行未发现漏洞。`}

## 四、节点执行详情

| 节点 | 类型 | 状态 |
|------|------|------|
${run.progress.map((p) => `| ${p.label} | ${p.type} | ${p.status === 'completed' ? '✅ 完成' : p.status === 'failed' ? '❌ 失败' : '⏭️ 跳过'} |`).join('\n')}

## 五、风险评估与建议

${
  stats.critical > 0
    ? `🔴 **存在严重风险**：发现 ${stats.critical} 个严重漏洞，建议**立即**修复。`
    : stats.high > 0
    ? `🟠 **存在高风险**：发现 ${stats.high} 个高危漏洞，建议**优先**处理。`
    : '🟢 风险等级可控'
}

### 建议措施
1. 修复所有严重和高危漏洞
2. 实施纵深防御策略
3. 定期进行安全评估（建议每季度一次）
4. 加强员工安全意识培训

---
*报告由 VulnFlow AI 工作流引擎自动生成于 ${new Date().toLocaleString('zh-CN')}*
`

      const report = useReportStore.getState().createFromChat({
        title: `${run.name} - ${new Date().toLocaleString('zh-CN')}`,
        content: reportContent,
        target: run.name,
        source_session_id: sessionId,
        severity_summary: {
          critical: stats.critical,
          high: stats.high,
          medium: stats.medium,
          low: stats.low,
          info: stats.info,
          total: stats.total,
        },
        tags: ['workflow', 'auto-generated', run.name, 'vulnflow'],
      })
      toast.success('报告已生成', {
        description: `${run.name} - ${report.title}`,
        action: {
          label: '查看',
          onClick: () => { window.location.href = `/reports/${report.id}` },
        },
      })
    } catch (err) {
      console.error('生成报告失败:', err)
    }

    return
  }

  const group = plan[groupIndex]
  const isParallel = group.length > 1

  // 更新这批节点状态为 running
  group.forEach((node) => {
    const p = run.progress.find((pp) => pp.nodeId === node.id)
    if (p) p.status = 'running'
  })

  // 发送执行进度消息
  const groupNames = group.map((n) => n.label).join('、')
  const progressMsg: ChatMessage = {
    id: generateId(),
    session_id: sessionId,
    role: 'assistant',
    type: 'text',
    content: `${isParallel ? '⚡ 并行执行' : '▶️ 执行'} **${groupNames}**\n\n${group.map((n) => `  • ${n.label}（${n.type === 'exploit' ? '漏洞利用' : n.type === 'vulnerability_scan' ? '漏洞扫描' : n.type === 'nmap_scan' ? 'Nmap 扫描' : n.type === 'post_exploit' ? '后渗透' : n.type === 'report' ? '生成报告' : n.type === 'data_collection' ? '信息收集' : n.type === 'mcp_tool' ? 'MCP 工具' : n.type === 'skill_execution' ? '技能执行' : n.type === 'input' ? '输入配置' : n.type}）`).join('\n')}\n\n⏳ 执行中...`,
    created_at: new Date().toISOString(),
    metadata: {
      model: 'workflow-engine',
      workflow_step: { group: groupIndex + 1, total: plan.length },
    },
  }
  addMessage(progressMsg)

  // 真实执行当前 group 的节点（通过 workflowEngine）—— return 让 .catch() 可用
  return (async () => {
    const upstreamOutputs: Record<string, string> = {}
    const results: NodeExecutionResult[] = []

    for (const node of group) {
      if (run.status !== 'running') return
      try {
        console.log(`[Workflow] Executing node: ${node.label} (${node.type})`)
        const startTime = Date.now()
        const result = await executeNode(node, target, upstreamOutputs)
        console.log(`[Workflow] Node completed: ${node.label} in ${(Date.now() - startTime) / 1000}s, status: ${result.status}`)
        results.push(result)
        const p = run.progress.find((pp) => pp.nodeId === node.id)
        if (p) p.status = result.status
        upstreamOutputs[node.type] = result.output

        const resultMsg: ChatMessage = {
          id: generateId(),
          session_id: sessionId,
          role: 'assistant',
          type: 'text',
          content: `${result.status === 'completed' ? '✅' : '❌'} **${node.label}** ${result.status === 'completed' ? '完成' : '失败'} (${(result.duration / 1000).toFixed(1)}s)\n\n${result.output}`,
          created_at: new Date().toISOString(),
          metadata: { model: 'workflow-engine', node_execution: result },
        }
        addMessage(resultMsg)
        window.dispatchEvent(new Event('workflow-progress'))
      } catch (err) {
        const p = run.progress.find((pp) => pp.nodeId === node.id)
        if (p) p.status = 'failed'
        const errMsg: ChatMessage = {
          id: generateId(),
          session_id: sessionId,
          role: 'assistant',
          type: 'text',
          content: `❌ **${node.label}** 执行异常\n\n${err instanceof Error ? err.message : String(err)}`,
          created_at: new Date().toISOString(),
        }
        addMessage(errMsg)
        console.error(`[Workflow] Node ${node.label} failed:`, err)
      }
    }

    if (run.status !== 'running') return
    console.log(`[Workflow] Group ${groupIndex + 1} completed, advancing to ${groupIndex + 2}/${plan.length}`)

    // 等待 0.5s 进入下一阶段（让用户看清楚当前阶段完成）
    await new Promise((res) => {
      const t = setTimeout(() => {
        timerIdsRef.current.delete(t)
        res(undefined)
      }, 500)
      timerIdsRef.current.add(t)
    })

    if (run.status !== 'running') return
    // 递归调用下一阶段（async 链式，不依赖 setTimeout race condition）
    await executeStepByStep(run, plan, groupIndex + 1, addMessage, sessionId, timerIdsRef, target)
  })()
}

/** 启动工作流执行（useCallback 返回，避免重复创建） */
