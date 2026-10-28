import OSS from 'ali-oss'
import crypto from 'node:crypto'
import path from 'node:path'

let client = null

function config() {
  return {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    region: process.env.OSS_REGION || '',
    bucket: process.env.OSS_BUCKET || '',
    endpoint: process.env.OSS_ENDPOINT || '',
    publicBaseUrl: process.env.OSS_PUBLIC_BASE_URL || '',
    prefix: (process.env.OSS_PREFIX || 'lab').replace(/^\/+|\/+$/g, '')
  }
}

export function isOssConfigured() {
  const cfg = config()
  return Boolean(cfg.accessKeyId && cfg.accessKeySecret && cfg.region && cfg.bucket)
}

function getClient() {
  if (client) return client
  const cfg = config()
  client = new OSS({
    region: cfg.region,
    bucket: cfg.bucket,
    endpoint: cfg.endpoint || undefined,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret
  })
  return client
}

function safeExt(filename, mime) {
  const ext = path.extname(String(filename || '')).toLowerCase()
  if (/^\.(jpg|jpeg|png|webp|gif)$/.test(ext)) return ext
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  return '.jpg'
}

function publicUrl(key) {
  const cfg = config()
  const base = cfg.publicBaseUrl || `https://${cfg.bucket}.${cfg.endpoint}`
  return `${base.replace(/\/+$/, '')}/${key}`
}

/**
 * 上传图片到 OSS。
 * @returns {Promise<{key:string,url:string}>}
 */
export async function uploadImage({ buffer, filename, mime }) {
  const cfg = config()
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const ext = safeExt(filename, mime)
  const key = `${cfg.prefix}/${now.getFullYear()}/${month}/${crypto.randomUUID()}${ext}`

  await getClient().put(key, buffer, {
    mime,
    headers: {
      'Cache-Control': 'public, max-age=31536000'
    }
  })

  return { key, url: publicUrl(key) }
}
