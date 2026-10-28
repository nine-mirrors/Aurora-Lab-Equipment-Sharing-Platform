import { getDB } from './db.js'

const PROVIDERS = {
  qwen: {
    id: 'qwen',
    label: '通义千问',
    model: process.env.QWEN_MODEL || 'qwen-flash',
    baseUrl:
      process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyEnvs: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY']
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    keyEnvs: ['DEEPSEEK_API_KEY']
  }
}

function providerKey(provider) {
  for (const env of provider.keyEnvs) {
    const value = process.env[env]
    if (value && value.trim()) return value.trim()
  }
  return ''
}

const REQUEST_TIMEOUT = 15000

// 按“首选模型 → 备用模型”的顺序返回已配置的服务商，用于故障自动切换
function providerChain(preferredId) {
  const order = [preferredId, ...Object.keys(PROVIDERS).filter(id => id !== preferredId)]
  return order
    .map(id => PROVIDERS[id])
    .filter(provider => provider && providerKey(provider))
}

export function getAiStatus() {
  const list = Object.values(PROVIDERS).map(provider => ({
    id: provider.id,
    label: provider.label,
    model: provider.model,
    configured: Boolean(providerKey(provider)),
    keyEnvs: provider.keyEnvs
  }))

  return {
    providers: list,
    defaultProvider: list.find(item => item.configured)?.id || 'qwen',
    hasCloudProvider: list.some(item => item.configured)
  }
}

function pad(num) {
  return String(num).padStart(2, '0')
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function buildContext(user) {
  const db = getDB()
  const today = localDate()
  const activeDevices = db.devices.filter(item => Number(item.is_active))
  const availableDevices = activeDevices.filter(item => Number(item.available_qty) > 0)
  const totalQty = activeDevices.reduce((sum, item) => sum + Number(item.total_qty || 0), 0)
  const availableQty = activeDevices.reduce(
    (sum, item) => sum + Number(item.available_qty || 0),
    0
  )
  const myAll = db.bookings.filter(item => item.user_id === user.id)
  const myTotal = myAll.length
  const myBookings = myAll
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 12)
    .map(item => ({
      id: item.id,
      device: item.device_name,
      category: item.category,
      status: item.status,
      start: item.borrow_start,
      end: item.borrow_end,
      pickupCode: item.pickup_code || null,
      overdue: item.status === 'approved' && item.borrow_end < today
    }))

  const devices = availableDevices
    .slice()
    .sort((a, b) => Number(b.available_qty) - Number(a.available_qty))
    .slice(0, 26)
    .map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      location: item.location || '实验室',
      available: Number(item.available_qty),
      total: Number(item.total_qty),
      description: item.description || '',
      rating: deviceRating(db, item.id)
    }))

  return {
    today,
    user: { name: user.name, role: user.role },
    overview: {
      deviceCount: activeDevices.length,
      totalQty,
      availableQty,
      borrowedQty: Math.max(0, totalQty - availableQty),
      pending: db.bookings.filter(item => item.status === 'pending').length
    },
    myBookings,
    myTotal,
    devices
  }
}

function deviceRating(db, deviceId) {
  const reviews = db.bookings.filter(
    item => item.device_id === deviceId && Number(item.review_rating)
  )
  if (!reviews.length) return null
  const avg = reviews.reduce((sum, item) => sum + Number(item.review_rating), 0) / reviews.length
  return { score: Math.round(avg * 10) / 10, count: reviews.length }
}

const CATEGORY_HINTS = [
  { keys: ['嵌入式', '单片机', '开发板', '树莓派', '物联网'], categories: ['计算机与网络', '传感器'] },
  { keys: ['电路', '信号', '示波', '万用表', '电源', '电子'], categories: ['电子测量', '电源设备'] },
  { keys: ['光学', '显微', '光谱', '激光'], categories: ['光学仪器'] },
  { keys: ['3d', '打印', '建模', '结构件'], categories: ['3D 打印', '机械加工'] },
  { keys: ['生物', 'pcr', '培养', '移液', '基因'], categories: ['生物实验'] },
  { keys: ['化学', 'ph', '离心', '天平', '分析'], categories: ['化学分析'] },
  { keys: ['网络', '通信', '蓝牙', 'lora', '无线', 'wifi'], categories: ['通信设备', '计算机与网络'] },
  { keys: ['航拍', '无人机', '测绘', '飞行'], categories: ['无人机'] },
  { keys: ['视频', '拍摄', '相机', '录音', '麦克风'], categories: ['音视频设备'] },
  { keys: ['传感', '温湿度', '加速度', '压力'], categories: ['传感器'] }
]

