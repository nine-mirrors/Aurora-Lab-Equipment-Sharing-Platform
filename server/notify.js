import { getDB, nextId } from './db.js'
import { pushToUser } from './push.js'
import { sendNotificationEmail } from './mailer.js'
import { getBoolSetting } from './settings.js'
import { logBusiness } from './logger.js'

// 新增站内通知（不落盘，调用方统一 saveDB）
export function notify(userId, { type = 'info', title, content, link = '' }) {
  const db = getDB()
  if (!Array.isArray(db.notifications)) db.notifications = []

  const record = {
    id: nextId('notifications'),
    user_id: Number(userId),
    type,
    title,
    content,
    link,
    read: false,
    created_at: new Date().toISOString(),
    read_at: null
  }

  db.notifications.push(record)
  pushToUser(userId, record).catch(() => {})

  if (getBoolSetting(db, 'notification_email', true)) {
    const user = (db.users || []).find(item => item.id === Number(userId))
    if (user?.email) {
      sendNotificationEmail({
        to: user.email,
        title,
        content,
        link
      }).catch(() => {})
    }
  }

  return record
}

// 写入管理员操作审计日志（不落盘，调用方统一 saveDB）
export function audit(req, { action, targetType, targetId, targetName, detail = '' }) {
  const db = getDB()
  if (!Array.isArray(db.audit_logs)) db.audit_logs = []

  const actor = req?.user || {}
  const record = {
    id: nextId('audit_logs'),
    actor_id: actor.id || null,
    actor_name: actor.name || '系统',
    actor_role: actor.role || 'system',
    action,
    target_type: targetType || '',
    target_id: targetId ?? null,
    target_name: targetName || '',
    detail,
    ip: String(req?.headers?.['x-forwarded-for'] || req?.ip || '').split(',')[0] || '',
    created_at: new Date().toISOString()
  }

  db.audit_logs.push(record)
  logBusiness('admin.action', {
    actor: record.actor_name,
    role: record.actor_role,
    action: record.action,
    targetType: record.target_type,
    targetId: record.target_id,
    targetName: record.target_name
  })
  return record
}
