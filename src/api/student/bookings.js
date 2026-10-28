import request from '@/utils/request'

// 获取当前用户的借用记录（可传 params）
export const getMyBookings = (params) => {
  return request({
    url: '/api/bookings/my',
    method: 'get',
    params
  })
}

// 提交归还申请
export const returnBooking = (id, data) => {
  return request({
    url: `/api/bookings/${id}/return`,
    method: 'patch',
    data
  })
}

// 取消待审核申请
export const cancelBooking = (id) => {
  return request({
    url: `/api/bookings/${id}/cancel`,
    method: 'patch'
  })
}

// 申请续借
export const extendBooking = (id, data) => {
  return request({
    url: `/api/bookings/${id}/extend`,
    method: 'patch',
    data
  })
}

// 确认取件（校验取件码）
export const confirmPickup = (id, code) => {
  return request({
    url: `/api/bookings/${id}/pickup`,
    method: 'patch',
    data: { code }
  })
}

// 评价设备
export const reviewBooking = (id, data) => {
  return request({
    url: `/api/bookings/${id}/review`,
    method: 'post',
    data
  })
}
