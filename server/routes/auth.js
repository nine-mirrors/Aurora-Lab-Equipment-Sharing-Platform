import { Router } from 'express'
import { getDB, saveDB, nextId } from '../db.js'
import {
  bumpTokenVersion,
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
  requireAuth,
  requireNotBlacklisted
} from '../auth.js'
import { isMailConfigured, sendVerificationCode } from '../mailer.js'

const router = Router()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_TTL = 10 * 60 * 1000
const RESEND_INTERVAL = 60 * 1000

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

function mailEnabled() {
  return isMailConfigured() && String(process.env.MAIL_DISABLED || '') !== '1'
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function saveCode(email, type, code) {
  const db = getDB()
  const key = String(email).trim().toLowerCase()
  db.codes = (db.codes || []).filter(
    item => !(item.email === key && item.type === type)
  )
  db.codes.push({
    email: key,
    type,
    code,
    attempts: 0,
    created_at: Date.now(),
    expires_at: Date.now() + CODE_TTL
  })
  saveDB()
}

function isLoopback(req) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(req.ip || ''))
}

function verifyEmailCode(email, type, input, consume = true) {
  const code = String(input || '').trim()
  if (!code) return false

  const db = getDB()
  const key = String(email).trim().toLowerCase()
  const record = (db.codes || []).find(
    item => item.email === key && item.type === type
  )

  if (!record) return false
  if (Number(record.expires_at) < Date.now()) {
    db.codes = db.codes.filter(item => item !== record)
    saveDB()
    return false
  }

  if (String(record.code) !== code) {
    // 单个验证码最多允许 5 次尝试，防止被穷举
    record.attempts = Number(record.attempts || 0) + 1
    if (record.attempts >= 5) {
      db.codes = db.codes.filter(item => item !== record)
    }
    saveDB()
    return false
  }

  if (consume) {
    db.codes = db.codes.filter(item => item !== record)
    saveDB()
  }

  return true
}

function findUserByAccount(account) {
  const keyword = String(account || '').trim().toLowerCase()
  return getDB().users.find(
    user =>
      user.account.toLowerCase() === keyword ||
      (user.email || '').toLowerCase() === keyword
  )
}

function writeLoginLog(req, user, account, success) {
  const db = getDB()
  if (!Array.isArray(db.login_logs)) db.login_logs = []

  db.login_logs.push({
    id: nextId('login_logs'),
    user_id: user?.id || null,
    account: String(account || '').trim(),
    name: user?.name || '',
    ip: String(req.ip || ''),
    user_agent: String(req.headers['user-agent'] || '').slice(0, 200),
    success: success ? 1 : 0,
    created_at: new Date().toISOString()
  })

  saveDB()
}

router.post('/login', (req, res) => {
  const { account, password } = req.body || {}
  if (!account || !password) {
    return fail(res, '请输入账号和密码')
  }

  const user = findUserByAccount(account)
  if (!user || !verifyPassword(password, user.password)) {
    writeLoginLog(req, user || null, account, false)
    return fail(res, '账号或密码不正确')
  }

  writeLoginLog(req, user, account, true)

  ok(
    res,
    { token: signToken(user), user: publicUser(user) },
    '登录成功'
  )
})

router.post('/register', (req, res) => {
  const { account, name, email, password, email_code, code } = req.body || {}
  const db = getDB()

  if (!account || !name || !email || !password) {
    return fail(res, '请填写完整的注册信息')
  }
  if (String(account).trim().length < 4) {
    return fail(res, '账号长度不能少于 4 位')
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return fail(res, '邮箱格式不正确')
  }
  if (String(password).length < 6) {
    return fail(res, '密码长度不能少于 6 位')
  }
  if (db.users.some(user => user.account === String(account).trim())) {
    return fail(res, '该账号已被注册')
  }
  if (db.users.some(user => (user.email || '').toLowerCase() === String(email).trim().toLowerCase())) {
    return fail(res, '该邮箱已被使用')
  }

  const inputCode = String(email_code || code || '').trim()
  if (!verifyEmailCode(email, 'register', inputCode)) {
    return fail(res, '邮箱验证码不正确或已过期')
  }

  const user = {
    id: nextId('users'),
    account: String(account).trim(),
    password: hashPassword(password),
    name: String(name).trim(),
    role: 'student',
    email: String(email).trim(),
    phone: req.body?.phone || '',
    avatar: '',
    created_at: new Date().toISOString()
  }

  db.users.push(user)
  saveDB()

  ok(res, { token: signToken(user), user: publicUser(user) }, '注册成功')
})

