import { useCallback } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { generateId } from '@/lib/utils'
import type { WorkflowNode, WorkflowEdge } from '@/types/workflow'

export function useWorkflowEditor() {
  const store = useWorkflowStore()

  const addNode = useCallback(
    (type: WorkflowNode['type'], position: { x: number; y: number }, label?: string) => {
      const node: WorkflowNode = {
        id: generateId(),
        type,
        label: label || type.replace(/_/g, ' '),
        position,
        config: {},
        status: 'idle',
      }
      store.addNode(node)
      return node
    },
    [store],
  )

  const connectNodes = useCallback(
    (sourceId: string, targetId: string, label?: string) => {
      const edge: WorkflowEdge = {
        id: generateId(),
        source: sourceId,
        target: targetId,
        label,
      }
      store.addEdge(edge)
      return edge
    },
    [store],
  )

  const moveNode = useCallback(
    (id: string, position: { x: number; y: number }) => {
      store.updateNode(id, { position })
    },
    [store],
  )

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = store.currentWorkflow?.nodes.find((n) => n.id === nodeId)
      if (!node) return

      const newNode: WorkflowNode = {
        ...node,
        id: generateId(),
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
      }
      store.addNode(newNode)
      return newNode
    },
    [store],
  )

  return {
    ...store,
    addNode,
    connectNodes,
    moveNode,
    duplicateNode,
  }
}
