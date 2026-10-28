import request from '@/utils/request'

// 设备列表（分页 + 搜索）
export const getDeviceList = (params) => {
  return request({
    url: '/api/devices',
    method: 'get',
    params
  })
}

export const getDeviceDetail = (id) => {
  return request({
    url: `/api/devices/${id}`,
    method: 'get'
  })
}

// 某设备指定月份的可用日历
export const getDeviceAvailability = (id, month) => {
  return request({
    url: `/api/devices/${id}/availability`,
    method: 'get',
    params: { month }
  })
}

// 某设备的用户评价
export const getDeviceReviews = (id) => {
  return request({
    url: `/api/devices/${id}/reviews`,
    method: 'get'
  })
}

// 提交设备报修
export const reportDevice = (id, data) => {
  return request({
    url: `/api/devices/${id}/report`,
    method: 'post',
    data
  })
}
