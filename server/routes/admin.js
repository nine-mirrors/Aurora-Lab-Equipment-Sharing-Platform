import { Router } from 'express'
import { getDB, saveDB } from '../db.js'
import { requireAuth, publicUser } from '../auth.js'
import { notify, audit } from '../notify.js'
import { rewardOnTimeReturn, settleOverdueCredit } from '../credit.js'
import { getBoolSetting } from '../settings.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

const LIST_FILTERS = {
  pending: item => item.status === 'pending',
  unreturned: item => item.status === 'approved',
  returning: item => item.status === 'returning',
  returned: item => item.status === 'returned',
  rejected: item => item.status === 'rejected',
  cancelled: item => item.status === 'cancelled',
  'extension-pending': item =>
    item.status === 'approved' && item.extension_status === 'pending',
  'return-rejected': item => item.status === 'approved' && Boolean(item.return_reject_reason)
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function extensionConflictDate(db, booking, newEnd) {
  const device = db.devices.find(item => item.id === booking.device_id)
  if (!device) return null
  const total = Number(device.total_qty) || 0
  const cursor = new Date(`${booking.borrow_start}T00:00:00`)
  const last = new Date(`${newEnd}T00:00:00`)

  while (cursor <= last) {
    const pad = num => String(num).padStart(2, '0')
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`
    const reserved = db.bookings.filter(
      item =>
        item.id !== booking.id &&
        item.device_id === booking.device_id &&
        ['approved', 'returning'].includes(item.status) &&
        item.borrow_start <= key &&
        item.borrow_end >= key
    ).length

    if (reserved >= total) return key
    cursor.setDate(cursor.getDate() + 1)
  }

  return null
}

router.get('/admin/bookings/:type', requireAuth(['admin']), (req, res) => {
  const filter = LIST_FILTERS[req.params.type]
  if (!filter) return fail(res, '未知的列表类型', 404)

  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(2000, Math.max(1, Number(req.query.pageSize) || 10))
  const keyword = String(req.query.keyword || '').trim()

  let list = getDB().bookings.filter(filter)

  if (keyword) {
    list = list.filter(
      item =>
        item.device_name.includes(keyword) ||
        item.user_name.includes(keyword) ||
        (item.category || '').includes(keyword)
    )
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  ok(res, {
    list: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length
  })
})

router.patch('/admin/bookings/:id/audit', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请不存在', 404)
  if (booking.status !== 'pending') return fail(res, '该申请已被处理，请刷新列表')

  const { action, reason } = req.body || {}

  if (action === 'approve') {
    const device = db.devices.find(item => item.id === booking.device_id)
    if (!device) return fail(res, '设备已被删除，无法通过申请')
    if (!Number(device.is_active)) {
      return fail(res, '该设备已下架，请先重新上架后再审批')
    }
    if (
      getBoolSetting(db, 'maintenance_block_booking', true) &&
      device.maintenance_status === 'repairing'
    ) {
      return fail(res, '该设备正在维护中，暂时不能通过新的借用申请')
    }
    if (Number(device.available_qty) <= 0) {
      return fail(res, '该设备已无可借库存，请先补充库存')
    }

    device.available_qty = Number(device.available_qty) - 1
    booking.status = 'approved'
    booking.approved_at = new Date().toISOString()
    booking.reason = ''
    booking.pickup_code = booking.pickup_code || generateCode()
    notify(booking.user_id, {
      type: 'success',
      title: '借用申请已通过',
      content: `「${booking.device_name}」已通过审核，取件码 ${booking.pickup_code}，请按时取件。`,
      link: '/applyRecord'
    })
    audit(req, {
      action: 'booking.approve',
      targetType: 'booking',
      targetId: booking.id,
      targetName: `#${booking.id} ${booking.device_name}`,
      detail: `通过 ${booking.user_name} 的借用申请`
    })
    saveDB()

    return ok(res, booking, '申请已通过，取件码已生成')
  }

  if (action === 'reject') {
    booking.status = 'rejected'
    booking.reason = reason || '审核未通过'
    booking.rejected_at = new Date().toISOString()
    notify(booking.user_id, {
      type: 'warn',
      title: '借用申请未通过',
      content: `「${booking.device_name}」未通过审核：${booking.reason}。`,
      link: '/applyRecord'
    })
    audit(req, {
      action: 'booking.reject',
      targetType: 'booking',
      targetId: booking.id,
      targetName: `#${booking.id} ${booking.device_name}`,
      detail: `拒绝：${booking.reason}`
    })
    saveDB()

    return ok(res, booking, '申请已拒绝')
  }

  fail(res, '未知的审核动作')
})