function recommendDevices(text, context, limit = 3) {
  const keyword = String(text).toLowerCase()
  const matchedCategories = new Set()

  CATEGORY_HINTS.forEach(hint => {
    if (hint.keys.some(key => keyword.includes(key))) {
      hint.categories.forEach(item => matchedCategories.add(item))
    }
  })

  const scored = context.devices
    .map(device => {
      let score = 0
      if (matchedCategories.has(device.category)) score += 6
      if (keyword.includes(device.category.toLowerCase())) score += 5
      if (keyword.includes(device.name.toLowerCase())) score += 10
      if (
        device.description &&
        keyword
          .split(/[\s,，。？?、]/)
          .filter(Boolean)
          .some(word => device.description.toLowerCase().includes(word))
      ) {
        score += 2
      }
      score += Math.min(3, device.available / 4)
      return { device, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const fallback = context.devices.slice(0, limit).map(device => ({ device, score: 1 }))
  return (scored.length ? scored : fallback).slice(0, limit).map(item => item.device)
}

function statusText(status) {
  return (
    {
      pending: '待审核',
      approved: '在借',
      returning: '归还中',
      returned: '已归还',
      rejected: '已拒绝',
      cancelled: '已取消'
    }[status] || status
  )
}

function localReply(text, context) {
  const message = String(text || '').trim()
  const lower = message.toLowerCase()
  const my = context.myBookings
  const overdue = my.filter(item => item.overdue)

  if (/你好|hi|hello|在吗|嗨/.test(lower)) {
    return {
      reply: `你好，${context.user.name}。我是极光实验室智能助手，可以帮你挑设备、查申请进度、解释借用/续借/归还规则。\n\n当前平台共有 ${context.overview.deviceCount} 台在册设备，${context.overview.availableQty} 台可借。你可以直接问：“推荐一台做嵌入式实验的设备”。`
    }
  }

  if (/我的申请|进度|审核|到哪一步|状态/.test(lower)) {
    if (!my.length) {
      return { reply: '你还没有借用记录。可以在「设备大厅」选择设备并提交申请，审核通过后我会提醒你。' }
    }
    const lines = my.slice(0, 5).map(item => {
      const code = item.pickupCode ? `，取件码 ${item.pickupCode}` : ''
      return `· ${item.device}（${statusText(item.status)}）${item.start} → ${item.end}${code}`
    })
    return {
      reply: `你目前共有 ${context.myTotal ?? my.length} 条借用记录：\n${lines.join('\n')}\n\n可以在「我的申请」中查看完整流程时间线，待审核状态还可以直接取消。${
        overdue.length ? `\n注意：有 ${overdue.length} 条已逾期，请尽快提交归还，避免影响信用分。` : ''
      }`
    }
  }

  if (/逾期|信用|扣分|罚款/.test(lower)) {
    return {
      reply: `平台会按借用到期日自动标记逾期。逾期记录会影响个人信用分，并在管理员端高亮提醒。\n\n你当前有 ${overdue.length} 条逾期记录。建议尽快在「我的申请」中提交归还申请；如果确有困难，可以联系实验室管理员说明情况。`
    }
  }

  if (/续借|延长|延期/.test(lower)) {
    return {
      reply: '续借流程：在「我的申请」中找到在借记录 → 打开详情 → 点击「申请续借」→ 选择新的归还日期并填写原因。管理员审核通过后，借用结束时间会自动延长。\n\n注意：续借需要在该设备后续时段仍有余量时才能通过。'
    }
  }

  if (/归还|还书|还设备|怎么还/.test(lower)) {
    return {
      reply: '归还流程：在「我的申请」中打开在借记录 → 点击「申请归还」→ 系统生成 6 位归还码 → 到实验室交给管理员核验 → 管理员确认后库存自动回补，流程完成。\n\n归还完成后你还可以对设备进行评分与评价。'
    }
  }

  if (/评价|评分|打分|评论/.test(lower)) {
    return {
      reply: '归还审核通过后，在「我的申请」中打开已归还记录，点击「评价设备」，可以给 1-5 星并填写使用感受。评价会汇总为设备评分，帮助其他同学选择设备。'
    }
  }

  if (/怎么借|流程|如何借|借用|预约/.test(lower)) {
    return {
      reply: `完整借用流程：\n1. 在设备大厅查看设备详情与可用日历\n2. 选择借用起止日期，填写用途并同意借用协议\n3. 等待管理员审核（可在我的申请查看进度）\n4. 审核通过后凭 6 位取件码到实验室取件\n5. 使用期间可申请续借\n6. 用完提交归还申请，凭归还码完成归还\n7. 归还后评价设备，积累信用分\n\n当前有 ${context.overview.availableQty} 台设备可借。`
    }
  }

  if (/推荐|挑|适合|选|有什么|找|帮我/.test(lower)) {
    const devices = recommendDevices(message, context)
    if (!devices.length) {
      return { reply: '当前没有可借设备，可以先收藏设备或稍后再来看看。' }
    }
    const lines = devices.map(
      (item, index) =>
        `${index + 1}. ${item.name}（${item.category}）\n   可借 ${item.available}/${item.total} 台 · ${item.location}\n   ${item.description || '暂无描述'}`
    )
    return {
      reply: `根据你的需求，我推荐这几台当前可借的设备：\n\n${lines.join('\n\n')}\n\n需要我帮你打开其中某台设备的详情吗？`,
      deviceNames: devices.map(item => item.name)
    }
  }

  if (/设备|分类|库存|余量|可借/.test(lower)) {
    return {
      reply: `平台当前有 ${context.overview.deviceCount} 台在册设备，库存 ${context.overview.totalQty} 台，其中 ${context.overview.availableQty} 台可借。\n\n热门分类包括电子测量、计算机与网络、传感器、无人机、音视频设备等。你可以告诉我实验方向，我来帮你筛选具体设备。`
    }
  }

  return {
    reply: `我可以帮你：\n· 按实验方向推荐可借设备\n· 查询你的申请进度与取件码\n· 解释借用 / 续借 / 归还 / 评价规则\n· 提醒逾期与信用分影响\n\n当前有 ${context.overview.availableQty} 台设备可借，${context.overview.pending} 条申请等待审核。试试问我：“做嵌入式课程设计推荐什么设备？”`
  }
}

function buildSystemPrompt(context) {
  return `你是「极光 · 实验室设备共享平台」的智能助手，服务于高校实验室设备借用场景。
请使用简体中文，回答简洁、务实、有步骤感，优先使用下面提供的真实数据，不要编造不存在的设备、价格、政策或用户数据。
当用户需要推荐设备时，请直接从候选设备中选择，并使用设备的完整名称；最多推荐 3 台，并说明可借数量和适用场景。
如果用户询问申请进度，请结合他的借用记录回答；如果用户询问规则，请按平台流程回答。
候选设备与上下文如下：
${JSON.stringify(context)}`
}

async function callProvider(providerId, messages, context) {
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error('未知的 AI 服务商')

  const key = providerKey(provider)
  if (!key) throw new Error('未配置 API Key')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.4,
        max_tokens: 800,
        messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...messages]
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`AI 服务返回 ${response.status}${body ? `：${body.slice(0, 160)}` : ''}`)
    }

    const data = await response.json()
    const reply = data?.choices?.[0]?.message?.content
    if (!reply) throw new Error('AI 服务未返回内容')

    return { reply: String(reply).trim(), model: provider.model }
  } finally {
    clearTimeout(timer)
  }
}

