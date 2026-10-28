import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

const server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
  cwd: ROOT,
  stdio: 'inherit'
})

const vite = spawn(process.execPath, [VITE_BIN], {
  cwd: ROOT,
  stdio: 'inherit'
})

let closing = false

function shutdown(code = 0) {
  if (closing) return
  closing = true
  server.kill()
  vite.kill()
  process.exit(code)
}

server.on('exit', code => {
  if (code && !closing) shutdown(code)
})

vite.on('exit', code => {
  if (code && !closing) shutdown(code)
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
