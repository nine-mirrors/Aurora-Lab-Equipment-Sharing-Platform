import axios from 'axios'
import { useUserStore } from '@/stores/useUserStore'
import router from '@/router'

const service = axios.create({
  // 走 vite 代理，直接使用相对路径 /api
  timeout: 60000
})

const whiteList = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/send-email-code',
  '/api/auth/forget-password'
]

const getToken = () => {
  const localToken = localStorage.getItem('token')
  if (localToken && localToken.trim()) {
    return localToken.trim()
  }

  try {
    const userStore = useUserStore()
    if (userStore.token && String(userStore.token).trim()) {
      return String(userStore.token).trim()
    }
  } catch {
    // 忽略 pinia 未就绪等异常
  }

  return ''
}

// 请求拦截
service.interceptors.request.use(
  (config) => {
    const isWhite = whiteList.some(url => config.url?.includes(url))
    const token = getToken()

    if (!isWhite && token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截
service.interceptors.response.use(
  (res) => {
    if (res.status === 204) {
      return { code: 200, message: '操作成功' }
    }

    const body = res.data
    // 后端业务错误统一为 HTTP 200 + body.code，这里转换成 reject，避免调用点漏判
    if (body && typeof body.code === 'number' && body.code >= 400) {
      const error = new Error(body.message || '请求失败')
      error.response = { data: body, status: body.code }
      error.isBusinessError = true
      return Promise.reject(error)
    }

    return body
  },
  (error) => {
    if (error.response?.status === 401) {
      try {
        const userStore = useUserStore()
        userStore.$reset?.()
      } catch {
        // 忽略 store 尚未初始化的情况
      }

      localStorage.removeItem('token')

      try {
        if (router.currentRoute.value.path !== '/login') {
          router.replace('/login')
        }
      } catch (e) {
        console.error('router replace failed', e)
      }
    }

    return Promise.reject(error)
  }
)

export default service