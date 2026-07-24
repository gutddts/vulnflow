import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ChatSession } from '@/types/chat'

interface ChatState {
  sessions: ChatSession[]
  currentSessionId: string | null
  /** 按 sessionId 隔离的消息列表 */
  sessionMessages: Record<string, ChatMessage[]>
  /** 当前 session 的消息（派生自 sessionMessages[currentSessionId]） */
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingContent: string
  error: string | null

  setSessions: (sessions: ChatSession[]) => void
  setCurrentSession: (sessionId: string) => void
  addSession: (session: ChatSession) => void
  removeSession: (id: string) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  removeMessage: (id: string) => void
  setMessages: (messages: ChatMessage[]) => void
  setLoading: (loading: boolean) => void
  setStreaming: (streaming: boolean) => void
  appendStreamContent: (content: string) => void
  clearStreaming: () => void
  setError: (error: string | null) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  sessions: [],
  currentSessionId: null,
  sessionMessages: {},
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  error: null,

  setSessions: (sessions) => set({ sessions }),

  setCurrentSession: (sessionId) => {
    const { sessionMessages } = get()
    set({
      currentSessionId: sessionId,
      messages: sessionMessages[sessionId] || [],
    })
  },

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSessionId: session.id,
      sessionMessages: { ...state.sessionMessages, [session.id]: [] },
      messages: [], // 切换到新 session，messages 清空
    })),

  removeSession: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.sessionMessages
      const newCurrent =
        state.currentSessionId === id
          ? state.sessions.find((s) => s.id !== id)?.id ?? null
          : state.currentSessionId
      return {
        sessions: state.sessions.filter((s) => s.id !== id),
        currentSessionId: newCurrent,
        sessionMessages: rest,
        messages: newCurrent ? rest[newCurrent] || [] : [],
      }
    }),

  addMessage: (message) => {
    const { currentSessionId, sessionMessages, sessions } = get()
    if (!currentSessionId) return
    const currentList = sessionMessages[currentSessionId] || []
    const updated = [...currentList, message]
    // 同时更新 session 的 updated_at + message_count
    const updatedSessions = sessions.map((s) =>
      s.id === currentSessionId
        ? { ...s, updated_at: new Date().toISOString(), message_count: (s.message_count || 0) + 1 }
        : s,
    )
    set({
      sessionMessages: { ...sessionMessages, [currentSessionId]: updated },
      messages: updated,
      sessions: updatedSessions,
    })
  },

  updateMessage: (id, updates) => {
    const { currentSessionId, sessionMessages, messages } = get()
    if (!currentSessionId) return
    const currentList = sessionMessages[currentSessionId] || messages
    const updated = currentList.map((m) => (m.id === id ? { ...m, ...updates } : m))
    set({
      sessionMessages: { ...sessionMessages, [currentSessionId]: updated },
      messages: updated,
    })
  },

  removeMessage: (id) => {
    const { currentSessionId, sessionMessages, messages } = get()
    if (!currentSessionId) return
    const currentList = sessionMessages[currentSessionId] || messages
    const updated = currentList.filter((m) => m.id !== id)
    set({
      sessionMessages: { ...sessionMessages, [currentSessionId]: updated },
      messages: updated,
    })
  },

  setMessages: (messages) => {
    const { currentSessionId, sessionMessages } = get()
    if (!currentSessionId) {
      set({ messages })
      return
    }
    set({
      messages,
      sessionMessages: { ...sessionMessages, [currentSessionId]: messages },
    })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  appendStreamContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content,
    })),

  clearStreaming: () => set({ streamingContent: '', isStreaming: false }),

  setError: (error) => set({ error }),

  clearMessages: () => {
    const { currentSessionId, sessionMessages } = get()
    if (!currentSessionId) {
      set({ messages: [] })
      return
    }
    set({
      messages: [],
      sessionMessages: { ...sessionMessages, [currentSessionId]: [] },
    })
  },
}), {
  name: 'vulnflow-chat',
  partialize: (state) => ({
    sessions: state.sessions,
    sessionMessages: state.sessionMessages,
    currentSessionId: state.currentSessionId,
  }),
}))
