import { Router } from 'express'
import { getDB, saveDB, nextId } from '../db.js'
import { requireAuth } from '../auth.js'
import { audit } from '../notify.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

const admin = requireAuth(['admin'])
const ANNOUNCEMENT_LEVELS = ['info', 'warning', 'important']
const LAB_STATUSES = ['open', 'maintenance', 'closed']
const BOOLEAN_SETTINGS = [
  'allow_self_cancel',
  'maintenance_block_booking',
  'ai_review_enabled',
  'notification_email',
  'auto_overdue_reminder'
]
const NUMBER_SETTINGS = [
  'max_borrow_days',
  'max_active_bookings',
  'overdue_penalty',
  'max_renew_days',
  'booking_advance_days'
]

// ---------- 公告 ----------
router.get('/admin/announcements', admin, (req, res) => {
  const list = [...(getDB().announcements || [])].sort(
    (a, b) => new Date(b.published_at) - new Date(a.published_at)
  )
  ok(res, { list, total: list.length })
})

router.post('/admin/announcements', admin, (req, res) => {
  const db = getDB()
  const title = String(req.body?.title || '').trim()
  const content = String(req.body?.content || '').trim()
  if (!title) return fail(res, '请填写公告标题')
  if (!content) return fail(res, '请填写公告内容')

  const record = {
    id: nextId('announcements'),
    title,
    content,
    level: ANNOUNCEMENT_LEVELS.includes(req.body?.level) ? req.body.level : 'info',
    author: req.user.name || req.user.account || '管理员',
    is_active: req.body?.is_active === false || req.body?.is_active === 0 ? 0 : 1,
    published_at: new Date().toISOString()
  }

  db.announcements.push(record)
  audit(req, {
    action: 'announcement.create',
    targetType: 'announcement',
    targetId: record.id,
    targetName: record.title,
    detail: `发布公告：${record.title}`
  })
  saveDB()
  ok(res, record, '公告已发布')
})

router.put('/admin/announcements/:id', admin, (req, res) => {
  const db = getDB()
  const record = db.announcements.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '公告不存在', 404)

  const title = String(req.body?.title ?? record.title).trim()
  const content = String(req.body?.content ?? record.content).trim()
  if (!title) return fail(res, '请填写公告标题')
  if (!content) return fail(res, '请填写公告内容')

  record.title = title
  record.content = content
  record.level = ANNOUNCEMENT_LEVELS.includes(req.body?.level) ? req.body.level : record.level
  if (req.body?.is_active !== undefined) {
    record.is_active = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1
  }

  audit(req, {
    action: 'announcement.update',
    targetType: 'announcement',
    targetId: record.id,
    targetName: record.title,
    detail: `更新公告：${record.title}`
  })
  saveDB()
  ok(res, record, '公告已更新')
})

router.delete('/admin/announcements/:id', admin, (req, res) => {
  const db = getDB()
  const record = db.announcements.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '公告不存在', 404)

  db.announcements = db.announcements.filter(item => item.id !== record.id)
  audit(req, {
    action: 'announcement.delete',
    targetType: 'announcement',
    targetId: record.id,
    targetName: record.title,
    detail: `删除公告：${record.title}`
  })
  saveDB()
  ok(res, null, '公告已删除')
})

// ---------- 院系 ----------
router.get('/admin/departments', admin, (req, res) => {
  const list = [...(getDB().departments || [])].sort((a, b) => a.id - b.id)
  ok(res, { list, total: list.length })
})

router.post('/admin/departments', admin, (req, res) => {
  const db = getDB()
  const name = String(req.body?.name || '').trim()
  const code = String(req.body?.code || '').trim().toUpperCase()
  if (!name) return fail(res, '请填写院系名称')
  if (!code) return fail(res, '请填写院系编码')
  if (db.departments.some(item => item.name === name)) return fail(res, '院系名称已存在', 409)
  if (db.departments.some(item => item.code === code)) return fail(res, '院系编码已存在', 409)

  const record = {
    id: nextId('departments'),
    name,
    code,
    description: String(req.body?.description || '').trim(),
    created_at: new Date().toISOString()
  }

  db.departments.push(record)
  audit(req, {
    action: 'department.create',
    targetType: 'department',
    targetId: record.id,
    targetName: record.name,
    detail: `新增院系：${record.name}`
  })
  saveDB()
  ok(res, record, '院系已新增')
})

router.put('/admin/departments/:id', admin, (req, res) => {
  const db = getDB()
  const record = db.departments.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '院系不存在', 404)

  const name = String(req.body?.name ?? record.name).trim()
  const code = String(req.body?.code ?? record.code).trim().toUpperCase()
  if (!name) return fail(res, '请填写院系名称')
  if (!code) return fail(res, '请填写院系编码')
  if (db.departments.some(item => item.id !== record.id && item.name === name)) {
    return fail(res, '院系名称已存在', 409)
  }
  if (db.departments.some(item => item.id !== record.id && item.code === code)) {
    return fail(res, '院系编码已存在', 409)
  }

  record.name = name
  record.code = code
  record.description = String(req.body?.description ?? record.description).trim()

  ;(db.labs || []).forEach(lab => {
    if (lab.department_id === record.id) lab.department_name = name
  })

  audit(req, {
    action: 'department.update',
    targetType: 'department',
    targetId: record.id,
    targetName: record.name,
    detail: `更新院系：${record.name}`
  })
  saveDB()
  ok(res, record, '院系已更新')
})

