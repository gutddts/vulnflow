import { useNotificationStore, type NotificationType } from '@/stores/notificationStore'

/** 全局通知 API —— 任何模块都可以调，自动推送到 Header 通知面板 */
export function addNotification(params: {
  type: NotificationType
  title: string
  message: string
  target?: string
  task_id?: string
  project_id?: string
  /** 可选跳转链接 */
  link?: string
  /** 可选耗时（毫秒），会自动显示 */
  duration?: number
}) {
  useNotificationStore.getState().add(params)
}

/** 快捷方式 */
export const notify = {
  success: (title: string, message: string, opts?: Partial<Parameters<typeof addNotification>[0]>) =>
    addNotification({ type: 'success', title, message, ...opts }),
  error: (title: string, message: string, opts?: Partial<Parameters<typeof addNotification>[0]>) =>
    addNotification({ type: 'error', title, message, ...opts }),
  warning: (title: string, message: string, opts?: Partial<Parameters<typeof addNotification>[0]>) =>
    addNotification({ type: 'warning', title, message, ...opts }),
  info: (title: string, message: string, opts?: Partial<Parameters<typeof addNotification>[0]>) =>
    addNotification({ type: 'info', title, message, ...opts }),
}
