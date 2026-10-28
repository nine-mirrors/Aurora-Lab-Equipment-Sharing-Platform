import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.TEST_PORT) || 3188
const BASE = `http://127.0.0.1:${PORT}`
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-api-test-'))
const TEST_DB = path.join(TEMP_DIR, 'db.json')

const results = []
let serverProc = null

function pad(num) {
  return String(num).padStart(2, '0')
}

function dateKey(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(method, url, { body, token, raw } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  if (raw) return response

  const data = await response.json().catch(() => null)
  return { status: response.status, data }
}

async function step(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error: error.message })
    console.error(`  ✗ ${name}\n    ${error.message}`)
  }
}

async function emailCode(email, type = 'register') {
  const { data } = await request('POST', '/api/auth/send-email-code', {
    body: { email, type }
  })
  assert(data.code === 200 && data.data?.devCode, `验证码获取失败：${data.message}`)
  return data.data.devCode
}

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`)
      if (response.ok) return
    } catch {
      // 继续等待
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('后端未能在预期时间内启动')
}

function startServer() {
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      LAB_DB_FILE: TEST_DB,
      MAIL_DISABLED: '1',
      LOG_DISABLED: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  serverProc.stdout.on('data', chunk => {
    const text = String(chunk).trim()
    if (text) console.log(`    [server] ${text}`)
  })

  serverProc.stderr.on('data', chunk => {
    const text = String(chunk).trim()
    if (text) console.error(`    [server:error] ${text}`)
  })
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    serverProc.kill()
    serverProc = null
  }
}

async function main() {
  console.log(`\n实验室设备共享平台 · 接口功能测试\n后端端口: ${PORT}\n测试数据: ${TEST_DB}\n`)

  startServer()
  await waitForServer()

  const suffix = String(Date.now()).slice(-6)
  const studentAccount = `t${suffix}`
  const studentEmail = `${studentAccount}@test.edu.cn`
  let studentToken = ''
  let studentId = null
  let adminToken = ''
  let createdDeviceId = null
  let stockBefore = 0
  let activeStockDeviceId = null
  let auxToken = ''
  let auxUserId = null

  await step('健康检查返回 ok', async () => {
    const { status, data } = await request('GET', '/api/health')
    assert(status === 200 && data.code === 200, '健康检查失败')
  })

  await step('未登录访问受保护接口返回 401', async () => {
    const { status, data } = await request('GET', '/api/devices')
    assert(status === 401 && data.code === 401, '未登录访问未被拦截')
  })

  await step('管理员账号登录成功且角色正确', async () => {
    const { data } = await request('POST', '/api/auth/login', {
      body: { account: 'admin', password: '123456' }
    })
    assert(data.code === 200, `登录失败：${data.message}`)
    assert(data.data.user.role === 'admin', '管理员角色不正确')
    adminToken = data.data.token
  })

  await step('错误密码登录被拒绝', async () => {
    const { data } = await request('POST', '/api/auth/login', {
      body: { account: 'admin', password: 'wrong-password' }
    })
    assert(data.code === 400, '错误密码未被拒绝')
  })

  await step('缺少邮箱验证码时注册被拒绝', async () => {
    const { data } = await request('POST', '/api/auth/register', {
      body: {
        account: `bad${suffix}`,
        name: '无效用户',
        email: `bad${suffix}@test.edu.cn`,
        password: '123456'
      }
    })
    assert(data.code === 400, '未校验邮箱验证码')
  })

  await step('新用户注册并自动返回 token', async () => {
    const code = await emailCode(studentEmail)
    const { data } = await request('POST', '/api/auth/register', {
      body: {
        account: studentAccount,
        name: '接口测试同学',
        email: studentEmail,
        password: '123456',
        email_code: code
      }
    })
    assert(data.code === 200, `注册失败：${data.message}`)
    assert(data.data.token, '注册未返回 token')
    assert(data.data.user.role === 'student', '新用户角色不是学生')
    studentToken = data.data.token
    studentId = data.data.user.id
  })

  await step('重复账号注册被拒绝', async () => {
    const { data } = await request('POST', '/api/auth/register', {
      body: {
        account: studentAccount,
        name: '重复账号',
        email: `dup${suffix}@test.edu.cn`,
        password: '123456',
        email_code: '123456'
      }
    })
    assert(data.code === 400, '重复账号未被拒绝')
  })

  await step('学生访问管理员接口返回 403', async () => {
    const { status, data } = await request('GET', '/api/admin/users', { token: studentToken })
    assert(status === 403 && data.code === 403, '越权访问未被拦截')
  })

  await step('统计概览返回完整指标', async () => {
    const { data } = await request('GET', '/api/stats/overview', { token: studentToken })
    assert(data.code === 200, '概览接口失败')
    assert(data.data.deviceCount > 0, '设备数量异常')
    assert(typeof data.data.utilizationRate === 'number', '利用率字段缺失')
    assert(data.data.mine && data.data.mine.total === 0, '新用户个人统计应初始为 0')
  })

  await step('趋势、分类、利用率接口可用，最近申请仅管理员可见', async () => {
    const [trend, categories, utilization, denied] = await Promise.all([
      request('GET', '/api/stats/trend?days=30', { token: studentToken }),
      request('GET', '/api/stats/categories', { token: studentToken }),
      request('GET', '/api/stats/utilization', { token: studentToken }),
      request('GET', '/api/stats/recent?limit=5', { token: studentToken })
    ])
    assert(trend.data.data.length === 30, '趋势数据天数不正确')
    assert(categories.data.data.length > 0, '分类统计为空')
    assert(utilization.data.data.length > 0, '利用率统计为空')
    assert(denied.status === 403, '学生不应读取最近申请明细')

    const recent = await request('GET', '/api/stats/recent?limit=5', { token: adminToken })
    assert(recent.data.code === 200 && recent.data.data.length > 0, '管理员读取最近申请失败')
  })

  await step('设备列表分页与筛选正常', async () => {
    const page1 = await request('GET', '/api/devices?page=1&pageSize=5', { token: studentToken })
    const page2 = await request('GET', '/api/devices?page=2&pageSize=5', { token: studentToken })
    assert(page1.data.data.list.length === 5, '第一页数量不正确')
    assert(page2.data.data.list.length > 0, '第二页为空')
    assert(page1.data.data.list[0].id !== page2.data.data.list[0].id, '分页未生效')

    const filtered = await request('GET', '/api/devices?name=示波器&pageSize=50', { token: studentToken })
    assert(
      filtered.data.data.list.every(item => item.name.includes('示波器')),
      '名称筛选结果不正确'
    )

    const byCategory = await request(
      'GET',
      `/api/devices?category=${encodeURIComponent('电子测量')}&pageSize=50`,
      { token: studentToken }
    )
    assert(
      byCategory.data.data.list.every(item => item.category === '电子测量'),
      '分类筛选结果不正确'
    )
  })

  await step('设备详情接口返回单个设备', async () => {
    const list = await request('GET', '/api/devices?pageSize=1', { token: studentToken })
    const id = list.data.data.list[0].id
    const detail = await request('GET', `/api/devices/${id}`, { token: studentToken })
    assert(detail.data.code === 200 && detail.data.data.id === id, '设备详情不正确')
  })

  await step('学生提交借用申请成功', async () => {
    const list = await request('GET', '/api/devices?available=1&pageSize=50', { token: studentToken })
    const device = list.data.data.list.find(item => item.available_qty >= 2)
    assert(device, '没有可用设备')
    activeStockDeviceId = device.id
    stockBefore = device.available_qty

    const { data } = await request('POST', '/api/bookings', {
      token: studentToken,
      body: {
        device_id: device.id,
        borrow_start: dateKey(1),
        borrow_end: dateKey(4),
        purpose: '接口自动化测试借用'
      }
    })
    assert(data.code === 200, `申请失败：${data.message}`)
    assert(data.data.status === 'pending', '新申请状态不是待审核')
  })

  await step('同一设备重复申请被拒绝', async () => {
    const { data } = await request('POST', '/api/bookings', {
      token: studentToken,
      body: {
        device_id: activeStockDeviceId,
        borrow_start: dateKey(5),
        borrow_end: dateKey(8)
      }
    })
    assert(data.code === 409, '重复申请未被拒绝')
  })

  await step('过去日期和倒置日期被拒绝', async () => {
    const past = await request('POST', '/api/bookings', {
      token: studentToken,
      body: {
        device_id: activeStockDeviceId,
        borrow_start: dateKey(-3),
        borrow_end: dateKey(2)
      }
    })
    assert(past.data.code === 400, '过去日期未被拒绝')

    const reversed = await request('POST', '/api/bookings', {
      token: studentToken,
      body: {
        device_id: activeStockDeviceId,
        borrow_start: dateKey(6),
        borrow_end: dateKey(2)
      }
    })
    assert(reversed.data.code === 400, '倒置日期未被拒绝')
  })

  let bookingId = null

  await step('管理员待审核列表包含该申请', async () => {
    const { data } = await request(
      'GET',
      '/api/admin/bookings/pending?pageSize=500',
      { token: adminToken }
    )
    assert(data.code === 200, '待审核列表接口失败')
    const item = data.data.list.find(row => row.user_id === studentId)
    assert(item, '待审核列表中没有新申请')
    bookingId = item.id
  })

  await step('审批通过后库存正确扣减', async () => {
    const detailBefore = await request('GET', `/api/devices/${activeStockDeviceId}`, {
      token: adminToken
    })
    const before = detailBefore.data.data.available_qty

    const { data } = await request('PATCH', `/api/admin/bookings/${bookingId}/audit`, {
      token: adminToken,
      body: { action: 'approve' }
    })
    assert(data.code === 200, `审批失败：${data.message}`)
    assert(data.data.status === 'approved', '审批后状态不正确')

    const detailAfter = await request('GET', `/api/devices/${activeStockDeviceId}`, {
      token: adminToken
    })
    assert(detailAfter.data.data.available_qty === before - 1, '库存未扣减')
  })

  await step('学生申请归还后进入归还审核', async () => {
    const { data } = await request('PATCH', `/api/bookings/${bookingId}/return`, {
      token: studentToken,
      body: {}
    })
    assert(data.code === 200 && data.data.status === 'returning', '归还申请状态不正确')
  })

  await step('管理员确认归还后库存回补', async () => {
    const detailBefore = await request('GET', `/api/devices/${activeStockDeviceId}`, {
      token: adminToken
    })
    const before = detailBefore.data.data.available_qty

    const { data } = await request(
      'PATCH',
      `/api/admin/bookings/${bookingId}/return-audit`,
      { token: adminToken, body: { action: 'approve' } }
    )
    assert(data.code === 200 && data.data.status === 'returned', '归还审核失败')

    const detailAfter = await request('GET', `/api/devices/${activeStockDeviceId}`, {
      token: adminToken
    })
    assert(detailAfter.data.data.available_qty === before + 1, '库存未回补')
    assert(detailAfter.data.data.available_qty === stockBefore, '库存未恢复到申请前')
  })

  await step('拒绝申请并记录拒绝原因', async () => {
    const list = await request('GET', '/api/devices?available=1&pageSize=50', { token: studentToken })
    const device = list.data.data.list.find(item => item.id !== activeStockDeviceId)
    assert(device, '没有第二台可用设备')

    const apply = await request('POST', '/api/bookings', {
      token: studentToken,
      body: {
        device_id: device.id,
        borrow_start: dateKey(2),
        borrow_end: dateKey(6),
        purpose: '用于拒绝流程测试'
      }
    })
    assert(apply.data.code === 200, '第二笔申请失败')

    const reject = await request(
      'PATCH',
      `/api/admin/bookings/${apply.data.data.id}/audit`,
      { token: adminToken, body: { action: 'reject', reason: '库存不足' } }
    )
    assert(reject.data.code === 200 && reject.data.data.status === 'rejected', '拒绝流程失败')

    const mine = await request('GET', '/api/bookings/my?pageSize=50', { token: studentToken })
    const target = mine.data.data.list.find(item => item.id === apply.data.data.id)
    assert(target && target.reason === '库存不足', '拒绝原因未保存')
  })

  await step('个人资料更新与读取一致', async () => {
    const { data } = await request('PUT', '/api/auth/profile', {
      token: studentToken,
      body: { name: '接口测试同学（改名）', phone: '13900001111' }
    })
    assert(data.code === 200, `资料更新失败：${data.message}`)

    const me = await request('GET', '/api/auth/me', { token: studentToken })
    assert(me.data.data.name === '接口测试同学（改名）', '姓名未更新')
    assert(me.data.data.phone === '13900001111', '手机号未更新')
  })

  await step('头像上传校验与保存', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

    const okRes = await request('PUT', '/api/auth/profile', {
      token: studentToken,
      body: { avatar: png }
    })
    assert(okRes.data.code === 200 && okRes.data.data.avatar === png, '头像保存失败')

    const badRes = await request('PUT', '/api/auth/profile', {
      token: studentToken,
      body: { avatar: 'not-an-image' }
    })
    assert(badRes.data.code === 400, '非法头像格式未被拒绝')
  })

  await step('修改密码后旧密码与旧 Token 同时失效', async () => {
    const change = await request('POST', '/api/auth/password', {
      token: studentToken,
      body: { old_password: '123456', new_password: 'abc12345' }
    })
    assert(change.data.code === 200, `修改密码失败：${change.data.message}`)
    assert(change.data.data?.token, '修改密码后未返回新 Token')

    const stale = await request('GET', '/api/auth/me', { token: studentToken })
    assert(stale.status === 401, '修改密码后旧 Token 仍然可用')

    const oldLogin = await request('POST', '/api/auth/login', {
      body: { account: studentAccount, password: '123456' }
    })
    assert(oldLogin.data.code === 400, '旧密码仍然可以登录')

    const newLogin = await request('POST', '/api/auth/login', {
      body: { account: studentAccount, password: 'abc12345' }
    })
    assert(newLogin.data.code === 200, '新密码无法登录')
    studentToken = newLogin.data.data.token
  })

  await step('主动登出后旧 Token 立即失效', async () => {
    const login = await request('POST', '/api/auth/login', {
      body: { account: studentAccount, password: 'abc12345' }
    })
    const tempToken = login.data.data.token

    const out = await request('POST', '/api/auth/logout', { token: tempToken })
    assert(out.data.code === 200, `登出失败：${out.data.message}`)

    const stale = await request('GET', '/api/auth/me', { token: tempToken })
    assert(stale.status === 401, '登出后旧 Token 仍然可用')

    const relogin = await request('POST', '/api/auth/login', {
      body: { account: studentAccount, password: 'abc12345' }
    })
    studentToken = relogin.data.data.token
  })

  await step('设备上架、编辑、筛选与下架', async () => {
    const create = await request('POST', '/api/admin/devices', {
      token: adminToken,
      body: {
        name: `接口测试设备${suffix}`,
        category: '电子测量',
        description: '自动化测试创建',
        total_qty: 3,
        location: '测试实验室'
      }
    })
    assert(create.data.code === 200, `设备上架失败：${create.data.message}`)
    createdDeviceId = create.data.data.id

    const update = await request('PUT', `/api/admin/devices/${createdDeviceId}`, {
      token: adminToken,
      body: { name: `接口测试设备${suffix}-改`, total_qty: 5, location: '测试实验室 B' }
    })
    assert(update.data.code === 200 && update.data.data.total_qty === 5, '设备编辑失败')

    const filtered = await request(
      'GET',
      `/api/devices?name=${encodeURIComponent('接口测试设备')}&pageSize=50`,
      { token: adminToken }
    )
    assert(
      filtered.data.data.list.some(item => item.id === createdDeviceId),
      '新建设备未出现在列表'
    )

    const off = await request('DELETE', `/api/admin/devices/${createdDeviceId}`, {
      token: adminToken
    })
    assert(off.data.code === 200 && Number(off.data.data.is_active) === 0, '设备下架失败')

    const inactiveList = await request('GET', '/api/devices?is_active=0&pageSize=100', {
      token: adminToken
    })
    assert(
      inactiveList.data.data.list.some(item => item.id === createdDeviceId),
      '下架设备未出现在下架筛选结果'
    )
  })

  await step('已下架设备无法提交申请', async () => {
    const { data } = await request('POST', '/api/bookings', {
      token: studentToken,
      body: {
        device_id: createdDeviceId,
        borrow_start: dateKey(1),
        borrow_end: dateKey(3)
      }
    })
    assert(data.code === 400, '已下架设备仍可申请')
  })

  await step('管理员用户列表包含新用户', async () => {
    const { data } = await request(
      'GET',
      `/api/admin/users?pageSize=500&keyword=${encodeURIComponent(studentAccount)}`,
      { token: adminToken }
    )
    assert(data.code === 200, '用户列表接口失败')
    assert(data.data.list.some(item => item.id === studentId), '新用户未出现在用户列表')
  })

  await step('有未归还设备时禁止注销账号', async () => {
    const emailA = `a${suffix}@test.edu.cn`
    const codeA = await emailCode(emailA)
    const register = await request('POST', '/api/auth/register', {
      body: {
        account: `a${suffix}`,
        name: '占用设备用户',
        email: emailA,
        password: '123456',
        email_code: codeA
      }
    })
    auxToken = register.data.data.token
    auxUserId = register.data.data.user.id
    const tokenA = auxToken
    const idA = auxUserId

    const list = await request('GET', '/api/devices?is_active=1&available=1&pageSize=50', {
      token: tokenA
    })
    const device = list.data.data.list[0]
    const apply = await request('POST', '/api/bookings', {
      token: tokenA,
      body: {
        device_id: device.id,
        borrow_start: dateKey(1),
        borrow_end: dateKey(3)
      }
    })
    await request('PATCH', `/api/admin/bookings/${apply.data.data.id}/audit`, {
      token: adminToken,
      body: { action: 'approve' }
    })

    const remove = await request('DELETE', `/api/admin/users/${idA}`, { token: adminToken })
    assert(remove.data.code === 400, '有在借设备的用户被允许注销')
  })

  await step('管理员账号不允许注销', async () => {
    const { data } = await request('DELETE', '/api/admin/users/1', { token: adminToken })
    assert(data.code === 400, '管理员账号未被保护')
  })

  await step('黑名单账号无法使用上传、AI 与资料修改', async () => {
    const add = await request('PATCH', `/api/admin/users/${auxUserId}/blacklist`, {
      token: adminToken,
      body: { action: 'add', reason: '自动化测试限制' }
    })
    assert(add.data.code === 200, `加入黑名单失败：${add.data.message}`)

    const chat = await request('POST', '/api/ai/chat', {
      token: auxToken,
      body: { messages: [{ role: 'user', content: '你好' }] }
    })
    assert(chat.status === 403, '黑名单账号仍可调用 AI')

    const profile = await request('PUT', '/api/auth/profile', {
      token: auxToken,
      body: { name: '改名测试' }
    })
    assert(profile.status === 403, '黑名单账号仍可修改资料')

    const form = new FormData()
    form.append('file', new Blob([Buffer.from('fake')], { type: 'image/png' }), 'x.png')
    const upload = await fetch(`${BASE}/api/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auxToken}` },
      body: form
    })
    assert(upload.status === 403, '黑名单账号仍可上传文件')

    const remove = await request('PATCH', `/api/admin/users/${auxUserId}/blacklist`, {
      token: adminToken,
      body: { action: 'remove' }
    })
    assert(remove.data.code === 200, '解除黑名单失败')
  })

  await step('收藏接口支持新增、查询与取消', async () => {
    const list = await request('GET', '/api/devices?is_active=1&pageSize=1', {
      token: studentToken
    })
    const device = list.data.data.list[0]
    assert(device, '没有可用于收藏测试的设备')

    const add = await request('POST', `/api/favorites/${device.id}`, { token: studentToken })
    assert(add.data.code === 200, `收藏失败：${add.data.message}`)

    const mine = await request('GET', '/api/favorites', { token: studentToken })
    assert(mine.data.code === 200, '收藏列表接口失败')
    assert(mine.data.data.ids.includes(device.id), '收藏后未出现在列表')

    const duplicate = await request('POST', `/api/favorites/${device.id}`, {
      token: studentToken
    })
    assert(duplicate.data.code === 200, '重复收藏未幂等处理')

    const remove = await request('DELETE', `/api/favorites/${device.id}`, {
      token: studentToken
    })
    assert(remove.data.code === 200, '取消收藏失败')

    const after = await request('GET', '/api/favorites', { token: studentToken })
    assert(!after.data.data.ids.includes(device.id), '取消收藏后仍在列表')
  })

  await step('管理员公告 CRUD 生效', async () => {
    const title = `接口测试公告${suffix}`
    const create = await request('POST', '/api/admin/announcements', {
      token: adminToken,
      body: { title, content: '自动化测试公告内容', level: 'warning', is_active: 1 }
    })
    assert(create.data.code === 200, `公告创建失败：${create.data.message}`)
    const announcementId = create.data.data.id

    const adminList = await request('GET', '/api/admin/announcements', { token: adminToken })
    assert(
      adminList.data.data.list.some(item => item.id === announcementId),
      '新公告未出现在管理列表'
    )

    const publicList = await request('GET', '/api/announcements', { token: studentToken })
    assert(
      publicList.data.data.list.some(item => item.id === announcementId),
      '启用公告未出现在学生端'
    )

    const update = await request('PUT', `/api/admin/announcements/${announcementId}`, {
      token: adminToken,
      body: { is_active: 0 }
    })
    assert(update.data.code === 200 && Number(update.data.data.is_active) === 0, '公告停用失败')

    const hidden = await request('GET', '/api/announcements', { token: studentToken })
    assert(
      !hidden.data.data.list.some(item => item.id === announcementId),
      '停用公告仍展示给学生'
    )

    const remove = await request('DELETE', `/api/admin/announcements/${announcementId}`, {
      token: adminToken
    })
    assert(remove.data.code === 200, '公告删除失败')
  })

  await step('管理员院系 CRUD 生效', async () => {
    const name = `测试院系${suffix}`
    const create = await request('POST', '/api/admin/departments', {
      token: adminToken,
      body: { name, code: `T${suffix}`, description: '自动化测试院系' }
    })
    assert(create.data.code === 200, `院系创建失败：${create.data.message}`)
    const departmentId = create.data.data.id

    const list = await request('GET', '/api/admin/departments', { token: adminToken })
    assert(
      list.data.data.list.some(item => item.id === departmentId),
      '新院系未出现在列表'
    )

    const update = await request('PUT', `/api/admin/departments/${departmentId}`, {
      token: adminToken,
      body: { description: '已更新的说明' }
    })
    assert(update.data.code === 200 && update.data.data.description === '已更新的说明', '院系编辑失败')

    const remove = await request('DELETE', `/api/admin/departments/${departmentId}`, {
      token: adminToken
    })
    assert(remove.data.code === 200, '院系删除失败')
  })

  await step('管理员实验室 CRUD 与院系删除保护生效', async () => {
    const departmentName = `测试实验室院系${suffix}`
    const department = await request('POST', '/api/admin/departments', {
      token: adminToken,
      body: { name: departmentName, code: `L${suffix}` }
    })
    assert(department.data.code === 200, `实验室归属院系创建失败：${department.data.message}`)
    const departmentId = department.data.data.id

    const name = `测试实验室${suffix}`
    const create = await request('POST', '/api/admin/labs', {
      token: adminToken,
      body: {
        name,
        building: '测试楼',
        room: 'T101',
        department_id: departmentId,
        manager: '测试负责人',
        capacity: 20,
        status: 'open',
        open_hours: '09:00 - 17:00'
      }
    })
    assert(create.data.code === 200, `实验室创建失败：${create.data.message}`)
    const lab = create.data.data
    assert(lab.department_name === departmentName, '实验室院系名称未同步')

    const blocked = await request('DELETE', `/api/admin/departments/${departmentId}`, {
      token: adminToken
    })
    assert(blocked.data.code === 409, '院系下仍有实验室时未阻止删除')

    const update = await request('PUT', `/api/admin/labs/${lab.id}`, {
      token: adminToken,
      body: { capacity: 30, status: 'maintenance' }
    })
    assert(update.data.code === 200 && Number(update.data.data.capacity) === 30, '实验室编辑失败')
    assert(update.data.data.status === 'maintenance', '实验室状态未更新')

    const list = await request('GET', '/api/admin/labs', { token: adminToken })
    assert(list.data.data.list.some(item => item.id === lab.id), '新实验室未出现在列表')

    const remove = await request('DELETE', `/api/admin/labs/${lab.id}`, { token: adminToken })
    assert(remove.data.code === 200, '实验室删除失败')

    const removeDepartment = await request('DELETE', `/api/admin/departments/${departmentId}`, {
      token: adminToken
    })
    assert(removeDepartment.data.code === 200, '实验室删除后院系仍无法删除')
  })

  await step('管理员可读取并更新系统设置', async () => {
    const list = await request('GET', '/api/admin/settings', { token: adminToken })
    assert(list.data.code === 200, '系统设置列表失败')
    assert(list.data.data.list.length >= 10, '系统设置数量不足')

    const update = await request('PUT', '/api/admin/settings/max_active_bookings', {
      token: adminToken,
      body: { value: '2' }
    })
    assert(update.data.code === 200, `设置更新失败：${update.data.message}`)
    assert(update.data.data.value === '2', '设置值未更新')

    const publicRules = await request('GET', '/api/settings/public', { token: studentToken })
    assert(publicRules.data.code === 200, '公开借用规则读取失败')
    assert(Number(publicRules.data.data.max_borrow_days) > 0, '公开规则缺少最长借用天数')

    const invalid = await request('PUT', '/api/admin/settings/not_exists', {
      token: adminToken,
      body: { value: '1' }
    })
    assert(invalid.data.code === 404, '不存在的设置项未被拒绝')

    const restore = await request('PUT', '/api/admin/settings/max_active_bookings', {
      token: adminToken,
      body: { value: '3' }
    })
    assert(restore.data.code === 200 && restore.data.data.value === '3', '设置恢复失败')
  })

  await step('找回密码后旧密码与旧 Token 同时失效', async () => {
    const emailA = `a${suffix}@test.edu.cn`
    const code = await emailCode(emailA, 'reset_password')
    const reset = await request('POST', '/api/auth/forget-password', {
      body: {
        account: `a${suffix}`,
        email: emailA,
        code,
        password: 'newpass123'
      }
    })
    assert(reset.data.code === 200, `重置密码失败：${reset.data.message}`)

    const stale = await request('GET', '/api/auth/me', { token: auxToken })
    assert(stale.status === 401, '重置密码后旧 Token 仍然可用')

    const oldLogin = await request('POST', '/api/auth/login', {
      body: { account: `a${suffix}`, password: '123456' }
    })
    assert(oldLogin.data.code === 400, '旧密码在重置后仍可登录')

    const newLogin = await request('POST', '/api/auth/login', {
      body: { account: `a${suffix}`, password: 'newpass123' }
    })
    assert(newLogin.data.code === 200, '重置后的新密码无法登录')
    auxToken = newLogin.data.data.token
  })

  await step('普通用户注销成功后无法登录', async () => {
    const remove = await request('DELETE', `/api/admin/users/${studentId}`, {
      token: adminToken
    })
    assert(remove.data.code === 200, `注销失败：${remove.data.message}`)

    const login = await request('POST', '/api/auth/login', {
      body: { account: studentAccount, password: 'abc12345' }
    })
    assert(login.data.code === 400, '注销后的账号仍可登录')
  })

  await step('不存在的接口返回 404', async () => {
    const { status, data } = await request('GET', '/api/not-exists')
    assert(status === 404 && data.code === 404, '404 处理不正确')
  })

  await step('验证码接口超过阈值返回 429', async () => {
    let status = 0
    for (let i = 0; i < 12; i += 1) {
      const response = await request('POST', '/api/auth/send-email-code', {
        raw: true,
        body: { email: `limit${i}${suffix}@test.edu.cn`, type: 'register' }
      })
      status = response.status
      if (status === 429) break
    }
    assert(status === 429, `未触发限流，最后状态码 ${status}`)
  })

  const failed = results.filter(item => !item.ok)
  console.log(`\n测试结果：${results.length - failed.length} 通过 / ${failed.length} 失败\n`)

  if (failed.length) {
    console.error('失败项：')
    failed.forEach(item => console.error(`  - ${item.name}: ${item.error}`))
    process.exitCode = 1
  }
}

try {
  await main()
} catch (error) {
  console.error(`\n测试执行异常：${error.message}`)
  process.exitCode = 1
} finally {
  stopServer()
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  } catch {
    // 忽略清理失败
  }
}
