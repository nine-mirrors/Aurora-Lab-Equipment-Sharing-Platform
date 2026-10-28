import test from 'node:test'
import assert from 'node:assert/strict'
import { getSetting, getNumberSetting, getBoolSetting } from '../../server/settings.js'

const db = {
  settings: [
    { key: 'max_borrow_days', value: '45' },
    { key: 'max_active_bookings', value: '3' },
    { key: 'allow_self_cancel', value: '0' },
    { key: 'maintenance_block_booking', value: 'true' }
  ]
}

test('读取字符串设置，缺失时使用默认值', () => {
  assert.equal(getSetting(db, 'max_borrow_days', '90'), '45')
  assert.equal(getSetting(db, 'not_exists', 'fallback'), 'fallback')
})

test('读取数字设置，空值与 0 回落到默认值', () => {
  assert.equal(getNumberSetting(db, 'max_borrow_days', 90), 45)
  assert.equal(getNumberSetting(db, 'max_active_bookings', 1), 3)
  assert.equal(getNumberSetting(db, 'not_exists', 5), 5)
})

test('读取布尔设置，支持 1/0 与 true/false', () => {
  assert.equal(getBoolSetting(db, 'allow_self_cancel', true), false)
  assert.equal(getBoolSetting(db, 'maintenance_block_booking', false), true)
  assert.equal(getBoolSetting(db, 'not_exists', true), true)
  assert.equal(getBoolSetting(db, 'not_exists', false), false)
})
