import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs')

// 对齐 Laravel daily channel：business 14 天、api 7 天、exception 30 天
const RETENTION = { business: 14, api: 7, exception: 30 }

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
}

function cleanup() {
  try {
    const now = Date.now()
    for (const file of fs.readdirSync(LOG_DIR)) {
      const matched = file.match(/^(business|api|exception)-(\d{4}-\d{2}-\d{2})\.log$/)
      if (!matched) continue

      const days = RETENTION[matched[1]]
      const age = (now - new Date(`${matched[2]}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000)
      if (age > days) fs.unlinkSync(path.join(LOG_DIR, file))
    }
  } catch {
    // 日志清理失败不影响业务
  }
}

function write(channel, level, message, meta) {
  if (process.env.LOG_DISABLED === '1') return

  try {
    ensureDir()
    const now = new Date()
    const pad = num => String(num).padStart(2, '0')
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const time = `${day} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const suffix = meta === undefined ? '' : ` ${JSON.stringify(meta)}`
    fs.appendFileSync(
      path.join(LOG_DIR, `${channel}-${day}.log`),
      `[${time}] ${level.toUpperCase()} ${message}${suffix}\n`,
      'utf8'
    )
  } catch {
    // 日志写入失败不影响业务
  }
}

export function logBusiness(message, meta) {
  write('business', 'info', message, meta)
}

export function logBusinessWarn(message, meta) {
  write('business', 'warn', message, meta)
}

export function logApi(req, statusCode, durationMs) {
  write('api', statusCode >= 500 ? 'error' : 'info', `${req.method} ${req.originalUrl}`, {
    status: statusCode,
    durationMs: Math.round(durationMs),
    userId: req.user?.id ?? null,
    ip: req.ip
  })
}

export function logException(error, context = {}) {
  write('exception', 'error', error?.message || 'Unknown error', {
    ...context,
    stack: error?.stack
  })
}

cleanup()
