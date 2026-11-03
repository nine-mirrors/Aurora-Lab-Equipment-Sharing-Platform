<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/Ui'
import { useUserStore } from '@/stores/useUserStore'
import { useFavoriteStore } from '@/stores/Favorite'
import { getDeviceList } from '@/api/device'

const router = useRouter()
const ui = useUiStore()
const userStore = useUserStore()
const favoriteStore = useFavoriteStore()

const inputRef = ref(null)
const query = ref('')
const activeIndex = ref(0)
const devices = ref([])
const searching = ref(false)
let timer = null

const isAdmin = computed(() => (userStore.role || 'student') === 'admin')

const commands = computed(() => {
  const base = isAdmin.value
    ? [
        { key: 'nav-dashboard', title: '数据总览', desc: '设备、库存与申请的整体运行情况', icon: 'DataLine', action: () => router.push('/admin/dashboard') },
        { key: 'nav-device', title: '设备管理', desc: '维护设备档案、库存与上下架状态', icon: 'Box', action: () => router.push('/admin/device') },
        { key: 'nav-apply', title: '申请管理', desc: '审核借用申请与归还确认', icon: 'Tickets', action: () => router.push('/admin/apply') },
        { key: 'nav-maintenance', title: '维护中心', desc: '设备报修、维修进度与恢复可借', icon: 'Tools', action: () => router.push('/admin/maintenance') },
        { key: 'nav-user', title: '用户管理', desc: '查看平台账号并处理异常账号', icon: 'User', action: () => router.push('/admin/getUser') },
        { key: 'nav-system-data', title: '系统数据', desc: '数据表规模与管理员操作审计', icon: 'DataBoard', action: () => router.push('/admin/systemData') },
        { key: 'nav-profile', title: '个人中心', desc: '维护个人资料与账号安全', icon: 'Setting', action: () => router.push('/admin/adminProfile') }
      ]
    : [
        { key: 'nav-home', title: '数据看板', desc: '实验室运行概览与个人借用进度', icon: 'DataLine', action: () => router.push('/homePage') },
        { key: 'nav-devices', title: '设备大厅', desc: '浏览并申请借用实验室设备', icon: 'Box', action: () => router.push('/devices') },
        { key: 'nav-record', title: '我的申请', desc: '查看审核进度与归还流程', icon: 'Tickets', action: () => router.push('/applyRecord') },
        { key: 'nav-profile', title: '个人中心', desc: '资料、安全与偏好设置', icon: 'Setting', action: () => router.push('/student/profile') }
      ]

  base.push({
    key: 'nav-design',
    title: '设计系统',
    desc: 'VERDANT LAB 专属组件、配色与光标规范',
    icon: 'Brush',
    action: () => router.push('/design')
  })

  base.push({
    key: 'act-theme',
    title: ui.isDark ? '切换到浅色模式' : '切换到深色模式',
    desc: '切换全局主题外观',
    icon: 'Sunny',
    action: () => ui.toggleTheme()
  })

  return base
})

const filteredCommands = computed(() => {
  const kw = query.value.trim().toLowerCase()
  if (!kw) return commands.value.slice(0, 5)
  return commands.value.filter(
    item => item.title.toLowerCase().includes(kw) || item.desc.toLowerCase().includes(kw)
  )
})

const filteredDevices = computed(() => {
  const kw = query.value.trim()
  if (!kw) return []
  return devices.value.slice(0, 5)
})

const flatItems = computed(() => [
  ...filteredCommands.value.map(item => ({ ...item, type: 'command' })),
  ...filteredDevices.value.map(item => ({
    key: `device-${item.id}`,
    title: item.name,
    desc: `${item.category} · 可借 ${item.available_qty}/${item.total_qty} · ${item.location || '实验室'}`,
    icon: 'Box',
    type: 'device',
    device: item,
    action: () => router.push({ path: '/devices', query: { keyword: item.name } })
  }))
])

const hasResults = computed(() => flatItems.value.length > 0)

function close() {
  ui.closePalette()
}

function run(item) {
  item.action()
  close()
}

async function searchDevices() {
  const kw = query.value.trim()
  if (!kw) {
    devices.value = []
    return
  }

  searching.value = true
  try {
    const res = await getDeviceList({ name: kw, page: 1, pageSize: 5, is_active: 1 })
    devices.value = res.data?.list || []
  } catch {
    devices.value = []
  } finally {
    searching.value = false
  }
}

watch(query, () => {
  activeIndex.value = 0
  clearTimeout(timer)
  timer = setTimeout(searchDevices, 260)
})

