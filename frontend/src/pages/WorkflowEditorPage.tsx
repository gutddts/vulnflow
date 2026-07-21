import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Workflow,
  Plus,
  Play,
  Save,
  Undo2,
  Redo2,
  Search,
  Trash2,
  Copy,
  Zap,
  Target,
  Shield,
  Crosshair,
  FileText,
  ChevronRight,
  X,
  Database,
  Code,
  Lock,
  ArrowLeft,
  Server,
  Cog,
  Code2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflowStore'
import { cn } from '@/lib/utils'
import type { WorkflowNode, WorkflowNodeType } from '@/types/workflow'
import { generateId } from '@/lib/utils'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/stores/workflowSeed'

const TEMPLATES = WORKFLOW_TEMPLATES.map((w) => ({
  id: w.id,
  name: w.name,
  description: w.description,
  nodes: w.nodes.length,
  icon: w.icon,
  tags: w.tags,
  reference: w.reference,
  seedNodes: w.nodes,
  seedEdges: w.edges,
}))

// 可用节点类型
const NODE_TYPES: {
  type: WorkflowNodeType
  label: string
  icon: typeof Zap
  color: string
  bg: string
  border: string
}[] = [
  { type: 'data_collection', label: '信息收集', icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/40' },
  { type: 'nmap_scan', label: 'Nmap 扫描', icon: Search, color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40' },
  { type: 'vulnerability_scan', label: '漏洞扫描', icon: Target, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' },
  { type: 'exploit', label: '漏洞利用', icon: Crosshair, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/40' },
  { type: 'post_exploit', label: '后渗透', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40' },
  { type: 'skill_execution', label: '技能执行', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40' },
  { type: 'mcp_tool', label: 'MCP 工具调用', icon: Server, color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/40' },
  { type: 'decision', label: '条件判断', icon: Code, color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/40' },
  { type: 'input', label: '输入参数', icon: Lock, color: 'text-cyan-300', bg: 'bg-cyan-400/20', border: 'border-cyan-400/40' },
  { type: 'output', label: '输出结果', icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' },
  { type: 'report', label: '生成报告', icon: FileText, color: 'text-[#00d4aa]', bg: 'bg-[#00d4aa]/20', border: 'border-[#00d4aa]/40' },
]

const STATUS_BORDER: Record<string, string> = {
  idle: 'border-[#1e293b]',
  running: 'border-[#00d4aa] shadow-[0_0_15px_rgba(0,212,170,0.3)]',
  completed: 'border-green-500/60',
  failed: 'border-red-500/60',
  skipped: 'border-gray-500/40',
}

interface DragState {
  type: 'new' | 'move'
  nodeType?: WorkflowNodeType
  nodeId?: string
  offsetX: number
  offsetY: number
}

export function WorkflowEditorPage() {
  const {
    currentWorkflow,
    workflows,
    undoStack,
    redoStack,
    isDirty,
    undo,
    redo,
    createWorkflow,
    deleteWorkflow,
    setCurrentWorkflow,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    markClean,
    setExecution,
  } = useWorkflowStore()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)

  const makeNode = useCallback(
    (type: WorkflowNodeType, label: string, x: number, y: number): WorkflowNode => ({
      id: generateId(),
      type,
      label,
      position: { x, y },
      config: {},
      status: 'idle' as const,
    }),
    [],
  )

  const handleUseTemplate = () => {
    const template = TEMPLATES.find((t) => t.id === selectedTemplate)
    if (!template) return
    // 节点的 id 和 edges 的 source/target 已经直接对应（由 buildWorkflow 生成）
    createWorkflow(template.name, template.description, template.seedNodes, template.seedEdges)
    setSelectedTemplate(null)
    toast.success(`已创建工作流：${template.name}`)
  }

  const handleCreateBlank = () => {
    const name = `新工作流 ${workflows.length + 1}`
    createWorkflow(name, '空白工作流', [], [])
    toast.success(`已创建：${name}`)
  }

  const handleBackToTemplates = () => {
    if (isDirty && !window.confirm('当前工作流有未保存修改，确定离开吗？')) return
    setCurrentWorkflow(null)
    setSelectedNodeId(null)
    setConnectingFrom(null)
  }

  const handleSave = () => {
    toast.success('工作流已保存（演示模式）')
    markClean()
  }

  const handleRun = () => {
    if (!currentWorkflow) return
    toast.success('工作流已启动！')
    setExecution({
      id: `exec-${Date.now()}`,
      workflow_id: currentWorkflow.id,
      status: 'running',
      started_at: new Date().toISOString(),
      progress: 0,
      logs: [],
    })
  }

  // 自定义拖拽 - 节点面板项
  const handlePaletteMouseDown = (e: React.MouseEvent, nodeType: WorkflowNodeType) => {
    if (e.button !== 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX
    const startY = e.clientY
    dragStateRef.current = {
      type: 'new',
      nodeType,
      offsetX: e.clientX - rect.left - 70,
      offsetY: e.clientY - rect.top - 25,
    }

    let isDragging = false
    const onMove = (ev: MouseEvent) => {
      // 移动距离 > 5px 才算开始拖
      if (!isDragging) {
        if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return
        isDragging = true
        document.body.style.cursor = 'grabbing'
      }
      if (dragStateRef.current) {
        const r = canvasRef.current?.getBoundingClientRect()
        if (!r) return
        dragStateRef.current.offsetX = ev.clientX - r.left - 70
        dragStateRef.current.offsetY = ev.clientY - r.top - 25
      }
    }
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      if (!isDragging || !dragStateRef.current) {
        dragStateRef.current = null
        return
      }
      // 在 canvas 中
      if (!canvasRef.current) {
        dragStateRef.current = null
        return
      }
      const r = canvasRef.current.getBoundingClientRect()
      if (
        ev.clientX < r.left ||
        ev.clientX > r.right ||
        ev.clientY < r.top ||
        ev.clientY > r.bottom
      ) {
        dragStateRef.current = null
        return
      }
      if (!currentWorkflow) {
        // 自动创建工作流
        const name = `新工作流 ${workflows.length + 1}`
        const def = NODE_TYPES.find((n) => n.type === dragStateRef.current.nodeType)
        if (!def) return
        const x = Math.max(0, dragStateRef.current.offsetX)
        const y = Math.max(0, dragStateRef.current.offsetY)
        createWorkflow(name, '拖拽创建的工作流', [makeNode(dragStateRef.current.nodeType, def.label, x, y)], [])
        toast.success(`已创建工作流并添加节点：${def.label}`)
      } else {
        const def = NODE_TYPES.find((n) => n.type === dragStateRef.current.nodeType)
        if (!def) return
        const x = Math.max(0, dragStateRef.current.offsetX)
        const y = Math.max(0, dragStateRef.current.offsetY)
        addNode(makeNode(dragStateRef.current.nodeType, def.label, x, y))
      }
      dragStateRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // 自定义拖拽 - 已有节点
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = currentWorkflow?.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragStateRef.current = {
      type: 'move',
      nodeId,
      offsetX: e.clientX - rect.left - node.position.x,
      offsetY: e.clientY - rect.top - node.position.y,
    }
    let isDragging = false
    const onMove = (ev: MouseEvent) => {
      if (!isDragging) {
        if (Math.abs(ev.clientX - e.clientX) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return
        isDragging = true
        document.body.style.cursor = 'grabbing'
      }
      if (dragStateRef.current?.type === 'move' && dragStateRef.current.nodeId) {
        const r = canvasRef.current?.getBoundingClientRect()
        if (!r) return
        const x = ev.clientX - r.left - dragStateRef.current.offsetX
        const y = ev.clientY - r.top - dragStateRef.current.offsetY
        updateNode(dragStateRef.current.nodeId, {
          position: { x: Math.max(0, x), y: Math.max(0, y) },
        })
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      dragStateRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleNodeClick = (id: string) => {
    if (connectingFrom && connectingFrom !== id) {
      addEdge({
        id: generateId(),
        source: connectingFrom,
        target: id,
      })
      setConnectingFrom(null)
      toast.success('已连接节点')
      return
    }
    setSelectedNodeId(id)
  }

  const handleConnectClick = (id: string) => {
    if (connectingFrom === id) {
      setConnectingFrom(null)
      return
    }
    setConnectingFrom(id)
    toast.info('请点击目标节点完成连接')
  }

  const handleDeleteNode = (id: string) => {
    removeNode(id)
    if (selectedNodeId === id) setSelectedNodeId(null)
    if (connectingFrom === id) setConnectingFrom(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && selectedNodeId) {
          handleDeleteNode(selectedNodeId)
        }
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null)
        setConnectingFrom(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNodeId, connectingFrom])

  const selectedNode = currentWorkflow?.nodes.find((n) => n.id === selectedNodeId) ?? null

  return (
    <div className="space-y-4 h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {currentWorkflow && (
            <Button
              variant="outline"
              size="sm"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e]"
              onClick={handleBackToTemplates}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              返回
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">工作流编辑器</h1>
            <p className="text-sm text-[#94a3b8] mt-1">
              {currentWorkflow ? (
                <>
                  {currentWorkflow.name} · {currentWorkflow.nodes.length} 节点 · {currentWorkflow.edges.length} 连线
                  {isDirty && <span className="text-orange-400 ml-2">· 未保存</span>}
                </>
              ) : (
                '可视化编排渗透测试流程'
              )}
            </p>
          </div>
        </div>
        {currentWorkflow && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e]"
              onClick={undo}
              disabled={undoStack.length === 0}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e]"
              onClick={redo}
              disabled={redoStack.length === 0}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="h-6 w-px bg-[#1e293b]" />
            <Button
              variant="outline"
              size="sm"
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e]"
              onClick={handleSave}
              disabled={!isDirty}
            >
              <Save className="h-4 w-4 mr-1.5" />
              保存
            </Button>
            <Button
              size="sm"
              className="bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.2)]"
              onClick={handleRun}
            >
              <Play className="h-4 w-4 mr-1.5" />
              运行
            </Button>
          </div>
        )}
      </div>

      {!currentWorkflow ? (
        // 模板选择视图
        <div className="flex-1 overflow-y-auto space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">从模板开始</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((template) => {
                const isSelected = selectedTemplate === template.id
                return (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={cn(
                      'rounded-xl border p-4 transition-all duration-300 cursor-pointer',
                      isSelected
                        ? 'border-[#00d4aa]/40 bg-[#00d4aa]/5 shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                        : 'border-[#1e293b] bg-[#1a1f2e] hover:border-[#00d4aa]/20',
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={cn('text-sm font-semibold', isSelected ? 'text-[#00d4aa]' : 'text-white')}>
                        {template.name}
                      </h3>
                      <span className="text-lg">{template.icon}</span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8] mb-2 line-clamp-2">{template.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className="text-[10px] text-[#64748b] bg-[#111827] px-1.5 py-0.5 rounded border border-[#1e293b]">
                        {template.nodes} 个节点
                      </span>
                      {template.tags?.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[10px] text-[#00d4aa]/70 bg-[#00d4aa]/5 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {template.reference && (
                      <p className="text-[9px] text-[#64748b]">参考: {template.reference}</p>
                    )}
                    {isSelected && (
                      <Button
                        size="sm"
                        className="mt-2 w-full bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.2)] h-8 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleUseTemplate() }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        使用此模板
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {workflows.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">已有工作流</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="group relative rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-4 text-sm text-[#94a3b8] hover:border-[#00d4aa]/30 transition-all"
                  >
                    <button
                      onClick={() => setCurrentWorkflow(wf)}
                      className="w-full text-left"
                    >
                      <div className="font-medium text-white mb-1 pr-6">{wf.name}</div>
                      <div className="text-xs truncate">{wf.description}</div>
                      <div className="mt-2 flex gap-2 text-[10px] text-[#64748b]">
                        <span>{wf.nodes.length} 节点</span>
                        <span>·</span>
                        <span>{wf.status}</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`确定删除工作流「${wf.name}」？`)) {
                          deleteWorkflow(wf.id)
                        }
                      }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-[#64748b] opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="删除工作流"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#1e293b]" />
            <span className="text-sm text-[#64748b]">或</span>
            <div className="flex-1 h-px bg-[#1e293b]" />
          </div>

          <button
            onClick={handleCreateBlank}
            className="w-full rounded-xl border-2 border-dashed border-[#1e293b] hover:border-[#00d4aa]/40 p-8 text-center transition-all group"
          >
            <Plus className="h-10 w-10 mx-auto mb-2 text-[#94a3b8] group-hover:text-[#00d4aa] transition-colors" />
            <div className="text-sm font-medium text-white">创建空白工作流</div>
            <div className="text-xs text-[#64748b] mt-1">从零开始构建您的渗透测试工作流</div>
          </button>
        </div>
      ) : (
        // 画布视图
        <div className="flex-1 flex gap-4 min-h-0">
          {/* 节点面板 */}
          <div className="w-56 flex-shrink-0 rounded-xl border border-[#1e293b] bg-[#1a1f2e] flex flex-col">
            <div className="p-3 border-b border-[#1e293b]">
              <h3 className="text-xs font-semibold text-white">节点库</h3>
              <p className="text-[10px] text-[#64748b] mt-0.5">按住拖到画布</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {NODE_TYPES.map((nt) => {
                const Icon = nt.icon
                return (
                  <div
                    key={nt.type}
                    onMouseDown={(e) => handlePaletteMouseDown(e, nt.type)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border bg-[#111827] px-2.5 py-2 cursor-grab active:cursor-grabbing transition-all hover:border-opacity-80 select-none',
                      nt.border,
                    )}
                  >
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded', nt.bg)}>
                      <Icon className={cn('h-3.5 w-3.5', nt.color)} />
                    </div>
                    <div className="flex-1 text-xs text-[#e2e8f0] truncate">{nt.label}</div>
                  </div>
                )
              })}
            </div>
            <div className="p-2 border-t border-[#1e293b] text-[10px] text-[#64748b]">
              💡 提示：拖动节点、点 → 连线、Delete 删节点
            </div>
          </div>

          {/* 画布 */}
          <div
            ref={canvasRef}
            className="flex-1 rounded-xl border border-[#1e293b] bg-[#0d1321] relative overflow-auto"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(148, 163, 184, 0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedNodeId(null)
                setConnectingFrom(null)
              }
            }}
          >
            {currentWorkflow.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-[#64748b]">
                  <Workflow className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">从左侧拖拽节点到此处开始编排</p>
                </div>
              </div>
            )}

            {/* 连线层 */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#475569" />
                </marker>
                <marker id="arrowhead-active" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#00d4aa" />
                </marker>
              </defs>
              {currentWorkflow.edges.map((edge) => {
                const source = currentWorkflow.nodes.find((n) => n.id === edge.source)
                const target = currentWorkflow.nodes.find((n) => n.id === edge.target)
                if (!source || !target) return null
                const sx = source.position.x + 70
                const sy = source.position.y + 25
                const tx = target.position.x
                const ty = target.position.y + 25
                const midX = (sx + tx) / 2
                return (
                  <path
                    key={edge.id}
                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                    stroke="#475569"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                )
              })}
            </svg>

            {/* 节点层 */}
            {currentWorkflow.nodes.map((node) => {
              const def = NODE_TYPES.find((n) => n.type === node.type)
              if (!def) return null
              const Icon = def.icon
              const isSelected = selectedNodeId === node.id
              const isConnecting = connectingFrom === node.id
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => {
                    if (e.button === 0) handleNodeMouseDown(e, node.id)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNodeClick(node.id)
                  }}
                  className={cn(
                    'absolute group cursor-grab active:cursor-grabbing transition-all',
                    'rounded-lg border-2 bg-[#1a1f2e] min-w-[140px] shadow-md select-none',
                    STATUS_BORDER[node.status],
                    isSelected && 'ring-2 ring-[#00d4aa] ring-offset-2 ring-offset-[#0d1321]',
                    isConnecting && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0d1321]',
                  )}
                  style={{ left: node.position.x, top: node.position.y }}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded', def.bg)}>
                      <Icon className={cn('h-3.5 w-3.5', def.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{node.label}</div>
                      <div className="text-[10px] text-[#64748b] truncate">{node.type}</div>
                    </div>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConnectClick(node.id)
                      }}
                      className={cn(
                        'opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-[#94a3b8] hover:text-[#00d4aa] hover:bg-[#00d4aa]/10 transition-all',
                        isConnecting && 'opacity-100 text-yellow-400',
                      )}
                      title="从此节点连接"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteNode(node.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="删除节点"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 属性面板 */}
          {selectedNode && (
            <div className="w-72 flex-shrink-0 rounded-xl border border-[#1e293b] bg-[#1a1f2e] flex flex-col">
              <div className="p-3 border-b border-[#1e293b] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">节点属性</h3>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-[#64748b] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <NodePropertiesPanel
                node={selectedNode}
                onUpdate={(updates) => updateNode(selectedNode.id, updates)}
                onDelete={() => handleDeleteNode(selectedNode.id)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 节点属性面板（支持 MCP 节点等特殊节点的配置）
function NodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
}: {
  node: WorkflowNode
  onUpdate: (updates: Partial<WorkflowNode>) => void
  onDelete: () => void
}) {
  const isMcp = node.type === 'mcp_tool'
  const [configJson, setConfigJson] = useState(() => {
    const { tool, payload, action, ...rest } = node.config
    return JSON.stringify(Object.keys(rest).length ? rest : {}, null, 2)
  })

  return (
    <div className="p-3 space-y-3 flex-1 overflow-y-auto">
      <div className="space-y-2.5 text-xs">
        <div>
          <label className="text-[#64748b] mb-1 block">显示名称</label>
          <input
            value={node.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] outline-none focus:border-[#00d4aa]/50"
            placeholder="节点名称（任意）"
          />
        </div>
        <div>
          <div className="text-[#64748b] mb-1">类型 / ID</div>
          <div className="text-[10px] font-mono text-[#64748b]">
            {node.type} · {node.id.slice(0, 16)}
          </div>
        </div>
      </div>

      {/* MCP 节点专用配置 */}
      {isMcp && (
        <div className="space-y-3 pt-2 border-t border-[#1e293b]">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-xs font-semibold text-rose-400">MCP 工具配置</span>
          </div>
          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">API 基础地址</label>
            <input
              value={node.config.apiUrl || ''}
              placeholder="https://api.example.com/v1"
              onChange={(e) => onUpdate({ config: { ...node.config, apiUrl: e.target.value } })}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] font-mono outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">API 端点路径</label>
            <input
              value={node.config.apiEndpoint || ''}
              placeholder="/mcp/tools/call"
              onChange={(e) => onUpdate({ config: { ...node.config, apiEndpoint: e.target.value } })}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] font-mono outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">HTTP 方法</label>
            <select
              value={node.config.method || 'POST'}
              onChange={(e) => onUpdate({ config: { ...node.config, method: e.target.value } })}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] outline-none focus:border-rose-500/50"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">认证方式</label>
            <select
              value={node.config.authType || 'none'}
              onChange={(e) => onUpdate({ config: { ...node.config, authType: e.target.value } })}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] outline-none focus:border-rose-500/50"
            >
              <option value="none">无认证</option>
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>
          {(node.config.authType === 'bearer' || node.config.authType === 'api_key' || node.config.authType === 'basic') && (
            <div>
              <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">
                {node.config.authType === 'bearer' ? 'Token' : node.config.authType === 'api_key' ? 'API Key' : '凭据'}
              </label>
              <input
                type="password"
                value={node.config.credential || ''}
                placeholder="••••••••"
                onChange={(e) => onUpdate({ config: { ...node.config, credential: e.target.value } })}
                className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] font-mono outline-none focus:border-rose-500/50"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">请求体 (JSON)</label>
            <textarea
              value={node.config.body || ''}
              placeholder='{"tool": "name", "params": {...}}'
              onChange={(e) => onUpdate({ config: { ...node.config, body: e.target.value } })}
              className="w-full h-24 rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-[10px] text-[#e2e8f0] font-mono outline-none focus:border-rose-500/50 resize-none"
            />
          </div>
        </div>
      )}

      {/* 通用动态执行配置 —— AI 渗透引擎会读取这里的所有字段 */}
      {!isMcp && (
        <div className="space-y-3 pt-2 border-t border-[#1e293b]">
          <div className="flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5 text-cyber-cyan" />
            <span className="text-xs font-semibold text-cyber-cyan">动态执行配置</span>
            <span className="ml-auto text-[9px] text-[#64748b]">AI 自主决策</span>
          </div>

          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">工具 / 脚本名</label>
            <input
              value={(node.config.tool as string) || ''}
              placeholder="nmap / sqlmap / curl / msfconsole / 自定义脚本"
              onChange={(e) => onUpdate({ config: { ...node.config, tool: e.target.value } })}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-xs text-[#e2e8f0] font-mono outline-none focus:border-cyber-cyan/50"
            />
          </div>

          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">命令模板（含 {`{target}`}）</label>
            <textarea
              value={(node.config.command as string) || ''}
              placeholder={'nmap -sV -p- {target}\n或\nsqlmap -u "http://{target}/api?id=1" --batch --dbs'}
              onChange={(e) => onUpdate({ config: { ...node.config, command: e.target.value } })}
              rows={3}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-[10px] text-[#e2e8f0] font-mono outline-none focus:border-cyber-cyan/50 resize-none"
            />
            <div className="text-[9px] text-[#64748b] mt-1">
              {'{target}'} = 实际目标 IP/域名 · {'{user}'} = 凭据等
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">提示词 / payload</label>
            <textarea
              value={(node.config.payload as string) || ''}
              placeholder='AI 用来执行节点的提示词（可选，留空 AI 自主规划）'
              onChange={(e) => onUpdate({ config: { ...node.config, payload: e.target.value } })}
              rows={2}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-[10px] text-[#e2e8f0] outline-none focus:border-cyber-cyan/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-[#64748b] mb-1 block uppercase tracking-wider">自定义参数 (JSON)</label>
            <textarea
              value={configJson}
              placeholder='{"timeout": 60, "retries": 3, "args": ["-X", "POST"]}'
              onChange={(e) => {
                setConfigJson(e.target.value)
                try {
                  const parsed = JSON.parse(e.target.value || '{}')
                  const base = { ...node.config }
                  // 保留核心字段
                  const { tool, payload, action, command, ...rest } = base
                  onUpdate({ config: { tool, payload, action, command, ...parsed, ...rest } })
                } catch { /* 非法 JSON 时不更新 */ }
              }}
              rows={4}
              className="w-full rounded border border-[#1e293b] bg-[#111827] px-2 py-1.5 text-[10px] text-[#e2e8f0] font-mono outline-none focus:border-cyber-cyan/50 resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-[#1e293b]">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-[#1e293b] bg-[#111827] text-[#e2e8f0]"
          onClick={() => {
            const newConfig = { ...node.config, _copied: true }
            onUpdate({ config: newConfig })
            toast.success('已复制（演示）')
          }}
        >
          <Copy className="h-3 w-3 mr-1" />
          复制
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="text-[10px] text-[#64748b]">
        提示：按 Delete 删除选中节点，Esc 取消选中
      </div>
    </div>
  )
}
