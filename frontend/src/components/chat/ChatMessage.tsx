import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { Bot, User, Copy, Check, FileText, CheckCircle2, ChevronDown, ChevronRight, Lightbulb, Play, Square, Terminal } from 'lucide-react'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/utils'
import { importReportFromMarkdown, parseVulnerabilitiesFromMarkdown } from '@/lib/importReport'
import { useChatStore } from '@/stores/chatStore'
import type { ChatMessage } from '@/types/chat'

interface ChatMessageProps {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [imported, setImported] = useState(false)
  const currentSessionId = useChatStore((s) => s.currentSessionId)

  // 渲染系统动作卡片（渗透测试模式）
  if (message.type === 'action_vuln') {
    try {
      const d = JSON.parse(message.content)
      const sevColor: Record<string, string> = {
        critical: 'border-pink-500/30 bg-pink-500/10 text-pink-400',
        high: 'border-red-500/30 bg-red-500/10 text-red-400',
        medium: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
        low: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      }
      return (
        <div className="flex justify-start px-4 py-1">
          <div className={`rounded-lg border ${sevColor[d.severity] || sevColor.medium} px-3 py-2 text-xs w-full max-w-lg`}>
            <div className="flex items-center gap-1.5 font-semibold">
              🔴 漏洞发现
              <span className="ml-auto text-[10px] opacity-70">{d.severity}</span>
            </div>
            <div className="mt-1 text-white/90">{d.title}</div>
            <div className="text-[10px] mt-0.5 opacity-70">目标：{d.target} · CVSS {d.cvss}</div>
          </div>
        </div>
      )
    } catch { return null }
  }

  if (message.type === 'action_phase') {
    try {
      const d = JSON.parse(message.content)
      const isRunning = d.status === 'running'
      return (
        <div className="flex justify-start px-4 py-1">
          <div className={`rounded-lg border ${isRunning ? 'border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan' : 'border-green-500/20 bg-green-500/5 text-green-400'} px-3 py-2 text-xs w-full max-w-lg`}>
            <div className="flex items-center gap-1.5 font-semibold">
              {isRunning ? '🔄' : '✅'} {d.phase}
            </div>
            {d.detail && <div className="mt-0.5 text-white/70 text-[10px]">{d.detail}</div>}
          </div>
        </div>
      )
    } catch { return null }
  }

  // 检测消息是否包含可导入的报告（包含 markdown 表格且有漏洞关键词）
  const hasReportTable = !isUser && message.content && message.content.includes('|') &&
    /漏洞|Vulnerability|injection|XSS|RCE|渗透/.test(message.content)
  const parsedVulnCount = hasReportTable
    ? parseVulnerabilitiesFromMarkdown(message.content).length
    : 0

  const handleImportReport = () => {
    if (imported) return
    const targetMatch = message.content?.match(/(?:目标|测试目标|渗透目标)[\s:：]+[`*]*([^\s*`\n]+)/i)
    const target = targetMatch?.[1] || 'AI 对话目标'
    const title = `AI 对话报告 - ${target}`

    const result = importReportFromMarkdown({
      title,
      content: message.content,
      target,
      sourceSessionId: currentSessionId || undefined,
    })