router.patch('/admin/bookings/:id/return-audit', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请不存在', 404)
  if (booking.status !== 'returning') return fail(res, '该记录不在归还审核状态')

  const { action, reason, code } = req.body || {}

  if (action === 'approve') {
    if (booking.return_code && code && String(code) !== String(booking.return_code)) {
      return fail(res, '归还码不正确，请核对后重试')
    }

    // 先结算逾期扣分，再登记归还，避免归还后漏扣
    settleOverdueCredit(db)

    booking.status = 'returned'
    booking.returned_at = new Date().toISOString()
    booking.return_reject_reason = ''

    const reward = rewardOnTimeReturn(db, booking)

    const device = db.devices.find(item => item.id === booking.device_id)
    if (device) {
      device.available_qty = Math.min(
        Number(device.total_qty),
        Number(device.available_qty) + 1
      )
    }

    notify(booking.user_id, {
      type: 'success',
      title: '设备归还完成',
      content: `「${booking.device_name}」已通过归还核验，欢迎对设备进行评价。${reward ? '按期归还，信用分 +1。' : ''}`,
      link: '/applyRecord'
    })
    audit(req, {
      action: 'return.approve',
      targetType: 'booking',
      targetId: booking.id,
      targetName: `#${booking.id} ${booking.device_name}`,
      detail: '归还核验通过，库存已回补'
    })

    saveDB()
    return ok(res, booking, '归还审核通过')
  }

  if (action === 'reject') {
    booking.status = 'approved'
    booking.return_reject_reason = reason || '归还审核未通过'
    booking.reason = reason || '归还审核未通过'
    notify(booking.user_id, {
      type: 'warn',
      title: '归还审核未通过',
      content: `「${booking.device_name}」归还核验未通过：${booking.return_reject_reason}。`,
      link: '/applyRecord'
    })
    audit(req, {
      action: 'return.reject',
      targetType: 'booking',
      targetId: booking.id,
      targetName: `#${booking.id} ${booking.device_name}`,
      detail: booking.return_reject_reason
    })
    saveDB()

    return ok(res, booking, '已拒绝归还申请')
  }

  fail(res, '未知的审核动作')
})

router.patch('/admin/bookings/:id/extension', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(req.params.id))
  if (!booking) return fail(res, '申请不存在', 404)
  if (booking.status !== 'approved' || booking.extension_status !== 'pending') {
    return fail(res, '该续借申请已被处理，请刷新列表')
  }

  const { action, reason } = req.body || {}

  if (action === 'approve') {
    const newEnd = booking.requested_end
    if (!newEnd) return fail(res, '续借目标日期缺失')

    const conflict = extensionConflictDate(db, booking, newEnd)
    if (conflict) {
      return fail(res, `${conflict} 该设备后续时段已被预约，无法通过续借`)
    }

    booking.borrow_end = newEnd
    booking.extension_status = 'approved'
    booking.extension_reviewed_at = new Date().toISOString()
    booking.extension_reject_reason = ''
    notify(booking.user_id, {
      type: 'success',
      title: '续借申请已通过',
      content: `「${booking.device_name}」归还日期已延长至 ${newEnd}。`,
      link: '/applyRecord'
    })
    audit(req, {
      action: 'extension.approve',
      targetType: 'booking',
      targetId: booking.id,
      targetName: `#${booking.id} ${booking.device_name}`,
      detail: `续借至 ${newEnd}`
    })
    saveDB()

    return ok(res, booking, '续借申请已通过')
  }

  if (action === 'reject') {
    booking.extension_status = 'rejected'
    booking.extension_reject_reason = reason || '续借申请未通过'
    booking.extension_reviewed_at = new Date().toISOString()
    notify(booking.user_id, {
      type: 'warn',
      title: '续借申请未通过',
      content: `「${booking.device_name}」续借未通过：${booking.extension_reject_reason}。`,
      link: '/applyRecord'
    })
    audit(req, {
      action: 'extension.reject',
      targetType: 'booking',
      targetId: booking.id,
      targetName: `#${booking.id} ${booking.device_name}`,
      detail: booking.extension_reject_reason
    })
    saveDB()

    return ok(res, booking, '已拒绝续借申请')
  }

  fail(res, '未知的续借审核动作')
})

