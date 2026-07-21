import { useEffect, useState } from 'react'
import { Plus, MessageSquare, Trash2, Clock, MoreHorizontal, Sparkles } from 'lucide-react'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ContextPanel } from '@/components/chat/ContextPanel'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/stores/chatStore'
import { ensureSeedData } from '@/stores/chatSeed'
import { generateId, formatRelativeTime, cn } from '@/lib/utils'

export function ChatPage() {
  const sessions = useChatStore((s) => s.sessions)
  const currentSessionId = useChatStore((s) => s.currentSessionId)
  const setCurrentSession = useChatStore((s) => s.setCurrentSession)
  const addSession = useChatStore((s) => s.addSession)
  const removeSession = useChatStore((s) => s.removeSession)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // 首次挂载：seed 数据 + 选中第一个 session
  useEffect(() => {
    ensureSeedData()
    if (!currentSessionId) {
      const state = useChatStore.getState()
      const firstId = state.sessions[0]?.id
      if (firstId) setCurrentSession(firstId)
    }
  }, [])

  const handleNewSession = () => {
    const newId = generateId()
    addSession({
      id: newId,
      title: '新对话',
      project_id: '',
      model: 'gpt-4o',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    })
    // addSession 已经会自动设为 current
  }

  const handleRename = (id: string) => {
    const session = sessions.find((s) => s.id === id)
    if (session) {
      setRenamingId(id)
      setRenameValue(session.title)
    }
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      useChatStore.setState((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === renamingId ? { ...s, title: renameValue.trim() } : s,
        ),
      }))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      {/* ===== 左：会话列表（永远显示全部） ===== */}
      <div className="w-[280px] flex-shrink-0 rounded-xl border border-[#1e293b] bg-[#1a1f2e] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20">
              <MessageSquare className="h-3.5 w-3.5 text-cyber-cyan" />
            </div>
            <h2 className="text-sm font-semibold text-white">对话列表</h2>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNewSession}
            className="h-7 w-7 text-[#94a3b8] hover:text-cyber-cyan hover:bg-cyber-cyan/10 rounded-lg"
            title="新建对话"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Session list - 全部显示 */}
        <ScrollArea className="flex-1 p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#64748b]">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">暂无对话</p>
              <p className="text-[10px] mt-1">点击 + 创建新对话</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => {
                const isActive = session.id === currentSessionId
                const isRenaming = renamingId === session.id
                return (
                  <div
                    key={session.id}
                    onClick={() => !isRenaming && setCurrentSession(session.id)}
                    onDoubleClick={() => handleRename(session.id)}
                    className={cn(
                      'group flex items-start gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200',
                      isActive
                        ? 'bg-cyber-cyan/10 border border-cyber-cyan/20 shadow-[0_0_10px_rgba(0,212,170,0.05)]'
                        : 'hover:bg-[#111827] border border-transparent',
                    )}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-cyan/20 to-purple-500/20 border border-cyber-cyan/10">
                      <MessageSquare className={cn(
                        'h-3.5 w-3.5',
                        isActive ? 'text-cyber-cyan' : 'text-[#94a3b8]',
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                          }}
                          autoFocus
                          className="w-full bg-[#111827] border border-cyber-cyan/30 rounded px-1 py-0.5 text-sm text-white outline-none"
                        />
                      ) : (
                        <p
                          className={cn(
                            'text-sm truncate font-medium',
                            isActive ? 'text-cyber-cyan' : 'text-[#e2e8f0]',
                          )}
                          title="双击重命名"
                        >
                          {session.title}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#64748b] flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelativeTime(session.updated_at)}
                        </span>
                        <span className="text-[10px] text-[#475569]">
                          {session.message_count} 条
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRename(session.id) }}
                        className="text-[#64748b] hover:text-cyber-cyan transition-colors"
                        title="重命名"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`确定删除「${session.title}」吗？`)) {
                            removeSession(session.id)
                          }
                        }}
                        className="text-[#64748b] hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer info */}
        <div className="border-t border-[#1e293b] p-3">
          <div className="flex items-center justify-between text-[10px] text-[#64748b]">
            <span>{sessions.length} 个会话</span>
            <span className="flex items-center gap-1 text-cyber-cyan/60">
              <Sparkles className="h-2.5 w-2.5" />
              AI 模型
            </span>
          </div>
        </div>
      </div>

      {/* ===== 中：聊天窗口（跟随 currentSession） ===== */}
      <div className="flex-1 min-w-0">
        <ChatWindow />
      </div>

      {/* ===== 右：上下文面板（跟随 currentSession） ===== */}
      <div className="w-[320px] flex-shrink-0 hidden xl:block">
        <ContextPanel />
      </div>
    </div>
  )
}

