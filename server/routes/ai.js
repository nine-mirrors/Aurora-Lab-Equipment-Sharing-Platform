import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { chat, getAiStatus, reviewBooking } from '../ai.js'
import { getDB } from '../db.js'
import { getBoolSetting } from '../settings.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

router.get('/ai/status', requireAuth(), (req, res) => {
  ok(res, getAiStatus())
})

router.post('/ai/chat', requireAuth(), async (req, res, next) => {
  try {
    const { messages, provider } = req.body || {}

    if (!Array.isArray(messages) || !messages.length) {
      return fail(res, '消息内容不能为空')
    }

    const latest = messages[messages.length - 1]
    if (!latest || String(latest.content || '').trim().length === 0) {
      return fail(res, '请输入问题内容')
    }

    const data = await chat({
      messages,
      provider: provider === 'deepseek' ? 'deepseek' : 'qwen',
      user: req.user
    })

    ok(res, data)
  } catch (error) {
    next(error)
  }
})

router.post('/ai/review', requireAuth(['admin']), async (req, res) => {
  try {
    if (!getBoolSetting(getDB(), 'ai_review_enabled', true)) {
      return fail(res, '管理员已关闭 AI 审批建议', 403)
    }

    const { booking_id, provider } = req.body || {}
    if (!booking_id) return fail(res, '缺少申请编号')

    const data = await reviewBooking({
      bookingId: booking_id,
      provider: provider === 'deepseek' ? 'deepseek' : 'qwen'
    })

    ok(res, data)
  } catch (error) {
    fail(res, error.message || '审批建议生成失败')
  }
})

export default router
