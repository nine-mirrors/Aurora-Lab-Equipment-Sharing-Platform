<script setup>
import { useRouter } from 'vue-router'
import ErrorPage from '@/components/common/ErrorPage.vue'

const router = useRouter()

function reload() {
  window.location.reload()
}

function goHome() {
  router.replace('/')
}
</script>

<template>
  <ErrorPage
    code="500"
    title="服务暂时不可用"
    description="平台遇到了一点异常，可能是本地服务未启动或网络波动。请稍后重试，或确认后端服务已启动。"
  >
    <template #actions>
      <el-button type="primary" size="large" @click="reload">重新加载</el-button>
      <el-button size="large" @click="goHome">回到首页</el-button>
    </template>
  </ErrorPage>
</template>
