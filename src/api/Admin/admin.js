// 管理员申请管理和获取用户列表
import request from '@/utils/request'

// 获取待审核申请列表
export const getPendingBookings = (params) => {
  return request({
    url: '/api/admin/bookings/pending',
    method: 'get',
    params
  })
}

// 审核借用申请（通过/拒绝）
export const auditBooking = (id, data) => {
  return request({
    url: `/api/admin/bookings/${id}/audit`,
    method: 'patch',
    data
  })
}

// 获取归还中列表
export const getReturningBookings = (params) => {
  return request({
    url: '/api/admin/bookings/returning',
    method: 'get',
    params
  })
}

// 获取未归还列表
export const getUnreturnedBookings = (params) => {
  return request({
    url: '/api/admin/bookings/unreturned',
    method: 'get',
    params
  })
}

// 获取已归还列表
export const getReturnedBookings = (params) => {
  return request({
    url: '/api/admin/bookings/returned',
    method: 'get',
    params
  })
}

// 获取已拒绝列表
export const getRejectedBookings = (params) => {
  return request({
    url: '/api/admin/bookings/rejected',
    method: 'get',
    params
  })
}

// 获取已取消列表
export const getCancelledBookings = (params) => {
  return request({
    url: '/api/admin/bookings/cancelled',
    method: 'get',
    params
  })
}

// 获取待审核续借列表
export const getExtensionPendingBookings = (params) => {
  return request({
    url: '/api/admin/bookings/extension-pending',
    method: 'get',
    params
  })
}

// 续借审核
export const auditExtension = (id, data) => {
  return request({
    url: `/api/admin/bookings/${id}/extension`,
    method: 'patch',
    data
  })
}

// 获取归还被拒绝列表
export const getReturnRejectedBookings = (params) => {
  return request({
    url: '/api/admin/bookings/return-rejected',
    method: 'get',
    params
  })
}

// 归还审核
export const returnAuditBooking = (id, data) => {
  return request({
    url: `/api/admin/bookings/${id}/return-audit`,
    method: 'patch',
    data
  })
}

// 获取用户列表
export const getUserList = (params) => {
  return request({
    url: '/api/admin/users',
    method: 'get',
    params
  })
}

// 用户统计（全量口径，不受分页影响）
export const getUserStats = () => {
  return request({
    url: '/api/admin/users/stats',
    method: 'get'
  })
}

// 加入 / 解除黑名单
export const blacklistUser = (id, data) => {
  return request({
    url: `/api/admin/users/${id}/blacklist`,
    method: 'patch',
    data
  })
}

// 删除用户
export const deleteUserByAdmin = (id) => {
  return request({
    url: `/api/admin/users/${id}`,
    method: 'delete'
  })
}

// 维护中心列表（含统计与维修中设备）
export const getMaintenanceList = (params) => {
  return request({
    url: '/api/admin/maintenance',
    method: 'get',
    params
  })
}

// 处理报修：start / finish / reject
export const auditMaintenance = (id, data) => {
  return request({
    url: `/api/admin/maintenance/${id}`,
    method: 'patch',
    data
  })
}

// 管理员直接开始 / 结束设备维护
export const setDeviceMaintenance = (id, data) => {
  return request({
    url: `/api/admin/devices/${id}/maintenance`,
    method: 'patch',
    data
  })
}
