// 管理端基础数据：公告 / 院系 / 实验室
import request from '@/utils/request'

// 公告
export const getAnnouncementList = () => request({ url: '/api/admin/announcements', method: 'get' })
export const createAnnouncement = data => request({ url: '/api/admin/announcements', method: 'post', data })
export const updateAnnouncement = (id, data) =>
  request({ url: `/api/admin/announcements/${id}`, method: 'put', data })
export const deleteAnnouncement = id =>
  request({ url: `/api/admin/announcements/${id}`, method: 'delete' })

// 院系
export const getDepartmentList = () => request({ url: '/api/admin/departments', method: 'get' })
export const createDepartment = data => request({ url: '/api/admin/departments', method: 'post', data })
export const updateDepartment = (id, data) =>
  request({ url: `/api/admin/departments/${id}`, method: 'put', data })
export const deleteDepartment = id =>
  request({ url: `/api/admin/departments/${id}`, method: 'delete' })

// 实验室
export const getLabList = () => request({ url: '/api/admin/labs', method: 'get' })
export const createLab = data => request({ url: '/api/admin/labs', method: 'post', data })
export const updateLab = (id, data) => request({ url: `/api/admin/labs/${id}`, method: 'put', data })
export const deleteLab = id => request({ url: `/api/admin/labs/${id}`, method: 'delete' })

// 系统设置
export const getSettingList = () => request({ url: '/api/admin/settings', method: 'get' })
export const updateSetting = (key, value) =>
  request({ url: `/api/admin/settings/${key}`, method: 'put', data: { value } })
