import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-rules-reminders-'))
process.env.LAB_DB_FILE = path.join(tmpDir, 'db.json')
process.env.LOG_DISABLED = '1'
process.env.MAIL_DISABLED = '1'

const { initDB } = await import('../../server/seed.js')
initDB()
const { migrateDB } = await import('../../server/migrate.js')
migrateDB()
const { getDB } = await import('../../server/db.js')
const { sendDueReminders } = await import('../../server/reminders.js')

const pad = num => String(num).padStart(2, '0')
const dateKey = offsetDays => {
  const date = new Date(Date.now() + offsetDays * 86400000)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDueBooking(id, name) {
  const db = getDB()
  const user = db.users.find(item => item.role === 'student' && !item.blacklisted)
  db.bookings.push({
    id,
    user_id: user.id,
    user_name: user.name,
    device_id: 1,
    device_name: name,
    category: '测试',
    borrow_start: dateKey(-1),
    borrow_end: dateKey(1),
    status: 'approved',
    extension_status: '',
    created_at: new Date().toISOString()
  })
}

test('到期前一天发送提醒且重复调用不重复提醒', () => {
  addDueBooking(99001, '提醒测试设备A')
  sendDueReminders()

  const db = getDB()
  const matches = db.notifications.filter(item => item.content.includes('申请 #99001'))
  assert.equal(matches.length, 1, '应发送一条到期提醒')
  assert.equal(matches[0].title, '设备即将到期')

  const sentAgain = sendDueReminders()
  const after = db.notifications.filter(item => item.content.includes('申请 #99001'))
  assert.equal(after.length, 1, '重复调用不应重复提醒')
  assert.equal(sentAgain, 0, '重复调用返回值应为 0')
})

test('关闭 auto_overdue_reminder 后不再发送提醒', () => {
  const db = getDB()
  const setting = db.settings.find(item => item.key === 'auto_overdue_reminder')
  setting.value = '0'

  addDueBooking(99002, '提醒测试设备B')
  sendDueReminders()

  const matches = db.notifications.filter(item => item.content.includes('申请 #99002'))
  assert.equal(matches.length, 0, '关闭设置后不应发送提醒')

  setting.value = '1'
})