router.get('/admin/users', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(2000, Math.max(1, Number(req.query.pageSize) || 10))

  let list = db.users

  if (keyword) {
    list = list.filter(
      user =>
        user.account.toLowerCase().includes(keyword) ||
        user.name.toLowerCase().includes(keyword) ||
        (user.email || '').toLowerCase().includes(keyword)
    )
  }

  const sorted = [...list].sort((a, b) => b.id - a.id)

  ok(res, {
    list: sorted.slice((page - 1) * pageSize, page * pageSize).map(publicUser),
    total: sorted.length
  })
})

router.patch('/admin/users/:id/blacklist', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const target = db.users.find(item => item.id === Number(req.params.id))
  if (!target) return fail(res, '用户不存在', 404)
  if (target.role === 'admin') return fail(res, '管理员账号不能被加入黑名单')

  const { action, reason } = req.body || {}

  if (action === 'add') {
    target.blacklisted = true
    target.blacklist_reason = String(reason || '').trim() || '违反实验室设备借用规定'
    target.blacklisted_at = new Date().toISOString()
    notify(target.id, {
      type: 'warn',
      title: '账号借用权限已受限',
      content: `你的账号已被限制借用：${target.blacklist_reason}。`,
      link: '/student/profile'
    })
    audit(req, {
      action: 'user.blacklist.add',
      targetType: 'user',
      targetId: target.id,
      targetName: `${target.name}（${target.account}）`,
      detail: target.blacklist_reason
    })
    saveDB()
    return ok(res, publicUser(target), '已加入黑名单')
  }

  if (action === 'remove') {
    target.blacklisted = false
    target.blacklist_reason = ''
    target.blacklisted_at = null
    notify(target.id, {
      type: 'success',
      title: '借用权限已恢复',
      content: '你的账号已解除限制，可以正常提交借用申请。',
      link: '/devices'
    })
    audit(req, {
      action: 'user.blacklist.remove',
      targetType: 'user',
      targetId: target.id,
      targetName: `${target.name}（${target.account}）`,
      detail: '解除借用限制'
    })
    saveDB()
    return ok(res, publicUser(target), '已解除黑名单')
  }

  fail(res, '未知的操作')
})

router.delete('/admin/users/:id', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const target = db.users.find(item => item.id === Number(req.params.id))
  if (!target) return fail(res, '用户不存在', 404)
  if (target.role === 'admin') return fail(res, '管理员账号不能注销')

  const active = db.bookings.some(
    item =>
      item.user_id === target.id &&
      ['approved', 'returning'].includes(item.status)
  )
  if (active) return fail(res, '该用户还有未归还设备，无法注销')

  db.users = db.users.filter(item => item.id !== target.id)
  db.bookings = db.bookings.filter(item => item.user_id !== target.id)
  // 同步清理该用户的个人侧数据
  db.notifications = (db.notifications || []).filter(item => item.user_id !== target.id)
  db.favorites = (db.favorites || []).filter(item => item.user_id !== target.id)
  db.push_subscriptions = (db.push_subscriptions || []).filter(item => item.user_id !== target.id)
  saveDB()

  ok(res, null, '用户已注销')
})

