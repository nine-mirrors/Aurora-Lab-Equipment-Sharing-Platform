<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { register, sendEmailCode } from '@/api/user'
import { useUserStore } from '@/stores/useUserStore'
import AuthShell from './AuthShell.vue'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)
const sending = ref(false)
const countdown = ref(0)
let timer = null

const form = reactive({
  account: '',
  name: '',
  email: '',
  code: '',
  password: '',
  confirmPassword: ''
})

const validateConfirm = (rule, value, callback) => {
  if (value !== form.password) return callback(new Error('两次输入的密码不一致'))
  callback()
}

const rules = {
  account: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入邮箱验证码', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

const strength = computed(() => {
  const value = form.password
  if (!value) return 0
  let score = 0
  if (value.length >= 6) score += 1
  if (value.length >= 10) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return Math.min(4, score)
})

const strengthMeta = computed(() => {
  const map = [
    { label: '请输入密码', color: 'var(--border-strong)' },
    { label: '强度较弱', color: 'var(--red)' },
    { label: '强度一般', color: 'var(--amber)' },
    { label: '强度良好', color: 'var(--primary)' },
    { label: '强度很高', color: 'var(--green)' }
  ]
  return map[strength.value] || map[0]
})

async function handleSendCode() {
  if (sending.value || countdown.value > 0) return
  if (!form.email) {
    ElMessage.warning('请先填写邮箱')
    return
  }

  sending.value = true
  try {
    const res = await sendEmailCode(form.email)
    if (res.code !== 200) {
      ElMessage.error(res.message || '验证码发送失败')
      return
    }

    const devCode = res.data?.devCode
    ElMessage.success(
      devCode
        ? `本次验证码：${devCode}（仅本机演示环境返回）`
        : '验证码已发送，请查收邮箱（含垃圾邮件箱）'
    )
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch {
    ElMessage.error('验证码发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

async function handleRegister() {
  if (loading.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await register({
      account: form.account,
      name: form.name,
      email: form.email,
      password: form.password,
      email_code: form.code
    })

    if (res.code !== 200) {
      ElMessage.error(res.message || '注册失败')
      return
    }

    userStore.setUser({
      token: res.data.token,
      role: res.data.user.role,
      userInfo: res.data.user
    })

    ElMessage.success('注册成功，已为你自动登录')
    router.replace('/homePage')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '注册失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <AuthShell
    eyebrow="CREATE ACCOUNT"
    title="创建账号"
    subtitle="注册后即可预约实验室设备，全程线上留痕"
    back-text="返回登录"
    width="620px"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleRegister">
      <div class="form-grid">
        <el-form-item label="学号 / 账号" prop="account">
          <el-input v-model="form.account" size="large" placeholder="例如 2023009" />
        </el-form-item>

        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" size="large" placeholder="请输入真实姓名" />
        </el-form-item>
      </div>

      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" size="large" placeholder="用于接收验证码" />
      </el-form-item>

      <el-form-item label="邮箱验证码" prop="code">
        <div class="code-row">
          <el-input v-model="form.code" size="large" maxlength="6" placeholder="6 位验证码" />
          <button
            type="button"
            class="code-btn"
            :disabled="sending || countdown > 0"
            @click="handleSendCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码' }}
          </button>
        </div>
      </el-form-item>

      <div class="form-grid">
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" size="large" show-password placeholder="至少 6 位" />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" size="large" show-password placeholder="再次输入密码" />
        </el-form-item>
      </div>

      <div class="strength">
        <div class="strength-bars">
          <i
            v-for="i in 4"
            :key="i"
            :style="{
              background: i <= strength ? strengthMeta.color : 'var(--border)',
              boxShadow: i <= strength ? `0 0 8px ${strengthMeta.color}` : 'none'
            }"
          ></i>
        </div>
        <span :style="{ color: strengthMeta.color }">{{ strengthMeta.label }}</span>
      </div>

      <button type="button" class="submit-btn" :disabled="loading" @click="handleRegister">
        <span v-if="!loading" class="btn-text">
          注册并登录
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span v-else class="btn-loading"><i class="btn-spinner"></i>正在创建账号…</span>
        <i class="btn-shine"></i>
      </button>
    </el-form>

    <div class="notice">
      <el-icon><InfoFilled /></el-icon>
      <span>验证码 10 分钟内有效；未配置 SMTP 时验证码仅输出到服务端控制台。</span>
    </div>

    <template #footer>
      <span>已经有账号？</span>
      <router-link to="/login" class="footer-link">直接登录</router-link>
    </template>
  </AuthShell>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.code-row {
  display: flex;
  gap: 9px;
  width: 100%;
}

.code-row .el-input {
  flex: 1;
}

.code-btn {
  flex: none;
  height: 44px;
  padding: 0 16px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--dur-fast) ease;
  white-space: nowrap;
}

.code-btn:hover:not(:disabled) {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 34%, var(--border));
  background: var(--primary-soft);
}

.code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -8px 0 18px;
  font-size: 11.5px;
}

.strength-bars {
  flex: 1;
  display: flex;
  gap: 5px;
}

.strength-bars i {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  transition: background-color var(--dur) ease, box-shadow var(--dur) ease;
}

.submit-btn {
  position: relative;
  width: 100%;
  height: 46px;
  margin-top: 2px;
  border: none;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--gradient-primary);
  box-shadow: 0 14px 30px -14px var(--primary-glow);
  transition: transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out), filter var(--dur) ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 20px 38px -14px var(--primary-glow);
  filter: brightness(1.05);
}

.btn-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  letter-spacing: 0.04em;
}

.btn-spinner {
  width: 15px;
  height: 15px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

.btn-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 60px;
  left: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: translateX(-130%) skewX(-18deg);
  pointer-events: none;
}

.submit-btn:hover .btn-shine {
  animation: shine 1.1s var(--ease-out);
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--primary-soft);
  color: var(--text-2);
  font-size: 11.5px;
  line-height: 1.65;
}

.notice .el-icon {
  margin-top: 2px;
  color: var(--primary);
  flex: none;
}

.notice b {
  color: var(--primary);
}

.footer-link {
  margin-left: 5px;
  font-weight: 600;
}

@media (max-width: 620px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
