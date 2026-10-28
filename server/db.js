import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
export const DB_FILE = process.env.LAB_DB_FILE
  ? path.resolve(process.env.LAB_DB_FILE)
  : path.join(DATA_DIR, 'db.json')

let db = null

export function getDB() {
  if (db) return db
  if (!fs.existsSync(DB_FILE)) {
    throw new Error('数据库未初始化，请执行 npm run seed')
  }
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  return db
}

export function saveDB() {
  if (!db) return
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  const tmp = `${DB_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8')
  fs.renameSync(tmp, DB_FILE)
}

export function setDB(next) {
  db = next
  saveDB()
}

export function nextId(key) {
  const data = getDB()
  data.seq[key] = (data.seq[key] || 0) + 1
  return data.seq[key]
}

export function resetCache() {
  db = null
}
