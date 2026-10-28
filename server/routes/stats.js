import { Router } from 'express'
import { getDB } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })

const DAY = 86400000
const pad = num => String(num).padStart(2, '0')

function dayKey(input) {
  const date = new Date(input)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function sum(list, key) {
  return list.reduce((total, item) => total + Number(item[key] || 0), 0)
}

router.get('/overview', requireAuth(), (req, res) => {
  const db = getDB()
  const today = dayKey(Date.now())
  const month = today.slice(0, 7)

  const devices = db.devices.filter(item => Number(item.is_active))
  const totalQty = sum(devices, 'total_qty')
  const availableQty = sum(devices, 'available_qty')
  const borrowedQty = Math.max(0, totalQty - availableQty)
  const bookings = db.bookings

  const pending = bookings.filter(item => item.status === 'pending').length
  const inUse = bookings.filter(item => item.status === 'approved').length
  const returning = bookings.filter(item => item.status === 'returning').length
  const overdue = bookings.filter(
    item => item.status === 'approved' && item.borrow_end < today
  ).length
  const studentCount = db.users.filter(item => item.role === 'student').length

  const monthBookings = bookings.filter(
    item => dayKey(item.created_at).slice(0, 7) === month
  ).length
  const todayBookings = bookings.filter(
    item => dayKey(item.created_at) === today
  ).length

  const mine = bookings.filter(item => item.user_id === req.user.id)

  ok(res, {
    deviceCount: devices.length,
    totalQty,
    availableQty,
    borrowedQty,
    utilizationRate: totalQty ? Math.round((borrowedQty / totalQty) * 1000) / 10 : 0,
    pending,
    inUse,
    returning,
    overdue,
    studentCount,
    monthBookings,
    todayBookings,
    mine: {
      total: mine.length,
      pending: mine.filter(item => item.status === 'pending').length,
      active: mine.filter(item => ['approved', 'returning'].includes(item.status)).length,
      overdue: mine.filter(
        item => item.status === 'approved' && item.borrow_end < today
      ).length,
      returned: mine.filter(item => item.status === 'returned').length,
      month: mine.filter(item => dayKey(item.created_at).slice(0, 7) === month).length
    }
  })
})

router.get('/trend', requireAuth(), (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30))
  const bookings = getDB().bookings

  const applicationMap = new Map()
  const approvalMap = new Map()

  bookings.forEach(item => {
    const created = dayKey(item.created_at)
    applicationMap.set(created, (applicationMap.get(created) || 0) + 1)

    if (item.approved_at) {
      const approved = dayKey(item.approved_at)
      approvalMap.set(approved, (approvalMap.get(approved) || 0) + 1)
    }
  })

  const list = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * DAY)
    const key = dayKey(date)
    list.push({
      date: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      fullDate: key,
      applications: applicationMap.get(key) || 0,
      approvals: approvalMap.get(key) || 0
    })
  }

  ok(res, list)
})

router.get('/categories', requireAuth(), (req, res) => {
  const devices = getDB().devices.filter(item => Number(item.is_active))
  const map = new Map()

  devices.forEach(item => {
    const current = map.get(item.category) || { name: item.category, total: 0, available: 0, count: 0 }
    current.total += Number(item.total_qty)
    current.available += Number(item.available_qty)
    current.count += 1
    map.set(item.category, current)
  })

  const list = [...map.values()]
    .map(item => ({
      ...item,
      borrowed: Math.max(0, item.total - item.available),
      rate: item.total
        ? Math.round(((item.total - item.available) / item.total) * 1000) / 10
        : 0
    }))
    .sort((a, b) => b.total - a.total)

  ok(res, list)
})

router.get('/utilization', requireAuth(), (req, res) => {
  const db = getDB()
  const validStatus = ['returned', 'approved', 'returning']

  const borrowCountMap = new Map()
  db.bookings.forEach(item => {
    if (!validStatus.includes(item.status)) return
    borrowCountMap.set(item.device_id, (borrowCountMap.get(item.device_id) || 0) + 1)
  })

  const list = db.devices
    .filter(item => Number(item.is_active))
    .map(item => {
      const borrowed = Math.max(0, Number(item.total_qty) - Number(item.available_qty))
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        total: Number(item.total_qty),
        available: Number(item.available_qty),
        borrowed,
        borrowCount: borrowCountMap.get(item.id) || 0,
        rate: item.total_qty
          ? Math.round((borrowed / Number(item.total_qty)) * 1000) / 10
          : 0
      }
    })
    .sort((a, b) => b.borrowCount - a.borrowCount)
    .slice(0, 8)

  ok(res, list)
})

// 最近申请包含申请人姓名与用途，仅管理员可见；其余统计接口只返回聚合量
router.get('/recent', requireAuth(['admin']), (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8))
  const bookings = [...getDB().bookings]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)

  ok(res, bookings)
})

export default router
