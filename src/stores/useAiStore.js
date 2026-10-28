import { defineStore } from 'pinia'
import { getAiStatus, sendAiMessage } from '@/api/ai'

let seed = 0
function nextId() {
  seed += 1
  return `ai-${Date.now()}-${seed}`
}

function welcomeMessage() {
  return {
    id: nextId(),
    role: 'assistant',
    content:
      '你好，我是极光 AI 助手。可以帮你按实验方向挑设备、查申请进度、解释借用 / 续借 / 归还规则。\n\n试试问我：“做嵌入式课程设计推荐什么设备？”',
    devices: [],
    providerLabel: '极光 AI',
    time: Date.now()
  }
}

export const useAiStore = defineStore('ai', {
  state: () => ({
    open: false,
    messages: [welcomeMessage()],
    pending: false,
    provider: 'qwen',
    status: null,
    statusLoading: false
  }),

  getters: {
    currentProvider: state =>
      state.status?.providers?.find(item => item.id === state.provider) || null,
    configuredCount: state =>
      state.status?.providers?.filter(item => item.configured).length || 0
  },

  actions: {
    async loadStatus(force = false) {
      if (this.status && !force) return this.status
      if (this.statusLoading) return this.status

      this.statusLoading = true
      try {
        const res = await getAiStatus()
        this.status = res.data
        if (!this.status?.providers?.some(item => item.id === this.provider && item.configured)) {
          this.provider = this.status?.providers?.find(item => item.configured)?.id || this.provider
        }
      } catch {
        this.status = null
      } finally {
        this.statusLoading = false
      }
      return this.status
    },

    openDrawer() {
      this.open = true
      this.loadStatus()
    },

    closeDrawer() {
      this.open = false
    },

    toggleDrawer() {
      if (this.open) this.closeDrawer()
      else this.openDrawer()
    },

    setProvider(provider) {
      this.provider = provider
    },

    reset() {
      this.messages = [welcomeMessage()]
      this.pending = false
    },

    trimMessages() {
      if (this.messages.length > 40) {
        this.messages = this.messages.slice(-40)
      }
    },

    async openWith(prompt) {
      this.open = true
      await this.loadStatus()
      if (prompt) await this.send(prompt)
    },

    async send(text) {
      const content = String(text || '').trim()
      if (!content || this.pending) return

      this.messages.push({
        id: nextId(),
        role: 'user',
        content,
        devices: [],
        time: Date.now()
      })

      await this.request()
    },

    async regenerate() {
      if (this.pending) return
      const index = [...this.messages]
        .map((item, i) => ({ item, i }))
        .reverse()
        .find(entry => entry.item.role === 'user' && !entry.item.error)?.i

      if (index === undefined || index < 0) return

      this.messages = this.messages.slice(0, index + 1)
      await this.request()
    },

    async request() {
      this.pending = true

      try {
        const history = this.messages
          .filter(item => item.role === 'user' || (item.role === 'assistant' && !item.error))
          .slice(-10)
          .map(item => ({ role: item.role, content: item.content }))

        const res = await sendAiMessage({
          messages: history,
          provider: this.provider
        })

        if (res.code !== 200) {
          throw new Error(res.message || 'AI 服务暂时不可用')
        }

        this.messages.push({
          id: nextId(),
          role: 'assistant',
          content: res.data?.reply || '我暂时没有想好怎么回答，请换个说法试试。',
          devices: res.data?.devices || [],
          providerLabel: res.data?.providerLabel || '极光 AI',
          model: res.data?.model || '',
          notice: res.data?.notice || '',
          time: Date.now()
        })
      } catch (error) {
        this.messages.push({
          id: nextId(),
          role: 'assistant',
          content:
            error?.response?.data?.message ||
            error?.message ||
            'AI 助手连接失败，请检查后端服务或稍后再试。',
          devices: [],
          providerLabel: '系统提示',
          error: true,
          time: Date.now()
        })
      } finally {
        this.pending = false
        this.trimMessages()
      }
    }
  },

  persist: {
    pick: ['provider', 'messages']
  }
})
