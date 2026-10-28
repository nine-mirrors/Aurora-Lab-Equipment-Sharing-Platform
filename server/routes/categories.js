import { Router } from 'express'
import { getDB, saveDB, nextId } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

const ok = (res, data = null, message = '操作成功') =>
  res.json({ code: 200, message, data })
const fail = (res, message, code = 400) =>
  res.json({ code, message, data: null })

router.get('/categories', requireAuth(), (req, res) => {
  const db = getDB()
  let list = [...db.categories]

  if (req.query.is_active !== undefined && req.query.is_active !== '') {
    const active = String(req.query.is_active) === 'true' || String(req.query.is_active) === '1'
    list = list.filter(item => Boolean(item.is_active) === active)
  }

  list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  ok(res, { list })
})

router.post('/admin/categories', requireAuth(['admin']), (req, res) => {
  const { name, code, description, sort_order, is_active } = req.body || {}
  if (!name) return fail(res, '分类名称不能为空')

  const db = getDB()
  if (db.categories.some(item => item.name === String(name).trim())) {
    return fail(res, '该分类已存在', 409)
  }

  const category = {
    id: nextId('categories'),
    name: String(name).trim(),
    code: code || `C${Date.now().toString().slice(-5)}`,
    description: description || '',
    sort_order: Number(sort_order) || db.categories.length + 1,
    is_active: is_active === undefined ? true : Boolean(is_active),
    created_at: new Date().toISOString()
  }

  db.categories.push(category)
  saveDB()
  ok(res, category, '分类创建成功')
})

router.put('/admin/categories/:id', requireAuth(['admin']), (req, res) => {
  const category = getDB().categories.find(item => item.id === Number(req.params.id))
  if (!category) return fail(res, '分类不存在', 404)

  const { name, description, sort_order, is_active } = req.body || {}
  if (name) category.name = String(name).trim()
  if (description !== undefined) category.description = description
  if (sort_order !== undefined) category.sort_order = Number(sort_order)
  if (is_active !== undefined) category.is_active = Boolean(is_active)

  saveDB()
  ok(res, category, '分类已更新')
})

router.delete('/admin/categories/:id', requireAuth(['admin']), (req, res) => {
  const db = getDB()
  const target = db.categories.find(item => item.id === Number(req.params.id))
  if (!target) return fail(res, '分类不存在', 404)

  if (db.devices.some(item => item.category === target.name)) {
    return fail(res, '该分类下仍有设备，无法删除')
  }

  db.categories = db.categories.filter(item => item.id !== target.id)
  saveDB()
  ok(res, null, '分类已删除')
})

export default router
