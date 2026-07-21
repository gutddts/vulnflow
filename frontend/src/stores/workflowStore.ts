import { create } from 'zustand'
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution } from '@/types/workflow'

interface WorkflowHistoryEntry {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

interface WorkflowState {
  currentWorkflow: Workflow | null
  workflows: Workflow[]
  execution: WorkflowExecution | null
  isDirty: boolean
  isRunning: boolean
  undoStack: WorkflowHistoryEntry[]
  redoStack: WorkflowHistoryEntry[]
  selectedNodeId: string | null
  selectedEdgeId: string | null

  setCurrentWorkflow: (workflow: Workflow | null) => void
  setWorkflows: (workflows: Workflow[]) => void
  createWorkflow: (name: string, description: string, nodes?: WorkflowNode[], edges?: WorkflowEdge[]) => void
  deleteWorkflow: (id: string) => void
  addNode: (node: WorkflowNode) => void
  updateNode: (id: string, updates: Partial<WorkflowNode>) => void
  removeNode: (id: string) => void
  addEdge: (edge: WorkflowEdge) => void
  removeEdge: (id: string) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setExecution: (execution: WorkflowExecution | null) => void
  markClean: () => void
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  currentWorkflow: null,
  workflows: [],
  execution: null,
  isDirty: false,
  isRunning: false,
  undoStack: [],
  redoStack: [],
  selectedNodeId: null,
  selectedEdgeId: null,

  setCurrentWorkflow: (workflow) => {
    set({ currentWorkflow: workflow, isDirty: false, undoStack: [], redoStack: [] })
  },

  setWorkflows: (workflows) => set({ workflows }),

  createWorkflow: (name, description, nodes = [], edges = []) => {
    const workflow: Workflow = {
      id: `wf-${Date.now()}`,
      name,
      description,
      nodes,
      edges,
      project_id: 'proj-1',
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'admin',
    }
    set((state) => ({
      currentWorkflow: workflow,
      workflows: [...state.workflows, workflow],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    }))
  },

  deleteWorkflow: (id) => {
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
    }))
  },

  pushHistory: () => {
    const { currentWorkflow } = get()
    if (!currentWorkflow) return
    const entry: WorkflowHistoryEntry = {
      nodes: JSON.parse(JSON.stringify(currentWorkflow.nodes)),
      edges: JSON.parse(JSON.stringify(currentWorkflow.edges)),
    }
    set((state) => ({
      undoStack: [...state.undoStack.slice(-50), entry],
      redoStack: [],
    }))
  },

  addNode: (node) => {
    get().pushHistory()
    set((state) => {
      if (!state.currentWorkflow) return state
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: [...state.currentWorkflow.nodes, node],
        },
        isDirty: true,
      }
    })
  },

  updateNode: (id, updates) => {
    set((state) => {
      if (!state.currentWorkflow) return state
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.map((n) =>
            n.id === id ? { ...n, ...updates } : n,
          ),
        },
        isDirty: true,
      }
    })
  },

  removeNode: (id) => {
    get().pushHistory()
    set((state) => {
      if (!state.currentWorkflow) return state
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.filter((n) => n.id !== id),
          edges: state.currentWorkflow.edges.filter(
            (e) => e.source !== id && e.target !== id,
          ),
        },
        isDirty: true,
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      }
    })
  },

  addEdge: (edge) => {
    get().pushHistory()
    set((state) => {
      if (!state.currentWorkflow) return state
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: [...state.currentWorkflow.edges, edge],
        },
        isDirty: true,
      }
    })
  },

  removeEdge: (id) => {
    get().pushHistory()
    set((state) => {
      if (!state.currentWorkflow) return state
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: state.currentWorkflow.edges.filter((e) => e.id !== id),
        },
        isDirty: true,
      }
    })
  },

  undo: () => {
    const { undoStack, currentWorkflow } = get()
    if (undoStack.length === 0 || !currentWorkflow) return

    const previous = undoStack[undoStack.length - 1]
    const currentEntry: WorkflowHistoryEntry = {
      nodes: JSON.parse(JSON.stringify(currentWorkflow.nodes)),
      edges: JSON.parse(JSON.stringify(currentWorkflow.edges)),
    }

    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentEntry],
      currentWorkflow: state.currentWorkflow
        ? {
            ...state.currentWorkflow,
            nodes: previous.nodes,
            edges: previous.edges,
          }
        : null,
      isDirty: true,
    }))
  },

  redo: () => {
    const { redoStack, currentWorkflow } = get()
    if (redoStack.length === 0 || !currentWorkflow) return

    const next = redoStack[redoStack.length - 1]
    const currentEntry: WorkflowHistoryEntry = {
      nodes: JSON.parse(JSON.stringify(currentWorkflow.nodes)),
      edges: JSON.parse(JSON.stringify(currentWorkflow.edges)),
    }

    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, currentEntry],
      currentWorkflow: state.currentWorkflow
        ? {
            ...state.currentWorkflow,
            nodes: next.nodes,
            edges: next.edges,
          }
        : null,
      isDirty: true,
    }))
  },

  selectNode: (id) => set({ selectedNodeId: id }),
  selectEdge: (id) => set({ selectedEdgeId: id }),

  setExecution: (execution) => set({ execution, isRunning: execution?.status === 'running' }),

  markClean: () => set({ isDirty: false }),
}))