    setImported(true)
    if (result.findingCount > 0) {
      toast.success(`已导入报告`, {
        description: `提取了 ${result.findingCount} 个漏洞，报告已同步到报告中心`,
      })
    } else {
      toast.success('报告已保存', { description: '标题和内容已同步到报告中心' })
    }
  }

  const handleCopy = async () => {
    await copyToClipboard(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
          isUser
            ? 'bg-gradient-to-br from-[#7c3aed] to-[#ff3385]'
            : 'bg-gradient-to-br from-[#00d4aa] to-[#3b82f6]',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-xl px-4 py-3',
            isUser
              ? 'bg-gradient-to-r from-[#7c3aed] to-[#ff3385] text-white'
              : 'bg-[#111827] border border-[#1e293b] text-[#e2e8f0]',
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const language = match?.[1] || ''
                    const inline = !match
                    const codeStr = String(children).replace(/\n$/, '')
                    const [running, setRunning] = useState(false)
                    const [output, setOutput] = useState('')

                    const handleExecute = useCallback(async () => {
                      setRunning(true)
                      setOutput('启动执行沙箱...\n')
                      const token = useAuthStore.getState().token
                      const target = message.content.match(/(?:https?:\/\/)?([^\s\n]+)/)?.[0] || 'localhost'
                      try {
                        const res = await fetch('/api/v1/ai/exec', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({
                            target,
                            commands: [codeStr],
                            image: 'ubuntu:22.04',
                            timeout: 120,
                          }),
                        })
                        const reader = res.body?.getReader()
                        if (!reader) throw new Error('No response body')
                        const decoder = new TextDecoder()
                        let buf = ''
                        while (true) {
                          const { done, value } = await reader.read()
                          if (done) break
                          buf += decoder.decode(value, { stream: true })
                          const lines = buf.split('\n')
                          buf = lines.pop() || ''
                          for (const line of lines) {
                            if (!line.startsWith('data: ')) continue
                            try {
                              const d = JSON.parse(line.slice(6))
                              if (d.type === 'output') setOutput((prev) => prev + d.content + '\n')
                              if (d.type === 'status') setOutput((prev) => prev + d.content + '\n')
                              if (d.type === 'complete') setOutput((prev) => prev + (d.content || ''))
                              if (d.type === 'error') { setOutput((prev) => prev + '\n❌ ' + d.content + '\n'); toast.error(d.content) }
                            } catch { /* ignore parse errors */ }
                          }
                        }
                      } catch (e: any) {
                        setOutput((prev) => prev + `\n❌ 执行失败: ${e.message}`)
                      } finally {
                        setRunning(false)
                      }
                    }, [codeStr])

                    return !inline ? (
                      <div className="relative group">
                        <div className="flex items-center justify-between bg-[#0d1321] rounded-t-lg px-3 py-1.5 border border-[#1e293b] border-b-0">
                          <span className="text-[10px] text-[#64748b]">{language || 'bash'}</span>
                          {language === 'bash' || language === 'sh' || !language ? (
                            <button
                              onClick={handleExecute}
                              disabled={running}
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 border border-[#00d4aa]/20 disabled:opacity-50 transition-all"
                            >
                              {running ? (
                                <><Square className="h-2.5 w-2.5" /> 执行中...</>
                              ) : (
                                <><Play className="h-2.5 w-2.5" /> 执行</>
                              )}
                            </button>
                          ) : null}
                        </div>
                        <pre className="bg-[#0d1321] rounded-b-lg p-3 overflow-x-auto border border-[#1e293b] border-t-0 m-0">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                        {output && (
                          <div className="bg-[#0a0f1a] rounded-lg p-3 mt-1 border border-[#1e293b] max-h-48 overflow-y-auto">
                            <div className="flex items-center gap-1 mb-1">
                              <Terminal className="h-3 w-3 text-[#00d4aa]" />
                              <span className="text-[10px] text-[#64748b]">执行输出</span>
                            </div>
                            <pre className="text-[11px] text-[#e2e8f0] whitespace-pre-wrap font-mono">{output}</pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <code className="bg-[#0d1321] px-1.5 py-0.5 rounded text-[#00d4aa] text-sm" {...props}>
                        {children}
                      </code>
                    )
                  },
                  pre({ children }) {
                    return <>{children}</>
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* 推理/思考过程展示 */}
        {!isUser && message.metadata?.reasoning && (
          <ReasoningBlock reasoning={message.metadata.reasoning} />
        )}

        {/* Actions */}
        {!isUser && message.content && (
          <div className="flex items-center gap-3 mt-1 ml-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  复制
                </>
              )}
            </button>
            {hasReportTable && (
              <button
                onClick={handleImportReport}
                disabled={imported}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  imported
                    ? 'text-green-400 cursor-default'
                    : 'text-[#64748b] hover:text-[#00d4aa]',
                )}
                title={imported ? '已导入报告中心' : '提取漏洞并保存到报告中心'}
              >
                {imported ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    已导入{parsedVulnCount > 0 && ` (${parsedVulnCount} 个漏洞)`}
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3" />
                    导入报告{parsedVulnCount > 0 && ` (${parsedVulnCount} 个漏洞)`}
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Streaming indicator */}
        {message.streaming && (
          <div className="flex items-center gap-1 mt-1 ml-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="text-xs text-[#64748b]">生成中...</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** 可折叠的 AI 推理过程展示组件 */
function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5 ml-1 max-w-[80%]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-[#8b5cf6] hover:text-[#a78bfa] transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Lightbulb className="h-3 w-3" />
        <span>{open ? '隐藏思考过程' : '查看 AI 思考过程'}</span>
        <span className="text-[#64748b]">({reasoning.length} 字符)</span>
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-[#8b5cf6]/20 bg-[#1e1b4b]/50 px-3 py-2 text-[12px] text-[#c4b5fd] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  )
}

export { ChatMessageBubble as ChatMessage }
