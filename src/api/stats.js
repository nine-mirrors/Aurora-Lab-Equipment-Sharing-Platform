import request from '@/utils/request'

// 平台概览指标
export const getOverview = () => {
  return request({
    url: '/api/stats/overview',
    method: 'get'
  })
}

// 借用趋势
export const getTrend = (days = 30) => {
  return request({
    url: '/api/stats/trend',
    method: 'get',
    params: { days }
  })
}

// 分类分布
export const getCategoryStats = () => {
  return request({
    url: '/api/stats/categories',
    method: 'get'
  })
}

// 设备利用率
export const getUtilization = () => {
  return request({
    url: '/api/stats/utilization',
    method: 'get'
  })
}

// 最近申请
export const getRecentBookings = (limit = 8) => {
  return request({
    url: '/api/stats/recent',
    method: 'get',
    params: { limit }
  })
}

// 设备使用率热力图（管理端）
export const getUsageHeatmap = (weeks = 12) => {
  return request({
    url: '/api/admin/usage-heatmap',
    method: 'get',
    params: { weeks }
  })
}
