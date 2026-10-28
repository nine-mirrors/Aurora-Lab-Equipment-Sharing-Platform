/**
 * 设备展示相关的纯函数，供设备卡片、详情抽屉与设备大厅共用。
 */

export function categoryInitial(name = '') {
  return name.slice(0, 1) || '设'
}

export function stockPercent(device) {
  const totalQty = Number(device?.total_qty) || 1
  return Math.round((Number(device?.available_qty) / totalQty) * 100)
}

export function isRepairing(device) {
  return device?.maintenance_status === 'repairing'
}

export function devicePillStatus(device) {
  if (device?.maintenance_status === 'repairing') return 'maintenance'
  if (device?.maintenance_status === 'pending') return 'repair-pending'
  return Number(device?.available_qty) ? 'available' : 'empty'
}

export function canApply(device, { blacklisted = false, activeStatus = null } = {}) {
  if (blacklisted) return false
  if (isRepairing(device)) return false
  if (!Number(device?.available_qty)) return false
  return !activeStatus
}

export function actionText(device, { blacklisted = false, activeStatus = null } = {}) {
  if (blacklisted) return '账号受限'
  if (isRepairing(device)) return '维护中'
  if (activeStatus?.status === 'pending') return '审核中'
  if (activeStatus?.status === 'approved') return '使用中'
  if (activeStatus?.status === 'returning') return '归还中'
  if (!Number(device?.available_qty)) return '已借完'
  return '申请借用'
}
