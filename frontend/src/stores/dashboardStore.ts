import { create } from 'zustand'
import type { DashboardMetrics, ActivityItem, SeverityDistribution, TimeSeriesData } from '@/types/dashboard'
import api from '@/lib/api'

interface DashboardState {
  metrics: DashboardMetrics | null
  activities: ActivityItem[]
  severityDistribution: SeverityDistribution | null
  timeSeriesData: TimeSeriesData[]
  isLoading: boolean

  fetchMetrics: () => Promise<void>
  fetchActivities: () => Promise<void>
  fetchSeverityDistribution: () => Promise<void>
  fetchTimeSeries: (days?: number) => Promise<void>
  refreshAll: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  metrics: null,
  activities: [],
  severityDistribution: null,
  timeSeriesData: [],
  isLoading: false,

  fetchMetrics: async () => {
    try {
      const response = await api.get('/dashboard/metrics')
      set({ metrics: response.data.data })
    } catch {
      // Silently fail
    }
  },

  fetchActivities: async () => {
    try {
      const response = await api.get('/dashboard/activities')
      set({ activities: response.data.data.items || [] })
    } catch {
      // Silently fail
    }
  },

  fetchSeverityDistribution: async () => {
    try {
      const response = await api.get('/dashboard/severity-distribution')
      set({ severityDistribution: response.data.data })
    } catch {
      // Silently fail
    }
  },

  fetchTimeSeries: async (days = 30) => {
    try {
      const response = await api.get('/dashboard/time-series', { params: { days } })
      set({ timeSeriesData: response.data.data || [] })
    } catch {
      // Silently fail
    }
  },

  refreshAll: async () => {
    set({ isLoading: true })
    await Promise.allSettled([
      set((s) => { s.fetchMetrics(); return s }),
      set((s) => { s.fetchActivities(); return s }),
      set((s) => { s.fetchSeverityDistribution(); return s }),
      set((s) => { s.fetchTimeSeries(); return s }),
    ])
    set({ isLoading: false })
  },
}))
