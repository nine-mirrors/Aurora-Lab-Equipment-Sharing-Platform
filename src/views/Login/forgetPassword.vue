<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { resetPassword, sendResetEmailCode } from '@/api/user'
import AuthShell from './AuthShell.vue'

const router = useRouter()

const formRef = ref(null)
const loading = ref(false)
const sending = ref(false)
const countdown = ref(0)
const done = ref(false)
let timer = null

const form = reactive({
  account: '',
  email: '',
  code: '',
  password: '',
  confirmPassword: ''
})

const rules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入绑定邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.password) return callback(new Error('两次输入的密码不一致'))
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const step = computed(() => (form.account && form.email && form.code ? 2 : 1))

async function handleSendCode() {
  if (sending.value || countdown.value > 0) return
  if (!form.email) {
    ElMessage.warning('请先填写绑定邮箱')
    return
  }

  sending.value = true
  try {
    const res = await sendResetEmailCode(form.email)
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

async function handleReset() {
  if (loading.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await resetPassword({
      account: form.account,
      email: form.email,
      code: form.code,
      password: form.password,
      password_confirmation: form.confirmPassword
    })

    if (res.code !== 200) {
      ElMessage.error(res.message || '重置失败')
      return
    }

    done.value = true
    ElMessage.success('密码已重置，即将返回登录')
    setTimeout(() => router.replace('/login'), 1400)
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '重置失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <AuthShell
    eyebrow="ACCOUNT RECOVERY"
    title="找回密码"
    subtitle="通过绑定邮箱验证身份后重置密码"
    back-text="返回登录"
    width="500px"
  >
    <div class="steps">
      <div class="step" :class="{ active: step >= 1, done: step > 1 }">
        <span class="step-dot">
          <el-icon v-if="step > 1"><Check /></el-icon>
          <b v-else>1</b>
        </span>
        <span class="step-text">验证身份</span>
      </div>
      <i class="step-line" :class="{ on: step > 1 }"></i>
      <div class="step" :class="{ active: step >= 2 }">
        <span class="step-dot"><b>2</b></span>
        <span class="step-text">设置新密码</span>
      </div>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleReset">
      <el-form-item label="账号" prop="account">
        <el-input v-model="form.account" size="large" placeholder="请输入学号或管理员账号" />
      </el-form-item>

      <el-form-item label="绑定邮箱" prop="email">
        <el-input v-model="form.email" size="large" placeholder="请输入注册时使用的邮箱" />
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
        <el-form-item label="新密码" prop="password">
          <el-input v-model="form.password" type="password" size="large" show-password placeholder="至少 6 位" />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" size="large" show-password placeholder="再次输入" />
        </el-form-item>
      </div>

      <button type="button" class="submit-btn" :disabled="loading || done" @click="handleReset">
        <span v-if="done" class="btn-text done">
          <el-icon><Check /></el-icon>
          重置成功
        </span>
        <span v-else-if="!loading" class="btn-text">
          重置密码
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span v-else class="btn-loading"><i class="btn-spinner"></i>正在重置…</span>
        <i class="btn-shine"></i>
      </button>
    </el-form>

    <div class="notice">
      <el-icon><InfoFilled /></el-icon>
      <span>验证码 10 分钟内有效；未配置 SMTP 时验证码仅输出到服务端控制台。若邮箱不可用，请联系实验室管理员。</span>
    </div>

    <template #footer>
      <span>想起密码了？</span>
      <router-link to="/login" class="footer-link">返回登录</router-link>
    </template>
  </AuthShell>
</template>

<style scoped>
.steps {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
}

.step {
  display: flex;
  align-items: center;
  gap: 7px;
}

.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  color: var(--text-3);
  background: var(--bg-muted);
  border: 1px solid var(--border);
  transition: color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out),
    border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
}

.step-dot b {
  font-weight: 700;
}

.step-text {
  font-size: 12px;
  color: var(--text-3);
}

.step.active .step-dot {
  color: #fff;
  background: var(--gradient-aurora);
  border-color: transparent;
  box-shadow: 0 4px 12px -4px var(--primary-glow);
}

.step.active .step-text {
  color: var(--text-1);
  font-weight: 600;
}

.step.done .step-dot {
  background: var(--green);
}

.step-line {
  flex: 1;
  height: 2px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.step-line.on {
  background: linear-gradient(90deg, var(--green), var(--primary));
}

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
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease,
    border-color var(--dur-fast) ease, transform var(--dur-press) ease;
  white-space: nowrap;
}

.code-btn:hover:not(:disabled) {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 34%, var(--border));
  background: var(--primary-soft);
}

.code-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  position: relative;
  width: 100%;
  height: 46px;
  margin-top: 4px;
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

.submit-btn:disabled {
  opacity: 0.8;
}

.btn-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-text.done {
  color: #fff;
}

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
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

@media (max-width: 560px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .code-btn {
    padding: 0 12px;
    font-size: 11.5px;
  }
}
</style>
