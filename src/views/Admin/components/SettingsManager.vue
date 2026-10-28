<!-- 管理端基础数据：系统设置 -->
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSettingList, updateSetting } from '@/api/Admin/base'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const BOOLEAN_KEYS = [
  'allow_self_cancel',
  'maintenance_block_booking',
  'ai_review_enabled',
  'notification_email',
  'auto_overdue_reminder'
]
const NUMBER_KEYS = [
  'max_borrow_days',
  'max_active_bookings',
  'overdue_penalty',
  'max_renew_days',
  'booking_advance_days'
]

const loading = ref(true)
const list = ref([])
const drafts = reactive({})
const savingKey = ref('')

function isBoolean(key) {
  return BOOLEAN_KEYS.includes(key)
}

function isNumber(key) {
  return NUMBER_KEYS.includes(key)
}

function normalize(row, value) {
  if (isBoolean(row.key)) return value ? '1' : '0'
  return String(value)
}

function changed(row) {
  return normalize(row, drafts[row.key]) !== String(row.value)
}

async function load() {
  loading.value = true
  try {
    const res = await getSettingList()
    list.value = res.data?.list || []
    list.value.forEach(row => {
      drafts[row.key] = isBoolean(row.key)
        ? Number(row.value) !== 0
        : isNumber(row.key)
          ? Number(row.value)
          : row.value
    })
  } catch {
    ElMessage.error('系统设置加载失败')
    list.value = []
  } finally {
    loading.value = false
  }
}

async function saveRow(row) {
  if (savingKey.value) return
  savingKey.value = row.key
  try {
    const res = await updateSetting(row.key, normalize(row, drafts[row.key]))
    if (res.code !== 200) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    row.value = res.data.value
    row.updated_by = res.data.updated_by
    row.updated_at = res.data.updated_at
    ElMessage.success(`「${row.label}」已更新`)
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="manager">
    <div class="manager-head">
      <div>
        <h3>系统设置<span>共 {{ list.length }} 项</span></h3>
        <p>修改保存后立即生效，借用、续借、提醒与 AI 审批会读取最新配置。</p>
      </div>
    </div>

    <AppSkeleton v-if="loading" type="list" :rows="5" />

    <div v-else-if="list.length" class="setting-list">
      <div v-for="row in list" :key="row.key" class="setting-item">
        <div class="setting-meta">
          <strong>{{ row.label }}</strong>
          <code>{{ row.key }}</code>
          <small v-if="row.updated_by">
            最近修改：{{ row.updated_by }} · {{ new Date(row.updated_at).toLocaleString('zh-CN', { hour12: false }) }}
          </small>
        </div>

        <div class="setting-control">
          <el-switch
            v-if="isBoolean(row.key)"
            v-model="drafts[row.key]"
            active-text="启用"
            inactive-text="关闭"
          />
          <el-input-number
            v-else-if="isNumber(row.key)"
            v-model="drafts[row.key]"
            :step="1"
            style="width: 160px"
          />
          <el-input v-else v-model="drafts[row.key]" style="width: 220px" />

          <el-button
            type="primary"
            plain
            :disabled="!changed(row)"
            :loading="savingKey === row.key"
            @click="saveRow(row)"
          >
            保存
          </el-button>
        </div>
      </div>
    </div>

    <EmptyState v-else title="暂无系统设置" description="请检查数据库 settings 集合" />
  </div>
</template>

<style scoped>
.manager-head {
  margin-bottom: 16px;
}

.manager-head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-1);
}

.manager-head h3 span {
  margin-left: 8px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-3);
}

.manager-head p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--text-3);
}

.setting-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 13px 16px;
  border-radius: 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  flex-wrap: wrap;
}

.setting-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 200px;
}

.setting-meta strong {
  font-size: 13px;
  color: var(--text-1);
}

.setting-meta code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-3);
}

.setting-meta small {
  font-size: 10px;
  color: var(--text-3);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
