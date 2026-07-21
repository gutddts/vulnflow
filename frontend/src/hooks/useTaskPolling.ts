import { useEffect, useRef, useCallback } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import api from '@/lib/api'

export function useTaskPolling(intervalMs: number = 5000) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const { tasks, updateTask } = useTaskStore()

  const pollRunningTasks = useCallback(async () => {
    const runningTasks = tasks.filter((t) => t.status === 'running' || t.status === 'queued')
    if (runningTasks.length === 0) return

    try {
      const results = await Promise.allSettled(
        runningTasks.map((task) => api.get(`/tasks/${task.id}`)),
      )

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const updated = result.value.data.data
          updateTask(runningTasks[index].id, updated)
        }
      })
    } catch {
      // Silently fail polling
    }
  }, [tasks, updateTask])

  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'running' || t.status === 'queued')

    if (hasRunning && !intervalRef.current) {
      intervalRef.current = setInterval(pollRunningTasks, intervalMs)
    } else if (!hasRunning && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [tasks, intervalMs, pollRunningTasks])

  return { pollRunningTasks }
}
