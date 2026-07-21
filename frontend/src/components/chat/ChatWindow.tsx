import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChatMessage as ChatMessageView } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useChatStore } from '@/stores/chatStore'
import { useFindingStore } from '@/stores/findingStore'
import { usePenTestStore } from '@/stores/penetrationStore'
import { useSkillStore } from '@/stores/skillStore'
import { useLLM } from '@/hooks/useLLM'
import { useWorkflowRunner } from '@/hooks/useWorkflowRunner'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/stores/workflowSeed'
import { AGENT_SYSTEM_PROMPT } from '@/lib/penetrationAgent'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { MessageSquare, Sparkles, Play, X, Workflow, ChevronDown, Square, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { generateId, cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/chat'
import type { SeverityLevel } from '@/stores/findingStore'

/** 从 AI 回复中解析动作指令并执行 —— 返回要追加的系统消息 */
function executeAIActions(reply: string, sessionId: string): ChatMessage[] {
  const actionMessages: ChatMessage[] = []
  const findingStore = useFindingStore.getState()
  const ptStore = usePenTestStore.getState()
  const SEV_MAP: Record<string, SeverityLevel> = {
    严重: 'critical', 高危: 'high', 中危: 'medium', 低危: 'low',
    critical: 'critical', high: 'high', medium: 'medium', low: 'low',
  }

  const makeActionId = () => `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const ts = () => new Date().toISOString()

  const vulnRe = /\[记录漏洞\]\n([\s\S]*?)(?=\n\[|$)/g
  let m
  while ((m = vulnRe.exec(reply)) !== null) {
    const b = m[1]
    const t = b.match(/标题[:：]\s*(.+)/)?.[1]?.trim() || 'AI 发现漏洞'
    const s = SEV_MAP[b.match(/严重性[:：]\s*(.+)/)?.[1]?.trim() || ''] || 'medium'
    const tg = b.match(/目标[:：]\s*(.+)/)?.[1]?.trim() || ''
    const cv = parseFloat(b.match(/CVSS[:：]\s*([\d.]+)/)?.[1] || '5')
    const poc = b.match(/POC[:：]\s*([\s\S]*?)(?=\n\S|$)/)?.[1]?.trim() || ''
    const fix = b.match(/修复建议[:：]\s*([\s\S]*?)(?=\n\S|$)/)?.[1]?.trim() || ''

    findingStore.addFinding({
      title: t, description: t, severity: s, target: tg,
      cvss_score: cv, tags: ['ai-pentest', s],
      evidence: `## POC\n\`\`\`\n${poc}\n\`\`\`\n\n${reply}`,
      remediation: fix,
    })
    const cur = ptStore.state?.phases.find((p) => p.status === 'running')
    if (cur) ptStore.addFinding(cur.name, t)
    actionMessages.push({
      id: makeActionId(), session_id: sessionId, role: 'system', type: 'action_vuln',
      content: JSON.stringify({ title: t, severity: s, target: tg, cvss: cv }),
      created_at: ts(),
    })
  }

  const infoRe = /\[记录信息\]\n([\s\S]*?)(?=\n\[|$)/g
  while ((m = infoRe.exec(reply)) !== null) {
    const pn = m[1].match(/阶段[:：]\s*(.+)/)?.[1]?.trim()
    if (pn) {
      if (!ptStore.state?.phases.find((p) => p.name === pn)) ptStore.addPhase(pn)
      const detail = m[1].replace(/阶段[:：].+\n?/, '').trim()
      actionMessages.push({
        id: makeActionId(), session_id: sessionId, role: 'system', type: 'action_phase',
        content: JSON.stringify({ phase: pn, status: 'running', detail }),
        created_at: ts(),
      })
    }
  }

  const phaseRe = /\[阶段完成\]\n([\s\S]*?)(?=\n\[|$)/g
  while ((m = phaseRe.exec(reply)) !== null) {
    const pn = m[1].match(/阶段[:：]\s*(.+)/)?.[1]?.trim()
    if (pn) {
      if (!ptStore.state?.phases.find((p) => p.name === pn)) ptStore.addPhase(pn)
      ptStore.completePhase(pn)
      actionMessages.push({
        id: makeActionId(), session_id: sessionId, role: 'system', type: 'action_phase',
        content: JSON.stringify({ phase: pn, status: 'completed' }),
        created_at: ts(),
      })
    }
  }

  return actionMessages
}

export function ChatWindow() {
  const currentSessionId = useChatStore((s) => s.currentSessionId)
  const sessionMessages = useChatStore((s) => s.sessionMessages)
  const addMessage = useChatStore((s) => s.addMessage)
  const sessions = useChatStore((s) => s.sessions)
  const navigate = useNavigate()

  const scrollRef = useRef<HTMLDivElement>(null)
  const messages: ChatMessage[] = currentSessionId ? (sessionMessages[currentSessionId] || []) : []
  const currentSession = sessions.find((s) => s.id === currentSessionId)
  const { sendToLLM, isConfigured, config } = useLLM()
  const { startWorkflowRun, stopWorkflowRun, isRunning } = useWorkflowRunner()

  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null)
  const [showWfPicker, setShowWfPicker] = useState(false)
  const [penTestMode, setPenTestMode] = useState(false)

  // 滚动到底部：消息变化 + 切换会话时都滚
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
          if (el) el.scrollTop = el.scrollHeight
        }
      })
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, currentSessionId, scrollToBottom])

  const handleSend = useCallback(async (content: string) => {
    if (!currentSessionId) return

    // 1. 添加用户消息
    const userMsg: ChatMessage = {
      id: generateId(),
      session_id: currentSessionId,
      role: 'user',
      type: 'text',
      content: selectedWorkflow ? `【工作流：${selectedWorkflow.name}】\n${content}` : content,
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)

    // 更新 session 元信息
    useChatStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === currentSessionId
          ? { ...s, title: s.message_count === 0 ? content.slice(0, 30) : s.title, updated_at: new Date().toISOString(), message_count: s.message_count + 1 }
          : s,
      ),
    }))

    // 2. 如果选择了工作流 + 用户输入包含"渗透/测试/扫描/攻击"关键词 → AI 先思考再启动
    if (selectedWorkflow && /渗透|测试|扫描|攻击|安全|检测|审计/.test(content)) {
      // 2.1 AI 思考：分析用户输入是否合理
      const thinkingMsg: ChatMessage = {
        id: generateId(),
        session_id: currentSessionId,
        role: 'assistant',
        type: 'text',
        content: `🤔 **正在分析您的需求...**\n\n工作流：${selectedWorkflow.name}\n您的输入：${content}`,
        created_at: new Date().toISOString(),
      }
      addMessage(thinkingMsg)

      // 提取目标（IP / 域名 / URL）
      const target = extractTarget(content)
      if (!target) {
        const errMsg: ChatMessage = {
          id: generateId(),
          session_id: currentSessionId,
          role: 'assistant',
          type: 'text',
          content: `⚠️ **无法识别目标**\n\n您选择的工作流「${selectedWorkflow.name.replace('🔴 ', '')}」需要一个明确的目标（IP/域名/URL）。\n\n请重新输入，例如：\n- "对 example.com 进行渗透测试"\n- "扫描 192.168.1.0/24"\n- "测试 https://api.example.com 的安全性"`,
          created_at: new Date().toISOString(),
        }
        addMessage(errMsg)
        return
      }

      // 2.2 显示思考结果
      const analysisMsg: ChatMessage = {
        id: generateId(),
        session_id: currentSessionId,
        role: 'assistant',
        type: 'text',
        content: `✅ **需求分析通过**\n\n🎯 目标：\`${target}\`\n📋 工作流：${selectedWorkflow.name.replace('🔴 ', '')}\n🔧 节点数：${selectedWorkflow.nodes.length}\n\n即将按工作流执行：信息收集 → 端口扫描 → 漏洞检测 → 利用 → 报告...`,
        created_at: new Date().toISOString(),
      }
      addMessage(analysisMsg)

      // 2.3 启动工作流（用提取的 target 而非用户原始 content）
      startWorkflowRun(selectedWorkflow.name, selectedWorkflow.nodes, selectedWorkflow.edges, target)
      return
    }

    // 3. 否则走常规 AI 对话
    const loadingId = generateId()
    const thinkingText = penTestMode
      ? `🔍 AI 红队智能体正在思考...\n\n正在分析：\n- 目标：${(usePenTestStore.getState().state?.target) || '提取中'}\n- 阶段：${(usePenTestStore.getState().state?.phases.length || 0) === 0 ? '尚未开始' : '阶段 ' + (usePenTestStore.getState().state?.phases.length || 0)}\n- 可用技能：${(useSkillStore.getState().skills.length)} 个\n\n正在调用 AI 模型（${config.model}）生成渗透测试结果...`
      : isConfigured
        ? `💭 AI 正在思考...\n\n已加载历史消息：${chatHistory.length} 条\n模型：${config.model}\n\n等待 AI 回复...`
        : '⚠️ 请先在「设置 → AI 模型配置」中配置 API 密钥。'
    const loadingMsg: ChatMessage = {
      id: loadingId, session_id: currentSessionId, role: 'assistant', type: 'text',
      content: thinkingText,
      created_at: new Date().toISOString(),
    }
    addMessage(loadingMsg)
    // 强制滚动到底部
    scrollToBottom()
    useChatStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === currentSessionId ? { ...s, updated_at: new Date().toISOString(), message_count: s.message_count + 1 } : s,
      ),
    }))

    const state = useChatStore.getState()
    const currentMessages = state.sessionMessages[currentSessionId] || []
    const chatHistory = currentMessages.filter((m) => m.id !== loadingId && m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))

    // AI 对话消息构建
    let enhancedContent = content
    if (penTestMode) {
      const ptStore = usePenTestStore.getState()
      if (!ptStore.state || !ptStore.state.active) {
        // 首轮：启动渗透测试 + 注入系统提示（只定义工具，不定义规则）
        ptStore.startPentest(content)
        enhancedContent = `${AGENT_SYSTEM_PROMPT}\n\n用户目标：${content}\n\n请开始你的渗透测试。`
      } else {
        // 后续轮次：告诉 AI 目前的状态（不预设任何阶段）
        const phases = ptStore.state.phases
          .filter((p) => p.status === 'completed')
          .map((p) => `- ${p.name}: ✅ 完成（${p.findings.length} 个发现）`)
          .join('\n')
        enhancedContent = `你正在对 ${ptStore.state.target} 进行渗透测试。\n\n目前已完成：\n${phases || '- 尚无完成阶段'}\n\n总发现漏洞：${ptStore.state.totalFindings} 个\n\n继续：${content}`
      }
    } else if (selectedWorkflow) {
      enhancedContent = `我正在执行一个名为「${selectedWorkflow.name}」的渗透测试工作流，它有 ${selectedWorkflow.nodes.length} 个步骤。请根据工作流的结构给出专业的渗透测试指导。\n\n工作流说明：${selectedWorkflow.description}\n\n用户输入：${content}`
    }

    try {
      const reply = await sendToLLM(enhancedContent, chatHistory)

      // 清理 AI 回复中的 [xxx] 指令块（更健壮的正则，避免误删正文）
      const cleanReply = reply
        .replace(/\[记录漏洞\][\s\S]*?(?=\[|$)/g, '')
        .replace(/\[记录信息\][\s\S]*?(?=\[|$)/g, '')
        .replace(/\[阶段完成\][\s\S]*?(?=\[|$)/g, '')
        .replace(/\[查询技能\][\s\S]*?(?=\[|$)/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // 渗透测试模式：执行动作 + 追加卡片 —— 单次 setState 批量写入
      const actionCards = penTestMode ? executeAIActions(reply, currentSessionId) : []
      // AI 回复的最终显示内容（如果清空了就显示 AI 已执行操作的提示）
      const finalContent = cleanReply || `✅ AI 已根据渗透测试结果执行了 ${actionCards.length} 个操作。\n\n请查看下方可视化卡片了解详情。`
      if (penTestMode) {
        console.log('[PenTest] AI reply length:', reply.length, 'actions:', actionCards.length, 'cleaned:', !!cleanReply)
      }

      useChatStore.setState((st) => {
        const msgs = (st.sessionMessages[currentSessionId] || []).map((m) =>
          m.id === loadingId ? { ...m, content: finalContent, metadata: { ...m.metadata, model: config.model } } : m,
        )
        return {
          sessionMessages: { ...st.sessionMessages, [currentSessionId]: [...msgs, ...actionCards] },
        }
      })
      // AI 回复后滚到底部
      scrollToBottom()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      useChatStore.setState((st) => ({
        sessionMessages: {
          ...st.sessionMessages,
          [currentSessionId]: (st.sessionMessages[currentSessionId] || []).map((m) =>
            m.id === loadingId ? { ...m, content: `❌ AI 请求失败：${errMsg}` } : m,
          ),
        },
      }))
    }
  }, [currentSessionId, addMessage, sendToLLM, isConfigured, config.model, selectedWorkflow, startWorkflowRun])

  if (!currentSessionId) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-[#1e293b] bg-[#1a1f2e]">
        <div className="text-center text-[#64748b]">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>请从左侧选择或创建一个对话</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#1e293b] bg-[#1a1f2e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e293b] flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-white">{currentSession?.title || '对话'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPenTestMode(!penTestMode)}
            className={cn(
              'flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] transition-all',
              penTestMode
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-[#1e293b] bg-[#111827] text-[#64748b] hover:text-white',
            )}
            title={penTestMode ? '关闭渗透测试模式' : '开启渗透测试模式'}
          >
            <Shield className="h-3 w-3" />
            {penTestMode ? '渗透测试 ON' : '渗透测试 OFF'}
          </button>
          <Sparkles className="h-3 w-3 text-cyber-cyan" />
          <span className="text-[10px] text-[#64748b]">{currentSession?.model || 'gpt-4o'}</span>
        </div>
      </div>

      {/* Workflow selector bar */}
      <div className="border-b border-[#1e293b] px-3 py-2 flex-shrink-0 bg-[#0d1321]/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWfPicker(!showWfPicker)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all',
              selectedWorkflow
                ? 'border-cyber-cyan/30 bg-cyber-cyan/10 text-cyber-cyan'
                : 'border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-white hover:border-[#334155]',
            )}
          >
            <Workflow className="h-3 w-3" />
            {selectedWorkflow ? selectedWorkflow.name.replace('🔴 ', '') : '选择工作流'}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>

          {selectedWorkflow && (
            <button
              onClick={() => { setSelectedWorkflow(null); toast.info('已取消工作流选择') }}
              className="text-[#64748b] hover:text-red-400 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {selectedWorkflow && !isRunning && (
            <span className="text-[10px] text-[#64748b]">
              {selectedWorkflow.nodes.length} 节点 · 点击输入框发送目标开始执行
            </span>
          )}

          {/* 一键停止按钮 - 工作流执行中显示 */}
          {isRunning && (
            <Button
              onClick={stopWorkflowRun}
              size="sm"
              className="h-7 ml-auto bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-md text-xs px-2.5 flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <Square className="h-3 w-3 fill-current" />
              停止工作流
            </Button>
          )}

          {!selectedWorkflow && !isRunning && (
            <span className="text-[10px] text-[#475569]">
              选择一个工作流模板，AI 将按流程执行
            </span>
          )}
        </div>
      </div>

      {/* Workflow picker dropdown */}
      {showWfPicker && (
        <div className="border-b border-[#1e293b] bg-[#0d1321] px-4 py-3 max-h-[280px] overflow-y-auto">
          <p className="text-[11px] text-[#64748b] mb-2">选择工作流模板</p>
          <div className="grid grid-cols-2 gap-2">
            {WORKFLOW_TEMPLATES.map((wf) => (
              <button
                key={wf.id}
                onClick={() => { setSelectedWorkflow(wf); setShowWfPicker(false); toast.success(`已选择：${wf.name.replace('🔴 ', '')}`) }}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-all text-xs',
                  selectedWorkflow?.id === wf.id
                    ? 'border-cyber-cyan/50 bg-cyber-cyan/10'
                    : 'border-[#1e293b] bg-[#111827] hover:border-cyber-cyan/30',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white text-[11px]">{wf.icon} {wf.name.replace('🔴 ', '')}</span>
                  <span className="text-[#64748b]">{wf.nodes.length} 节点</span>
                </div>
                <p className="text-[10px] text-[#64748b] line-clamp-2">{wf.description.slice(0, 80)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {wf.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[9px] bg-[#0d1321] px-1 rounded text-[#64748b]">#{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/workflows')}
            className="text-[10px] text-cyber-cyan hover:underline mt-2 block text-right"
          >
            查看更多工作流 →
          </button>
        </div>
      )}

      {/* 渗透测试模式进度条 */}
      {penTestMode && (() => {
        const ptState = usePenTestStore.getState().state
        if (!ptState) return null
        return (
          <div className="border-b border-[#1e293b] px-4 py-2 bg-[#0d1321]/30 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-[10px]">
                <Shield className="h-3 w-3 text-red-400" />
                <span className="text-[#94a3b8]">{ptState.target}</span>
                <span className="text-[#64748b]">发现 {ptState.totalFindings} 个漏洞</span>
              </div>
              <span className="text-[10px] text-[#64748b]">{ptState.phases.filter((p) => p.status === 'completed').length}/{ptState.phases.length}</span>
            </div>
            <div className="flex gap-1">
              {ptState.phases.map((phase) => (
                <div
                  key={phase.name}
                  className={cn(
                    'flex-1 h-1.5 rounded-full transition-all',
                    phase.status === 'completed' && 'bg-green-500',
                    phase.status === 'running' && 'bg-cyber-cyan animate-pulse',
                    phase.status === 'failed' && 'bg-red-500',
                    phase.status === 'pending' && 'bg-[#0a0f1a]',
                  )}
                  title={`${phase.name}: ${phase.status}（${phase.findings.length} 个发现）`}
                />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyber-cyan/10 border border-cyber-cyan/20 mb-4">
              <MessageSquare className="h-8 w-8 text-cyber-cyan" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">开始对话</h3>
            <p className="text-sm text-[#94a3b8] max-w-md mb-2">
              描述您的安全测试需求，或选择工作流模板执行渗透测试。
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-2xl">
              {['扫描 example.com', '检测 SQL 注入', '设计 API 测试方案', '生成渗透报告'].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="rounded-lg border border-[#1e293b] bg-[#111827] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-cyber-cyan hover:border-cyber-cyan/30 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((msg) => (
              <ChatMessageView key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-[#1e293b] p-3 flex-shrink-0">
        <ChatInput
          onSend={handleSend}
          placeholder={selectedWorkflow
            ? `对 XXX 进行 ${selectedWorkflow.name.replace('🔴 ', '')}...`
            : '输入消息...（Enter 发送，Shift+Enter 换行）'}
        />
      </div>
    </div>
  )
}

/** 从用户输入中提取渗透测试目标（IP/域名/URL/CIDR） */
function extractTarget(input: string): string | null {
  // URL
  const urlMatch = input.match(/https?:\/\/[^\s\u4e00-\u9fa5]+/i)
  if (urlMatch) return urlMatch[0].replace(/[，。.,;；:：]+$/, '')
  // CIDR
  const cidrMatch = input.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}/)
  if (cidrMatch) return cidrMatch[0]
  // 单 IP
  const ipMatch = input.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
  if (ipMatch) return ipMatch[0]
  // 域名（带后缀）
  const domainMatch = input.match(/([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/)
  if (domainMatch) return domainMatch[0]
  return null
}
