<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUiStore } from '@/stores/Ui'
import { useUserStore } from '@/stores/useUserStore'
import { useNotificationStore } from '@/stores/Notification'
import {
  getPushConfig,
  sendTestPush,
  subscribePush,
  unsubscribePush
} from '@/api/push'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatRelativeTime as relative } from '@/utils/date'

const router = useRouter()
const ui = useUiStore()
const userStore = useUserStore()
const store = useNotificationStore()

const pushSupported = ref(false)
const pushConfigured = ref(false)
const pushSubscribed = ref(false)
const pushBusy = ref(false)
const pushPermission = ref('default')

const tab = ref('all')

const typeMeta = {
  system: { icon: 'Cpu', tone: 'primary' },
  notice: { icon: 'Bell', tone: 'amber' },
  success: { icon: 'CircleCheck', tone: 'green' },
  warn: { icon: 'Warning', tone: 'amber' },
  info: { icon: 'InfoFilled', tone: 'primary' }
}

const list = computed(() => {
  if (tab.value === 'unread') return store.list.filter(item => !item.read)
  return store.list
})

function meta(type) {
  return typeMeta[type] || typeMeta.info
}

function close() {
  ui.closeNotifications()
}

function openItem(item) {
  store.markRead(item.id)
  if (item.link) {
    close()
    router.push(item.link)
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

async function setupPush() {
  pushSupported.value =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!pushSupported.value) return
  if (!userStore.token) return

  try {
    await navigator.serviceWorker.register('/sw.js')
    pushPermission.value = Notification.permission

    const res = await getPushConfig()
    if (res.code !== 200) return

    pushConfigured.value = Boolean(res.data?.configured)
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    pushSubscribed.value = Boolean(existing) || Number(res.data?.subscriptions) > 0

    // 浏览器已有订阅但服务端没有记录时，自动补同步
    if (existing && !Number(res.data?.subscriptions)) {
      await subscribePush(existing.toJSON())
    }
  } catch {
    pushConfigured.value = false
  }
}

async function enablePush() {
  if (pushBusy.value) return
  pushBusy.value = true

  try {
    const permission = await Notification.requestPermission()
    pushPermission.value = permission
    if (permission !== 'granted') {
      ElMessage.warning('浏览器通知权限未开启')
      return
    }

    const cfg = await getPushConfig()
    if (cfg.code !== 200 || !cfg.data?.publicKey) {
      ElMessage.error('Web Push 服务未配置')
      return
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.data.publicKey)
      })
    }

    const res = await subscribePush(subscription.toJSON())
    if (res.code !== 200) {
      ElMessage.error(res.message || '订阅失败')
      return
    }

    pushSubscribed.value = true
    ElMessage.success('浏览器通知已开启')
  } catch (error) {
    ElMessage.error(error?.message || '开启浏览器通知失败')
  } finally {
    pushBusy.value = false
  }
}

async function disablePush() {
  if (pushBusy.value) return
  pushBusy.value = true

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await unsubscribePush(subscription.endpoint)
      await subscription.unsubscribe()
    }
    pushSubscribed.value = false
    ElMessage.success('浏览器通知已关闭')
  } catch {
    ElMessage.error('关闭浏览器通知失败')
  } finally {
    pushBusy.value = false
  }
}

async function testPush() {
  try {
    const res = await sendTestPush()
    if (res.code !== 200) {
      ElMessage.error(res.message || '发送失败')
      return
    }
    ElMessage.success(res.data?.sent ? '测试通知已发送' : '当前浏览器没有有效订阅')
  } catch {
    ElMessage.error('测试通知发送失败')
  }
}

onMounted(setupPush)

watch(
  () => userStore.token,
  token => {
    if (token) setupPush()
  }
)
</script>

