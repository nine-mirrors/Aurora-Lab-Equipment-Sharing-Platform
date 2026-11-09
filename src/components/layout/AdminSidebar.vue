<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/useUserStore'
import { useUiStore } from '@/stores/Ui'
import BrandMark from '@/components/common/BrandMark.vue'
import {
  Box,
  DataBoard,
  DataLine,
  Expand,
  Fold,
  OfficeBuilding,
  Setting,
  SwitchButton,
  Tickets,
  Tools,
  User
} from '@element-plus/icons-vue'

defineProps({
  mobileOpen: { type: Boolean, default: false }
})

defineEmits(['close'])

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const ui = useUiStore()

const navList = [
  { path: '/admin/dashboard', label: '数据总览', icon: DataLine, desc: '运行概览' },
  { path: '/admin/device', label: '设备管理', icon: Box, desc: '库存与上下架' },
  { path: '/admin/apply', label: '申请管理', icon: Tickets, desc: '审核与归还' },
  { path: '/admin/maintenance', label: '维护中心', icon: Tools, desc: '报修与检修' },
  { path: '/admin/getUser', label: '用户管理', icon: User, desc: '账号与角色' },
  { path: '/admin/baseData', label: '基础数据', icon: OfficeBuilding, desc: '公告与场地' },
  { path: '/admin/systemData', label: '系统数据', icon: DataBoard, desc: '数据表与审计' }
]

const displayName = computed(
  () => userStore.userInfo?.name || userStore.userInfo?.account || '管理员'
)
const avatarText = computed(() => displayName.value.slice(0, 1))
const avatarSrc = computed(() => userStore.userInfo?.avatar || '')

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('rememberUser')
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<template>
  <Transition name="mask">
    <div v-if="mobileOpen" class="sidebar-mask" @click="$emit('close')"></div>
  </Transition>

  <aside class="sidebar" :class="{ collapsed: ui.sidebarCollapsed, 'mobile-open': mobileOpen }">
    <span class="sidebar-glow glow-top"></span>
    <span class="sidebar-glow glow-bottom"></span>

    <div class="brand-row">
      <router-link to="/admin/dashboard" class="brand" @click="$emit('close')">
        <BrandMark :size="36" :mono="true" />
        <span class="brand-text">
          <strong>极光 · 后台</strong>
          <small>AURORA ADMIN</small>
        </span>
      </router-link>

      <button class="collapse-btn" type="button" :title="ui.sidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="ui.toggleSidebar()">
        <el-icon>
          <Expand v-if="ui.sidebarCollapsed" />
          <Fold v-else />
        </el-icon>
      </button>
    </div>

    <nav class="nav">
      <span class="nav-title">工作台</span>
      <router-link
        v-for="item in navList"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
        :title="item.label"
        @click="$emit('close')"
      >
        <span class="nav-icon">
          <el-icon><component :is="item.icon" /></el-icon>
        </span>
        <span class="nav-copy">
          <strong>{{ item.label }}</strong>
          <small>{{ item.desc }}</small>
        </span>
        <i class="active-bar"></i>
      </router-link>

      <span class="nav-title second">账户</span>
      <router-link
        to="/admin/adminProfile"
        class="nav-item"
        :class="{ active: route.path === '/admin/adminProfile' }"
        title="个人中心"
        @click="$emit('close')"
      >
        <span class="nav-icon">
          <el-icon><Setting /></el-icon>
        </span>
        <span class="nav-copy">
          <strong>个人中心</strong>
          <small>资料与安全</small>
        </span>
        <i class="active-bar"></i>
      </router-link>
    </nav>

    <div class="sidebar-bottom">
      <div class="status-card">
        <span class="status-ring"><i></i></span>
        <div class="status-copy">
          <strong>系统运行正常</strong>
          <small>本地服务 · 已连接</small>
        </div>
      </div>

      <div class="user-card">
        <el-avatar :size="34" class="user-avatar" :src="avatarSrc || undefined">
          {{ avatarText }}
        </el-avatar>
        <div class="user-meta">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-role">实验室管理员</span>
        </div>
        <button class="logout-btn" title="退出登录" @click="logout">
          <el-icon><SwitchButton /></el-icon>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped src="./AdminSidebar.css"></style>
