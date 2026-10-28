import request from '@/utils/request'

// 登录
export const login = (data) => {
  return request({
    url: '/api/auth/login',
    method: 'POST',
    data
  })
}

// 注册
export const register = (data) => {
  return request({
    url: '/api/auth/register',
    method: 'POST',
    data
  })
}

// 发送邮箱验证码（注册）
export const sendEmailCode = (email) => {
  return request({
    url: '/api/auth/send-email-code',
    method: 'POST',
    data: { email, type: 'register' }
  })
}

// 发送邮箱验证码（找回密码）
export const sendResetEmailCode = (email) => {
  return request({
    url: '/api/auth/send-email-code',
    method: 'POST',
    data: { email, type: 'reset_password' }
  })
}

// 重置密码
export const resetPassword = (data) => {
  return request({
    url: '/api/auth/forget-password',
    method: 'POST',
    data
  })
}

// 获取当前登录用户（包含黑名单等最新状态）
export const getMe = () => {
  return request({
    url: '/api/auth/me',
    method: 'GET'
  })
}

// 更新用户信息
export const updateUserInfo = (data) => {
  return request({
    url: '/api/auth/profile',
    method: 'PUT',
    data
  })
}

// 修改密码（登录状态下使用原密码校验）
export const changePassword = (data) => {
  return request({
    url: '/api/auth/password',
    method: 'POST',
    data
  })
}

// 注销账号（登录状态下使用密码校验）
export const deleteAccountSimple = (password) => {
  return request({
    url: '/api/account',
    method: 'DELETE',
    data: { password }
  })
}
