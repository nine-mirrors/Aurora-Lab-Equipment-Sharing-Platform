import { Router } from 'express'
import { getDB, saveDB, nextId } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

router.get('/favorites', requireAuth(), (req, res) => {
  const db = getDB()
  const favorites = (db.favorites || []).filter(item => item.user_id === req.user.id)
  const ids = favorites.map(item => Number(item.device_id))
  const list = (db.devices || [])
    .filter(item => ids.includes(item.id))
    .map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      image: item.image || '',
      available_qty: item.available_qty,
      total_qty: item.total_qty,
      is_active: item.is_active
    }))

  ok(res, { ids, list, total: ids.length })
})

router.post('/favorites/:deviceId', requireAuth(), (req, res) => {
  const db = getDB()
  const deviceId = Number(req.params.deviceId)
  const device = db.devices.find(item => item.id === deviceId)
  if (!device) return fail(res, '设备不存在', 404)

  if (!Array.isArray(db.favorites)) db.favorites = []
  const exists = db.favorites.some(
    item => item.user_id === req.user.id && Number(item.device_id) === deviceId
  )
  if (exists) return ok(res, { device_id: deviceId }, '已收藏该设备')

  db.favorites.push({
    id: nextId('favorites'),
    user_id: req.user.id,
    device_id: deviceId,
    device_name: device.name,
    created_at: new Date().toISOString()
  })
  saveDB()
  ok(res, { device_id: deviceId }, '已收藏该设备')
})

router.delete('/favorites/:deviceId', requireAuth(), (req, res) => {
  const db = getDB()
  const deviceId = Number(req.params.deviceId)
  const before = (db.favorites || []).length

  db.favorites = (db.favorites || []).filter(
    item => !(item.user_id === req.user.id && Number(item.device_id) === deviceId)
  )

  if (db.favorites.length !== before) saveDB()
  ok(res, { device_id: deviceId }, '已取消收藏')
})

export default router
