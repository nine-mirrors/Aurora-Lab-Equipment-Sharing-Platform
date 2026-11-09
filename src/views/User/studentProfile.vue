<!-- 个人中心：资料、安全评分与偏好设置 -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Aim, Camera, Key, Moon, Sunny, SwitchButton } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/useUserStore'
import { useUiStore } from '@/stores/Ui'
import { useFavoriteStore } from '@/stores/Favorite'
import { changePassword, deleteAccountSimple, updateUserInfo } from '@/api/user'
import { getMyBookings } from '@/api/student/bookings'
import { compressImage } from '@/utils/image'
import { formatDate } from '@/utils/date'

const router = useRouter()
const userStore = useUserStore()
const ui = useUiStore()
const favoriteStore = useFavoriteStore()

const saving = ref(false)
const pwdSaving = ref(false)
const deleteVisible = ref(false)
const deletePassword = ref('')
const deleting = ref(false)
const uploading = ref(false)

const notifyEnabled = ref(localStorage.getItem('lab_notify_enabled') !== '0')
const bookings = ref([])

onMounted(async () => {
  try {
    const res = await getMyBookings({ page: 1, pageSize: 1000 })
    bookings.value = res.data?.list || []
  } catch {
    bookings.value = []
  }
})

const profileForm = reactive({
  name: '',
  email: '',
  phone: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const userInfo = computed(() => userStore.userInfo || {})
const isAdmin = computed(() => userStore.role === 'admin')
const displayName = computed(
  () => userInfo.value.name || userInfo.value.account || '未设置姓名'
)
const avatarText = computed(() => displayName.value.slice(0, 1))
const avatarSrc = computed(() => userInfo.value.avatar || '')
const roleText = computed(() => (isAdmin.value ? '实验室管理员' : '在校学生'))
const joinedAt = computed(() => {
  return formatDate(userInfo.value.created_at)
})

const joinedDays = computed(() => {
  if (!userInfo.value.created_at) return 0
  return Math.max(
    1,
    Math.floor((Date.now() - new Date(userInfo.value.created_at).getTime()) / 86400000)
  )
})

const securityItems = computed(() => [
  { label: '账号已实名', done: Boolean(userInfo.value.name), weight: 20 },
  { label: '已绑定邮箱', done: Boolean(userInfo.value.email), weight: 30 },
  { label: '已绑定手机号', done: Boolean(userInfo.value.phone), weight: 25 },
  { label: '已设置头像', done: Boolean(userInfo.value.avatar), weight: 10 },
  {
    label: userInfo.value.blacklisted ? '账号借用受限' : '账号状态正常',
    done: !userInfo.value.blacklisted,
    weight: 15
  }
])

const securityScore = computed(() =>
  securityItems.value.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0)
)

const scoreTone = computed(() => {
  if (securityScore.value >= 85) return { label: '安全性高', color: 'var(--green)' }
  if (securityScore.value >= 60) return { label: '安全性良好', color: 'var(--primary)' }
  return { label: '建议完善', color: 'var(--amber)' }
})

const creditStats = computed(() => {
  const list = bookings.value
  const today = (() => {
    const now = new Date()
    const pad = num => String(num).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })()

  const overdue = list.filter(
    item =>
      ['approved', 'returning'].includes(item.status) &&
      item.borrow_end &&
      item.borrow_end < today
  ).length
  const rejected = list.filter(item => item.status === 'rejected').length
  const returned = list.filter(item => item.status === 'returned').length
  const reviewed = list.filter(item => Number(item.review_rating) > 0).length

  const fallbackScore = Math.max(
    0,
    Math.min(100, Math.round(92 - overdue * 5 - rejected + Math.min(6, returned / 3)))
  )
  const serverScore = Number(userStore.userInfo?.credit_score)
  const score = Number.isFinite(serverScore) ? Math.max(0, Math.min(100, serverScore)) : fallbackScore

  const label =
    score >= 90 ? '信用优秀' : score >= 80 ? '信用良好' : score >= 60 ? '信用正常' : '需要改善'

  return { overdue, rejected, returned, reviewed, score, label }
})

watch(
  userInfo,
  value => {
    profileForm.name = value?.name || ''
    profileForm.email = value?.email || ''
    profileForm.phone = value?.phone || ''
  },
  { immediate: true }
)

watch(notifyEnabled, value => {
  localStorage.setItem('lab_notify_enabled', value ? '1' : '0')
})

// 关闭注销弹窗时清空密码，避免下次打开残留
watch(deleteVisible, visible => {
  if (!visible) deletePassword.value = ''
})

async function saveProfile() {
  if (!profileForm.name.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
    ElMessage.warning('邮箱格式不正确')
    return
  }
  if (profileForm.phone && !/^1\d{10}$/.test(profileForm.phone)) {
    ElMessage.warning('手机号格式不正确，应为 11 位数字')
    return
  }

  saving.value = true
  try {
    const res = await updateUserInfo({
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone
    })

    if (res.code !== 200) {
      ElMessage.error(res.message || '保存失败')
      return
    }

    userStore.setUser({ user: res.data })
    ElMessage.success('个人资料已保存')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    ElMessage.warning('请填写原密码和新密码')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }

  pwdSaving.value = true
  try {
    const res = await changePassword({
      old_password: passwordForm.oldPassword,
      new_password: passwordForm.newPassword
    })

    if (res.code !== 200) {
      ElMessage.error(res.message || '密码修改失败')
      return
    }

    if (res.data?.token) {
      userStore.setUser({ token: res.data.token })
    }

    ElMessage.success(res.message || '密码修改成功')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '密码修改失败')
  } finally {
    pwdSaving.value = false
  }
}

