import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../auth.js'
import { isOssConfigured, uploadImage } from '../oss.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads')
const MAX_UPLOAD_FILES = Math.max(50, Number(process.env.UPLOAD_MAX_FILES) || 500)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!String(file.mimetype).startsWith('image/')) {
      cb(new Error('只支持上传图片文件'))
      return
    }
    cb(null, true)
  }
})

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })

function extOf(filename, mime) {
  const ext = path.extname(String(filename || '')).toLowerCase()
  if (/^\.(jpg|jpeg|png|webp|gif)$/.test(ext)) return ext
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  return '.jpg'
}

// 通过文件头识别真实图片类型，避免仅伪造 Content-Type 上传非图片内容
function sniffImage(buffer = Buffer.alloc(0)) {
  if (buffer.length < 12) return ''
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  const head6 = buffer.subarray(0, 6).toString('ascii')
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif'
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return ''
}

router.post('/uploads', requireAuth(), (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (error) {
      const message =
        error.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 5MB' : error.message || '上传失败'
      return res.json({ code: 400, message, data: null })
    }
    next()
  })
}, async (req, res) => {
  if (!req.file) {
    return res.json({ code: 400, message: '请选择要上传的图片', data: null })
  }

  const realMime = sniffImage(req.file.buffer)
  if (!realMime) {
    return res.json({ code: 400, message: '文件内容不是有效的图片', data: null })
  }

  try {
    if (isOssConfigured()) {
      const result = await uploadImage({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mime: realMime
      })
      return ok(
        res,
        {
          url: result.url,
          key: result.key,
          storage: 'oss',
          size: req.file.size,
          mime: realMime
        },
        '图片已上传到 OSS'
      )
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })

    // 本地回退存储没有对象存储的生命周期策略，这里限制文件总数，避免磁盘被持续写满
    if (fs.readdirSync(UPLOAD_DIR).length >= MAX_UPLOAD_FILES) {
      return res.json({
        code: 400,
        message: `本地图片已达 ${MAX_UPLOAD_FILES} 个上限，请联系管理员清理或配置 OSS`,
        data: null
      })
    }

    const filename = `${crypto.randomUUID()}${extOf(req.file.originalname, realMime)}`
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer)

    ok(
      res,
      {
        url: `/uploads/${filename}`,
        key: filename,
        storage: 'local',
        size: req.file.size,
        mime: realMime
      },
      '图片已保存到本地'
    )
  } catch (error) {
    console.error('[upload error]', error)
    res.json({ code: 500, message: `上传失败：${error.message}`, data: null })
  }
})

export default router
