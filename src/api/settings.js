import request from '@/utils/request'

export const getPublicSettings = () => request({ url: '/api/settings/public', method: 'get' })
