import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import webpush from 'web-push'
import { getDB, saveDB, nextId } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAPID_FILE = path.join(__dirname, 'data', 'vapid.json')

let configured = false
let vapidKeys = null

/**
 * VAPID 密钥优先级：.env → server/data/vapid.json → 首次启动自动生成并落盘。
 * 自动生成的密钥只保存在本地数据目录，不会进入源码或提交包。
 */
function loadVapidKeys() {
  if (vapidKeys) return vapidKeys

  const envPublic = String(process.env.VAPID_PUBLIC_KEY || '').trim()
  const envPrivate = String(process.env.VAPID_PRIVATE_KEY || '').trim()
  if (envPublic && envPrivate) {
    vapidKeys = { publicKey: envPublic, privateKey: envPrivate }
    return vapidKeys
  }

  try {
    if (fs.existsSync(VAPID_FILE)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'))
      if (saved?.publicKey && saved?.privateKey) {
        vapidKeys = { publicKey: saved.publicKey, privateKey: saved.privateKey }
        return vapidKeys
      }
    }
  } catch (error) {
    console.warn('[push] 读取 VAPID 密钥失败，将重新生成：', error.message)
  }

  const generated = webpush.generateVAPIDKeys()
  vapidKeys = { publicKey: generated.publicKey, privateKey: generated.privateKey }
  try {
    fs.mkdirSync(path.dirname(VAPID_FILE), { recursive: true })
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), { mode: 0o600 })
    console.log('[push] 未配置 VAPID，已自动生成密钥并保存到 server/data/vapid.json')
  } catch (error) {
    console.warn('[push] VAPID 密钥保存失败，本次运行使用临时密钥：', error.message)
  }
  return vapidKeys
}

function ensureConfigured() {
  if (configured) return true
  const { publicKey, privateKey } = loadVapidKeys()

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:lab-admin@example.com',
    publicKey,
    privateKey
  )
  configured = true
  return true
}

export function getPublicKey() {
  return loadVapidKeys().publicKey
}

export function isPushConfigured() {
  return Boolean(loadVapidKeys().publicKey && loadVapidKeys().privateKey)
}

export function saveSubscription(userId, subscription, userAgent = '') {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error('订阅信息不完整')
  }

  // 只接受标准 HTTPS 推送端点，避免把服务端当作任意地址的请求代理
  let endpoint
  try {
    endpoint = new URL(subscription.endpoint)
  } catch {
    throw new Error('订阅地址无效')
  }
  if (endpoint.protocol !== 'https:') {
    throw new Error('订阅地址必须为 HTTPS')
  }
  if (subscription.endpoint.length > 1000) {
    throw new Error('订阅地址过长')
  }

  const db = getDB()
  if (!Array.isArray(db.push_subscriptions)) db.push_subscriptions = []

  const record = {
    id: nextId('push_subscriptions'),
    user_id: Number(userId),
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    },
    user_agent: String(userAgent || '').slice(0, 200),
    created_at: new Date().toISOString()
  }

  const index = db.push_subscriptions.findIndex(
    item => item.user_id === record.user_id && item.endpoint === record.endpoint
  )
  if (index >= 0) {
    record.id = db.push_subscriptions[index].id
    db.push_subscriptions[index] = record
  } else {
    db.push_subscriptions.push(record)
  }

  saveDB()
  return record
}

export function removeSubscription(userId, endpoint) {
  const db = getDB()
  if (!Array.isArray(db.push_subscriptions)) return
  db.push_subscriptions = db.push_subscriptions.filter(
    item => !(item.user_id === Number(userId) && item.endpoint === endpoint)
  )
  saveDB()
}

export function subscriptionCount(userId) {
  return (getDB().push_subscriptions || []).filter(item => item.user_id === userId).length
}

export async function pushToUser(userId, payload) {
  if (!ensureConfigured()) return { sent: 0, total: 0 }

  const db = getDB()
  const list = (db.push_subscriptions || []).filter(item => item.user_id === Number(userId))
  if (!list.length) return { sent: 0, total: 0 }

  const body = JSON.stringify({
    title: payload.title || '极光实验室',
    body: payload.content || '',
    url: payload.link || '/',
    tag: payload.tag || `lab-${Date.now()}`
  })

  let sent = 0
  const invalid = []

  await Promise.all(
    list.map(async item => {
      try {
        await webpush.sendNotification(
          { endpoint: item.endpoint, keys: item.keys },
          body,
          { TTL: 3600 }
        )
        sent += 1
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          invalid.push(item.endpoint)
        }
      }
    })
  )

  if (invalid.length) {
    db.push_subscriptions = (db.push_subscriptions || []).filter(
      item => !invalid.includes(item.endpoint)
    )
    saveDB()
  }

  return { sent, total: list.length }
}