function matchDevices(reply, context) {
  const names = new Set()
  context.devices.forEach(device => {
    if (reply.includes(device.name)) names.add(device.name)
  })
  return context.devices.filter(device => names.has(device.name)).slice(0, 4)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function reviewConflictDate(db, booking) {
  const device = db.devices.find(item => item.id === booking.device_id)
  if (!device) return null

  const total = Number(device.total_qty) || 0
  const cursor = new Date(`${booking.borrow_start}T00:00:00`)
  const last = new Date(`${booking.borrow_end}T00:00:00`)

  while (cursor <= last) {
    const key = localDate(cursor)
    const reserved = db.bookings.filter(
      item =>
        item.id !== booking.id &&
        item.device_id === booking.device_id &&
        ['approved', 'returning'].includes(item.status) &&
        item.borrow_start <= key &&
        item.borrow_end >= key
    ).length

    if (reserved >= total) return key
    cursor.setDate(cursor.getDate() + 1)
  }

  return null
}

function localReview({ booking, device, user, stats, conflictDate }) {
  const reasons = []
  const risks = []
  let recommendation = 'approve'

  if (!device) {
    return {
      recommendation: 'reject',
      score: 10,
      summary: '设备档案不存在，无法完成审批。',
      reasons: ['设备可能已被删除或下架'],
      risks: ['设备不存在'],
      suggested_note: '设备档案不存在，请先核对设备信息'
    }
  }

  if (user.blacklisted) {
    recommendation = 'reject'
    risks.push(`申请人已被限制借用：${user.blacklist_reason || '未填写原因'}`)
  }

  if (!Number(device.is_active)) {
    recommendation = 'reject'
    risks.push('设备已下架，当前不可借出')
  }

  if (device.maintenance_status === 'repairing') {
    recommendation = 'reject'
    risks.push(`设备正在维护：${device.maintenance_reason || '设备检修'}`)
  }

  if (Number(device.available_qty) <= 0) {
    recommendation = 'reject'
    risks.push('设备当前没有可借库存')
  }

  if (conflictDate) {
    recommendation = 'reject'
    risks.push(`${conflictDate} 设备已被约满，时间存在冲突`)
  }

  if (stats.overdue >= 2) {
    recommendation = 'reject'
    risks.push(`申请人有 ${stats.overdue} 条逾期未还记录`)
  } else if (stats.overdue === 1) {
    risks.push('申请人存在 1 条逾期记录')
  }

  if (stats.rejected >= 3 && stats.rejected / Math.max(1, stats.total) >= 0.35) {
    risks.push(`历史申请被拒 ${stats.rejected} 次，占比偏高`)
  }

  if (String(booking.purpose || '').trim().length < 6) {
    risks.push('借用用途描述较短，建议补充实验内容')
  }

  const start = new Date(`${booking.borrow_start}T00:00:00`)
  const end = new Date(`${booking.borrow_end}T00:00:00`)
  const days = Math.round((end - start) / 86400000) + 1
  if (days > 30) risks.push(`借用时长 ${days} 天，建议确认使用计划`)

  reasons.push(`申请人历史借用 ${stats.total} 次，已按时归还 ${stats.returned} 次`)
  reasons.push(`设备当前可借 ${device.available_qty}/${device.total_qty} 台`)
  if (!stats.overdue) reasons.push('暂无逾期记录')

  if (recommendation !== 'reject' && risks.length >= 2) recommendation = 'manual'

  const score =
    recommendation === 'reject'
      ? clamp(30 - risks.length * 4, 5, 30)
      : recommendation === 'manual'
        ? clamp(68 - (risks.length - 1) * 5, 45, 75)
        : clamp(95 - risks.length * 4, 80, 98)

  return {
    recommendation,
    score,
    summary:
      recommendation === 'approve'
        ? '申请信息完整，历史记录正常，建议通过。'
        : recommendation === 'manual'
          ? '存在需要人工确认的风险点，建议核实后再决定。'
          : '存在明确的拦截条件，建议拒绝本次申请。',
    reasons,
    risks,
    suggested_note:
      recommendation === 'reject'
        ? risks[0] || '不满足当前借用条件'
        : recommendation === 'manual'
          ? '请申请人补充说明或由管理员核实后审批'
          : '信息核验正常，可正常借出'
  }
}

async function callReviewModel(providerId, payload) {
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error('未知的 AI 服务商')
  const key = providerKey(provider)
  if (!key) throw new Error('未配置 API Key')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              '你是高校实验室设备借用审批助手。请基于真实数据给出审批建议，只能返回 JSON，不要输出 Markdown 或额外解释。'
          },
          {
            role: 'user',
            content: `请审核下面这条借用申请，并严格返回 JSON：
{
  "recommendation": "approve | reject | manual",
  "score": 0-100,
  "summary": "一句话结论",
  "reasons": ["支持通过的理由"],
  "risks": ["风险点，没有则空数组"],
  "suggested_note": "给管理员的审批意见"
}

审核数据：
${JSON.stringify(payload)}`
          }
        ]
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`AI 服务返回 ${response.status}${body ? `：${body.slice(0, 120)}` : ''}`)
    }

    const data = await response.json()
    const text = String(data?.choices?.[0]?.message?.content || '')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI 未返回有效 JSON')

    return { parsed: JSON.parse(match[0]), model: provider.model }
  } finally {
    clearTimeout(timer)
  }
}

