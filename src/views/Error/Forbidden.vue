<script setup>
import { useRouter } from 'vue-router'
import ErrorPage from '@/components/common/ErrorPage.vue'

const router = useRouter()

function goHome() {
  const token = localStorage.getItem('token')
  router.replace(token ? '/' : '/login')
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  router.replace('/login')
}
</script>

<template>
  <ErrorPage
    code="403"
    title="暂无访问权限"
    description="当前账号的角色无法访问这个页面。管理员功能仅对实验室管理员开放，如需开通请联系平台管理员。"
  >
    <template #actions>
      <el-button type="primary" size="large" @click="goHome">返回我的工作台</el-button>
      <el-button size="large" @click="logout">切换账号</el-button>
    </template>
  </ErrorPage>
</template>
