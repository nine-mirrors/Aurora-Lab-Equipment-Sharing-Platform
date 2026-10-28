<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppLoading from '@/components/common/AppLoading.vue'
import RouteProgress from '@/components/layout/RouteProgress.vue'
import CommandPalette from '@/components/layout/CommandPalette.vue'
import NotificationDrawer from '@/components/layout/NotificationDrawer.vue'
import AiCopilot from '@/components/ai/AiCopilot.vue'
import CursorLab from '@/components/common/CursorLab.vue'
import { useUiStore } from '@/stores/Ui'
import { useUserStore } from '@/stores/useUserStore'
import { useAiStore } from '@/stores/useAiStore'
import { useNotificationStore } from '@/stores/Notification'
import { useFavoriteStore } from '@/stores/Favorite'
import { getMe } from '@/api/user'

const ui = useUiStore()
const userStore = useUserStore()
const aiStore = useAiStore()
const notificationStore = useNotificationStore()
const favoriteStore = useFavoriteStore()
const route = useRoute()

const showBoot = ref(true)
let bootTimer = null

const showAi = computed(
  () =>
    Boolean(userStore.token) &&
    !['login', 'register', 'forgetPassword'].includes(String(route.name || ''))
)

watch(
  () => userStore.token,
  token => {
    if (!token) {
      aiStore.closeDrawer()
      aiStore.reset()
      notificationStore.clear()
      favoriteStore.clear()
    } else {
      notificationStore.loadServer()
      favoriteStore.load()
    }
  }
)

function layoutKey(current) {
  return current.matched[0]?.path || current.path
}

function handleKeydown(event) {
  if (showBoot.value) return

  const meta = event.metaKey || event.ctrlKey
  if (meta && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (!localStorage.getItem('token')) return
    ui.paletteOpen ? ui.closePalette() : ui.openPalette()
  }

  if (meta && event.key.toLowerCase() === 'i') {
    event.preventDefault()
    if (!localStorage.getItem('token')) return
    aiStore.toggleDrawer()
  }

  if (event.key === 'Escape') {
    if (ui.paletteOpen) ui.closePalette()
    if (ui.notificationsOpen) ui.closeNotifications()
    if (aiStore.open) aiStore.closeDrawer()
  }
}

onMounted(() => {
  ui.applyTheme()
  bootTimer = setTimeout(() => {
    showBoot.value = false
    ui.finishBoot()
  }, 1700)
  window.addEventListener('keydown', handleKeydown)

  if (userStore.token) {
    notificationStore.loadServer()
    favoriteStore.load()
    getMe()
      .then(res => {
        if (res.code === 200 && res.data) {
          userStore.setUser({ user: res.data })
        }
      })
      .catch(() => {})
  }
})

onBeforeUnmount(() => {
  clearTimeout(bootTimer)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <RouteProgress />

  <Transition name="boot">
    <AppLoading v-if="showBoot" variant="splash" label="正在加载工作台资源…" />
  </Transition>

  <RouterView v-slot="{ Component }">
    <Transition name="route" mode="out-in">
      <component :is="Component" :key="layoutKey(route)" />
    </Transition>
  </RouterView>

  <CommandPalette />
  <NotificationDrawer />
  <AiCopilot v-if="showAi && !showBoot" />
  <CursorLab />
</template>

<style>
/* 启动与路由过渡类由 Vue 注入到全局 DOM，必须全局生效 */
.boot-leave-active {
  transition: opacity 0.5s var(--ease-out), transform 0.6s var(--ease-out), filter 0.5s ease;
}

.boot-leave-to {
  opacity: 0;
  transform: scale(1.04);
  filter: blur(10px);
}
</style>