export async function reviewBooking({ bookingId, provider = 'qwen' }) {
  const db = getDB()
  const booking = db.bookings.find(item => item.id === Number(bookingId))
  if (!booking) throw new Error('申请不存在')

  const device = db.devices.find(item => item.id === booking.device_id)
  const user = db.users.find(item => item.id === booking.user_id) || {}
  const today = localDate()

  const history = db.bookings.filter(item => item.user_id === booking.user_id)
  const stats = {
    total: history.length,
    returned: history.filter(item => item.status === 'returned').length,
    rejected: history.filter(item => item.status === 'rejected').length,
    overdue: history.filter(
      item => item.status === 'approved' && item.borrow_end < today
    ).length
  }

  const conflictDate = reviewConflictDate(db, booking)
  const fallback = localReview({ booking, device, user, stats, conflictDate })

  const payload = {
    today,
    applicant: {
      name: booking.user_name,
      account: user.account || '',
      role: user.role || 'student',
      blacklisted: Boolean(user.blacklisted),
      blacklistReason: user.blacklist_reason || '',
      history: stats
    },
    booking: {
      id: booking.id,
      device: booking.device_name,
      category: booking.category,
      start: booking.borrow_start,
      end: booking.borrow_end,
      purpose: booking.purpose || '',
      status: booking.status
    },
    device: device
      ? {
          active: Boolean(Number(device.is_active)),
          maintenance: device.maintenance_status,
          maintenanceReason: device.maintenance_reason || '',
          total: device.total_qty,
          available: device.available_qty,
          location: device.location || ''
        }
      : null,
    conflictDate
  }

  const chain = providerChain(provider)
  if (!chain.length) {
    return {
      ...fallback,
      provider: 'local',
      providerLabel: '本地规则',
      model: 'rule-based',
      notice: '云端 AI 未配置，本次使用本地规则生成审批建议。'
    }
  }

  const errors = []
  for (const target of chain) {
    try {
      const { parsed, model } = await callReviewModel(target.id, payload)
      const recommendation = ['approve', 'reject', 'manual'].includes(parsed.recommendation)
        ? parsed.recommendation
        : fallback.recommendation

      return {
        recommendation,
        score: clamp(Number(parsed.score) || fallback.score, 0, 100),
        summary: String(parsed.summary || fallback.summary),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 5) : fallback.reasons,
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 5) : fallback.risks,
        suggested_note: String(parsed.suggested_note || fallback.suggested_note),
        conflictDate,
        provider: target.id,
        providerLabel: target.label,
        model,
        notice:
          target.id === provider
            ? 'AI 建议仅供参考，最终审批结果由管理员确认。'
            : `首选模型不可用，已自动切换至 ${target.label}，建议仅供参考。`
      }
    } catch (error) {
      errors.push(`${target.label}：${error.message}`)
    }
  }

  return {
    ...fallback,
    conflictDate,
    provider: 'local',
    providerLabel: '本地规则',
    model: 'rule-based',
    notice: `云端 AI 暂不可用（${errors.join('；')}），已使用本地规则生成建议。`
  }
}

