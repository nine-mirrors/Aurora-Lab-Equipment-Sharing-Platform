import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-rules-credit-'))
process.env.LAB_DB_FILE = path.join(tmpDir, 'db.json')

const { initDB } = await import('../../server/seed.js')
initDB()
const { migrateDB } = await import('../../server/migrate.js')
migrateDB()
const { getDB } = await import('../../server/db.js')
const { rewardOnReview, rewardOnTimeReturn, settleOverdueCredit } = await import(
  '../../server/credit.js'
)

const pad = num => String(num).padStart(2, '0')
const dateKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const offsetKey = days => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

function addUser(db, id, credit) {
  const user = {
    id,
    account: `rule${id}`,
    name: `规则测试${id}`,
    role: 'student',
    email: `rule${id}@test.edu.cn`,
    password: 'salt:hash',
    credit_score: credit,
    blacklisted: false,
    blacklist_reason: '',
    blacklisted_at: null,
    token_version: 0,
    created_at: new Date().toISOString()
  }
  db.users.push(user)
  return user
}

function addBooking(db, id, userId, end, status = 'approved') {
  const booking = {
    id,
    device_id: 1,
    device_name: '规则测试设备',
    category: '电子测量',
    user_id: userId,
    user_name: '规则测试',
    borrow_start: end,
    borrow_end: end,
    purpose: 'rule test',
    status,
    pickup_code: '111111',
    review_rating: null,
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    returned_at: null,
    overdue_charged_days: 0
  }
  db.bookings.push(booking)
  return booking
}

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('逾期按天扣分且重复结算不重复扣', () => {
  const db = getDB()
  const user = addUser(db, 9001, 100)
  addBooking(db, 9001, user.id, offsetKey(-3))

  settleOverdueCredit()
  assert.equal(user.credit_score, 85)

  const logs = db.credit_logs.filter(item => item.ref_id === 9001)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].change, -15)

  settleOverdueCredit()
  assert.equal(user.credit_score, 85)
  assert.equal(db.credit_logs.filter(item => item.ref_id === 9001).length, 1)
})

test('信用分低于 60 自动暂停借用资格', () => {
  const db = getDB()
  const user = addUser(db, 9002, 50)
  addBooking(db, 9002, user.id, offsetKey(-2))

  settleOverdueCredit()
  assert.equal(user.credit_score, 40)
  assert.equal(user.blacklisted, true)
  assert.match(user.blacklist_reason, /逾期/)
})

test('按期归还与完成评价各奖励 1 分', () => {
  const db = getDB()
  const user = addUser(db, 9003, 100)
  const booking = addBooking(db, 9003, user.id, offsetKey(1), 'returned')
  booking.returned_at = new Date().toISOString()

  assert.equal(rewardOnTimeReturn(db, booking), 1)
  assert.equal(user.credit_score, 101)
  assert.equal(rewardOnReview(db, booking), 1)
  assert.equal(user.credit_score, 102)
})
