import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = process.env.LAB_DB_FILE
  ? path.resolve(process.env.LAB_DB_FILE)
  : path.join(__dirname, '..', 'server', 'data', 'db.json')

if (!fs.existsSync(DB_FILE)) {
  console.log('未找到 db.json，跳过数据完整性检查（首次启动会自动生成演示数据）。')
  process.exit(0)
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
const problems = []

const businessTables = [
  'users',
  'departments',
  'labs',
  'categories',
  'devices',
  'bookings',
  'maintenance',
  'notifications',
  'announcements',
  'favorites',
  'credit_logs',
  'login_logs',
  'audit_logs',
  'settings'
]

businessTables.forEach(key => {
  if (!Array.isArray(db[key]) || db[key].length === 0) {
    problems.push(`业务表 ${key} 为空`)
  }
})

const bookingStatuses = ['pending', 'approved', 'returning', 'returned', 'rejected', 'cancelled']
const statusSet = new Set((db.bookings || []).map(item => item.status))
bookingStatuses.forEach(status => {
  if (!statusSet.has(status)) problems.push(`借用状态缺少 ${status} 样本`)
})

const extensionStatuses = ['pending', 'approved', 'rejected']
const extensionSet = new Set((db.bookings || []).map(item => item.extension_status).filter(Boolean))
extensionStatuses.forEach(status => {
  if (!extensionSet.has(status)) problems.push(`续借状态缺少 ${status} 样本`)
})

const maintenanceStatuses = ['pending', 'processing', 'done', 'rejected']
const maintenanceSet = new Set((db.maintenance || []).map(item => item.status))
maintenanceStatuses.forEach(status => {
  if (!maintenanceSet.has(status)) problems.push(`维护状态缺少 ${status} 样本`)
})

if (!(db.users || []).some(user => user.blacklisted)) {
  problems.push('缺少黑名单账号样本')
}

const adminUser = (db.users || []).find(user => user.role === 'admin')
if (!adminUser) problems.push('缺少管理员账号')

const demoStudent = (db.users || []).find(user => user.account === 'student')
if (!demoStudent) {
  problems.push('缺少 student 演示账号')
} else {
  const mine = (db.bookings || []).filter(item => item.user_id === demoStudent.id)
  bookingStatuses.forEach(status => {
    if (!mine.some(item => item.status === status)) {
      problems.push(`student 演示账号缺少 ${status} 状态的申请`)
    }
  })
}

console.log('数据集合：')
businessTables.forEach(key => {
  console.log(`  ${key.padEnd(16)} ${(db[key] || []).length}`)
})
console.log(`  ${'push_subscriptions'.padEnd(16)} ${(db.push_subscriptions || []).length}（浏览器授权后生成，0 为正常）`)
console.log(`  ${'codes'.padEnd(16)} ${(db.codes || []).length}（验证码临时表，0 为正常）`)

if (problems.length) {
  console.error('\n数据完整性检查未通过：')
  problems.forEach(item => console.error(`  - ${item}`))
  process.exit(1)
}

console.log('\n数据完整性检查通过：业务表非空，借用 / 续借 / 维护 / 黑名单样本齐全。')
