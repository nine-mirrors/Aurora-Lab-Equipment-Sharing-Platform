import { getDB, saveDB } from './db.js'
import { notify } from './notify.js'
import { getNumberSetting } from './settings.js'

const DAY_MS = 86400000
const BLACKLIST_THRESHOLD = 60

function pad(num) {
  return String(num).padStart(2, '0')
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function diffDays(from, to) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.round((end - start) / DAY_MS))
}

function appendLog(db, user, { change, reason, refType = 'booking', refId = null, createdAt }) {
  const balance = Math.max(0, Number(user.credit_score ?? 100) + change)
  user.credit_score = balance

  if (!Array.isArray(db.credit_logs)) db.credit_logs = []
  db.seq.credit_logs = Number(db.seq.credit_logs || 0) + 1

  db.credit_logs.push({
    id: db.seq.credit_logs,
    user_id: user.id,
    change,
    balance,
    reason,
    ref_type: refType,
    ref_id: refId,
    created_at: createdAt || new Date().toISOString()
  })

  return balance
}

function autoBlacklist(db, user, reason) {
  if (user.role === 'admin' || user.blacklisted) return false
  user.blacklisted = true
  user.blacklist_reason = reason
  user.blacklisted_at = new Date().toISOString()
  notify(user.id, {
    type: 'error',
    title: '账号已暂停借用资格',
    content: `信用分低于 ${BLACKLIST_THRESHOLD} 分：${reason}。请联系实验室管理员处理。`,
    link: '/student/profile'
  })
  return true
}

/**
 * 逾期信用结算：按天扣减，已扣天数记录在 booking.overdue_charged_days，
 * 重复调用不会重复扣分。信用分低于阈值时自动暂停借用资格。
 */
export function settleOverdueCredit(db = getDB()) {
  const today = dateKey()
  const penalty = Math.abs(getNumberSetting(db, 'overdue_penalty', -5))
  let changed = false

  db.bookings.forEach(booking => {
    if (!['approved', 'returning'].includes(booking.status)) return
    if (!booking.borrow_end || booking.borrow_end >= today) return

    const overdueDays = diffDays(booking.borrow_end, today)
    const chargedDays = Number(booking.overdue_charged_days || 0)
    if (overdueDays <= chargedDays) return

    const extraDays = overdueDays - chargedDays
    booking.overdue_charged_days = overdueDays
    changed = true

    const user = db.users.find(item => item.id === booking.user_id)
    if (!user) return

    const balance = appendLog(db, user, {
      change: -penalty * extraDays,
      reason: `「${booking.device_name}」逾期 ${extraDays} 天未归还`,
      refId: booking.id
    })

    if (balance < BLACKLIST_THRESHOLD) {
      autoBlacklist(db, user, `逾期未归还导致信用分降至 ${balance} 分`)
    }
  })

  if (changed) saveDB()
  return changed
}

/** 归还核验通过时的信用奖励：按期归还 +1 分 */
export function rewardOnTimeReturn(db, booking) {
  const user = db.users.find(item => item.id === booking.user_id)
  if (!user) return 0
  const returnDate = dateKey(new Date(booking.returned_at || Date.now()))
  if (returnDate > booking.borrow_end) return 0

  appendLog(db, user, {
    change: 1,
    reason: `「${booking.device_name}」按期归还设备`,
    refId: booking.id
  })
  return 1
}

/** 完成设备评价 +1 分，每条申请仅一次 */
export function rewardOnReview(db, booking) {
  const user = db.users.find(item => item.id === booking.user_id)
  if (!user) return 0

  appendLog(db, user, {
    change: 1,
    reason: `完成「${booking.device_name}」使用评价`,
    refId: booking.id
  })
  return 1
}
