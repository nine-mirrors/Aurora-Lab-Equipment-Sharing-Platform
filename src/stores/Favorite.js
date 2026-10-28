import { defineStore } from 'pinia'
import { addFavorite, getFavorites, removeFavorite } from '@/api/favorites'

export const useFavoriteStore = defineStore('favorite', {
  state: () => ({
    ids: []
  }),

  getters: {
    count: state => state.ids.length,
    isFavorite: state => id => state.ids.includes(String(id))
  },

  actions: {
    // 登录后把本地收藏与服务端合并，并补齐尚未同步的收藏
    async load() {
      try {
        const res = await getFavorites()
        if (res.code !== 200) return

        const serverIds = (res.data?.ids || []).map(String)
        const localIds = this.ids.map(String)
        this.ids = Array.from(new Set([...serverIds, ...localIds]))

        const missing = localIds.filter(id => !serverIds.includes(id))
        await Promise.allSettled(missing.map(id => addFavorite(id)))
      } catch {
        // 离线或未登录时保留本地收藏
      }
    },

    toggle(id) {
      const key = String(id)
      const index = this.ids.indexOf(key)
      if (index >= 0) {
        this.ids.splice(index, 1)
        removeFavorite(key).catch(() => {
          if (!this.ids.includes(key)) this.ids.push(key)
        })
        return false
      }

      this.ids.push(key)
      addFavorite(key).catch(() => {
        const current = this.ids.indexOf(key)
        if (current >= 0) this.ids.splice(current, 1)
      })
      return true
    },

    clear() {
      this.ids = []
    },

    has(id) {
      return this.ids.includes(String(id))
    }
  },

  persist: true
})
