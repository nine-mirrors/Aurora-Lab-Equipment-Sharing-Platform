import { Router } from 'express'
import { getDB, saveDB } from '../db.js'
import { requireAuth } from '../auth.js'
import { notify } from '../notify.js'
import { rewardOnReview } from '../credit.js'
import { getBoolSetting } from '../settings.js'
import { logBusiness } from '../logger.js'
import {
  checkBookingAvailability,
  createBooking,
  dateKey,
  extendBooking
} from '../services/booking-service.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 保留原有导出签名，供规则测试直接调用
export function checkAvailability(device, start, end, excludeId = null) {
  return checkBookingAvailability(getDB(), device, start, end, excludeId)
}

router.post('/bookings', requireAuth(), (req, res) => {
  const db = getDB()
  const result = createBooking(db, req.user, req.body || {})
  if (!result.ok) return fail(res, result.message, result.code || 400)

  const { booking } = result
  logBusiness('booking.create', {
    bookingId: booking.id,
    userId: req.user.id,
    deviceId: booking.device_id,
    borrowStart: booking.borrow_start,
    borrowEnd: booking.borrow_end
  })
  notify(req.user.id, {
    type: 'info',
    title: '借用申请已提交',
    content: `「${booking.device_name}」的申请已提交，等待管理员审核。`,
    link: '/applyRecord'
  })
  saveDB()

  ok(res, booking, '借用申请已提交，等待管理员审核')
})

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

function countReserved(db, deviceId, key) {
  return db.bookings.filter(
    item =>
      item.device_id === deviceId &&
      ['approved', 'returning'].includes(item.status) &&
      item.borrow_start <= key &&
      item.borrow_end >= key
  ).length
}

// 借用冲突预检：提交前告诉学生所选时段每天的剩余量与可用替代时段
router.post('/bookings/conflict-check', requireAuth(), (req, res) => {
  const db = getDB()
  const { device_id, borrow_start, borrow_end } = req.body || {}
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  const device = db.devices.find(item => item.id === Number(device_id))
  if (!device) return fail(res, '设备不存在', 404)
  if (!DATE_RE.test(String(borrow_start || '')) || !DATE_RE.test(String(borrow_end || ''))) {
    return fail(res, '日期格式不正确，应为 YYYY-MM-DD')
  }
  if (borrow_end < borrow_start) return fail(res, '归还日期不能早于借用日期')

  const total = Number(device.total_qty) || 0
  const start = new Date(`${borrow_start}T00:00:00`)
  const last = new Date(`${borrow_end}T00:00:00`)
  const duration = Math.round((last - start) / 86400000) + 1

  const days = []
  let minRemaining = total
  const cursor = new Date(start)
  while (cursor <= last) {
    const key = dateKey(cursor)
    const reserved = countReserved(db, device.id, key)
    const remaining = Math.max(0, total - reserved)
    days.push({ date: key, reserved, remaining })
    minRemaining = Math.min(minRemaining, remaining)
    cursor.setDate(cursor.getDate() + 1)
  }

  const suggestions = []
  if (minRemaining <= 0) {
    for (let offset = 1; offset <= 21 && suggestions.length < 3; offset += 1) {
      const candidateStart = addDays(borrow_start, offset)
      const candidateEnd = addDays(candidateStart, duration - 1)
      let available = true
      const probe = new Date(`${candidateStart}T00:00:00`)
      const probeEnd = new Date(`${candidateEnd}T00:00:00`)
      while (probe <= probeEnd) {
        if (total - countReserved(db, device.id, dateKey(probe)) <= 0) {
          available = false
          break
        }
        probe.setDate(probe.getDate() + 1)
      }
      if (available) suggestions.push({ start: candidateStart, end: candidateEnd })
    }
  }

  ok(res, {
    total,
    duration,
    minRemaining,
    conflict: minRemaining <= 0,
    days,
    suggestions
  })
})

