import request from '@/utils/request'

// 获取分类列表（学生/管理员都可看）
export const getEnabledCategoryList = () => {
  return request({
    url: '/api/categories',
    method: 'get'
  })
}

// 获取启用的分类列表
export const getActiveCategories = () => {
  return request({
    url: '/api/categories',
    method: 'get',
    params: { is_active: true }
  })
}

// 分类详情
export const getCategoryDetail = (id) => {
  return request({
    url: `/api/categories/${id}`,
    method: 'get'
  })
}

// 创建分类（管理员）
export const createCategory = (data) => {
  return request({
    url: '/api/admin/categories',
    method: 'post',
    data
  })
}

// 更新分类（管理员）
export const updateCategory = (id, data) => {
  return request({
    url: `/api/admin/categories/${id}`,
    method: 'put',
    data
  })
}

// 删除分类（管理员）
export const deleteCategory = (id) => {
  return request({
    url: `/api/admin/categories/${id}`,
    method: 'delete'
  })
}