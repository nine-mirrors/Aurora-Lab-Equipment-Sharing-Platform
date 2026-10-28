import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDate,
  formatDateTime,
  formatDateKey,
  formatRelativeTime,
  formatShortDate
} from '../../src/utils/date.js'

test('formatDateKey 输出 YYYY-MM-DD', () => {
  assert.equal(formatDateKey(new Date(2026, 9, 3)), '2026-10-03')
  assert.equal(formatDateKey('2026-01-09T12:00:00'), '2026-01-09')
})

test('空值与非法日期返回占位符', () => {
  assert.equal(formatDate(null), '-')
  assert.equal(formatDate(undefined), '-')
  assert.equal(formatDate('not-a-date'), '-')
  assert.equal(formatDateKey('not-a-date'), '-')
  assert.equal(formatDateTime(''), '-')
})

test('formatDate 返回本地化日期', () => {
  const text = formatDate(new Date(2026, 9, 3))
  assert.match(text, /2026/)
  assert.match(text, /10/)
  assert.match(text, /0?3/)
})

test('formatShortDate 只保留月日', () => {
  const text = formatShortDate(new Date(2026, 9, 3))
  assert.match(text, /10/)
  assert.match(text, /0?3/)
  assert.doesNotMatch(text, /2026/)
})

test('formatDateTime 包含时与分', () => {
  const text = formatDateTime(new Date(2026, 9, 3, 14, 5))
  assert.match(text, /14/)
  assert.match(text, /05/)
})

test('formatRelativeTime 按时间差返回中文描述', () => {
  const now = Date.now()
  assert.equal(formatRelativeTime(now - 20 * 1000), '刚刚')
  assert.equal(formatRelativeTime(now - 5 * 60 * 1000), '5 分钟前')
  assert.equal(formatRelativeTime(now - 3 * 3600 * 1000), '3 小时前')
  assert.equal(formatRelativeTime(now - 2 * 86400 * 1000), '2 天前')
  assert.equal(
    formatRelativeTime(now - 30 * 86400 * 1000),
    formatDate(new Date(now - 30 * 86400 * 1000))
  )
})
