<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/useUserStore'
import { useUiStore } from '@/stores/Ui'
import { useNotificationStore } from '@/stores/Notification'
import BrandMark from '@/components/common/BrandMark.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { ArrowDown, Menu as MenuIcon, Moon, Search, Sunny, SwitchButton, User } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const ui = useUiStore()
const notificationStore = useNotificationStore()

const mobileOpen = ref(false)

const navList = [
  { path: '/homePage', label: '数据看板' },
  { path: '/devices', label: '设备大厅' },
  { path: '/applyRecord', label: '我的申请' }
]

const displayName = computed(
  () => userStore.userInfo?.name || userStore.userInfo?.account || '同学'
)
const avatarText = computed(() => displayName.value.slice(0, 1))
const avatarSrc = computed(() => userStore.userInfo?.avatar || '')
const today = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

function handleCommand(command) {
  if (command === 'profile') {
    router.push('/student/profile')
    return
  }

  if (command === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('rememberUser')
    userStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}

function go(path) {
  mobileOpen.value = false
  router.push(path)
}
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <router-link to="/homePage" class="brand">
        <BrandMark :size="38" />
        <span class="brand-text">
          <strong>极光 · 设备共享</strong>
          <small>AURORA LAB PLATFORM</small>
        </span>
      </router-link>

      <nav class="nav">
        <router-link
          v-for="item in navList"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
        >
          {{ item.label }}
          <i class="nav-glow"></i>
        </router-link>
      </nav>

      <div class="header-right">
        <button class="search-trigger" type="button" @click="ui.openPalette()">
          <el-icon><Search /></el-icon>
          <span class="search-label">搜索设备、页面…</span>
          <span class="kbd">⌘K</span>
        </button>

        <ThemeToggle />

        <button
          class="icon-btn bell-btn"
          type="button"
          title="通知中心"
          @click="ui.openNotifications()"
        >
          <el-icon><Bell /></el-icon>
          <i v-if="notificationStore.unreadCount" class="badge">
            {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
          </i>
        </button>

        <span class="today">{{ today }}</span>

        <el-dropdown trigger="click" @command="handleCommand">
          <div class="user-chip">
            <el-avatar :size="30" class="chip-avatar" :src="avatarSrc || undefined">
              {{ avatarText }}
            </el-avatar>
            <span class="chip-name">{{ displayName }}</span>
            <el-icon class="chip-arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>个人中心
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <button class="icon-btn menu-btn" type="button" @click="mobileOpen = !mobileOpen">
          <el-icon><MenuIcon /></el-icon>
        </button>
      </div>
    </div>

    <Transition name="mobile-nav">
      <nav v-if="mobileOpen" class="mobile-nav">
        <button
          v-for="item in navList"
          :key="item.path"
          type="button"
          class="mobile-nav-item"
          :class="{ active: route.path === item.path }"
          @click="go(item.path)"
        >
          {{ item.label }}
        </button>

        <button type="button" class="mobile-nav-item" @click="ui.toggleTheme()">
          <el-icon><Moon v-if="ui.isDark" /><Sunny v-else /></el-icon>
          切换至{{ ui.isDark ? '浅色' : '深色' }}模式
        </button>

        <button type="button" class="mobile-nav-item" @click="go('/student/profile')">
          <el-icon><User /></el-icon>
          个人中心
        </button>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: color-mix(in srgb, var(--bg-canvas) 72%, transparent);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}

.header-inner {
  max-width: 1480px;
  margin: 0 auto;
  height: var(--header-h);
  padding: 0 34px;
  display: flex;
  align-items: center;
  gap: 26px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-1);
  flex: none;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.18;
}

.brand-text strong {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.brand-text small {
  font-size: 8.5px;
  letter-spacing: 0.16em;
  color: var(--text-3);
  font-family: var(--font-mono);
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav::-webkit-scrollbar {
  display: none;
}

.nav-item {
  position: relative;
  padding: 8px 15px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-2);
  white-space: nowrap;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}

.nav-item:hover {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
}

.nav-item.active {
  color: var(--primary);
  font-weight: 600;
  background: var(--primary-soft);
}

.nav-glow {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--primary);
  transform: translateX(-50%);
  transition: width var(--dur) var(--ease-out);
}

.nav-item.active .nav-glow {
  width: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.search-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-3);
  font-size: 12.5px;
  cursor: pointer;
  transition: all var(--dur-fast) ease;
}

.search-trigger:hover {
  border-color: color-mix(in srgb, var(--primary) 32%, var(--border));
  color: var(--primary);
  box-shadow: 0 6px 16px -10px var(--primary-glow);
}

.search-label {
  font-size: 12.5px;
}

.icon-btn {
  position: relative;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
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
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef9a86, #c95445);
  color: #fff;
  font-size: 9.5px;
  font-weight: 700;
  font-style: normal;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-canvas);
}

.today {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 9px 3px 3px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all var(--dur-fast) ease;
}

.user-chip:hover {
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: 0 8px 18px -12px var(--primary-glow);
}

.chip-avatar {
  background: var(--gradient-aurora);
  color: #fff;
  font-weight: 600;
  font-size: 12px;
}

.chip-name {
  font-size: 13px;
  color: var(--text-1);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-arrow {
  color: var(--text-3);
  font-size: 11px;
}

.menu-btn,
.mobile-nav {
  display: none;
}

@media (max-width: 1180px) {
  .search-trigger .search-label {
    display: none;
  }

  .today {
    display: none;
  }
}

@media (max-width: 900px) {
  .header-inner {
    padding: 0 16px;
    gap: 12px;
  }

  .brand-text small {
    display: none;
  }

  .nav {
    display: none;
  }

  .header-right {
    margin-left: auto;
    gap: 8px;
  }

  .chip-name {
    display: none;
  }

  .menu-btn {
    display: inline-flex;
  }

  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 16px 16px;
    border-top: 1px solid var(--border-soft);
    background: var(--bg-elevated);
  }

  .mobile-nav-item {
    padding: 11px 14px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-2);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  .mobile-nav-item.active {
    background: var(--primary-soft);
    color: var(--primary);
    font-weight: 600;
  }

  .mobile-nav-enter-active,
  .mobile-nav-leave-active {
    transition: opacity 0.2s ease, transform 0.24s var(--ease-out);
  }

  .mobile-nav-enter-from,
  .mobile-nav-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

@media (max-width: 620px) {
  .header-inner {
    padding: 0 12px;
    gap: 8px;
  }

  .header-right {
    gap: 6px;
  }

  .brand-text strong {
    font-size: 15px;
    white-space: nowrap;
  }

  .brand-text {
    max-width: 118px;
    overflow: hidden;
  }

  .header-right .theme-toggle {
    display: none;
  }

  .chip-arrow {
    display: none;
  }

  .mobile-nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-trigger {
    width: 34px;
    padding: 0;
    justify-content: center;
  }

  .search-trigger .kbd {
    display: none;
  }
}
</style>
