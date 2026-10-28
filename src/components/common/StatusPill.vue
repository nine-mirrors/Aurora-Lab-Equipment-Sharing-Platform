<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: '' },
  label: { type: String, default: '' },
  size: { type: String, default: 'md' } // sm | md
})

const map = {
  pending: { text: '待审核', tone: 'warning' },
  approved: { text: '在借', tone: 'success' },
  unreturned: { text: '在借未还', tone: 'success' },
  returning: { text: '归还中', tone: 'primary' },
  returned: { text: '已归还', tone: 'info' },
  rejected: { text: '已拒绝', tone: 'danger' },
  cancelled: { text: '已取消', tone: 'info' },
  'extension-pending': { text: '续借待审', tone: 'violet' },
  'return-rejected': { text: '归还被拒', tone: 'danger' },
  active: { text: '在库', tone: 'success' },
  inactive: { text: '已下架', tone: 'info' },
  available: { text: '可借', tone: 'success' },
  empty: { text: '已借完', tone: 'info' },
  overdue: { text: '已逾期', tone: 'danger' },
  maintenance: { text: '维护中', tone: 'warning' },
  'repair-pending': { text: '待维修', tone: 'warning' },
  processing: { text: '维修中', tone: 'warning' },
  done: { text: '已修复', tone: 'success' },
  admin: { text: '管理员', tone: 'violet' },
  student: { text: '学生', tone: 'primary' },
  online: { text: '在线', tone: 'success' }
}

const info = computed(() => {
  const item = map[props.status] || { text: props.status || '未知', tone: 'info' }
  return { ...item, text: props.label || item.text }
})
</script>

<template>
  <span class="status-pill" :class="[`tone-${info.tone}`, `size-${size}`]">
    <i class="dot"></i>
    {{ info.text }}
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  color: var(--tone);
  background: var(--tone-soft);
  border: 1px solid color-mix(in srgb, var(--tone) 18%, transparent);
}

.size-sm {
  padding: 2px 8px;
  font-size: 11px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--tone);
  box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--tone) 16%, transparent);
}

.tone-primary { --tone: var(--primary); --tone-soft: var(--primary-soft); }
.tone-success { --tone: var(--green); --tone-soft: var(--green-soft); }
.tone-warning { --tone: var(--amber); --tone-soft: var(--amber-soft); }
.tone-danger { --tone: var(--red); --tone-soft: var(--red-soft); }
.tone-violet { --tone: var(--violet); --tone-soft: var(--violet-soft); }
.tone-info { --tone: var(--text-3); --tone-soft: var(--bg-muted); }
</style>
