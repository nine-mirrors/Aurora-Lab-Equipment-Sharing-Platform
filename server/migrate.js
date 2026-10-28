import { getDB, saveDB } from './db.js'

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function dayKey(date) {
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 轻量数据迁移：为旧数据补齐借用全流程所需字段。
 * 不删除、不覆盖任何既有记录。
 */
export function migrateDB() {
  const db = getDB()
  let changed = false

  db.meta = db.meta || {}

  db.bookings.forEach(booking => {
    if (booking.extension_status === undefined) {
      booking.extension_status = ''
      changed = true
    }

    if (
      ['approved', 'returning', 'returned'].includes(booking.status) &&
      !booking.pickup_code
    ) {
      booking.pickup_code = makeCode()
      changed = true
    }

    if (booking.status === 'returning' && !booking.return_code) {
      booking.return_code = makeCode()
      changed = true
    }

    if (booking.review_rating === undefined) {
      booking.review_rating = null
      changed = true
    }
  })

  if (db.meta.schemaVersion !== 2) {
    db.meta.schemaVersion = 2
    db.meta.migrated_at = new Date().toISOString()
    changed = true
  }

  db.users.forEach(user => {
    if (user.blacklisted === undefined) {
      user.blacklisted = false
      changed = true
    }
    if (user.blacklist_reason === undefined) {
      user.blacklist_reason = ''
      changed = true
    }
    if (user.blacklisted_at === undefined) {
      user.blacklisted_at = null
      changed = true
    }
  })

  if (db.meta.schemaVersion !== 3) {
    db.meta.schemaVersion = 3
    db.meta.updated_at = new Date().toISOString()
    changed = true
  }

  if (!Array.isArray(db.maintenance)) {
    db.maintenance = []
    changed = true
  }

  db.devices.forEach(device => {
    if (device.maintenance_status === undefined) {
      device.maintenance_status = 'none'
      changed = true
    }
    if (device.maintenance_reason === undefined) {
      device.maintenance_reason = ''
      changed = true
    }
    if (device.maintenance_started_at === undefined) {
      device.maintenance_started_at = null
      changed = true
    }
  })

  if (db.meta.schemaVersion !== 4) {
    db.meta.schemaVersion = 4
    db.meta.updated_at = new Date().toISOString()
    changed = true
  }

  const collections = [
    'departments',
    'labs',
    'notifications',
    'audit_logs',
    'favorites',
    'announcements',
    'credit_logs',
    'login_logs',
    'settings',
    'push_subscriptions'
  ]

  collections.forEach(key => {
    if (!Array.isArray(db[key])) {
      db[key] = []
      changed = true
    }
    if (!db.seq?.[key]) {
      db.seq = db.seq || {}
      db.seq[key] = db[key].length
      changed = true
    }
  })

  db.users.forEach(user => {
    if (user.credit_score === undefined) {
      user.credit_score = 100
      changed = true
    }
    if (user.token_version === undefined) {
      user.token_version = 0
      changed = true
    }
  })

  // 历史逾期记录默认视为已按旧规则扣过分，避免升级后二次扣分
  const today = dayKey(new Date())
  db.bookings.forEach(booking => {
    if (booking.overdue_charged_days !== undefined) return
    const overdue =
      ['approved', 'returning'].includes(booking.status) &&
      booking.borrow_end &&
      booking.borrow_end < today
    booking.overdue_charged_days = overdue
      ? Math.max(
          0,
          Math.round(
            (new Date(`${today}T00:00:00`) - new Date(`${booking.borrow_end}T00:00:00`)) /
              86400000
          )
        )
      : 0
    changed = true
  })

  db.devices.forEach(device => {
    if (device.lab_id === undefined) {
      device.lab_id = null
      changed = true
    }
    if (device.image === undefined) {
      device.image = ''
      changed = true
    }
  })

  if (db.meta.schemaVersion !== 5) {
    db.meta.schemaVersion = 5
    db.meta.updated_at = new Date().toISOString()
    changed = true
  }

  if (db.meta.schemaVersion !== 6) {
    db.meta.schemaVersion = 6
    db.meta.updated_at = new Date().toISOString()
    changed = true
  }

  if (changed) saveDB()
}
