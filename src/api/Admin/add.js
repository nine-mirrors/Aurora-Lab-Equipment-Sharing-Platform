
// 设备管理
import request from '@/utils/request'

// 获取列表
export const getDeviceList = (params) => {
  return request({
    url: '/api/devices',
    method: 'get',
    params
  })
}

// 新增设备

export const createDevice = (data) => {
  return request({
    url: '/api/admin/devices',
    method: 'post',
    data
  })
}

// 编辑设备
export const updateDevice = (id, data) => {
  return request({
    url: `/api/admin/devices/${id}`,
    method: 'put',
    data
  })
}

// 下架设备（支持用 id 或 name 作为参数）
export const offDevice = (id) => {
  return request({
    url: `/api/admin/devices/${id}`,
    method: 'delete'
  })
}