import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NotificationType = 'success' | 'warning' | 'error' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  // 弹窗开关
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  // 标记单条已读
  markRead: (id: string) => void
  // 全部已读
  markAllRead: () => void
  // 删除单条
  remove: (id: string) => void
  // 清空全部
  clearAll: () => void
  // 新增通知
  add: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
}

const seed: Notification[] = [
  {
    id: 'n1',
    type: 'success',
    title: '技能导入完成',
    message: '成功导入 102 个渗透测试技能到数据库',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    read: false,
  },
  {
    id: 'n2',
    type: 'info',
    title: '工作流执行完成',
    message: '工作流 "基础扫描" 已完成，发现 3 个漏洞',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read: false,
  },
  {
    id: 'n3',
    type: 'warning',
    title: '数据库连接告警',
    message: 'PostgreSQL 连接池使用率超过 80%',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    read: false,
  },
  {
    id: 'n4',
    type: 'error',
    title: '任务执行失败',
    message: '任务 "SQL 注入利用测试" 连接超时，已重试 3 次',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: true,
  },
  {
    id: 'n5',
    type: 'info',
    title: '系统更新可用',
    message: 'VulnFlow v1.2.0 已发布，包含 12 项新功能',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
  },
]

let counter = 1000
const newId = () => `n${Date.now()}-${counter++}`

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: seed,
      panelOpen: false,
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),
      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      remove: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearAll: () => set({ notifications: [] }),
      add: (n) =>
        set((state) => ({
          notifications: [
            {
              id: newId(),
              timestamp: new Date().toISOString(),
              read: false,
              ...n,
            },
            ...state.notifications,
          ],
        })),
    }),
    {
      name: 'vulnflow-notifications',
      partialize: (state) => ({ notifications: state.notifications }),
    },
  ),
)
