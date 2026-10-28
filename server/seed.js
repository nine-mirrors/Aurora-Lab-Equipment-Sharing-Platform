import fs from 'node:fs'
import { hashPassword } from './auth.js'
import { DB_FILE, setDB, resetCache } from './db.js'
import {
  CATEGORIES,
  DEPARTMENTS,
  DEVICES,
  LAB_ROOMS,
  PURPOSES,
  REVIEW_COMMENTS,
  STUDENTS
} from './base-data.js'

const DAY = 86400000

function mulberry32(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20261022)
const pick = list => list[Math.floor(rnd() * list.length)]
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1))
const dateStr = date => new Date(date).toISOString().slice(0, 10)

const REJECT_REASONS = ['借用目的不合理', '设备暂不可用', '库存不足', '时间冲突']

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function nowISO() {
  return new Date().toISOString()
}

function isoAt(daysAgo, hour) {
  const d = new Date(Date.now() - daysAgo * DAY)
  d.setHours(hour, int(0, 59), 0, 0)
  return d.toISOString()
}

export function buildSeedData() {
  const users = [
    {
      id: 1,
      account: 'admin',
      password: hashPassword('123456'),
      name: '李管理',
      role: 'admin',
      email: 'admin@lab.edu.cn',
      phone: '13800000001',
      avatar: '',
      blacklisted: false,
      blacklist_reason: '',
      blacklisted_at: null,
      created_at: isoAt(180, 9)
    }
  ]

  STUDENTS.forEach(([account, name, email, phone], index) => {
    users.push({
      id: index + 2,
      account,
      password: hashPassword('123456'),
      name,
      role: 'student',
      email,
      phone,
      avatar: '',
      blacklisted: false,
      blacklist_reason: '',
      blacklisted_at: null,
      created_at: isoAt(150 - index * 3, 10)
    })
  })

  const categories = CATEGORIES.map(([name, code, description], index) => ({
    id: index + 1,
    name,
    code,
    description,
    sort_order: index + 1,
    is_active: true,
    created_at: isoAt(160, 9)
  }))

  const departments = DEPARTMENTS.map(([name, code, description], index) => ({
    id: index + 1,
    name,
    code,
    description,
    created_at: isoAt(200, 9)
  }))

  const departmentMap = new Map(departments.map(item => [item.name, item]))
  const labs = LAB_ROOMS.map(
    ([name, building, room, departmentName, manager, phone, capacity], index) => ({
      id: index + 1,
      name,
      building,
      room,
      department_id: departmentMap.get(departmentName)?.id || null,
      department_name: departmentName,
      manager,
      phone,
      capacity,
      status: index % 9 === 0 ? 'maintenance' : 'open',
      open_hours: index % 4 === 0 ? '08:30 - 21:00' : '08:30 - 17:30',
      created_at: isoAt(190, 9)
    })
  )
  const labMap = new Map(labs.map(item => [item.name, item]))

  const devices = DEVICES.map(([name, category, total, location, description], index) => ({
    id: index + 1,
    name,
    category,
    description,
    location,
    lab_id: labMap.get(location)?.id || null,
    image: '',
    total_qty: total,
    available_qty: total,
    is_active: 1,
    maintenance_status: 'none',
    maintenance_reason: '',
    maintenance_started_at: null,
    created_at: isoAt(150 - Math.floor(index / 3), 9),
    updated_at: isoAt(10, 9)
  }))

  const borrowedMap = new Map()

  const plan = [
    ...Array(105).fill('returned'),
    ...Array(20).fill('approved'),
    ...Array(8).fill('returning'),
    ...Array(11).fill('pending'),
    ...Array(16).fill('rejected')
  ]

  const bookings = []
  const students = users.filter(u => u.role === 'student')

  plan.forEach((status, index) => {
    const active = status === 'approved' || status === 'returning'

    let device
    if (active) {
      const candidates = devices.filter(
        item => (borrowedMap.get(item.id) || 0) < item.total_qty
      )
      if (!candidates.length) return
      device = pick(candidates)
      borrowedMap.set(device.id, (borrowedMap.get(device.id) || 0) + 1)
    } else {
      device = pick(devices)
    }

    const student = pick(students)

    let createdDaysAgo
    let borrowStart
    let borrowEnd
    let approvedAt = null
    let returnedAt = null
    let reason = ''

    if (status === 'returned') {
      createdDaysAgo = int(8, 120)
      const start = new Date(Date.now() - createdDaysAgo * DAY + DAY)
      const end = new Date(start.getTime() + int(2, 10) * DAY)
      borrowStart = dateStr(start)
      borrowEnd = dateStr(end)
      approvedAt = new Date(new Date(Date.now() - createdDaysAgo * DAY).getTime() + DAY).toISOString()
      returnedAt = new Date(end.getTime() + int(0, 2) * DAY).toISOString()
    } else if (status === 'approved' || status === 'returning') {
      createdDaysAgo = int(3, 26)
      const start = new Date(Date.now() - createdDaysAgo * DAY + DAY)
      const span = int(4, 16)
      const end = new Date(start.getTime() + span * DAY)
      borrowStart = dateStr(start)
      borrowEnd = dateStr(end)
      approvedAt = new Date(new Date(Date.now() - createdDaysAgo * DAY).getTime() + DAY).toISOString()
    } else if (status === 'pending') {
      createdDaysAgo = index % 4 === 0 ? 0 : int(1, 5)
      const start = new Date(Date.now() + int(1, 7) * DAY)
      const end = new Date(start.getTime() + int(3, 10) * DAY)
      borrowStart = dateStr(start)
      borrowEnd = dateStr(end)
    } else if (status === 'cancelled') {
      createdDaysAgo = int(1, 30)
      const start = new Date(Date.now() + int(1, 5) * DAY)
      const end = new Date(start.getTime() + int(2, 8) * DAY)
      borrowStart = dateStr(start)
      borrowEnd = dateStr(end)
    } else {
      createdDaysAgo = int(1, 60)
      const start = new Date(Date.now() - createdDaysAgo * DAY + DAY)
      const end = new Date(start.getTime() + int(3, 10) * DAY)
      borrowStart = dateStr(start)
      borrowEnd = dateStr(end)
      reason = pick(REJECT_REASONS)
    }

    const booking = {
      id: index + 1,
      device_id: device.id,
      device_name: device.name,
      category: device.category,
      user_id: student.id,
      user_name: student.name,
      borrow_start: borrowStart,
      borrow_end: borrowEnd,
      purpose: pick(PURPOSES),
      status,
      reason,
      return_reject_reason: '',
      pickup_code: null,
      return_code: null,
      picked_up_at: null,
      extension_status: '',
      requested_end: null,
      extension_reason: '',
      extension_reject_reason: '',
      extension_reviewed_at: null,
      review_rating: null,
      review_comment: '',
      reviewed_at: null,
      created_at: isoAt(createdDaysAgo, int(8, 21)),
      approved_at: approvedAt,
      returned_at: returnedAt,
      cancelled_at: status === 'cancelled' ? isoAt(Math.max(0, createdDaysAgo - 1), int(9, 20)) : null
    }

    if (['approved', 'returning', 'returned'].includes(status)) {
      booking.pickup_code = generateCode()
      booking.picked_up_at = new Date(
        new Date(`${borrowStart}T09:00:00`).getTime() + int(0, 2) * 3600000
      ).toISOString()
    }

    if (['returning', 'returned'].includes(status)) {
      booking.return_code = generateCode()
    }

    if (status === 'returned' && rnd() < 0.68) {
      booking.review_rating = int(3, 5)
      booking.review_comment = pick(REVIEW_COMMENTS)
      booking.reviewed_at = returnedAt
    }

    if (status === 'approved' && rnd() < 0.18) {
      booking.return_reject_reason = '设备损坏请联系实验室人员进行赔偿'
      booking.reason = '设备损坏请联系实验室人员进行赔偿'
    }

    bookings.push(booking)
  })

  devices.forEach(device => {
    const borrowed = borrowedMap.get(device.id) || 0
    device.available_qty = Math.max(0, device.total_qty - borrowed)
  })

  bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // ---------- 在不增加记录总量的前提下，补齐学生端与管理端的展示样本 ----------
  const demoStudent = users.find(item => item.id === 2)

  // 1) 5 条已拒绝改为已取消，填充“已取消”分栏
  bookings
    .filter(item => item.status === 'rejected' && item.user_id !== demoStudent.id)
    .slice(0, 5)
    .forEach(item => {
      item.status = 'cancelled'
      item.reason = ''
      item.cancelled_at = item.created_at
    })

  // 2) 将部分申请改归演示学生，确保其“我的申请”覆盖全部状态
  const reassignToDemo = status => {
    const booking = bookings.find(
      item => item.status === status && item.user_id !== demoStudent.id
    )
    if (!booking) return null
    booking.user_id = demoStudent.id
    booking.user_name = demoStudent.name
    return booking
  }

  reassignToDemo('pending')
  reassignToDemo('returning')
  reassignToDemo('cancelled')
  reassignToDemo('rejected')
  reassignToDemo('approved')
  reassignToDemo('approved')
  reassignToDemo('approved')

  // 3) 为演示学生补充三种续借审核状态
  const demoApproved = bookings.filter(
    item => item.status === 'approved' && item.user_id === demoStudent.id
  )

  if (demoApproved[0]) {
    demoApproved[0].extension_status = 'pending'
    demoApproved[0].requested_end = dateStr(
      new Date(new Date(`${demoApproved[0].borrow_end}T00:00:00`).getTime() + 5 * DAY)
    )
    demoApproved[0].extension_reason = '实验进度延后，申请延长使用时间'
    demoApproved[0].extension_requested_at = isoAt(1, 10)
  }

  if (demoApproved[1]) {
    demoApproved[1].extension_status = 'approved'
    demoApproved[1].borrow_end = dateStr(
      new Date(new Date(`${demoApproved[1].borrow_end}T00:00:00`).getTime() + 5 * DAY)
    )
    demoApproved[1].requested_end = demoApproved[1].borrow_end
    demoApproved[1].extension_reason = '实验进度延后，申请延长使用时间'
    demoApproved[1].extension_reviewed_at = isoAt(2, 15)
  }

  if (demoApproved[2]) {
    demoApproved[2].extension_status = 'rejected'
    demoApproved[2].requested_end = dateStr(
      new Date(new Date(`${demoApproved[2].borrow_end}T00:00:00`).getTime() + 5 * DAY)
    )
    demoApproved[2].extension_reason = '项目延期，需要继续使用'
    demoApproved[2].extension_reject_reason = '该设备后续时段已约满，暂无法续借'
    demoApproved[2].extension_reviewed_at = isoAt(2, 16)
  }

  // 4) 另一位学生的续借申请，保证管理员续借审核至少两条
  const otherApproved = bookings.find(
    item => item.status === 'approved' && item.user_id !== demoStudent.id && !item.extension_status
  )
  if (otherApproved) {
    otherApproved.extension_status = 'pending'
    otherApproved.requested_end = dateStr(
      new Date(new Date(`${otherApproved.borrow_end}T00:00:00`).getTime() + 4 * DAY)
    )
    otherApproved.extension_reason = '课程实验尚未完成，申请顺延归还'
    otherApproved.extension_requested_at = isoAt(1, 14)
  }

  bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // 黑名单样本：让用户管理的“黑名单”筛选有真实数据
  const blacklistedStudent = users.find(item => item.account === '2023007')
  if (blacklistedStudent) {
    blacklistedStudent.blacklisted = true
    blacklistedStudent.blacklist_reason = '多次逾期未归还，暂停借用资格'
    blacklistedStudent.blacklisted_at = isoAt(6, 11)
  }

  // ---------- 维护工单 ----------
  const maintenancePlans = [
    [0, 1, '通道二基线漂移', '开机自检后通道二零点偏移约 8mV，已完成校准。', 'done', 26, 1],
    [17, 4, '散热风扇异响', '满载运行时风扇噪音明显，已更换风扇模组。', 'done', 19, 3],
    [27, 7, 'I2C 通信偶发失败', '部分模块上电后无法识别，疑似排线接触不良。', 'pending', 2, 0],
    [43, 10, '激光头功率衰减', '雕刻深度明显下降，等待厂家更换激光管。', 'processing', 5, 2],
    [51, 2, '称量重复性超差', '多次称量偏差超过 0.2mg，已完成内部校准。', 'done', 14, 4],
    [57, 12, '升降温速率异常', '梯度模块升温速度低于设定值，待检查加热片。', 'pending', 1, 0],
    [70, 6, '桨叶轻微变形', '运输后发现一支桨叶变形，经核查不影响使用。', 'rejected', 11, 0],
    [84, 15, '拉伸夹具松动', '夹具固定螺丝滑丝，已更换夹具并完成验证。', 'done', 8, 2]
  ]

  const maintenance = maintenancePlans.map(
    ([deviceIndex, userIndex, reason, detail, status, daysAgo, startOffset], index) => {
      const device = devices[deviceIndex]
      const student = students[userIndex % students.length]
      const created = isoAt(daysAgo, 10)
      const started = status === 'done' || status === 'processing' ? isoAt(daysAgo - startOffset, 14) : null
      const finished = status === 'done' ? isoAt(daysAgo - startOffset - 1, 16) : null

      if (status === 'processing') {
        device.maintenance_status = 'repairing'
        device.maintenance_reason = reason
        device.maintenance_started_at = started
      } else if (status === 'pending') {
        device.maintenance_status = 'pending'
        device.maintenance_reason = reason
      }

      return {
        id: index + 1,
        device_id: device.id,
        device_name: device.name,
        category: device.category,
        user_id: student.id,
        user_name: student.name,
        reason,
        detail,
        status,
        note:
          status === 'done'
            ? '维修完成，设备已通过功能复测'
            : status === 'rejected'
              ? '经核查为正常磨损，无需维修'
              : status === 'processing'
                ? '已安排厂家工程师处理'
                : '',
        handler_name: status === 'pending' ? '' : '李管理',
        created_at: created,
        started_at: started,
        finished_at: finished,
        handled_at: finished || started
      }
    }
  )

  // ---------- 通知 ----------
  const notifications = []
  let notificationId = 0
  const pushNotification = (userId, type, title, content, link, createdAt, read = false) => {
    notificationId += 1
    notifications.push({
      id: notificationId,
      user_id: userId,
      type,
      title,
      content,
      link: link || '',
      read: Boolean(read),
      created_at: createdAt,
      read_at: read ? createdAt : null
    })
  }

  students.forEach(student => {
    const mine = bookings
      .filter(item => item.user_id === student.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4)

    mine.forEach((booking, index) => {
      const at = new Date(new Date(booking.created_at).getTime() + (index + 1) * 3600000).toISOString()

      if (booking.status === 'pending') {
        pushNotification(
          student.id,
          'info',
          '借用申请已提交',
          `「${booking.device_name}」的申请正在等待管理员审核。`,
          '/applyRecord',
          at,
          index > 1
        )
      } else if (booking.status === 'approved' || booking.status === 'returning') {
        pushNotification(
          student.id,
          'success',
          '借用申请已通过',
          `「${booking.device_name}」已通过审核，取件码 ${booking.pickup_code || '—'}，请按时取件。`,
          '/applyRecord',
          at,
          index > 0
        )
      } else if (booking.status === 'returned') {
        pushNotification(
          student.id,
          'success',
          '设备归还完成',
          `「${booking.device_name}」已完成归还核验，欢迎对设备进行评价。`,
          '/applyRecord',
          at,
          true
        )
      } else if (booking.status === 'rejected') {
        pushNotification(
          student.id,
          'warn',
          '借用申请未通过',
          `「${booking.device_name}」未通过审核：${booking.reason || '不满足借用条件'}。`,
          '/applyRecord',
          at,
          index > 1
        )
      } else if (booking.status === 'cancelled') {
        pushNotification(
          student.id,
          'info',
          '借用申请已取消',
          `「${booking.device_name}」的申请已取消。`,
          '/applyRecord',
          at,
          true
        )
      }
    })

    const overdue = bookings.find(
      item => item.user_id === student.id && item.status === 'approved' && item.borrow_end < dateStr(Date.now())
    )
    if (overdue) {
      pushNotification(
        student.id,
        'warn',
        '设备即将逾期',
        `「${overdue.device_name}」应于 ${overdue.borrow_end} 前归还，请及时提交归还申请。`,
        '/applyRecord',
        isoAt(1, 9)
      )
    }

    const extensionSamples = bookings.filter(
      item => item.user_id === student.id && item.extension_status
    )
    extensionSamples.forEach(item => {
      if (item.extension_status === 'pending') {
        pushNotification(
          student.id,
          'info',
          '续借申请已提交',
          `「${item.device_name}」的续借申请正在等待管理员审核，目标归还日期 ${item.requested_end}。`,
          '/applyRecord',
          isoAt(1, 10)
        )
      } else if (item.extension_status === 'approved') {
        pushNotification(
          student.id,
          'success',
          '续借申请已通过',
          `「${item.device_name}」续借成功，归还日期已延至 ${item.borrow_end}。`,
          '/applyRecord',
          isoAt(2, 15),
          true
        )
      } else if (item.extension_status === 'rejected') {
        pushNotification(
          student.id,
          'warn',
          '续借申请未通过',
          `「${item.device_name}」续借未通过：${item.extension_reject_reason || '后续时段已约满'}。`,
          '/applyRecord',
          isoAt(2, 16),
          true
        )
      }
    })
  })

  pushNotification(users[0].id, 'notice', '待审核申请提醒', '当前有 11 条借用申请等待审核，请及时处理。', '/admin/apply', isoAt(0, 9))
  pushNotification(users[0].id, 'warn', '设备维护提醒', '激光雕刻机维护工单已处理中，相关借用已暂停。', '/admin/maintenance', isoAt(1, 15))
  pushNotification(users[0].id, 'system', '数据库结构升级', '平台已新增通知、审计、信用与场地等数据表。', '', isoAt(2, 10), true)

  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // ---------- 审计日志 ----------
  const auditLogs = []
  let auditId = 0
  const pushAudit = (actor, action, targetType, targetId, targetName, detail, createdAt, ip) => {
    auditId += 1
    auditLogs.push({
      id: auditId,
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      detail: detail || '',
      ip: ip || `10.12.${int(1, 20)}.${int(2, 240)}`,
      created_at: createdAt
    })
  }

  const auditSource = bookings
    .filter(item => ['approved', 'returning', 'returned', 'rejected'].includes(item.status))
    .slice(0, 55)

  auditSource.forEach(booking => {
    const approvedAt = booking.approved_at || booking.created_at
    if (booking.status === 'rejected') {
      pushAudit(users[0], 'booking.reject', 'booking', booking.id, `#${booking.id} ${booking.device_name}`, `拒绝：${booking.reason || '不满足条件'}`, booking.created_at)
      return
    }

    pushAudit(users[0], 'booking.approve', 'booking', booking.id, `#${booking.id} ${booking.device_name}`, `通过 ${booking.user_name} 的借用申请`, approvedAt)

    if (booking.extension_status === 'approved') {
      pushAudit(
        users[0],
        'extension.approve',
        'booking',
        booking.id,
        `#${booking.id} ${booking.device_name}`,
        `同意 ${booking.user_name} 的续借申请，归还日期延至 ${booking.borrow_end}`,
        booking.extension_reviewed_at || approvedAt
      )
    } else if (booking.extension_status === 'rejected') {
      pushAudit(
        users[0],
        'extension.reject',
        'booking',
        booking.id,
        `#${booking.id} ${booking.device_name}`,
        `驳回续借：${booking.extension_reject_reason || '后续时段已约满'}`,
        booking.extension_reviewed_at || approvedAt
      )
    }

    if (booking.status === 'returned') {
      pushAudit(users[0], 'return.approve', 'booking', booking.id, `#${booking.id} ${booking.device_name}`, '归还核验通过，库存已回补', booking.returned_at || approvedAt)
    }
  })

  pushAudit(
    users[0],
    'return.reject',
    'booking',
    auditSource[0]?.id || 1,
    `#${auditSource[0]?.id || 1} ${auditSource[0]?.device_name || '设备'}`,
    '归还核验未通过：设备外观存在明显磕碰，需进一步确认',
    isoAt(2, 16)
  )

  pushAudit(users[0], 'device.create', 'device', devices[0].id, devices[0].name, '上架设备并初始化库存与位置', isoAt(14, 10))
  pushAudit(users[0], 'device.update', 'device', devices[1].id, devices[1].name, '更新设备描述、库存与存放实验室', isoAt(9, 14))
  pushAudit(users[0], 'device.offline', 'device', devices[2].id, devices[2].name, '设备停用并下架，停止接受新申请', isoAt(21, 11))

  maintenance.slice(0, 4).forEach(item => {
    const action =
      item.status === 'processing'
        ? 'maintenance.start'
        : item.status === 'done'
          ? 'maintenance.finish'
          : item.status === 'rejected'
            ? 'maintenance.reject'
            : ''

    if (!action) return

    pushAudit(
      users[0],
      action,
      'maintenance',
      item.id,
      item.device_name,
      item.note || item.reason,
      item.handled_at || item.created_at
    )
  })

  const rejectedMaintenance = maintenance.find(item => item.status === 'rejected')
  if (rejectedMaintenance) {
    pushAudit(
      users[0],
      'maintenance.reject',
      'maintenance',
      rejectedMaintenance.id,
      rejectedMaintenance.device_name,
      rejectedMaintenance.note || '经核查无需维修',
      rejectedMaintenance.handled_at || rejectedMaintenance.created_at
    )
  }

  auditLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // ---------- 收藏 ----------
  const favorites = []
  let favoriteId = 0
  students.forEach((student, index) => {
    const picked = new Set()
    const count = 3 + (index % 4)
    while (picked.size < count) picked.add(int(1, devices.length))
    picked.forEach(deviceId => {
      const device = devices[deviceId - 1]
      favoriteId += 1
      favorites.push({
        id: favoriteId,
        user_id: student.id,
        device_id: device.id,
        device_name: device.name,
        created_at: isoAt(int(1, 60), int(9, 21))
      })
    })
  })

  // ---------- 公告 ----------
  const announcements = [
    ['实验室安全检查通知', '本周五 14:00 开展实验室安全专项检查，请各实验室提前整理台面与危化品台账。', 'important', 1],
    ['激光雕刻机暂停借用', '激光雕刻机因激光管功率衰减正在维修，恢复时间另行通知。', 'warning', 3],
    ['新增 Jetson Orin Nano 开发套件', 'B202 嵌入式实验室新增 6 套 Jetson Orin Nano，可预约用于边缘 AI 实验。', 'info', 6],
    ['国庆假期开放时间调整', '假期期间实验室开放时间调整为 09:00 - 17:00，请提前安排实验。', 'info', 12],
    ['设备借用规则更新', '单次借用最长 90 天，逾期将扣减信用分并暂停新的借用申请。', 'warning', 18],
    ['生物安全培训报名', '使用生物安全柜与 PCR 仪前需完成线上安全培训，本月培训开放报名。', 'info', 21],
    ['无人机飞行报备提醒', '校内飞行需提前 24 小时在平台提交航线与飞行时间，未报备不得起飞。', 'warning', 25],
    ['平台维护完成公告', '设备借用、续借、归还与评价流程已完成升级，历史数据不受影响。', 'info', 30]
  ].map(([title, content, level, daysAgo], index) => ({
    id: index + 1,
    title,
    content,
    level,
    author: '实验室管理中心',
    is_active: 1,
    published_at: isoAt(daysAgo, 9)
  }))

  // ---------- 信用流水 ----------
  const creditLogs = []
  let creditId = 0
  students.forEach(student => {
    let balance = 100
    const mine = bookings
      .filter(item => item.user_id === student.id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    mine.forEach(booking => {
      let change = 0
      let reason = ''

      if (booking.status === 'returned') {
        change = booking.review_rating ? 2 : 1
        reason = booking.review_rating ? '按时归还并完成评价' : '按时归还设备'
      } else if (booking.status === 'rejected') {
        change = -1
        reason = '借用申请被拒绝'
      } else if (booking.status === 'approved' && booking.borrow_end < dateStr(Date.now())) {
        change = -5
        reason = '设备逾期未归还'
      }

      if (!change) return
      balance = Math.max(0, balance + change)
      creditId += 1
      creditLogs.push({
        id: creditId,
        user_id: student.id,
        change,
        balance,
        reason,
        ref_type: 'booking',
        ref_id: booking.id,
        created_at: booking.returned_at || booking.approved_at || booking.created_at
      })
    })

    student.credit_score = balance
  })
  creditLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // ---------- 登录日志 ----------
  const loginLogs = []
  let loginId = 0
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) Chrome/154.0.0.0'
  ]

  users.forEach((user, index) => {
    const count = index === 0 ? 8 : 4
    for (let i = 0; i < count; i += 1) {
      loginId += 1
      const success = !(i === 3 && index % 7 === 0)
      loginLogs.push({
        id: loginId,
        user_id: user.id,
        account: user.account,
        name: user.name,
        ip: `10.12.${int(1, 20)}.${int(2, 240)}`,
        user_agent: agents[int(0, agents.length - 1)],
        success: success ? 1 : 0,
        created_at: isoAt(int(0, 45), int(7, 23))
      })
    }
  })
  loginLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // ---------- 系统设置 ----------
  const settings = [
    ['max_borrow_days', '90', '单次借用最长天数'],
    ['max_active_bookings', '3', '单个学生同时进行中的申请上限'],
    ['overdue_penalty', '-5', '逾期一天扣减的信用分'],
    ['allow_self_cancel', '1', '允许学生在待审核状态自行取消'],
    ['maintenance_block_booking', '1', '维护中设备禁止提交借用'],
    ['ai_review_enabled', '1', '启用 AI 审批建议'],
    ['notification_email', '1', '启用业务邮件通知'],
    ['max_renew_days', '30', '单次续借最长天数'],
    ['booking_advance_days', '30', '可提前预约的最大天数'],
    ['auto_overdue_reminder', '1', '到期前自动发送逾期提醒']
  ].map(([key, value, label], index) => ({
    id: index + 1,
    key,
    value,
    label,
    updated_by: '李管理',
    updated_at: isoAt(int(1, 20), 10)
  }))

  return {
    users,
    departments,
    labs,
    categories,
    devices,
    bookings,
    maintenance,
    notifications,
    audit_logs: auditLogs,
    favorites,
    announcements,
    credit_logs: creditLogs,
    login_logs: loginLogs,
    settings,
    push_subscriptions: [],
    codes: [],
    seq: {
      users: users.length,
      departments: departments.length,
      labs: labs.length,
      categories: categories.length,
      devices: devices.length,
      bookings: bookings.length,
      maintenance: maintenance.length,
      notifications: notifications.length,
      audit_logs: auditLogs.length,
      favorites: favorites.length,
      announcements: announcements.length,
      credit_logs: creditLogs.length,
      login_logs: loginLogs.length,
      settings: settings.length,
      push_subscriptions: 0
    },
    meta: {
      schemaVersion: 6,
      seeded_at: nowISO()
    }
  }
}

export function initDB({ force = false } = {}) {
  if (fs.existsSync(DB_FILE) && !force) {
    resetCache()
    return false
  }

  setDB(buildSeedData())
  return true
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const created = initDB({ force: process.argv.includes('--force') })
  console.log(created ? '演示数据已重新生成' : '数据库已存在，使用 --force 可覆盖')
}
