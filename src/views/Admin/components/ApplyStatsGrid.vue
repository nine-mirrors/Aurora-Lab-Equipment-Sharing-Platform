<!-- 管理端申请管理：状态统计卡片 -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  lists: { type: Object, required: true },
  activeTab: { type: String, default: 'pending' }
})

const emit = defineEmits(['select'])

const stats = computed(() => [
  { key: 'pending', label: '待审核', value: (props.lists.pending || []).length, hint: '需要尽快处理' },
  {
    key: 'extension-pending',
    label: '续借待审',
    value: (props.lists['extension-pending'] || []).length,
    hint: '等待延长借用'
  },
  { key: 'unreturned', label: '在借未还', value: (props.lists.unreturned || []).length, hint: '当前使用中' },
  { key: 'returning', label: '归还中', value: (props.lists.returning || []).length, hint: '等待确认归还' },
  {
    key: 'returned',
    label: '已完成',
    value: (props.lists.returned || []).length,
    hint: '历史归还记录'
  }
])
</script>

<template>
  <section class="apply-stats stagger">
    <button
      v-for="(item, index) in stats"
      :key="item.key"
      type="button"
      class="a-stat card"
      :class="[`tone-${index}`, { active: activeTab === item.key }]"
      @click="emit('select', item.key)"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
      <small>{{ item.hint }}</small>
    </button>
  </section>
</template>

<style scoped src="./ApplyStatsGrid.css"></style>
