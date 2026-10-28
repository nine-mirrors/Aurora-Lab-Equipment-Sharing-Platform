import './env.js'

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'

import { getDB, saveDB } from './db.js'
import { initDB } from './seed.js'
import { migrateDB } from './migrate.js'
import { requireAuth, requireNotBlacklisted, verifyPassword } from './auth.js'
import { settleOverdueCredit } from './credit.js'
import { sendDueReminders } from './reminders.js'
import { rateLimit } from './rate-limit.js'
import { logApi, logException } from './logger.js'

import authRoutes from './routes/auth.js'
import deviceRoutes from './routes/devices.js'
import categoryRoutes from './routes/categories.js'
import bookingRoutes from './routes/bookings.js'
import adminRoutes from './routes/admin.js'
import statsRoutes from './routes/stats.js'
import aiRoutes from './routes/ai.js'
import workspaceRoutes from './routes/workspace.js'
import adminBaseRoutes from './routes/admin-base.js'
import favoriteRoutes from './routes/favorites.js'
import uploadRoutes from './routes/uploads.js'
import pushRoutes from './routes/push.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

initDB()
migrateDB()
settleOverdueCredit()

// 演示账号密码保护：生产模式默认拒绝以 123456 启动，避免公网演示被直接接管
function assertDemoPasswordSafe() {
  const db = getDB()
  const demoAccounts = db.users.filter(
    user => ['admin', 'student'].includes(user.account) && verifyPassword('123456', user.password)
  )
  if (!demoAccounts.length) return

  const names = demoAccounts.map(user => user.account).join('、')
  const message = `检测到演示账号仍使用密码 123456（${names}）`

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_PASSWORD !== '1') {
    console.error(
      `[security] ${message}。已拒绝启动：请先修改密码，或仅在受控演示环境设置 ALLOW_DEMO_PASSWORD=1。`
    )
    process.exit(1)
  }

  console.warn(`[security] ${message}，仅限本机演示，公网部署前必须修改。`)
}

assertDemoPasswordSafe()

const app = express()
const PORT = Number(process.env.PORT) || 3000

// 基础安全响应头；CSP 只作用于页面，避免影响纯 JSON 接口
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (!req.path.startsWith('/api')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
    )
  }
  next()
})
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

// 仅在明确位于反向代理之后时信任代理头，避免伪造 IP 绕过限流
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    return callback(null, false)
  }
}))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')))

app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'ok', data: { time: new Date().toISOString() } })
})

// 接口日志：方法、路径、状态码、耗时与用户 ID
app.use('/api', (req, res, next) => {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    logApi(req, res.statusCode, Number(process.hrtime.bigint() - start) / 1e6)
  })
  next()
})

app.use('/api/auth/login', rateLimit({ windowMs: 5 * 60 * 1000, max: 30 }))
app.use('/api/auth/register', rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }))
app.use('/api/auth/forget-password', rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }))
app.use('/api/auth/send-email-code', rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }))
app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, max: 30 }))
app.use('/api/uploads', rateLimit({ windowMs: 10 * 60 * 1000, max: 40 }))

// 黑名单账号不得使用上传与 AI 入口（借用资格相关的写操作在各自路由内校验）
app.use('/api/uploads', requireNotBlacklisted)
app.use('/api/ai', requireNotBlacklisted)

// 逾期信用按天结算，最多每分钟触发一次，避免每次请求都全量扫描
let lastCreditSettle = 0
app.use('/api', (req, res, next) => {
  if (Date.now() - lastCreditSettle > 60 * 1000) {
    lastCreditSettle = Date.now()
    try {
      settleOverdueCredit()
      sendDueReminders()
    } catch (error) {
      console.error('[credit settle]', error)
    }
  }
  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api', deviceRoutes)
app.use('/api', categoryRoutes)
app.use('/api', bookingRoutes)
app.use('/api', adminRoutes)
app.use('/api', aiRoutes)
app.use('/api', workspaceRoutes)
app.use('/api', adminBaseRoutes)
app.use('/api', favoriteRoutes)
app.use('/api', uploadRoutes)
app.use('/api', pushRoutes)

app.delete('/api/account', requireAuth(), (req, res) => {
  const { password } = req.body || {}
  const db = getDB()
  const user = db.users.find(item => item.id === req.user.id)

  if (!user) return res.status(404).json({ code: 404, message: '账号不存在' })
  if (user.role === 'admin') {
    return res.json({ code: 400, message: '管理员账号不能注销', data: null })
  }
  if (!verifyPassword(password || '', user.password)) {
    return res.json({ code: 400, message: '密码不正确', data: null })
  }

  const active = db.bookings.some(
    item => item.user_id === user.id && ['approved', 'returning'].includes(item.status)
  )
  if (active) {
    return res.json({ code: 400, message: '你还有未归还的设备，暂时无法注销', data: null })
  }

  db.users = db.users.filter(item => item.id !== user.id)
  db.bookings = db.bookings.filter(item => item.user_id !== user.id)
  // 清理个人侧数据，避免注销后残留通知、收藏与推送订阅
  db.notifications = (db.notifications || []).filter(item => item.user_id !== user.id)
  db.favorites = (db.favorites || []).filter(item => item.user_id !== user.id)
  db.push_subscriptions = (db.push_subscriptions || []).filter(item => item.user_id !== user.id)
  saveDB()

  res.json({ code: 200, message: '账号已注销', data: null })
})

app.use('/api', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'))
    }
    next()
  })
}

app.use((err, req, res, next) => {
  console.error('[server error]', err)
  logException(err, { method: req.method, url: req.originalUrl, userId: req.user?.id ?? null })
  if (res.headersSent) return next(err)
  res.status(500).json({ code: 500, message: '服务器内部错误' })
})

app.listen(PORT, () => {
  const db = getDB()
  console.log(`\n  实验室设备平台后端已启动: http://localhost:${PORT}`)
  console.log(`  数据规模: 用户 ${db.users.length} / 设备 ${db.devices.length} / 申请 ${db.bookings.length}\n`)
})
