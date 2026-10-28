import request from '@/utils/request'

export const getNotifications = (params) => {
  return request({
    url: '/api/notifications',
    method: 'get',
    params
  })
}

export const markNotificationRead = (id) => {
  return request({
    url: `/api/notifications/${id}/read`,
    method: 'patch'
  })
}

export const markAllNotificationsRead = () => {
  return request({
    url: '/api/notifications/read-all',
    method: 'patch'
  })
}

export const getAnnouncements = () => {
  return request({
    url: '/api/announcements',
    method: 'get'
  })
}

export const getCreditLogs = () => {
  return request({
    url: '/api/me/credit-logs',
    method: 'get'
  })
}

export const getAuditLogs = (params) => {
  return request({
    url: '/api/admin/audit-logs',
    method: 'get',
    params
  })
}

export const getDatabaseStats = () => {
  return request({
    url: '/api/admin/database',
    method: 'get'
  })
}
