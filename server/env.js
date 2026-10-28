import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(__dirname, '..', '.env')

/**
 * 轻量 .env 解析，避免额外依赖。
 * 只有不存在于当前进程环境中的变量才会被写入。
 */
export function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return
  const content = fs.readFileSync(ENV_FILE, 'utf-8')

  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const index = trimmed.indexOf('=')
    if (index < 0) return

    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  })
}

// 作为模块被首个导入时立即加载，保证后续模块读取到环境变量
loadEnv()
