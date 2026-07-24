import { useState, useRef, useEffect } from 'react'
import { Send, Square, Globe, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'

interface ChatInputProps {
  onSend: (content: string, target?: string) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
}

const EXAMPLE_PROMPTS = [
  { label: '完整渗透测试', text: '对 example.com 进行完整渗透测试' },
  { label: '子域名扫描', text: '扫描目标子域名' },
  { label: 'SQL注入检测', text: '检测 SQL 注入漏洞' },
  { label: 'XSS检测', text: '扫描跨站脚本攻击漏洞' },
  { label: '端口扫描', text: '进行全端口扫描和服务识别' },
]

export function ChatInput({ onSend, onCancel, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [showTarget, setShowTarget] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 实际配置的 AI 模型（用户设置中的）
  const configuredModel = useSettingsStore((s) => s.model)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming || disabled) return
    onSend(trimmed, targetUrl || undefined)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePromptClick = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      {/* Target URL input */}
      {showTarget && (
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[#1e293b] bg-[#111827] px-3 transition-all focus-within:border-cyber-cyan/50">
            <Globe className="h-4 w-4 text-[#64748b]" />
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="输入目标 URL（可选）"
              className="flex-1 bg-transparent text-sm text-[#e2e8f0] placeholder-[#64748b] outline-none"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTarget(false)}
            className="text-[#64748b] hover:text-white h-9 text-xs"
          >
            取消
          </Button>
        </div>
      )}

      {/* Example prompts */}
      {!input && !isStreaming && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              onClick={() => handlePromptClick(prompt.text)}
              className="rounded-full border border-[#1e293b] bg-[#111827] px-3 py-1 text-xs text-[#94a3b8] transition-all hover:border-cyber-cyan/30 hover:text-cyber-cyan hover:bg-cyber-cyan/5"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          {/* Input area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的消息... (Enter 发送, Shift+Enter 换行)"
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-[#1e293b] bg-[#111827] px-4 py-3 pr-24 text-sm text-[#e2e8f0] placeholder-[#64748b] outline-none transition-all focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/30 focus:shadow-[0_0_15px_rgba(0,212,170,0.1)] disabled:opacity-50"
          />

          {/* Action buttons inside input */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {!showTarget && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[#64748b] hover:text-cyber-cyan hover:bg-transparent"
                onClick={() => setShowTarget(true)}
                title="设置目标 URL"
              >
                <Globe className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Send / Cancel button */}
        {isStreaming ? (
          <Button
            onClick={onCancel}
            className="h-11 w-11 rounded-xl bg-red-500 hover:bg-red-600 flex-shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className={cn(
              'h-11 w-11 rounded-xl flex-shrink-0 transition-all duration-300',
              input.trim() && !disabled
                ? 'bg-cyber-cyan hover:bg-cyber-cyan/90 text-black shadow-[0_0_15px_rgba(0,212,170,0.3)] hover:shadow-[0_0_25px_rgba(0,212,170,0.5)] scale-105'
                : 'bg-[#1e293b] text-[#64748b]',
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center justify-between text-xs text-[#64748b]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#1e293b] bg-[#111827] px-1 py-0.5 text-[10px]">
              Enter
            </kbd>
            <span>发送</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#1e293b] bg-[#111827] px-1 py-0.5 text-[10px]">
              Shift+Enter
            </kbd>
            <span>换��</span>
          </span>
        </div>
        <span className="text-[#475569]">
          VulnFlow AI 助手 - 模型: {configuredModel}
        </span>
      </div>
    </div>
  )
}
