import request from '@/utils/request'

export const getPushConfig = () => {
  return request({
    url: '/api/push/public-key',
    method: 'get'
  })
}

export const subscribePush = (subscription) => {
  return request({
    url: '/api/push/subscribe',
    method: 'post',
    data: { subscription }
  })
}

export const unsubscribePush = (endpoint) => {
  return request({
    url: '/api/push/unsubscribe',
    method: 'post',
    data: { endpoint }
  })
}

export const sendTestPush = () => {
  return request({
    url: '/api/push/test',
    method: 'post'
  })
}