export async function chat({ messages, provider = 'qwen', user }) {
  const context = buildContext(user)
  const history = messages
    .filter(item => item && ['user', 'assistant'].includes(item.role))
    .slice(-10)
    .map(item => ({ role: item.role, content: String(item.content || '').slice(0, 2000) }))

  const lastUser = [...history].reverse().find(item => item.role === 'user')?.content || ''
  const chain = providerChain(provider)
  const fallback = localReply(lastUser, context)
  const recommended = fallback.deviceNames?.length
    ? context.devices.filter(item => fallback.deviceNames.includes(item.name))
    : matchDevices(fallback.reply, context)

  if (!chain.length) {
    return {
      reply: fallback.reply,
      devices: recommended,
      provider: 'local',
      providerLabel: '本地智能',
      model: 'rule-based',
      notice: '未配置云端 API Key，已使用本地智能回答。在 .env 中配置 QWEN_API_KEY 即可启用通义千问。'
    }
  }

  const errors = []
  for (const target of chain) {
    try {
      const result = await callProvider(target.id, history, context)
      return {
        reply: result.reply,
        devices: matchDevices(result.reply, context),
        provider: target.id,
        providerLabel: target.label,
        model: result.model,
        notice:
          target.id === provider ? '' : `首选模型不可用，已自动切换至 ${target.label}。`
      }
    } catch (error) {
      errors.push(`${target.label}：${error.message}`)
    }
  }

  return {
    reply: fallback.reply,
    devices: recommended,
    provider: 'local',
    providerLabel: '本地智能',
    model: 'rule-based',
    notice: `云端服务暂不可用（${errors.join('；')}），已切换到本地智能回答。`
  }
}
