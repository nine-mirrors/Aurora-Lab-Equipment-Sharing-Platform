import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-rules-availability-'))
process.env.LAB_DB_FILE = path.join(tmpDir, 'db.json')

const { initDB } = await import('../../server/seed.js')
initDB()
const { migrateDB } = await import('../../server/migrate.js')
migrateDB()
const { getDB } = await import('../../server/db.js')
const { checkAvailability } = await import('../../server/routes/bookings.js')

const pad = num => String(num).padStart(2, '0')
const dateKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const offsetKey = days => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

const db = getDB()
let bookingId = 9500

function addDevice(id, totalQty) {
  const device = {
    id,
    name: `规则设备${id}`,
    category: '电子测量',
    total_qty: totalQty,
    available_qty: totalQty,
    is_active: 1,
    maintenance_status: 'none'
  }
  db.devices.push(device)
  return device
}

function addBooking(deviceId, start, end, status = 'approved') {
  bookingId += 1
  db.bookings.push({
    id: bookingId,
    device_id: deviceId,
    device_name: `规则设备${deviceId}`,
    category: '电子测量',
    user_id: 9999,
    user_name: '规则测试',
    borrow_start: start,
    borrow_end: end,
    status,
    created_at: new Date().toISOString()
  })
}

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('单台设备：首尾日与单日边界都算冲突，紧邻日期不算', () => {
  const device = addDevice(9101, 1)
  addBooking(9101, offsetKey(1), offsetKey(3))

  assert.equal(checkAvailability(device, offsetKey(1), offsetKey(1)), offsetKey(1))
  assert.equal(checkAvailability(device, offsetKey(3), offsetKey(4)), offsetKey(3))
  assert.equal(checkAvailability(device, offsetKey(1), offsetKey(3)), offsetKey(1))
  assert.equal(checkAvailability(device, offsetKey(4), offsetKey(5)), null)
  assert.equal(checkAvailability(device, offsetKey(0), offsetKey(0)), null)
})

test('单日申请占用当天', () => {
  const device = addDevice(9102, 1)
  addBooking(9102, offsetKey(10), offsetKey(10))

  assert.equal(checkAvailability(device, offsetKey(10), offsetKey(10)), offsetKey(10))
  assert.equal(checkAvailability(device, offsetKey(11), offsetKey(11)), null)
})

test('多台库存：未约满不冲突，约满才冲突', () => {
  const device = addDevice(9103, 2)
  addBooking(9103, offsetKey(20), offsetKey(21))

  assert.equal(checkAvailability(device, offsetKey(20), offsetKey(21)), null)

  addBooking(9103, offsetKey(21), offsetKey(22))
  assert.equal(checkAvailability(device, offsetKey(20), offsetKey(22)), offsetKey(21))
})

test('已拒绝与已取消的记录不占用库存', () => {
  const device = addDevice(9104, 1)
  addBooking(9104, offsetKey(30), offsetKey(31), 'rejected')
  addBooking(9104, offsetKey(30), offsetKey(31), 'cancelled')

  assert.equal(checkAvailability(device, offsetKey(30), offsetKey(31)), null)
})
