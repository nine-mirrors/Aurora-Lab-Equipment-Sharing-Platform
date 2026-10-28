// 轻量内存限流：无需 Redis，适合单实例部署
const buckets = new Map()

let sweeping = false
function sweep(now) {
  if (sweeping) return
  sweeping = true
  for (const [key, item] of buckets) {
    if (item.resetAt <= now) buckets.delete(key)
  }
  sweeping = false
}

export function rateLimit({ windowMs = 60000, max = 30, message = '操作过于频繁，请稍后再试' } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const ip = String(req.ip || 'unknown')
    const key = `${req.method}:${req.baseUrl}${req.path}:${ip}`

    let item = buckets.get(key)
    if (!item || item.resetAt <= now) {
      item = { count: 0, resetAt: now + windowMs }
      buckets.set(key, item)
    }

    item.count += 1
    if (item.count > max) {
      res.setHeader('Retry-After', Math.ceil((item.resetAt - now) / 1000))
      return res.status(429).json({ code: 429, message, data: null })
    }

    if (Math.random() < 0.01) sweep(now)
    next()
  }
}