router.get('/bookings/my', requireAuth(), (req, res) => {
  const db = getDB()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(2000, Math.max(1, Number(req.query.pageSize) || 10))

  const list = db.bookings
    .filter(item => item.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(item => ({
      ...item,
      is_overdue: item.status === 'approved' && item.borrow_end < dateKey()
    }))

  ok(res, {
    list: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length
  })
})

router.get('/bookings/:id', requireAuth(), (req, res) => {
  const booking = getDB().bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请记录不存在', 404)

  if (req.user.role !== 'admin' && booking.user_id !== req.user.id) {
    return fail(res, '无权查看该申请', 403)
  }

  ok(res, booking)
})

router.patch('/bookings/:id/cancel', requireAuth(), (req, res) => {
  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请记录不存在', 404)
  if (booking.user_id !== req.user.id) return fail(res, '无权操作该申请', 403)
  if (!getBoolSetting(db, 'allow_self_cancel', true)) {
    return fail(res, '管理员已关闭学生自行取消，请联系实验室管理员处理')
  }
  if (booking.status !== 'pending') {
    return fail(res, '只有待审核的申请可以取消')
  }

  booking.status = 'cancelled'
  booking.cancelled_at = new Date().toISOString()
  logBusiness('booking.cancel', { bookingId: booking.id, userId: req.user.id })
  saveDB()

  ok(res, booking, '申请已取消')
})

router.patch('/bookings/:id/extend', requireAuth(), (req, res) => {
  if (req.user.blacklisted) {
    return fail(
      res,
      `账号已被限制借用：${req.user.blacklist_reason || '请联系实验室管理员解除限制'}`,
      403
    )
  }

  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请记录不存在', 404)
  if (booking.user_id !== req.user.id) return fail(res, '无权操作该申请', 403)
  if (booking.status !== 'approved') return fail(res, '只有正在借用的设备可以申请续借')

  const { new_end, reason } = req.body || {}
  const result = extendBooking(db, booking, new_end)
  if (!result.ok) return fail(res, result.message, result.code || 400)

  booking.extension_status = 'pending'
  booking.requested_end = new_end
  booking.extension_reason = reason || ''
  booking.extension_requested_at = new Date().toISOString()
  logBusiness('booking.extend', { bookingId: booking.id, userId: req.user.id, newEnd: new_end })
  saveDB()

  ok(res, booking, '续借申请已提交，等待管理员审核')
})

router.patch('/bookings/:id/pickup', requireAuth(), (req, res) => {
  const booking = getDB().bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请记录不存在', 404)
  if (booking.user_id !== req.user.id) return fail(res, '无权操作该申请', 403)
  if (booking.status !== 'approved') return fail(res, '当前状态无法确认取件')
  if (booking.picked_up_at) return ok(res, booking, '已确认取件')

  const { code } = req.body || {}
  if (booking.pickup_code && String(code || '') !== String(booking.pickup_code)) {
    return fail(res, '取件码不正确，请核对后重试')
  }

  booking.picked_up_at = new Date().toISOString()
  logBusiness('booking.pickup', { bookingId: booking.id, userId: req.user.id })
  saveDB()

  ok(res, booking, '取件成功，祝实验顺利')
})

router.patch('/bookings/:id/return', requireAuth(), (req, res) => {
  const booking = getDB().bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请记录不存在', 404)
  if (booking.user_id !== req.user.id) return fail(res, '无权操作该申请', 403)
  if (booking.status !== 'approved') {
    return fail(res, '当前状态不能申请归还')
  }

  booking.status = 'returning'
  booking.return_requested_at = new Date().toISOString()
  booking.return_code = booking.return_code || generateCode()
  logBusiness('booking.return', { bookingId: booking.id, userId: req.user.id })
  saveDB()

  ok(res, booking, '归还申请已提交，请凭归还码交给管理员核验')
})

router.post('/bookings/:id/review', requireAuth(), (req, res) => {
  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请记录不存在', 404)
  if (booking.user_id !== req.user.id) return fail(res, '无权评价该申请', 403)
  if (booking.status !== 'returned') return fail(res, '归还完成后才能评价设备')
  if (Number(booking.review_rating)) return fail(res, '该申请已经评价过了')

  const { rating, comment } = req.body || {}
  const score = Number(rating)
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return fail(res, '请选择 1-5 星评分')
  }

  booking.review_rating = score
  booking.review_comment = String(comment || '').slice(0, 300)
  booking.reviewed_at = new Date().toISOString()
  logBusiness('booking.review', { bookingId: booking.id, userId: req.user.id, rating: score })

  rewardOnReview(db, booking)

  const device = db.devices.find(item => item.id === booking.device_id)
  if (device) {
    device.rating_total = Number(device.rating_total || 0) + score
    device.rating_count = Number(device.rating_count || 0) + 1
    device.rating = Math.round((device.rating_total / device.rating_count) * 10) / 10
  }

  saveDB()
  ok(res, booking, '感谢你的评价')
})

export default router