async function handleDelete() {
  if (!deletePassword.value) {
    ElMessage.warning('请输入当前密码')
    return
  }

  deleting.value = true
  try {
    const res = await deleteAccountSimple(deletePassword.value)

    if (res.code !== 200) {
      ElMessage.error(res.message || '注销失败')
      return
    }

    ElMessage.success('账号已注销')
    userStore.logout()
    router.replace('/login')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '注销失败')
  } finally {
    deleting.value = false
  }
}

async function handleAvatarChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploading.value = true
  try {
    const avatar = await compressImage(file)
    const res = await updateUserInfo({ avatar })

    if (res.code !== 200) {
      ElMessage.error(res.message || '头像上传失败')
      return
    }

    userStore.setUser({ user: res.data })
    ElMessage.success('头像已更新')
  } catch (error) {
    ElMessage.error(error?.message || '头像上传失败，请稍后重试')
  } finally {
    uploading.value = false
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出当前账号吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  localStorage.removeItem('token')
  localStorage.removeItem('user')
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<template>
  <div class="page-shell">
    <div v-if="!isAdmin" class="page-head">
      <div>
        <span class="eyebrow">ACCOUNT CENTER</span>
        <h1>个人中心</h1>
        <p>维护个人资料、登录密码与账号安全</p>
      </div>
    </div>

    <!-- 资料横幅 -->
    <section class="profile-banner fade-up">
      <span class="banner-glow a"></span>
      <span class="banner-glow b"></span>
      <span class="banner-grid"></span>

      <div class="banner-left">
        <div class="avatar-wrap">
          <el-avatar :size="72" class="profile-avatar" :src="avatarSrc || undefined">
            {{ avatarText }}
          </el-avatar>
          <label class="avatar-edit" :class="{ loading: uploading }" title="更换头像">
            <el-icon><Camera /></el-icon>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="handleAvatarChange"
            />
          </label>
        </div>

        <div class="banner-copy">
          <div class="banner-name">
            <h2>{{ displayName }}</h2>
            <span class="role-badge">{{ roleText }}</span>
          </div>
          <p>{{ userInfo.account }} · 加入于 {{ joinedAt }}</p>
          <div class="banner-chips">
            <span class="chip"><el-icon><Star /></el-icon> 收藏 {{ favoriteStore.count }} 台设备</span>
            <span class="chip"><el-icon><Clock /></el-icon> 已陪伴 {{ joinedDays }} 天</span>
            <span class="chip"><el-icon><TrendCharts /></el-icon> {{ creditStats.label }} · {{ creditStats.score }}</span>
          </div>
        </div>
      </div>

      <div class="banner-right">
        <div class="score-ring" :style="{ '--score': `${(securityScore / 100) * 360}deg` }">
          <div class="score-inner">
            <strong>{{ securityScore }}</strong>
            <span>安全评分</span>
          </div>
        </div>
        <div class="score-copy">
          <strong :style="{ color: scoreTone.color }">{{ scoreTone.label }}</strong>
          <span>完善资料可提升账号安全等级</span>
        </div>

        <div class="credit-mini">
          <span>信用分</span>
          <strong>{{ creditStats.score }}</strong>
          <small>{{ creditStats.label }}</small>
        </div>
      </div>
    </section>

    <section v-if="userInfo.blacklisted" class="card blacklist-card">
      <span class="blacklist-icon"><el-icon><WarningFilled /></el-icon></span>
      <div class="blacklist-copy">
        <strong>借用权限已受限</strong>
        <span>
          {{ userInfo.blacklist_reason || '请联系实验室管理员了解详情' }}
          <template v-if="userInfo.blacklisted_at">
            · 限制时间 {{ formatDate(userInfo.blacklisted_at) }}
          </template>
        </span>
        <small>你仍可浏览设备与查看历史记录，但无法提交新的借用或续借申请。</small>
      </div>
    </section>

    <div class="profile-grid">
      <aside class="card profile-card">
        <div class="profile-meta">
          <div class="meta-row">
            <span>邮箱</span>
            <strong>{{ userInfo.email || '未绑定' }}</strong>
          </div>
          <div class="meta-row">
            <span>手机号</span>
            <strong>{{ userInfo.phone || '未填写' }}</strong>
          </div>
          <div class="meta-row">
            <span>账号角色</span>
            <strong>{{ roleText }}</strong>
          </div>
          <div class="meta-row">
            <span>注册时间</span>
            <strong>{{ joinedAt }}</strong>
          </div>
        </div>

        <div class="security-list">
          <span class="security-title">安全项检查</span>
          <div v-for="item in securityItems" :key="item.label" class="security-item" :class="{ done: item.done }">
            <span class="check-dot">
              <el-icon v-if="item.done"><Check /></el-icon>
            </span>
            <span>{{ item.label }}</span>
            <em>{{ item.done ? `+${item.weight}` : '待完善' }}</em>
          </div>
        </div>

        <el-button class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </aside>

      <div class="right-col">
        <section class="card card-pad">
          <div class="card-head">
            <h3>基本资料</h3>
            <span class="muted small">账号与角色由管理员维护</span>
          </div>

          <el-form label-position="top">
            <div class="form-grid">
              <el-form-item label="姓名">
                <el-input v-model="profileForm.name" placeholder="请输入姓名" />
              </el-form-item>

              <el-form-item label="账号">
                <el-input :model-value="userInfo.account" disabled />
              </el-form-item>

              <el-form-item label="邮箱">
                <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
              </el-form-item>

              <el-form-item label="手机号">
                <el-input v-model="profileForm.phone" placeholder="请输入手机号" />
              </el-form-item>
            </div>

            <div class="form-actions">
              <el-button type="primary" :loading="saving" @click="saveProfile">保存修改</el-button>
            </div>
          </el-form>
        </section>

        <section class="card card-pad">
          <div class="card-head">
            <h3>安全设置</h3>
            <span class="muted small">修改密码后需要重新登录其他设备</span>
          </div>

          <el-form label-position="top">
            <div class="form-grid three">
              <el-form-item label="原密码">
                <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
              </el-form-item>

              <el-form-item label="新密码">
                <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="至少 6 位" />
              </el-form-item>

              <el-form-item label="确认新密码">
                <el-input v-model="passwordForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
              </el-form-item>
            </div>

            <div class="form-actions">
              <el-button type="primary" plain :loading="pwdSaving" @click="savePassword">
                <el-icon><Key /></el-icon>
                修改密码
              </el-button>
            </div>
          </el-form>
        </section>

        <section class="card card-pad">
          <div class="card-head">
            <h3>借用概览</h3>
            <span class="muted small">累计 {{ bookings.length }} 条记录</span>
          </div>

          <div class="credit-grid">
            <div class="credit-cell">
              <span>已完成</span>
              <strong>{{ creditStats.returned }}</strong>
            </div>
            <div class="credit-cell">
              <span>已评价</span>
              <strong>{{ creditStats.reviewed }}</strong>
            </div>
            <div class="credit-cell" :class="{ danger: creditStats.overdue }">
              <span>逾期</span>
              <strong>{{ creditStats.overdue }}</strong>
            </div>
            <div class="credit-cell">
              <span>被拒绝</span>
              <strong>{{ creditStats.rejected }}</strong>
            </div>
          </div>

          <p class="credit-tip">
            按时归还、及时评价有助于提升信用分；逾期未还会影响后续借用申请。
          </p>
        </section>

        <section class="card card-pad">
          <div class="card-head">
            <h3>偏好设置</h3>
            <span class="muted small">仅对当前浏览器生效</span>
          </div>

          <div class="pref-row">
            <div class="pref-icon">
              <el-icon><Moon v-if="ui.isDark" /><Sunny v-else /></el-icon>
            </div>
            <div class="pref-copy">
              <strong>界面主题</strong>
              <span>当前为{{ ui.isDark ? '深夜温室' : '森野浅色' }}</span>
            </div>
            <el-button size="small" @click="ui.toggleTheme()">
              切换为{{ ui.isDark ? '浅色' : '深色' }}
            </el-button>
          </div>

          <div class="pref-row">
            <div class="pref-icon">
              <el-icon><Aim /></el-icon>
            </div>
            <div class="pref-copy">
              <strong>项目专属光标</strong>
              <span>跟随光晕，支持悬停 / 文本 / 加载与左右中键状态</span>
            </div>
            <el-switch
              :model-value="ui.cursorEnabled"
              @change="value => ui.setCursorEnabled(value)"
            />
          </div>

          <div class="pref-row">
            <div class="pref-icon">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="pref-copy">
              <strong>消息通知</strong>
              <span>接收审批结果与到期提醒</span>
            </div>
            <el-switch v-model="notifyEnabled" aria-label="开启审批结果与到期提醒" />
          </div>
        </section>

        <section v-if="!isAdmin" class="card card-pad danger-card">
          <div class="card-head">
            <h3>账号注销</h3>
            <span class="muted small">注销后账号与借用记录将不可恢复</span>
          </div>
          <p class="danger-text">
            如果确认不再使用平台，可在验证当前密码后注销账号。仍有未归还设备时无法注销。
          </p>
          <el-button type="danger" plain @click="deleteVisible = true">注销账号</el-button>
        </section>
      </div>
    </div>

    <el-dialog v-model="deleteVisible" title="确认注销账号" width="420px">
      <p class="dialog-text">此操作不可恢复，请输入当前登录密码以确认身份。</p>
      <el-input v-model="deletePassword" type="password" show-password placeholder="请输入当前密码" />
      <template #footer>
        <el-button @click="deleteVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="handleDelete">确认注销</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped src="./studentProfile.css"></style>
