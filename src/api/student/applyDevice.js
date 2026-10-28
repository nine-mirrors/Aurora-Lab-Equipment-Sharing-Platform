import request from '@/utils/request'

// 提交借用申请
export const applyBooking = (data) => {
  return request({
    url: '/api/bookings',
    method: 'post',
    data
  })
}

// 获取某个设备的借用记录/详情（用于读取拒绝原因）
export const getBookingDetail = (id) => {
  return request({
    url: `/api/bookings/${id}`,
    method: 'get'
  })
}
