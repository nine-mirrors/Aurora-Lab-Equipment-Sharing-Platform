import { expect, test } from '@playwright/test'

async function login(page, account, password = '123456') {
  await page.goto('/login')
  await page.getByPlaceholder('请输入学号或管理员账号').fill(account)
  await page.getByPlaceholder('请输入登录密码').fill(password)
  await page.locator('button.login-btn').click()
}

test('学生登录后能进入看板并看到全部申请状态分栏', async ({ page }) => {
  await login(page, 'student')
  await expect(page).toHaveURL(/\/homePage/, { timeout: 10000 })
  await expect(page.getByText('数据看板', { exact: false }).first()).toBeVisible()

  await page.goto('/applyRecord')
  await expect(page.getByRole('heading', { name: '我的申请' })).toBeVisible()

  for (const label of ['待审核', '在借', '归还中', '已归还', '已拒绝', '已取消']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  }
})

test('管理员能进入申请管理并处理续借审核视图', async ({ page }) => {
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 })

  await page.goto('/admin/apply')
  await expect(page.getByRole('heading', { name: '申请管理' })).toBeVisible()

  const extensionTab = page.locator('button.tab-chip').filter({ hasText: '续借审核' })
  await expect(extensionTab).toBeVisible()
  await extensionTab.click()

  await expect(page.getByText('续借待审').first()).toBeVisible()
  await expect(page.getByText('陈子涵').first()).toBeVisible()
})

test('管理员能在基础数据中发布并删除公告、查看系统设置', async ({ page }) => {
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 })

  await page.goto('/admin/baseData')
  await expect(page.getByText('平台公告', { exact: false }).first()).toBeVisible()

  await page.getByRole('button', { name: '发布公告' }).click()
  await page.getByPlaceholder('例如：实验室安全检查通知').fill('E2E 测试公告')
  await page.getByPlaceholder('填写公告正文').fill('用于验证基础数据页面')
  await page.getByRole('button', { name: '保存' }).click()

  const createdRow = page.locator('.el-table__row').filter({ hasText: 'E2E 测试公告' })
  await expect(createdRow).toBeVisible()

  await createdRow.getByRole('button', { name: '删除' }).click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.locator('.el-table__row').filter({ hasText: 'E2E 测试公告' })).toHaveCount(0)

  await page.locator('button.tab-chip').filter({ hasText: '系统设置' }).click()
  await expect(page.getByText('max_borrow_days').first()).toBeVisible()
})

test('错误密码会显示明确提示且不进入后台', async ({ page }) => {
  await login(page, 'admin', 'wrong-password')
  await expect(page.getByText('账号或密码不正确').first()).toBeVisible({ timeout: 10000 })
  await expect(page).not.toHaveURL(/\/admin\/dashboard/)
})
