import { getDB, saveDB } from './db.js'
import { notify } from './notify.js'
import { getBoolSetting } from './settings.js'

const DAY_MS = 86400000

function pad(num) {
  return String(num).padStart(2, '0')
}

function dateKey(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * DAY_MS)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 到期前一天发送站内提醒；通过通知内容中的「申请 #id」标记去重，
 * 不新增数据库字段，重复调用不会重复提醒。
 */
export function sendDueReminders(db = getDB()) {
  if (!getBoolSetting(db, 'auto_overdue_reminder', true)) return 0

  const tomorrow = dateKey(1)
  let sent = 0

  ;(db.bookings || []).forEach(booking => {
    if (booking.status !== 'approved') return
    if (booking.borrow_end !== tomorrow) return

    const marker = `申请 #${booking.id}`
    const exists = (db.notifications || []).some(
      item =>
        item.user_id === booking.user_id &&
        item.title === '设备即将到期' &&
        String(item.content || '').includes(marker)
    )
    if (exists) return

    notify(booking.user_id, {
      type: 'warn',
      title: '设备即将到期',
      content: `「${booking.device_name}」将于 ${booking.borrow_end} 到期（${marker}），请按时归还或提交续借。`,
      link: '/applyRecord'
    })
    sent += 1
  })

  if (sent) saveDB()
  return sent
}
