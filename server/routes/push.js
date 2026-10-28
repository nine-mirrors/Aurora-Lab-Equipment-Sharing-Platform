import { Router } from 'express'
import { requireAuth } from '../auth.js'
import {
  getPublicKey,
  isPushConfigured,
  pushToUser,
  removeSubscription,
  saveSubscription,
  subscriptionCount
} from '../push.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

router.get('/push/public-key', requireAuth(), (req, res) => {
  ok(res, {
    publicKey: getPublicKey(),
    configured: isPushConfigured(),
    subscriptions: subscriptionCount(req.user.id)
  })
})

router.post('/push/subscribe', requireAuth(), (req, res) => {
  try {
    const record = saveSubscription(
      req.user.id,
      req.body?.subscription,
      req.headers['user-agent']
    )
    ok(res, { id: record.id }, '浏览器通知已开启')
  } catch (error) {
    fail(res, error.message || '订阅失败')
  }
})

router.post('/push/unsubscribe', requireAuth(), (req, res) => {
  const endpoint = String(req.body?.endpoint || '')
  if (!endpoint) return fail(res, '缺少订阅地址')
  removeSubscription(req.user.id, endpoint)
  ok(res, null, '浏览器通知已关闭')
})

router.post('/push/test', requireAuth(), async (req, res) => {
  if (!isPushConfigured()) return fail(res, 'Web Push 未配置')
  const result = await pushToUser(req.user.id, {
    title: '极光实验室 · 测试通知',
    content: '如果你看到这条消息，说明浏览器推送已经接通。',
    link: '/homePage',
    tag: `test-${Date.now()}`
  })
  ok(res, result, result.sent ? '测试通知已发送' : '当前浏览器还没有有效订阅')
})

export default router
