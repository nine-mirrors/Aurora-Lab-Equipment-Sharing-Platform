import request from '@/utils/request'

export const getAiStatus = () => {
  return request({
    url: '/api/ai/status',
    method: 'get'
  })
}

export const sendAiMessage = (data) => {
  return request({
    url: '/api/ai/chat',
    method: 'post',
    data,
    timeout: 45000
  })
}

// 管理员审批建议（仅建议，不自动通过）
export const getReviewSuggestion = (bookingId, provider = 'qwen') => {
  return request({
    url: '/api/ai/review',
    method: 'post',
    data: { booking_id: bookingId, provider },
    timeout: 45000
  })
}