router.delete('/admin/departments/:id', admin, (req, res) => {
  const db = getDB()
  const record = db.departments.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '院系不存在', 404)

  if ((db.labs || []).some(item => item.department_id === record.id)) {
    return fail(res, '该院系下仍有实验室，请先调整实验室归属', 409)
  }

  db.departments = db.departments.filter(item => item.id !== record.id)
  audit(req, {
    action: 'department.delete',
    targetType: 'department',
    targetId: record.id,
    targetName: record.name,
    detail: `删除院系：${record.name}`
  })
  saveDB()
  ok(res, null, '院系已删除')
})

// ---------- 实验室 ----------
router.get('/admin/labs', admin, (req, res) => {
  const list = [...(getDB().labs || [])].sort((a, b) => a.id - b.id)
  ok(res, { list, total: list.length })
})

router.post('/admin/labs', admin, (req, res) => {
  const db = getDB()
  const name = String(req.body?.name || '').trim()
  const building = String(req.body?.building || '').trim()
  const room = String(req.body?.room || '').trim()
  if (!name) return fail(res, '请填写实验室名称')
  if (!building) return fail(res, '请填写楼栋')
  if (!room) return fail(res, '请填写房间号')
  if (db.labs.some(item => item.name === name)) return fail(res, '实验室名称已存在', 409)

  const departmentId = Number(req.body?.department_id) || null
  const department = db.departments.find(item => item.id === departmentId)

  const record = {
    id: nextId('labs'),
    name,
    building,
    room,
    department_id: department?.id || null,
    department_name: department?.name || '',
    manager: String(req.body?.manager || '').trim(),
    phone: String(req.body?.phone || '').trim(),
    capacity: Math.max(0, Number(req.body?.capacity) || 0),
    status: LAB_STATUSES.includes(req.body?.status) ? req.body.status : 'open',
    open_hours: String(req.body?.open_hours || '08:30 - 17:30').trim(),
    created_at: new Date().toISOString()
  }

  db.labs.push(record)
  audit(req, {
    action: 'lab.create',
    targetType: 'lab',
    targetId: record.id,
    targetName: record.name,
    detail: `新增实验室：${record.name}`
  })
  saveDB()
  ok(res, record, '实验室已新增')
})

router.put('/admin/labs/:id', admin, (req, res) => {
  const db = getDB()
  const record = db.labs.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '实验室不存在', 404)

  const name = String(req.body?.name ?? record.name).trim()
  const building = String(req.body?.building ?? record.building).trim()
  const room = String(req.body?.room ?? record.room).trim()
  if (!name) return fail(res, '请填写实验室名称')
  if (!building) return fail(res, '请填写楼栋')
  if (!room) return fail(res, '请填写房间号')
  if (db.labs.some(item => item.id !== record.id && item.name === name)) {
    return fail(res, '实验室名称已存在', 409)
  }

  const departmentId = Number(req.body?.department_id ?? record.department_id) || null
  const department = db.departments.find(item => item.id === departmentId)

  record.name = name
  record.building = building
  record.room = room
  record.department_id = department?.id || null
  record.department_name = department?.name || ''
  if (req.body?.manager !== undefined) record.manager = String(req.body.manager).trim()
  if (req.body?.phone !== undefined) record.phone = String(req.body.phone).trim()
  if (req.body?.capacity !== undefined) {
    record.capacity = Math.max(0, Number(req.body.capacity) || 0)
  }
  if (LAB_STATUSES.includes(req.body?.status)) record.status = req.body.status
  if (req.body?.open_hours !== undefined) {
    record.open_hours = String(req.body.open_hours).trim()
  }

  audit(req, {
    action: 'lab.update',
    targetType: 'lab',
    targetId: record.id,
    targetName: record.name,
    detail: `更新实验室：${record.name}`
  })
  saveDB()
  ok(res, record, '实验室已更新')
})

router.delete('/admin/labs/:id', admin, (req, res) => {
  const db = getDB()
  const record = db.labs.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '实验室不存在', 404)

  if ((db.devices || []).some(item => item.lab_id === record.id)) {
    return fail(res, '该实验室仍有关联设备，请先调整设备归属', 409)
  }

  db.labs = db.labs.filter(item => item.id !== record.id)
  audit(req, {
    action: 'lab.delete',
    targetType: 'lab',
    targetId: record.id,
    targetName: record.name,
    detail: `删除实验室：${record.name}`
  })
  saveDB()
  ok(res, null, '实验室已删除')
})

// ---------- 系统设置 ----------
router.get('/admin/settings', admin, (req, res) => {
  const list = [...(getDB().settings || [])].sort((a, b) => a.id - b.id)
  ok(res, { list, total: list.length })
})

router.put('/admin/settings/:key', admin, (req, res) => {
  const db = getDB()
  const record = (db.settings || []).find(item => item.key === req.params.key)
  if (!record) return fail(res, '设置项不存在', 404)
  if (req.body?.value === undefined || req.body?.value === null) {
    return fail(res, '缺少设置值')
  }

  let value = String(req.body.value).trim()
  if (BOOLEAN_SETTINGS.includes(record.key)) {
    if (!['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
      return fail(res, '布尔设置只能填写 0 / 1 / true / false')
    }
    value = ['1', 'true'].includes(value.toLowerCase()) ? '1' : '0'
  } else if (NUMBER_SETTINGS.includes(record.key)) {
    if (!Number.isFinite(Number(value))) return fail(res, '数字设置必须是有效数字')
    value = String(Number(value))
  } else if (!value) {
    return fail(res, '设置值不能为空')
  }

  record.value = value
  record.updated_by = req.user.name || req.user.account || '管理员'
  record.updated_at = new Date().toISOString()

  audit(req, {
    action: 'setting.update',
    targetType: 'setting',
    targetId: record.id,
    targetName: record.label,
    detail: `更新设置 ${record.key}：${value}`
  })
  saveDB()
  ok(res, record, '设置已更新')
})

export default router