<template>
  <Teleport to="body">
    <transition name="notice">
      <div v-if="ui.notificationsOpen" class="notice-root">
        <div class="notice-backdrop" @click="close"></div>

        <aside class="notice-panel">
          <header class="notice-head">
            <div>
              <h3>通知中心</h3>
              <p>{{ store.unreadCount }} 条未读 · 平台动态与系统提醒</p>
            </div>
            <button class="icon-btn" title="关闭" @click="close">
              <el-icon><Close /></el-icon>
            </button>
          </header>

          <div class="notice-tabs">
            <button
              type="button"
              class="notice-tab"
              :class="{ active: tab === 'all' }"
              @click="tab = 'all'"
            >
              全部
              <span>{{ store.list.length }}</span>
            </button>
            <button
              type="button"
              class="notice-tab"
              :class="{ active: tab === 'unread' }"
              @click="tab = 'unread'"
            >
              未读
              <span>{{ store.unreadCount }}</span>
            </button>
            <button
              v-if="store.unreadCount"
              type="button"
              class="mark-all"
              @click="store.markAllRead()"
            >
              全部已读
            </button>
          </div>

          <div v-if="pushSupported && pushConfigured" class="push-card">
            <div class="push-copy">
              <strong>浏览器通知</strong>
              <small v-if="pushSubscribed">已开启，重要提醒会直接弹窗</small>
              <small v-else-if="pushPermission === 'denied'">
                权限已被浏览器拒绝，请在站点设置中重新允许
              </small>
              <small v-else>开启后，审批、逾期与报修提醒会推送到桌面</small>
            </div>
            <div class="push-actions">
              <template v-if="pushSubscribed">
                <el-button size="small" @click="testPush">测试</el-button>
                <el-button size="small" text :loading="pushBusy" @click="disablePush">关闭</el-button>
              </template>
              <el-button
                v-else
                size="small"
                type="primary"
                :disabled="pushPermission === 'denied'"
                :loading="pushBusy"
                @click="enablePush"
              >
                开启
              </el-button>
            </div>
          </div>

          <div class="notice-list">
            <TransitionGroup v-if="list.length" name="list">
              <article
                v-for="item in list"
                :key="item.id"
                class="notice-item"
                :class="[{ unread: !item.read }, `tone-${meta(item.type).tone}`]"
                @click="openItem(item)"
              >
                <span class="notice-icon">
                  <el-icon><component :is="meta(item.type).icon" /></el-icon>
                </span>
                <div class="notice-body">
                  <div class="notice-title-row">
                    <strong>{{ item.title }}</strong>
                    <i v-if="!item.read" class="unread-dot"></i>
                  </div>
                  <p>{{ item.content }}</p>
                  <span class="notice-time">{{ relative(item.time) }}</span>
                </div>
              </article>
            </TransitionGroup>

            <EmptyState
              v-else
              compact
              :title="tab === 'unread' ? '没有未读通知' : '暂时没有通知'"
              :description="tab === 'unread' ? '所有消息都已阅读完毕' : '平台动态会在这里实时提醒你'"
            />
          </div>

          <footer class="notice-foot">
            <span class="status-dot">消息实时同步</span>
            <button v-if="store.list.length" class="clear-btn" @click="store.clear()">清空全部</button>
          </footer>
        </aside>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.notice-root {
  position: fixed;
  inset: 0;
  z-index: 3400;
}

.notice-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(6, 11, 24, 0.4);
  backdrop-filter: blur(4px);
}

.notice-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(392px, 92vw);
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  animation: notice-in 0.34s var(--ease-out) both;
}

@keyframes notice-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.notice-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 24px 22px 16px;
}

.notice-head h3 {
  margin: 0 0 2px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-1);
}

.notice-head p {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
}

.icon-btn {
  width: 40px;
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-3);
  cursor: pointer;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease,
    border-color var(--dur-fast) ease, transform var(--dur-press) ease;
}

.icon-btn:hover {
  color: var(--text-1);
  background: var(--bg-subtle);
}

.icon-btn:active {
  transform: scale(0.94);
}

.notice-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 22px 12px;
  border-bottom: 1px solid var(--border-soft);
}

.notice-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-3);
  font-size: 12.5px;
  cursor: pointer;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease,
    transform var(--dur-press) ease;
}

.notice-tab:active {
  transform: scale(0.96);
}

.notice-tab span {
  font-size: 10.5px;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-1) 7%, transparent);
}

.notice-tab:hover {
  color: var(--primary);
}

.notice-tab.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}

.mark-all {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
}

.mark-all:hover {
  text-decoration: underline;
}

.push-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 22px 0;
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--primary-soft);
  border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
}

.push-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.push-copy strong {
  font-size: 12px;
  color: var(--text-1);
}

.push-copy small {
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-3);
}

.push-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.notice-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notice-item {
  display: flex;
  gap: 12px;
  padding: 13px 12px;
  border-radius: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color var(--dur-fast) ease, border-color var(--dur-fast) ease;
}

.notice-item:hover {
  background: var(--bg-subtle);
}

.notice-item.unread {
  background: color-mix(in srgb, var(--tone) 5%, transparent);
  border-color: color-mix(in srgb, var(--tone) 14%, transparent);
}

.notice-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  font-size: 16px;
  color: var(--tone);
  background: var(--tone-soft);
}

.notice-body {
  flex: 1;
  min-width: 0;
}

.notice-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.notice-title-row strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--tone);
  flex: none;
  animation: pulse-dot 2.4s ease-in-out infinite;
}

.notice-body p {
  margin: 3px 0 5px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-2);
}

.notice-time {
  font-size: 10.5px;
  color: var(--text-3);
}

.notice-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  border-top: 1px solid var(--border-soft);
  background: var(--bg-subtle);
}

.clear-btn {
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--text-3);
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--red);
}

.tone-primary { --tone: var(--primary); --tone-soft: var(--primary-soft); }
.tone-green { --tone: var(--green); --tone-soft: var(--green-soft); }
.tone-amber { --tone: var(--amber); --tone-soft: var(--amber-soft); }

.list-enter-active,
.list-leave-active {
  transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out);
}

.list-move {
  transition: transform var(--dur) var(--ease-out);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(14px);
}

.notice-enter-active,
.notice-leave-active {
  transition: opacity var(--dur-quick) ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
}
</style>
