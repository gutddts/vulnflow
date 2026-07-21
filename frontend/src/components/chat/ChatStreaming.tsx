import { Bot } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'

export function ChatStreaming() {
  const { streamingContent } = useChatStore()

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#3b82f6] flex-shrink-0">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 rounded-xl bg-[#111827] border border-[#1e293b] px-4 py-3">
        <div className="text-sm text-[#e2e8f0] whitespace-pre-wrap">
          {streamingContent}
          <span className="inline-block w-2 h-4 bg-[#00d4aa] ml-0.5 animate-pulse align-middle" />
        </div>
      </div>
    </div>
  )
}
