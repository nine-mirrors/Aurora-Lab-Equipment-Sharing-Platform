<!-- 登录页：极光动态品牌区 + 分步入场 + 登录成功过场 -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataLine, Lock, User } from '@element-plus/icons-vue'
import { login } from '@/api/user'
import { useUserStore } from '@/stores/useUserStore'
import BrandMark from '@/components/common/BrandMark.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import ParticleField from '@/components/common/ParticleField.vue'

const REMEMBER_KEY = 'lab_remember_account'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)
const remember = ref(true)
const success = ref(false)
const successName = ref('')

const parallax = reactive({ x: 0, y: 0 })

const form = reactive({
  account: '',
  password: ''
})

const rules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const demoAccounts = [
  { label: '学生演示', account: 'student', password: '123456', desc: '预约设备与查看申请', icon: 'User' },
  { label: '管理员演示', account: 'admin', password: '123456', desc: '审核申请与设备管理', icon: 'Setting' }
]

const features = [
  { title: '库存实时可见', text: '设备余量、分类与状态一屏掌握' },
  { title: '借用归还闭环', text: '申请、审批、归还全流程线上留痕' },
  { title: '数据驱动调度', text: '借用趋势与利用率看板辅助决策' }
]

const stats = [
  { value: '88', label: '台在册设备' },
  { value: '14', label: '类实验仪器' },
  { value: '160', label: '条借用记录' }
]

