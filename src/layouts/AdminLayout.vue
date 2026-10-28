<script setup>
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AdminSidebar from '@/components/layout/AdminSidebar.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import ParticleField from '@/components/common/ParticleField.vue'
import { useUiStore } from '@/stores/Ui'
import { useNotificationStore } from '@/stores/Notification'
import { Bell, Menu, Search } from '@element-plus/icons-vue'

const route = useRoute()
const ui = useUiStore()
const notificationStore = useNotificationStore()

const mobileOpen = ref(false)

const title = computed(() => route.meta?.title || '管理后台')
const subtitle = computed(() => route.meta?.subtitle || '实验室设备共享与智能调度平台')
const today = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})
</script>

<template>
  <div class="admin-layout">
    <div class="admin-aurora" aria-hidden="true">
      <span class="admin-glow g1"></span>
      <span class="admin-glow g2"></span>
      <ParticleField :density="24" />
    </div>

    <AdminSidebar :mobile-open="mobileOpen" @close="mobileOpen = false" />

    <div class="admin-main">
      <header class="admin-topbar">
        <button class="mobile-menu" type="button" @click="mobileOpen = true">
          <el-icon><Menu /></el-icon>
        </button>

        <div class="title-box">
          <nav class="crumbs">
            <span>管理后台</span>
            <i>/</i>
            <strong>{{ title }}</strong>
          </nav>
          <div class="title-row">
            <h2>{{ title }}</h2>
            <span>{{ subtitle }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <button class="topbar-search" type="button" @click="ui.openPalette()">
            <el-icon><Search /></el-icon>
            <span>搜索</span>
            <span class="kbd">⌘K</span>
          </button>

          <ThemeToggle />

          <button class="icon-btn" type="button" title="通知中心" @click="ui.openNotifications()">
            <el-icon><Bell /></el-icon>
            <i v-if="notificationStore.unreadCount" class="badge">
              {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
            </i>
          </button>

          <span class="today">{{ today }}</span>
          <span class="status-dot">服务正常</span>
        </div>
      </header>

      <main class="admin-content">
        <RouterView v-slot="{ Component }">
          <Transition name="route" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  position: relative;
  display: flex;
  min-height: 100vh;
  isolation: isolate;
}

.admin-aurora {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.admin-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(130px);
  opacity: 0.28;
  animation: drift 24s var(--ease-in-out) infinite;
}

.admin-glow.g1 {
  width: 520px;
  height: 520px;
  right: 2%;
  top: -12%;
  background: radial-gradient(circle, rgba(14, 124, 102, 0.5), transparent 68%);
}

.admin-glow.g2 {
  width: 460px;
  height: 460px;
  left: 18%;
  bottom: -18%;
  background: radial-gradient(circle, rgba(159, 191, 58, 0.38), transparent 68%);
  animation-delay: -10s;
}

:root.dark .admin-glow {
  opacity: 0.2;
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 13px 30px;
  background: color-mix(in srgb, var(--bg-canvas) 74%, transparent);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}

.title-box {
  min-width: 0;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-3);
  margin-bottom: 1px;
  letter-spacing: 0.02em;
}

.crumbs i {
  font-style: normal;
  opacity: 0.5;
}

.crumbs strong {
  color: var(--primary);
  font-weight: 600;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.title-row h2 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-1);
  white-space: nowrap;
}

.title-row span {
  font-size: 11.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.topbar-search {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 9px 0 11px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-3);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--dur-fast) ease;
}

.topbar-search:hover {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
}

.icon-btn {
  position: relative;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--dur-fast) ease;
}

.icon-btn:hover {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  transform: translateY(-1px);
}

.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef9a86, #c95445);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  font-style: normal;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-canvas);
}

.today {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
}

.mobile-menu {
  display: none;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  flex: none;
}

.admin-content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 1100px) {
  .admin-topbar {
    padding: 12px 20px;
  }

  .today {
    display: none;
  }
}

@media (max-width: 820px) {
  .admin-topbar {
    padding: 10px 16px;
    gap: 10px;
  }

  .mobile-menu {
    display: inline-flex;
  }

  .title-row span,
  .topbar-search span,
  .topbar-search .kbd,
  .status-dot {
    display: none;
  }

  .topbar-search {
    width: 32px;
    padding: 0;
    justify-content: center;
  }

  .title-row h2 {
    font-size: 15px;
  }
}
</style>
