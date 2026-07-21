import { create } from 'zustand'
import api from '@/lib/api'

interface Project {
  id: string
  name: string
  description: string
  status: 'active' | 'completed' | 'archived'
  target: string
  vulnerability_count: number
  created_at: string
  updated_at: string
}

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  isLoading: boolean

  fetchProjects: () => Promise<void>
  setCurrentProject: (project: Project | null) => void
  createProject: (data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get('/projects')
      set({ projects: response.data.data.items || [] })
    } catch {
      // Silently fail
    } finally {
      set({ isLoading: false })
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project })
    if (project) {
      localStorage.setItem('current_project_id', project.id)
    } else {
      localStorage.removeItem('current_project_id')
    }
  },

  createProject: async (data) => {
    const response = await api.post('/projects', data)
    const project = response.data.data
    set((state) => ({ projects: [project, ...state.projects] }))
  },

  deleteProject: async (id) => {
    await api.delete(`/projects/${id}`)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }))
  },
}))
