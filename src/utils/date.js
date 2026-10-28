function parseDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 2026/10/23 */
export function formatDate(value, fallback = '-') {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('zh-CN') : fallback
}

/** 10/23 */
export function formatShortDate(value, fallback = '-') {
  const date = parseDate(value)
  return date
    ? date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    : fallback
}

/** 10/23 14:05 */
export function formatDateTime(value, fallback = '-') {
  const date = parseDate(value)
  return date
    ? date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : fallback
}

/** 2026-10-23（用于接口与表单日期） */
export function formatDateKey(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 刚刚 / 3 分钟前 / 2 小时前 / 5 天前 / 2026/10/23 */
export function formatRelativeTime(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback

  const diff = Date.now() - date.getTime()
  if (diff < 0) return formatDate(date, fallback)

  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`

  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`

  const day = Math.floor(hour / 24)
  if (day < 7) return `${day} 天前`

  return formatDate(date, fallback)
}
