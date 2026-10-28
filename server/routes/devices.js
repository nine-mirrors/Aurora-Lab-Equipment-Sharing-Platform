import { Router } from 'express'
import { getDB, saveDB, nextId } from '../db.js'
import { requireAuth } from '../auth.js'
import { notify, audit } from '../notify.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

function toInt(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function ratingOf(db, deviceId) {
  const list = db.bookings.filter(
    item => item.device_id === deviceId && Number(item.review_rating)
  )
  if (!list.length) return { rating: null, reviewCount: 0 }

  const avg = list.reduce((sum, item) => sum + Number(item.review_rating), 0) / list.length
  return {
    rating: Math.round(avg * 10) / 10,
    reviewCount: list.length
  }
}

function decorate(db, device) {
  return { ...device, ...ratingOf(db, device.id) }
}

router.get('/devices', requireAuth(), (req, res) => {
  const db = getDB()
  const { name, category, is_active, available } = req.query
  const page = Math.max(1, toInt(req.query.page) || 1)
  const pageSize = Math.min(2000, Math.max(1, toInt(req.query.pageSize) || 10))

  let list = [...db.devices]

  if (name) {
    const keyword = String(name).trim().toLowerCase()
    list = list.filter(
      item =>
        item.name.toLowerCase().includes(keyword) ||
        (item.description || '').toLowerCase().includes(keyword)
    )
  }

  if (category) {
    list = list.filter(item => item.category === category)
  }

  if (is_active !== undefined && is_active !== '') {
    const active = String(is_active) === '1' || String(is_active) === 'true'
    list = list.filter(item => Boolean(Number(item.is_active)) === active)
  }

  if (String(available) === '1') {
    list = list.filter(
      item => Number(item.available_qty) > 0 && item.maintenance_status !== 'repairing'
    )
  }

  list.sort((a, b) => b.id - a.id)

  const total = list.length
  const start = (page - 1) * pageSize

  ok(res, {
    list: list.slice(start, start + pageSize).map(item => decorate(db, item)),
    total
  })
})

router.get('/devices/:id/availability', requireAuth(), (req, res) => {
  const db = getDB()
  const device = db.devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)

  const month = String(req.query.month || '').slice(0, 7)
  const monthRe = /^\d{4}-\d{2}$/
  const target = monthRe.test(month) ? month : new Date().toISOString().slice(0, 7)
  const [year, monthIndex] = target.split('-').map(Number)
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  const total = Number(device.total_qty) || 0
  const pad = num => String(num).padStart(2, '0')

  const days = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${pad(monthIndex)}-${pad(day)}`
    const activeList = db.bookings.filter(
      item =>
        item.device_id === device.id &&
        ['approved', 'returning'].includes(item.status) &&
        item.borrow_start <= key &&
        item.borrow_end >= key
    )
    const pending = db.bookings.filter(
      item =>
        item.device_id === device.id &&
        item.status === 'pending' &&
        item.borrow_start <= key &&
        item.borrow_end >= key
    ).length

    days.push({
      date: key,
      reserved: activeList.length,
      pending,
      remaining: Math.max(0, total - activeList.length)
    })
  }

  ok(res, {
    month: target,
    device: decorate(db, device),
    days
  })
})

router.get('/devices/:id/reviews', requireAuth(), (req, res) => {
  const db = getDB()
  const device = db.devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)

  const list = db.bookings
    .filter(item => item.device_id === device.id && Number(item.review_rating))
    .sort((a, b) => new Date(b.reviewed_at || b.returned_at) - new Date(a.reviewed_at || a.returned_at))
    .slice(0, 30)
    .map(item => ({
      id: item.id,
      user_name: item.user_name,
      rating: Number(item.review_rating),
      comment: item.review_comment || '',
      reviewed_at: item.reviewed_at || item.returned_at,
      purpose: item.purpose || ''
    }))

  ok(res, {
    summary: ratingOf(db, device.id),
    list
  })
})

router.get('/devices/:id', requireAuth(), (req, res) => {
  const db = getDB()
  const device = db.devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)
  ok(res, decorate(db, device))
})

router.post('/devices/:id/report', requireAuth(), (req, res) => {
  const db = getDB()
  const device = db.devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)

  const { reason, detail } = req.body || {}
  if (!reason) return fail(res, '请选择故障类型')

  if (device.maintenance_status === 'repairing') {
    return fail(res, '该设备已在维修中，管理员正在处理', 409)
  }

  const duplicated = db.maintenance.some(
    item =>
      item.device_id === device.id &&
      item.user_id === req.user.id &&
      ['pending', 'processing'].includes(item.status)
  )
  if (duplicated) return fail(res, '你已提交过该设备的报修，请等待管理员处理', 409)

  const record = {
    id: nextId('maintenance'),
    device_id: device.id,
    device_name: device.name,
    category: device.category,
    user_id: req.user.id,
    user_name: req.user.name,
    reason: String(reason).trim(),
    detail: String(detail || '').trim(),
    status: 'pending',
    note: '',
    handler_name: '',
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    handled_at: null
  }

  db.maintenance.push(record)

  if (device.maintenance_status === 'none') {
    device.maintenance_status = 'pending'
    device.maintenance_reason = record.reason
    device.updated_at = new Date().toISOString()
  }

  notify(req.user.id, {
    type: 'notice',
    title: '设备报修已提交',
    content: `「${device.name}」的报修已提交，管理员会尽快处理。`,
    link: '/devices'
  })
  db.users
    .filter(item => item.role === 'admin')
    .forEach(admin => {
      notify(admin.id, {
        type: 'warn',
        title: '新的设备报修',
        content: `${req.user.name} 报修「${device.name}」：${record.reason}。`,
        link: '/admin/maintenance'
      })
    })

  saveDB()
  ok(res, record, '报修已提交，管理员会尽快处理')
})

router.patch('/admin/devices/:id/maintenance', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const device = db.devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)

  const { action, reason } = req.body || {}
  const now = new Date().toISOString()

  if (action === 'start') {
    if (device.maintenance_status === 'repairing') return fail(res, '该设备已在维护中')
    device.maintenance_status = 'repairing'
    device.maintenance_reason = String(reason || '').trim() || '设备检修'
    device.maintenance_started_at = now
    device.updated_at = now
    audit(req, {
      action: 'device.maintenance.start',
      targetType: 'device',
      targetId: device.id,
      targetName: device.name,
      detail: device.maintenance_reason
    })
    saveDB()
    return ok(res, device, '已标记为维护中，新的借用申请将被暂停')
  }

  if (action === 'finish') {
    if (device.maintenance_status !== 'repairing') return fail(res, '该设备当前不在维护中')
    device.maintenance_status = 'none'
    device.maintenance_reason = ''
    device.maintenance_started_at = null
    device.updated_at = now

    db.maintenance.forEach(item => {
      if (item.device_id === device.id && ['pending', 'processing'].includes(item.status)) {
        item.status = 'done'
        item.finished_at = now
        item.handled_at = now
        item.handler_name = req.user.name
        item.note = item.note || '维护完成，问题已处理'
      }
    })

    audit(req, {
      action: 'device.maintenance.finish',
      targetType: 'device',
      targetId: device.id,
      targetName: device.name,
      detail: '维护完成，恢复可借'
    })

    saveDB()
    return ok(res, device, '维护已完成，设备恢复可借')
  }

  fail(res, '未知的维护操作')
})

router.post('/admin/devices', requireAuth(['admin']), (req, res) => {
  const { name, category, description, total_qty, location, is_active, image } = req.body || {}

  if (!name || !category) return fail(res, '设备名称和分类不能为空')

  const total = Math.max(0, toInt(total_qty) ?? 1)
  const db = getDB()

  const device = {
    id: nextId('devices'),
    name: String(name).trim(),
    category: String(category).trim(),
    description: description || '',
    location: location || '',
    image: image || '',
    total_qty: total,
    available_qty: total,
    is_active: is_active === undefined ? 1 : Number(is_active) ? 1 : 0,
    maintenance_status: 'none',
    maintenance_reason: '',
    maintenance_started_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  db.devices.push(device)

  if (!db.categories.some(item => item.name === device.category)) {
    db.categories.push({
      id: nextId('categories'),
      name: device.category,
      code: `C${Date.now().toString().slice(-5)}`,
      description: `${device.category}分类`,
      sort_order: db.categories.length + 1,
      is_active: true,
      created_at: new Date().toISOString()
    })
  }

  audit(req, {
    action: 'device.create',
    targetType: 'device',
    targetId: device.id,
    targetName: device.name,
    detail: `上架 ${device.total_qty} 台`
  })
  saveDB()
  ok(res, device, '设备上架成功')
})

router.put('/admin/devices/:id', requireAuth(['admin']), (req, res) => {
  const device = getDB().devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)

  const { name, category, description, total_qty, location, is_active, image } = req.body || {}
  const borrowed = Math.max(0, Number(device.total_qty) - Number(device.available_qty))

  if (name) device.name = String(name).trim()
  if (category) device.category = String(category).trim()
  if (description !== undefined) device.description = description
  if (location !== undefined) device.location = location
  if (image !== undefined) device.image = image
  if (is_active !== undefined) device.is_active = Number(is_active) ? 1 : 0

  if (total_qty !== undefined) {
    const total = Math.max(0, toInt(total_qty) ?? device.total_qty)
    if (total < borrowed) {
      return fail(res, `该设备当前借出 ${borrowed} 台，总数不能小于借出数量`)
    }
    device.total_qty = total
    device.available_qty = total - borrowed
  }

  device.updated_at = new Date().toISOString()
  audit(req, {
    action: 'device.update',
    targetType: 'device',
    targetId: device.id,
    targetName: device.name,
    detail: '更新设备档案'
  })
  saveDB()

  ok(res, device, '设备信息已更新')
})

router.delete('/admin/devices/:id', requireAuth(['admin']), (req, res) => {
  const device = getDB().devices.find(item => item.id === Number(req.params.id))
  if (!device) return fail(res, '设备不存在', 404)

  device.is_active = 0
  device.updated_at = new Date().toISOString()
  audit(req, {
    action: 'device.offline',
    targetType: 'device',
    targetId: device.id,
    targetName: device.name,
    detail: '设备下架'
  })
  saveDB()

  ok(res, device, '设备已下架')
})

export default router
