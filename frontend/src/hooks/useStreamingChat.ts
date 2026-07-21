import { useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { generateId } from '@/lib/utils'
import type { ChatMessage } from '@/types/chat'

export function useStreamingChat() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    addMessage,
    updateMessage,
    setLoading,
    setStreaming,
    appendStreamContent,
    clearStreaming,
    setError,
  } = useChatStore()
  const token = useAuthStore((s) => s.token)

  const sendMessage = useCallback(
    async (content: string, sessionId: string) => {
      if (!content.trim() || isLoading) return

      const userMessage: ChatMessage = {
        id: generateId(),
        session_id: sessionId,
        role: 'user',
        content,
        type: 'text',
        created_at: new Date().toISOString(),
      }
      addMessage(userMessage)

      const assistantId = generateId()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        session_id: sessionId,
        role: 'assistant',
        content: '',
        type: 'text',
        created_at: new Date().toISOString(),
        streaming: true,
      }
      addMessage(assistantMessage)

      setLoading(true)
      setStreaming(true)
      setError(null)

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const response = await fetch('/api/v1/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            message: content,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let fullContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  fullContent += parsed.content
                  appendStreamContent(parsed.content)
                  updateMessage(assistantId, { content: fullContent })
                }
              } catch {
                fullContent += data
                appendStreamContent(data)
                updateMessage(assistantId, { content: fullContent })
              }
            }
          }
        }

        updateMessage(assistantId, { streaming: false })
        clearStreaming()
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          updateMessage(assistantId, { streaming: false })
        } else {
          const msg = error instanceof Error ? error.message : '发送消息失败'
          setError(msg)
          updateMessage(assistantId, {
            content: `错误: ${msg}`,
            streaming: false,
          })
        }
      } finally {
        setLoading(false)
        setStreaming(false)
        abortControllerRef.current = null
      }
    },
    [token, isLoading, addMessage, updateMessage, setLoading, setStreaming, appendStreamContent, clearStreaming, setError],
  )

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStream,
  }
}