const brandStyle = computed(() => ({
  transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`
}))

const inverseStyle = computed(() => ({
  transform: `translate3d(${-parallax.x * 0.6}px, ${-parallax.y * 0.6}px, 0)`
}))

let redirectTimer = null

function onMouseMove(event) {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  parallax.x = ((event.clientX - cx) / cx) * 14
  parallax.y = ((event.clientY - cy) / cy) * 12
}

function onMouseLeave() {
  parallax.x = 0
  parallax.y = 0
}

function fillDemo(item) {
  form.account = item.account
  form.password = item.password
  ElMessage.success(`已填入${item.label}账号`)
}

async function handleLogin() {
  if (loading.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await login(form)

    if (res.code !== 200) {
      ElMessage.error(res.message || '登录失败，请检查账号密码')
      return
    }

    userStore.setUser({
      token: res.data.token,
      role: res.data.user.role,
      userInfo: res.data.user
    })

    if (remember.value) {
      localStorage.setItem(REMEMBER_KEY, form.account)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }

    successName.value = res.data.user.name || res.data.user.account
    success.value = true

    const fallback = res.data.user.role === 'admin' ? '/admin/dashboard' : '/homePage'
    const target = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : fallback

    redirectTimer = setTimeout(() => {
      router.replace(target)
    }, 980)
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY)
  if (saved) form.account = saved
})

onBeforeUnmount(() => clearTimeout(redirectTimer))
</script>

<template>
  <div
    class="login-page"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- 左侧品牌区 -->
    <section class="visual">
      <div class="visual-aurora" :style="brandStyle">
        <span class="blob blob-a"></span>
        <span class="blob blob-b"></span>
        <span class="blob blob-c"></span>
      </div>
      <div class="visual-grid"></div>
      <div class="visual-noise"></div>
      <ParticleField :density="54" class="visual-particles" />

      <div class="visual-content">
        <div class="visual-brand">
          <BrandMark :size="36" :mono="true" />
          <span>极光 · 实验室设备共享平台</span>
          <span class="version-tag">v2.1</span>
        </div>

        <h1 class="visual-title">
          <span class="line"><i>让每一台实验设备</i></span>
          <span class="line"><i>都被看见、<em>用起来</em></i></span>
        </h1>

        <p class="visual-desc">
          面向高校实验室的设备共享平台，把设备档案、借用审批与使用数据放在同一个工作台里。
        </p>

        <ul class="feature-list">
          <li v-for="(item, index) in features" :key="item.title" :style="{ animationDelay: `${0.42 + index * 0.1}s` }">
            <span class="feature-icon">
              <el-icon><DataLine /></el-icon>
            </span>
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.text }}</small>
            </div>
          </li>
        </ul>

        <div class="visual-stats">
          <div v-for="item in stats" :key="item.label">
            <b>{{ item.value }}</b>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>

      <div class="float-card card-a" :style="inverseStyle">
        <span class="float-dot"></span>
        <div>
          <strong>设备可借余量</strong>
          <small>电子测量 · 光学仪器 · 3D 打印</small>
        </div>
        <b>489</b>
      </div>

      <div class="float-card card-b" :style="inverseStyle">
        <span class="float-ring"></span>
        <div>
          <strong>待审核申请</strong>
          <small>审核通过后生成 6 位取件码</small>
        </div>
        <b>11</b>
      </div>

      <div class="visual-footer">
        <span class="signal"><i></i>校园网统一身份认证</span>
        <span class="dot-sep"></span>
        <span>数据传输全程加密</span>
      </div>
    </section>

    <!-- 右侧表单区 -->
    <section class="form-side">
      <div class="form-topbar">
        <span class="service-state">
          <i></i>
          系统运行正常
        </span>
        <ThemeToggle />
      </div>

      <div class="form-wrap">
        <div class="form-head">
          <span class="eyebrow">WELCOME BACK</span>
          <h2>欢迎回来</h2>
          <p>登录后即可预约设备、查看借用进度</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item label="账号" prop="account">
            <el-input
              v-model="form.account"
              size="large"
              placeholder="请输入学号或管理员账号"
              :prefix-icon="User"
              autocomplete="username"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              show-password
              placeholder="请输入登录密码"
              :prefix-icon="Lock"
              autocomplete="current-password"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <div class="form-options">
            <el-checkbox v-model="remember">记住账号</el-checkbox>
            <router-link to="/forgetPassword" class="forgot">忘记密码？</router-link>
          </div>

          <button type="button" class="login-btn" :class="{ loading }" :disabled="loading" @click="handleLogin">
            <span v-if="!loading" class="btn-text">
              登 录
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span v-else class="btn-loading">
              <i class="btn-spinner"></i>
              正在验证身份…
            </span>
            <i class="btn-shine"></i>
          </button>
        </el-form>

        <div class="demo-box">
          <div class="demo-title">
            <span>演示账号 · 点击直接填入</span>
            <span class="demo-line"></span>
          </div>
          <div class="demo-list">
            <button
              v-for="item in demoAccounts"
              :key="item.account"
              type="button"
              class="demo-item"
              @click="fillDemo(item)"
            >
              <span class="demo-icon">
                <el-icon><component :is="item.icon" /></el-icon>
              </span>
              <span class="demo-copy">
                <strong>{{ item.label }}</strong>
                <span>{{ item.account }} / {{ item.password }}</span>
                <small>{{ item.desc }}</small>
              </span>
              <el-icon class="demo-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </div>

        <p class="register-link">
          还没有账号？
          <router-link to="/register">立即注册</router-link>
        </p>
      </div>

      <div class="form-footer">
        <span>© {{ new Date().getFullYear() }} AURORA LAB</span>
        <span class="foot-links">
          <a href="#help">帮助</a>
          <a href="#privacy">隐私</a>
          <a href="#status">状态</a>
        </span>
      </div>
    </section>

    <!-- 登录成功过场 -->
    <Transition name="success">
      <div v-if="success" class="success-overlay">
        <span class="success-ripple r1"></span>
        <span class="success-ripple r2"></span>
        <span class="success-ripple r3"></span>
        <div class="success-card">
          <span class="success-check">
            <svg viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="24" stroke="currentColor" stroke-width="2" opacity="0.25" />
              <path d="M15 27l7.5 7.5L38 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="tick" />
            </svg>
          </span>
          <strong>欢迎回来，{{ successName }}</strong>
          <small>正在为你加载工作台…</small>
          <span class="success-loader"><i></i></span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped src="./Login.css"></style>
