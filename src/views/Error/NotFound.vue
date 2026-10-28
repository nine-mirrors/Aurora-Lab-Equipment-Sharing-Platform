<script setup>
import { useRouter } from 'vue-router'
import ErrorPage from '@/components/common/ErrorPage.vue'

const router = useRouter()

function goHome() {
  const token = localStorage.getItem('token')
  router.replace(token ? '/' : '/login')
}
</script>

<template>
  <ErrorPage
    code="404"
    title="页面走丢了"
    description="你访问的地址不存在或已被移动。可以返回上一页，或回到工作台继续浏览实验室设备。"
  >
    <template #actions>
      <el-button type="primary" size="large" @click="goHome">回到工作台</el-button>
      <el-button size="large" @click="router.back()">返回上一页</el-button>
    </template>
  </ErrorPage>
</template>
