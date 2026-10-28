<!-- 极光 AI 助手：悬浮球 + 抽屉式对话 -->
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAiStore } from '@/stores/useAiStore'
import { ArrowRight, Close, CopyDocument, Promotion, Refresh, RefreshRight, Setting } from '@element-plus/icons-vue'

const ai = useAiStore()
const router = useRouter()

const draft = ref('')
const bodyRef = ref(null)
const showConfig = ref(false)

const quickPrompts = [
  '推荐做嵌入式实验的设备',
  '我的申请到哪一步了？',
  '怎么续借设备？',
  '逾期会影响信用分吗？'
]

const lastAssistantId = computed(() => {
  const list = [...ai.messages].reverse()
  return list.find(item => item.role === 'assistant' && !item.error)?.id || ''
})

async function copyMessage(message) {
  const text = String(message.content || '')
  if (!text) return

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}

async function regenerate() {
  if (ai.pending) return
  await ai.regenerate()
  await nextTick()
  scrollToBottom()
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMessage(content) {
  let html = escapeHtml(content)
    .replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code.trim()}</pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^&gt;\s?(.*)$/gm, '<span class="quote">$1</span>')
    .replace(/^###\s+(.*)$/gm, '<span class="h3">$1</span>')
    .replace(/^##\s+(.*)$/gm, '<span class="h2">$1</span>')
  html = html.replace(/\n/g, '<br>')
  return html
}

const providers = computed(() => ai.status?.providers || [])

const statusText = computed(() => {
  if (ai.statusLoading) return '正在检测模型…'
  if (ai.configuredCount > 0 && ai.currentProvider) {
    return `${ai.currentProvider.label} · ${ai.currentProvider.model}`
  }
  return '本地智能模式'
})

function scrollToBottom() {
  const el = bodyRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

async function submit(text = draft.value) {
  const content = String(text || '').trim()
  if (!content || ai.pending) return
  draft.value = ''
  await ai.send(content)
  await nextTick()
  scrollToBottom()
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}

function openDevice(name) {
  ai.closeDrawer()
  router.push({ path: '/devices', query: { keyword: name } })
}

function time(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(
  () => [ai.messages.length, ai.pending],
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

watch(
  () => ai.open,
  async open => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      await ai.loadStatus()
      await nextTick()
      scrollToBottom()
    }
  }
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <button
    type="button"
    class="ai-orb"
    :class="{ hidden: ai.open }"
    title="极光 AI 助手"
    data-cursor="hover"
    data-cursor-label="AI 助手"
    @click="ai.openDrawer()"
  >
    <span class="orb-halo"></span>
    <span class="orb-ring"></span>
    <span class="orb-core">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9L12 3.2Z"
          fill="currentColor"
        />
        <path d="M18.6 15.4l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9.9-2.2Z" fill="currentColor" opacity="0.75" />
      </svg>
    </span>
    <span class="orb-tip">AI 助手</span>
    <i class="orb-dot"></i>
  </button>

  <Teleport to="body">
    <Transition name="ai-panel">
      <div v-if="ai.open" class="ai-root">
        <div class="ai-backdrop" @click="ai.closeDrawer()"></div>

        <aside class="ai-panel">
          <header class="ai-head">
            <div class="ai-brand">
              <span class="ai-avatar">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9L12 3.2Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <div class="ai-brand-copy">
                <h3>极光 AI 助手</h3>
                <p>
                  <i class="online-dot"></i>
                  {{ statusText }}
                </p>
              </div>
            </div>

            <div class="ai-head-actions">
              <button type="button" title="新对话" @click="ai.reset()">
                <el-icon><Refresh /></el-icon>
              </button>
              <button type="button" title="AI 设置" :class="{ active: showConfig }" @click="showConfig = !showConfig">
                <el-icon><Setting /></el-icon>
              </button>
              <button type="button" title="关闭" @click="ai.closeDrawer()">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </header>

          <Transition name="config">
            <section v-if="showConfig" class="ai-config">
              <div class="config-head">
                <strong>模型服务</strong>
                <span>{{ ai.configuredCount }} / {{ providers.length }} 已配置</span>
              </div>

              <button
                v-for="provider in providers"
                :key="provider.id"
                type="button"
                class="provider-item"
                :class="{ active: ai.provider === provider.id, disabled: !provider.configured }"
                @click="provider.configured && ai.setProvider(provider.id)"
              >
                <span class="provider-name">
                  <strong>{{ provider.label }}</strong>
                  <small>{{ provider.model }}</small>
                </span>
                <span class="provider-state" :class="{ on: provider.configured }">
                  {{ provider.configured ? '已配置' : '未配置' }}
                </span>
              </button>

              <p class="config-tip">
                在项目根目录创建 <code>.env</code>，填入 <code>QWEN_API_KEY</code> 或
                <code>DEEPSEEK_API_KEY</code> 后重启后端即可启用云端模型。未配置时自动使用本地智能。
              </p>
            </section>
          </Transition>

          <div ref="bodyRef" class="ai-body">
            <div v-for="message in ai.messages" :key="message.id" class="msg" :class="message.role">
              <span v-if="message.role === 'assistant'" class="msg-avatar">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9L12 3.2Z"
                    fill="currentColor"
                  />
                </svg>
              </span>

              <div class="bubble-wrap">
                <div class="bubble" :class="{ error: message.error }" v-html="formatMessage(message.content)"></div>

                <div v-if="message.devices?.length" class="device-list">
                  <button
                    v-for="device in message.devices"
                    :key="device.id"
                    type="button"
                    class="device-card"
                    @click="openDevice(device.name)"
                  >
                    <span class="device-initial">{{ (device.category || '设').slice(0, 1) }}</span>
                    <span class="device-copy">
                      <strong>{{ device.name }}</strong>
                      <small>{{ device.category }} · 可借 {{ device.available }}/{{ device.total }}</small>
                    </span>
                    <span v-if="device.rating" class="device-rating">
                      <svg viewBox="0 0 12 12" width="10" height="10">
                        <path d="M6 1l1.5 3.1 3.4.5-2.5 2.4.6 3.4L6 8.7 3 10.4l.6-3.4L1.1 4.6l3.4-.5L6 1Z" fill="currentColor" />
                      </svg>
                      {{ device.rating.score }}
                    </span>
                    <el-icon class="device-arrow"><ArrowRight /></el-icon>
                  </button>
                </div>

                <div v-if="message.notice" class="msg-notice">{{ message.notice }}</div>

                <span class="msg-meta">
                  {{ message.providerLabel }}
                  <template v-if="message.model && message.model !== 'rule-based'"> · {{ message.model }}</template>
                  · {{ time(message.time) }}
                </span>

                <div v-if="message.role === 'assistant' && !message.error" class="msg-actions">
                  <button type="button" @click="copyMessage(message)">
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </button>
                  <button
                    v-if="message.id === lastAssistantId"
                    type="button"
                    :disabled="ai.pending"
                    @click="regenerate"
                  >
                    <el-icon><RefreshRight /></el-icon>
                    重新生成
                  </button>
                </div>
              </div>
            </div>

            <div v-if="ai.pending" class="msg assistant">
              <span class="msg-avatar typing-avatar">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9L12 3.2Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <div class="typing"><i></i><i></i><i></i></div>
            </div>
          </div>

          <div class="ai-quick">
            <button
              v-for="prompt in quickPrompts"
              :key="prompt"
              type="button"
              :disabled="ai.pending"
              @click="submit(prompt)"
            >
              {{ prompt }}
            </button>
          </div>

          <footer class="ai-input">
            <textarea
              v-model="draft"
              rows="1"
              maxlength="500"
              placeholder="问我设备推荐、申请进度、借用规则…"
              @keydown="onKeydown"
            ></textarea>
            <button
              type="button"
              class="send-btn"
              :disabled="!draft.trim() || ai.pending"
              @click="submit()"
            >
              <el-icon><Promotion /></el-icon>
            </button>
          </footer>
          <p class="ai-footnote">
            AI 回答基于平台实时数据生成，仅供参考 · Enter 发送 / Shift + Enter 换行
          </p>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped src="./AiCopilot.css"></style>
