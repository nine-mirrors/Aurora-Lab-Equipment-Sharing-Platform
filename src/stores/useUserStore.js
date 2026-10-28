import { defineStore } from 'pinia'
import axios from 'axios'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    role: '',
    userInfo: null
  }),

  actions: {
    setUser(resData) {
      if (!resData) return

      if (resData.token !== undefined) {
        this.token = resData.token || ''
      }
      if (resData.role !== undefined) {
        this.role = resData.role || ''
      }

      const source = resData.userInfo || resData.user || null
      if (source) {
        this.userInfo = { ...(this.userInfo || {}), ...source }
      } else if (resData.account || resData.name || resData.email) {
        this.userInfo = { ...(this.userInfo || {}), ...resData }
      }

      // 兼容只返回用户资料、未单独返回角色的场景
      if (!this.role && this.userInfo?.role) {
        this.role = this.userInfo.role
      }
      if (this.userInfo && !this.userInfo.role && this.role) {
        this.userInfo.role = this.role
      }

      // 单独保存 token，供请求拦截器读取
      if (this.token) {
        localStorage.setItem('token', this.token)
      } else {
        localStorage.removeItem('token')
      }
    },

    logout() {
      const token = this.token || localStorage.getItem('token') || ''
      // 通知服务端递增 token 版本，使当前 Token 立即失效（失败不阻塞本地退出）
      if (token) {
        axios
          .post('/api/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => {})
      }

      this.token = ''
      this.role = ''
      this.userInfo = null
      localStorage.removeItem('token')
    }
  },

  persist: true
})