router.get('/admin/maintenance', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const status = String(req.query.status || '')
  const keyword = String(req.query.keyword || '').trim().toLowerCase()

  let list = [...db.maintenance]

  if (status && status !== 'all') {
    list = list.filter(item => item.status === status)
  }

  if (keyword) {
    list = list.filter(
      item =>
        item.device_name.toLowerCase().includes(keyword) ||
        item.user_name.toLowerCase().includes(keyword) ||
        item.reason.toLowerCase().includes(keyword)
    )
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const today = new Date().toISOString().slice(0, 10)
  const stats = {
    pending: db.maintenance.filter(item => item.status === 'pending').length,
    processing: db.maintenance.filter(item => item.status === 'processing').length,
    doneToday: db.maintenance.filter(
      item => item.status === 'done' && String(item.finished_at || '').slice(0, 10) === today
    ).length,
    repairing: db.devices.filter(item => item.maintenance_status === 'repairing').length
  }

  ok(res, {
    list,
    stats,
    repairingDevices: db.devices
      .filter(item => item.maintenance_status === 'repairing')
      .map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        location: item.location,
        maintenance_reason: item.maintenance_reason,
        maintenance_started_at: item.maintenance_started_at
      }))
  })
})

router.patch('/admin/maintenance/:id', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const record = db.maintenance.find(item => item.id === Number(req.params.id))
  if (!record) return fail(res, '维护记录不存在', 404)

  const device = db.devices.find(item => item.id === record.device_id)
  const { action, note } = req.body || {}
  const now = new Date().toISOString()

  if (action === 'start') {
    if (record.status !== 'pending') return fail(res, '该报修已被处理，请刷新列表')
    record.status = 'processing'
    record.started_at = now
    record.handled_at = now
    record.handler_name = req.user.name
    record.note = String(note || '').trim() || '已开始检修'

    if (device) {
      device.maintenance_status = 'repairing'
      device.maintenance_reason = record.reason
      device.maintenance_started_at = now
      device.updated_at = now
    }

    notify(record.user_id, {
      type: 'notice',
      title: '报修已开始处理',
      content: `「${record.device_name}」已开始维修，设备借用暂时停止。`,
      link: '/devices'
    })
    audit(req, {
      action: 'maintenance.start',
      targetType: 'maintenance',
      targetId: record.id,
      targetName: record.device_name,
      detail: record.reason
    })

    saveDB()
    return ok(res, record, '已开始维修，设备借用已暂停')
  }

  if (action === 'finish') {
    if (!['pending', 'processing'].includes(record.status)) {
      return fail(res, '该报修已结束，请刷新列表')
    }
    record.status = 'done'
    record.finished_at = now
    record.handled_at = now
    record.handler_name = req.user.name
    record.note = String(note || '').trim() || '维修完成，设备恢复正常'

    if (device) {
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
          item.note = item.note || '随本次维护一并处理'
        }
      })
    }

    notify(record.user_id, {
      type: 'success',
      title: '设备维修完成',
      content: `「${record.device_name}」已完成维修并恢复可借，感谢你的报修。`,
      link: '/devices'
    })
    audit(req, {
      action: 'maintenance.finish',
      targetType: 'maintenance',
      targetId: record.id,
      targetName: record.device_name,
      detail: record.note
    })

    saveDB()
    return ok(res, record, '维护已完成，设备恢复可借')
  }

  if (action === 'reject') {
    if (record.status !== 'pending') return fail(res, '该报修已被处理，请刷新列表')
    record.status = 'rejected'
    record.handled_at = now
    record.handler_name = req.user.name
    record.note = String(note || '').trim() || '经核查无需维修'

    if (device && device.maintenance_status === 'pending') {
      const hasActive = db.maintenance.some(
        item =>
          item.device_id === device.id &&
          item.id !== record.id &&
          ['pending', 'processing'].includes(item.status)
      )
      if (!hasActive) {
        device.maintenance_status = 'none'
        device.maintenance_reason = ''
        device.updated_at = now
      }
    }

    notify(record.user_id, {
      type: 'info',
      title: '报修已处理',
      content: `「${record.device_name}」的报修已核查：${record.note}。`,
      link: '/devices'
    })
    audit(req, {
      action: 'maintenance.reject',
      targetType: 'maintenance',
      targetId: record.id,
      targetName: record.device_name,
      detail: record.note
    })

    saveDB()
    return ok(res, record, '已驳回该报修')
  }

  fail(res, '未知的维护操作')
})

export default router
