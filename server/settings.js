/**
 * 系统设置读取工具。
 * 设置存储于 db.settings（key / value / label），未配置或非法时回落到默认值。
 */

export function getSetting(db, key, fallback = '') {
  const row = (db.settings || []).find(item => item.key === key)
  return row === undefined ? fallback : row.value
}

export function getNumberSetting(db, key, fallback) {
  const value = Number(getSetting(db, key, fallback))
  return Number.isFinite(value) && value !== 0 ? value : fallback
}

export function getBoolSetting(db, key, fallback = true) {
  const value = String(getSetting(db, key, fallback ? '1' : '0')).trim().toLowerCase()
  return value === '1' || value === 'true'
}
