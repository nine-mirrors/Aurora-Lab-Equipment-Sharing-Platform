import crypto from 'node:crypto'
import { getDB } from './db.js'

// 未配置时使用进程级随机密钥，避免源码中的默认密钥被用来伪造 Token
const SECRET = String(process.env.LAB_SECRET || '').trim() || crypto.randomBytes(32).toString('hex')
const TOKEN_TTL = 7 * 24 * 3600

if (!String(process.env.LAB_SECRET || '').trim()) {
  console.warn(
    '[security] 未配置 LAB_SECRET，本次启动使用随机密钥：重启后所有登录态会失效，生产环境请在 .env 中配置固定密钥。'
  )
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function hashPassword(password, salt = crypto.randomBytes(8).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored = '') {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash || hash.length !== 64) return false
  const next = crypto.scryptSync(String(password), salt, 32).toString('hex')
  const expected = Buffer.from(hash, 'hex')
  const actual = Buffer.from(next, 'hex')
  if (expected.length !== actual.length) return false
  return crypto.timingSafeEqual(expected, actual)
}

export function signToken(user) {
  const payload = base64url(
    JSON.stringify({
      uid: user.id,
      role: user.role,
      ver: Number(user.token_version || 0),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL
    })
  )
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token = '') {
  const [payload, signature] = String(token).split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

export function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    account: user.account,
    name: user.name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar || '',
    credit_score: user.credit_score ?? 100,
    blacklisted: Boolean(user.blacklisted),
    blacklist_reason: user.blacklist_reason || '',
    blacklisted_at: user.blacklisted_at || null,
    created_at: user.created_at
  }
}

function userFromRequest(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = verifyToken(token)
  if (!payload) return { user: null, payload: null }

  const user = getDB().users.find(item => item.id === payload.uid)
  if (!user) return { user: null, payload }
  // 版本号不一致说明用户已主动登出或改过密码，旧 Token 立即失效
  if (Number(user.token_version || 0) !== Number(payload.ver || 0)) {
    return { user: null, payload }
  }
  return { user, payload }
}

export function requireAuth(roles = null) {
  return (req, res, next) => {
    const { user } = userFromRequest(req)

    if (!user) {
      return res.status(401).json({ code: 401, message: '登录状态已失效，请重新登录' })
    }

    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ code: 403, message: '没有该操作的权限' })
    }

    req.user = user
    next()
  }
}

/**
 * 黑名单拦截：用于上传、AI 等与借用资格相关的入口。
 * 可单独挂载，也可放在 requireAuth 之后复用已解析的用户。
 */
export function requireNotBlacklisted(req, res, next) {
  const user = req.user || userFromRequest(req).user
  if (!user) {
    return res.status(401).json({ code: 401, message: '登录状态已失效，请重新登录' })
  }
  if (user.blacklisted) {
    return res.status(403).json({
      code: 403,
      message: `账号已被限制借用：${user.blacklist_reason || '请联系实验室管理员解除限制'}`
    })
  }
  req.user = user
  next()
}

export function bumpTokenVersion(user) {
  user.token_version = Number(user.token_version || 0) + 1
  return user.token_version
}