router.post('/send-email-code', async (req, res) => {
  const { email, type } = req.body || {}
  if (!email) return fail(res, '请先填写邮箱')

  if (!EMAIL_RE.test(String(email).trim())) {
    return fail(res, '邮箱格式不正确')
  }

  const codeType = String(type || 'register') === 'reset_password' ? 'reset_password' : 'register'
  const key = String(email).trim().toLowerCase()
  const db = getDB()
  const existing = (db.codes || []).find(
    item => item.email === key && item.type === codeType
  )

  if (existing && Date.now() - Number(existing.created_at || 0) < RESEND_INTERVAL) {
    return fail(res, '验证码发送过于频繁，请稍后再试')
  }

  const mailReady = mailEnabled()
  const code = generateCode()

  if (mailReady) {
    try {
      await sendVerificationCode({ to: key, code, type: codeType })
    } catch (error) {
      console.error('[mail error]', error.message)
      return fail(res, '验证码邮件发送失败，请检查邮箱地址或稍后重试')
    }
  } else {
    // 未配置 SMTP 时不把验证码写进响应，只输出到服务端控制台
    console.log(`[mail disabled] ${key} 的${codeType === 'reset_password' ? '重置密码' : '注册'}验证码：${code}`)
  }

  saveCode(key, codeType, code)

  const allowLocalCode =
    !mailReady && isLoopback(req) && process.env.NODE_ENV !== 'production'

  ok(
    res,
    {
      channel: mailReady ? 'email' : 'console',
      // 仅本机非生产环境返回验证码，方便演示与自动化测试；生产环境一律不下发
      devCode: allowLocalCode ? code : undefined,
      expiresIn: CODE_TTL / 1000
    },
    mailReady
      ? '验证码已发送至邮箱'
      : allowLocalCode
        ? '演示环境验证码已生成，仅本机可见'
        : '验证码已生成，请查看服务端控制台'
  )
})

router.post('/forget-password', (req, res) => {
  const { account, email, code, password, password_confirmation } = req.body || {}

  if (!account || !password) return fail(res, '请填写账号和新密码')
  if (!email) return fail(res, '请填写绑定邮箱')
  if (password_confirmation && password !== password_confirmation) {
    return fail(res, '两次输入的密码不一致')
  }

  const user = findUserByAccount(account)
  if (!user || (user.email || '').toLowerCase() !== String(email).toLowerCase()) {
    return fail(res, '账号与绑定邮箱不匹配')
  }

  if (!verifyEmailCode(email, 'reset_password', code)) {
    return fail(res, '邮箱验证码不正确或已过期')
  }

  user.password = hashPassword(password)
  bumpTokenVersion(user)
  saveDB()

  ok(res, null, '密码已重置，原有登录状态全部失效，请使用新密码登录')
})

router.post('/logout', requireAuth(), (req, res) => {
  bumpTokenVersion(req.user)
  saveDB()
  ok(res, null, '已退出登录')
})

router.post('/password', requireAuth(), (req, res) => {
  const { old_password, new_password } = req.body || {}
  if (!old_password || !new_password) return fail(res, '请填写原密码和新密码')
  if (String(new_password).length < 6) return fail(res, '新密码长度不能少于 6 位')
  if (!verifyPassword(old_password, req.user.password)) return fail(res, '原密码不正确')

  req.user.password = hashPassword(new_password)
  bumpTokenVersion(req.user)
  saveDB()
  ok(res, { token: signToken(req.user) }, '密码修改成功，其他设备上的登录状态已失效')
})

router.get('/me', requireAuth(), (req, res) => {
  ok(res, publicUser(req.user))
})

router.put('/profile', requireAuth(), requireNotBlacklisted, (req, res) => {
  const { name, email, phone, avatar } = req.body || {}
  const db = getDB()

  if (email) {
    if (!EMAIL_RE.test(String(email).trim())) return fail(res, '邮箱格式不正确')
    const exists = db.users.some(
      user =>
        user.id !== req.user.id &&
        (user.email || '').toLowerCase() === String(email).trim().toLowerCase()
    )
    if (exists) return fail(res, '该邮箱已被其他账号使用')
    req.user.email = String(email).trim()
  }

  if (name) req.user.name = String(name).trim()
  if (phone !== undefined) {
    const value = String(phone).trim()
    if (value && !/^1\d{10}$/.test(value)) return fail(res, '手机号格式不正确')
    req.user.phone = value
  }

  if (avatar !== undefined) {
    const value = String(avatar || '')
    if (value && !/^data:image\/(png|jpe?g|webp);base64,/.test(value)) {
      return fail(res, '头像格式不正确')
    }
    if (value.length > 500 * 1024) return fail(res, '头像文件过大，请重新上传')
    req.user.avatar = value
  }

  saveDB()
  ok(res, publicUser(req.user), '资料已保存')
})

export default router
