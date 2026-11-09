<!-- 管理端申请管理：状态统计卡片 -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  counts: { type: Object, required: true },
  activeTab: { type: String, default: 'pending' }
})

const emit = defineEmits(['select'])

const stats = computed(() => [
  { key: 'pending', label: '待审核', hint: '需要尽快处理' },
  { key: 'extension-pending', label: '续借待审', hint: '等待延长借用' },
  { key: 'unreturned', label: '在借未还', hint: '当前使用中' },
  { key: 'returning', label: '归还中', hint: '等待确认归还' },
  { key: 'returned', label: '已完成', hint: '历史归还记录' },
  { key: 'rejected', label: '已拒绝', hint: '未通过申请' },
  { key: 'cancelled', label: '已取消', hint: '学生主动撤销' },
  { key: 'return-rejected', label: '归还被拒', hint: '待重新归还' }
].map(item => ({ ...item, value: Number(props.counts[item.key] || 0) })))
</script>

<template>
  <section class="apply-stats stagger">
    <button
      v-for="(item, index) in stats"
      :key="item.key"
      type="button"
      class="a-stat card"
      :class="[`tone-${index}`, { active: activeTab === item.key }]"
      :aria-pressed="activeTab === item.key"
      @click="emit('select', item.key)"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
      <small>{{ item.hint }}</small>
    </button>
  </section>
</template>

<style scoped src="./ApplyStatsGrid.css"></style>
