<!-- 管理端基础数据：公告 / 院系 / 实验室 -->
<script setup>
import { ref } from 'vue'
import AnnouncementManager from './components/AnnouncementManager.vue'
import DepartmentManager from './components/DepartmentManager.vue'
import LabManager from './components/LabManager.vue'
import SettingsManager from './components/SettingsManager.vue'

const activeTab = ref('announcements')

const tabs = [
  { key: 'announcements', label: '平台公告' },
  { key: 'departments', label: '院系设置' },
  { key: 'labs', label: '实验室场地' },
  { key: 'settings', label: '系统设置' }
]
</script>

<template>
  <div class="page-shell">
    <div class="card card-pad base-card">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="tab-chip"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <AnnouncementManager v-if="activeTab === 'announcements'" />
      <DepartmentManager v-else-if="activeTab === 'departments'" />
      <LabManager v-else-if="activeTab === 'labs'" />
      <SettingsManager v-else />
    </div>
  </div>
</template>

<style scoped>
.base-card {
  min-height: 520px;
}

.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-soft);
}

.tab-chip {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease,
    border-color var(--dur-fast) ease, transform var(--dur-press) ease;
}

.tab-chip:hover {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
}

.tab-chip:active {
  transform: scale(0.97);
}

.tab-chip.active {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
  background: var(--primary-soft);
  font-weight: 600;
}
</style>