watch(
  () => ui.paletteOpen,
  async open => {
    if (open) {
      query.value = ''
      devices.value = []
      activeIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
)

function onKeydown(event) {
  if (event.key === 'Escape') {
    close()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % Math.max(1, flatItems.value.length)
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value =
      (activeIndex.value - 1 + flatItems.value.length) % Math.max(1, flatItems.value.length)
  }

  if (event.key === 'Enter') {
    const item = flatItems.value[activeIndex.value]
    if (item) run(item)
  }
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <transition name="palette">
      <div v-if="ui.paletteOpen" class="palette-root" @keydown="onKeydown">
        <div class="palette-backdrop" @click="close"></div>

        <div class="palette">
          <div class="palette-search">
            <el-icon class="search-icon"><Search /></el-icon>
            <input
              ref="inputRef"
              v-model="query"
              class="palette-input"
              placeholder="搜索设备、页面或操作…"
              autocomplete="off"
            />
            <span class="kbd">ESC</span>
          </div>

          <div class="palette-body">
            <template v-if="hasResults">
              <div v-if="filteredCommands.length" class="group">
                <span class="group-title">快捷导航</span>
                <button
                  v-for="(item, index) in filteredCommands"
                  :key="item.key"
                  type="button"
                  class="result"
                  :class="{ active: flatItems[activeIndex]?.key === item.key }"
                  @mouseenter="activeIndex = index"
                  @click="run(flatItems[index])"
                >
                  <span class="result-icon">
                    <el-icon><component :is="item.icon" /></el-icon>
                  </span>
                  <span class="result-text">
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.desc }}</small>
                  </span>
                  <span class="result-enter">↵</span>
                </button>
              </div>

              <div v-if="filteredDevices.length" class="group">
                <span class="group-title">设备结果</span>
                <button
                  v-for="(item, index) in filteredDevices"
                  :key="`device-${item.id}`"
                  type="button"
                  class="result"
                  :class="{
                    active: flatItems[activeIndex]?.key === `device-${item.id}`
                  }"
                  @mouseenter="activeIndex = filteredCommands.length + index"
                  @click="run(flatItems[filteredCommands.length + index])"
                >
                  <span class="result-icon device">
                    <el-icon><Box /></el-icon>
                  </span>
                  <span class="result-text">
                    <strong>{{ item.name }}</strong>
                    <small>{{ item.category }} · 可借 {{ item.available_qty }}/{{ item.total_qty }}</small>
                  </span>
                  <span class="result-enter">↵</span>
                </button>
              </div>
            </template>

            <div v-else class="palette-empty">
              <span class="empty-ring"><el-icon><Search /></el-icon></span>
              <strong>{{ searching ? '正在检索设备…' : '没有匹配的结果' }}</strong>
              <small>试试设备名称、分类，或直接跳转页面</small>
            </div>
          </div>

          <div class="palette-foot">
            <span><span class="kbd">↑</span><span class="kbd">↓</span> 选择</span>
            <span><span class="kbd">↵</span> 打开</span>
            <span><span class="kbd">ESC</span> 关闭</span>
            <span class="foot-brand">
              <el-icon><Star /></el-icon>
              已收藏 {{ favoriteStore.count }} 台设备
            </span>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.palette-root {
  position: fixed;
  inset: 0;
  z-index: 3500;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

.palette-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(6, 11, 24, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.palette {
  position: relative;
  width: min(600px, 92vw);
  border-radius: 20px;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  backdrop-filter: blur(26px) saturate(160%);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.04);
  animation: palette-in 0.16s var(--ease-out) both;
}

/* 高频入口：只做透明度，不做位移与缩放 */
@keyframes palette-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-soft);
}

.search-icon {
  color: var(--primary);
  font-size: 17px;
}

.palette-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: var(--text-1);
  font-family: inherit;
}

.palette-input::placeholder {
  color: var(--text-3);
}

.palette-body {
  max-height: 54vh;
  overflow-y: auto;
  padding: 10px;
}

.group + .group {
  margin-top: 6px;
}

.group-title {
  display: block;
  padding: 8px 12px 5px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.result {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--dur-fast) ease;
}

.result.active {
  background: var(--primary-soft);
}

.result-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 16px;
  color: var(--primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.result.active .result-icon {
  background: var(--bg-elevated);
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
}

.result-icon.device {
  color: var(--cyan);
}

.result-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.result-text strong {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-text small {
  font-size: 11.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-enter {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-3);
  opacity: 0;
  transition: opacity var(--dur-fast) ease;
}

.result.active .result-enter {
  opacity: 1;
  color: var(--primary);
}

.palette-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 44px 20px;
  text-align: center;
}

.empty-ring {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent);
  color: var(--primary);
  margin-bottom: 8px;
}

.palette-empty strong {
  font-size: 14px;
  color: var(--text-2);
}

.palette-empty small {
  font-size: 12px;
  color: var(--text-3);
}

.palette-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  border-top: 1px solid var(--border-soft);
  background: var(--bg-subtle);
  font-size: 11px;
  color: var(--text-3);
}

.palette-foot .kbd {
  margin-right: 2px;
}

.foot-brand {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
}

.palette-enter-active {
  transition: opacity var(--dur-fast) var(--ease-out);
}

.palette-leave-active {
  transition: opacity var(--dur-fast) ease;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
</style>
