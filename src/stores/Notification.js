import { defineStore } from 'pinia'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '@/api/workspace'

const seedList = [
  {
    id: 'welcome',
    type: 'system',
    title: '欢迎使用极光实验室平台',
    content: '按 ⌘K / Ctrl K 可快速搜索设备与页面，右侧铃铛可查看平台动态。',
    time: Date.now() - 1000 * 60 * 3,
    read: false
  },
  {
    id: 'notice-1',
    type: 'notice',
    title: '设备借用规则更新',
    content: '自本周起，单次借用最长 14 天，逾期将影响信用分，请按时归还。',
    time: Date.now() - 1000 * 60 * 60 * 6,
    read: false
  },
  {
    id: 'notice-2',
    type: 'success',
    title: '实验室开放时间调整',
    content: 'A 栋电子实验室周末开放时间调整为 09:00 - 17:30。',
    time: Date.now() - 1000 * 60 * 60 * 26,
    read: true
  }
]

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    list: seedList
  }),

  getters: {
    unreadCount: state => state.list.filter(item => !item.read).length
  },

  actions: {
    async loadServer() {
      try {
        const res = await getNotifications({ page: 1, pageSize: 50 })
        if (res.code !== 200 || !Array.isArray(res.data?.list)) return
        if (!res.data.list.length) return

        this.list = res.data.list.map(item => ({
          id: item.id,
          type: item.type || 'info',
          title: item.title,
          content: item.content,
          link: item.link || '',
          time: new Date(item.created_at).getTime(),
          read: Boolean(item.read)
        }))
      } catch {
        // 后端不可用时保留本地通知
      }
    },

    push(payload) {
      this.list.unshift({
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'info',
        read: false,
        time: Date.now(),
        ...payload
      })
      if (this.list.length > 40) this.list.length = 40
    },

    markAllRead() {
      this.list.forEach(item => {
        item.read = true
      })
      markAllNotificationsRead().catch(() => {})
    },

    markRead(id) {
      const target = this.list.find(item => item.id === id)
      if (target) target.read = true
      if (typeof id === 'number') {
        markNotificationRead(id).catch(() => {})
      }
    },

    remove(id) {
      this.list = this.list.filter(item => item.id !== id)
    },

    clear() {
      this.list = []
    }
  },

  persist: true
})
