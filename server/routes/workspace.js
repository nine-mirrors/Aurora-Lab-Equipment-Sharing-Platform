import { Router } from 'express'
import { getDB, saveDB } from '../db.js'
import { requireAuth } from '../auth.js'
import { getNumberSetting } from '../settings.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

// 公开借用规则（登录用户可读，用于前端日期选择器前置限制）
router.get('/settings/public', requireAuth(), (req, res) => {
  const db = getDB()
  ok(res, {
    max_borrow_days: getNumberSetting(db, 'max_borrow_days', 90),
    max_renew_days: getNumberSetting(db, 'max_renew_days', 30),
    booking_advance_days: getNumberSetting(db, 'booking_advance_days', 30)
  })
})

// 当前用户站内通知
router.get('/notifications', requireAuth(), (req, res) => {
  const db = getDB()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30))

  const list = (db.notifications || [])
    .filter(item => item.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  ok(res, {
    list: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length,
    unread: list.filter(item => !item.read).length
  })
})

router.patch('/notifications/read-all', requireAuth(), (req, res) => {
  const db = getDB()
  const now = new Date().toISOString()
  let count = 0

  ;(db.notifications || []).forEach(item => {
    if (item.user_id === req.user.id && !item.read) {
      item.read = true
      item.read_at = now
      count += 1
    }
  })

  saveDB()
  ok(res, { count }, '已全部标记为已读')
})

router.patch('/notifications/:id/read', requireAuth(), (req, res) => {
  const db = getDB()
  const notification = (db.notifications || []).find(
    item => item.id === Number(req.params.id) && item.user_id === req.user.id
  )
  if (!notification) return fail(res, '通知不存在', 404)

  notification.read = true
  notification.read_at = new Date().toISOString()
  saveDB()
  ok(res, notification, '已标记为已读')
})

// 平台公告
router.get('/announcements', requireAuth(), (req, res) => {
  const list = (getDB().announcements || [])
    .filter(item => Number(item.is_active))
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
  ok(res, { list, total: list.length })
})

// 当前用户信用流水
router.get('/me/credit-logs', requireAuth(), (req, res) => {
  const db = getDB()
  const list = (db.credit_logs || [])
    .filter(item => item.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 50)

  ok(res, {
    score: req.user.credit_score ?? 100,
    list
  })
})

// 管理员审计日志
router.get('/admin/audit-logs', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20))
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const action = String(req.query.action || '').trim()

  let list = [...(db.audit_logs || [])]

  if (action && action !== 'all') {
    list = list.filter(item => item.action === action)
  }

  if (keyword) {
    list = list.filter(
      item =>
        String(item.actor_name || '').toLowerCase().includes(keyword) ||
        String(item.target_name || '').toLowerCase().includes(keyword) ||
        String(item.detail || '').toLowerCase().includes(keyword)
    )
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  ok(res, {
    list: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length
  })
})

// 数据库表规模（管理端展示，便于确认数据厚度）
router.get('/admin/database', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const tables = [
    ['users', '用户'],
    ['departments', '院系'],
    ['labs', '实验室场地'],
    ['categories', '设备分类'],
    ['devices', '设备档案'],
    ['bookings', '借用申请'],
    ['maintenance', '维护工单'],
    ['notifications', '站内通知'],
    ['announcements', '平台公告'],
    ['favorites', '收藏关系'],
    ['credit_logs', '信用流水'],
    ['login_logs', '登录日志'],
    ['audit_logs', '审计日志'],
    ['settings', '系统设置'],
    ['push_subscriptions', '推送订阅（浏览器授权后生成）']
  ].map(([key, label]) => ({
    key,
    label,
    count: Array.isArray(db[key]) ? db[key].length : 0
  }))
  tables.sort((a, b) => b.count - a.count)

  ok(res, {
    schemaVersion: db.meta?.schemaVersion || 0,
    tables,
    total: tables.reduce((sum, item) => sum + item.count, 0)
  })
})

export default router
