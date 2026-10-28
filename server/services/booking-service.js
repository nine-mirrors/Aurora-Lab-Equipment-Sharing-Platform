import { nextId } from '../db.js'
import { getBoolSetting, getNumberSetting } from '../settings.js'

const RESERVED_STATUS = ['approved', 'returning']
const DAY_MS = 86400000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function pad(num) {
  return String(num).padStart(2, '0')
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toDate(value) {
  return new Date(`${value}T00:00:00`)
}

function addDaysKey(key, days) {
  const date = toDate(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export function checkBookingAvailability(db, device, start, end, excludeId = null) {
  const total = Number(device.total_qty) || 0
  const cursor = toDate(start)
  const last = toDate(end)

  while (cursor <= last) {
    const key = dateKey(cursor)
    const reserved = db.bookings.filter(
      item =>
        item.id !== excludeId &&
        item.device_id === device.id &&
        RESERVED_STATUS.includes(item.status) &&
        item.borrow_start <= key &&
        item.borrow_end >= key
    ).length

    if (reserved >= total) return key
    cursor.setDate(cursor.getDate() + 1)
  }

  return null
}

/**
 * 创建借用申请的业务规则（Controller 只负责取参、通知与持久化）。
 * @returns {{ ok: true, booking: object } | { ok: false, message: string, code?: number }}
 */
export function createBooking(db, user, payload) {
  const { device_id, borrow_start, borrow_end, purpose, agreement } = payload || {}

  if (user.blacklisted) {
    return {
      ok: false,
      code: 403,
      message: `账号已被限制借用：${user.blacklist_reason || '请联系实验室管理员解除限制'}`
    }
  }

  const device = db.devices.find(item => item.id === Number(device_id))
  if (!device) return { ok: false, code: 404, message: '设备不存在' }
  if (!Number(device.is_active)) return { ok: false, message: '该设备已下架，无法申请' }

  if (
    getBoolSetting(db, 'maintenance_block_booking', true) &&
    device.maintenance_status === 'repairing'
  ) {
    return {
      ok: false,
      code: 409,
      message: `该设备正在维护：${device.maintenance_reason || '请稍后再试'}`
    }
  }

  if (Number(device.available_qty) <= 0) {
    return { ok: false, message: '该设备当前没有可借库存' }
  }
  if (!borrow_start || !borrow_end) return { ok: false, message: '请选择借用起止日期' }
  if (!DATE_RE.test(borrow_start) || !DATE_RE.test(borrow_end)) {
    return { ok: false, message: '日期格式不正确，应为 YYYY-MM-DD' }
  }

  const today = dateKey()
  const maxBorrowDays = getNumberSetting(db, 'max_borrow_days', 90)
  const maxActiveBookings = getNumberSetting(db, 'max_active_bookings', 3)
  const advanceDays = getNumberSetting(db, 'booking_advance_days', 30)

  if (borrow_start < today) return { ok: false, message: '借用开始日期不能早于今天' }
  if (borrow_start > addDaysKey(today, advanceDays)) {
    return { ok: false, message: `最多只能提前 ${advanceDays} 天预约` }
  }
  if (borrow_end < borrow_start) return { ok: false, message: '归还日期不能早于借用日期' }
  if (agreement === false) return { ok: false, message: '请先阅读并同意实验室设备借用协议' }

  const duration = toDate(borrow_end) - toDate(borrow_start)
  if (duration > maxBorrowDays * DAY_MS) {
    return { ok: false, message: `单次借用时长不能超过 ${maxBorrowDays} 天` }
  }

  const activeCount = db.bookings.filter(
    item => item.user_id === user.id && ['pending', ...RESERVED_STATUS].includes(item.status)
  ).length
  if (activeCount >= maxActiveBookings) {
    return {
      ok: false,
      code: 409,
      message: `同时进行中的申请已达上限（${maxActiveBookings} 条），请先完成或取消现有申请`
    }
  }

  const duplicated = db.bookings.some(
    item =>
      item.user_id === user.id &&
      item.device_id === device.id &&
      ['pending', ...RESERVED_STATUS].includes(item.status)
  )
  if (duplicated) {
    return { ok: false, code: 409, message: '该设备你已有进行中的申请，请勿重复提交' }
  }

  const conflictDate = checkBookingAvailability(db, device, borrow_start, borrow_end)
  if (conflictDate) {
    return {
      ok: false,
      code: 409,
      message: `${conflictDate} 该设备已被约满，请调整借用时间或选择其他设备`
    }
  }

  const booking = {
    id: nextId('bookings'),
    device_id: device.id,
    device_name: device.name,
    category: device.category,
    user_id: user.id,
    user_name: user.name,
    borrow_start,
    borrow_end,
    purpose: purpose || '',
    status: 'pending',
    reason: '',
    return_reject_reason: '',
    pickup_code: null,
    return_code: null,
    picked_up_at: null,
    extension_status: '',
    requested_end: null,
    extension_reason: '',
    review_rating: null,
    review_comment: '',
    reviewed_at: null,
    created_at: new Date().toISOString(),
    approved_at: null,
    returned_at: null
  }

  db.bookings.push(booking)
  return { ok: true, booking }
}

/** 续借申请的业务规则 */
export function extendBooking(db, booking, newEnd) {
  if (booking.extension_status === 'pending') {
    return { ok: false, message: '已有一条续借申请正在审核' }
  }
  if (booking.borrow_end < dateKey()) {
    return { ok: false, message: '设备已逾期，请先归还后再重新借出' }
  }
  if (!newEnd || !DATE_RE.test(newEnd)) {
    return { ok: false, message: '请选择新的归还日期' }
  }
  if (newEnd <= booking.borrow_end) {
    return { ok: false, message: '新的归还日期必须晚于当前归还日期' }
  }

  const maxRenewDays = getNumberSetting(db, 'max_renew_days', 30)
  const maxBorrowDays = getNumberSetting(db, 'max_borrow_days', 90)
  const renewDuration = toDate(newEnd) - toDate(booking.borrow_end)
  if (renewDuration > maxRenewDays * DAY_MS) {
    return { ok: false, message: `单次续借不能超过 ${maxRenewDays} 天` }
  }

  const duration = toDate(newEnd) - toDate(booking.borrow_start)
  if (duration > maxBorrowDays * DAY_MS) {
    return { ok: false, message: `单次借用总时长不能超过 ${maxBorrowDays} 天` }
  }

  const device = db.devices.find(item => item.id === booking.device_id)
  if (!device) return { ok: false, message: '设备不存在' }

  const conflictDate = checkBookingAvailability(db, device, booking.borrow_start, newEnd, booking.id)
  if (conflictDate) {
    return {
      ok: false,
      code: 409,
      message: `${conflictDate} 该设备后续时段已被约满，暂无法续借`
    }
  }

  return { ok: true, device }
}
