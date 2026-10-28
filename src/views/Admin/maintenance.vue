<!-- 管理端维护中心：报修处理、维修中设备与维护记录 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, Tools } from '@element-plus/icons-vue'
import { auditMaintenance, getMaintenanceList, setDeviceMaintenance } from '@/api/Admin/admin'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusPill from '@/components/common/StatusPill.vue'

const loading = ref(false)
const actionId = ref(null)
const keyword = ref('')
const status = ref('all')
const list = ref([])
const stats = ref({ pending: 0, processing: 0, doneToday: 0, repairing: 0 })
const repairingDevices = ref([])

const filters = [
  { key: 'all', label: '全部记录' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '维修中' },
  { key: 'done', label: '已修复' },
  { key: 'rejected', label: '已驳回' }
]

const statusLabels = {
  pending: '待处理',
  processing: '维修中',
  done: '已修复',
  rejected: '已驳回'
}

const activeFilter = computed(() => filters.find(item => item.key === status.value))

function formatTime(input) {
  if (!input) return '-'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function loadData() {
  loading.value = true
  try {
    const res = await getMaintenanceList({
      status: status.value,
      keyword: keyword.value.trim() || undefined
    })
    list.value = res.data?.list || []
    stats.value = res.data?.stats || { pending: 0, processing: 0, doneToday: 0, repairing: 0 }
    repairingDevices.value = res.data?.repairingDevices || []
  } catch {
    ElMessage.error('维护数据加载失败，请稍后重试')
    list.value = []
  } finally {
    loading.value = false
  }
}

function switchFilter(key) {
  status.value = key
  loadData()
}

function handleSearch() {
  loadData()
}

function handleReset() {
  keyword.value = ''
  status.value = 'all'
  loadData()
}

async function startRepair(row) {
  let note
  try {
    const result = await ElMessageBox.prompt(
      `确认开始维修「${row.device_name}」吗？开始后该设备将暂停新的借用申请。`,
      '开始维修',
      {
        confirmButtonText: '开始维修',
        cancelButtonText: '取消',
        inputPlaceholder: '维修备注（可选）',
        inputValue: ''
      }
    )
    note = result.value || ''
  } catch {
    return
  }

  actionId.value = row.id
  try {
    const res = await auditMaintenance(row.id, { action: 'start', note })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success('已开始维修，设备借用已暂停')
    await loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败，请稍后重试')
  } finally {
    actionId.value = null
  }
}

async function finishRepair(row) {
  let note
  try {
    const result = await ElMessageBox.prompt(
      `确认「${row.device_name}」已修复并恢复可借吗？`,
      '完成维修',
      {
        confirmButtonText: '完成维修',
        cancelButtonText: '取消',
        inputPlaceholder: '维修结果说明（可选）',
        inputValue: ''
      }
    )
    note = result.value || ''
  } catch {
    return
  }

  actionId.value = row.id
  try {
    const res = await auditMaintenance(row.id, { action: 'finish', note })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success('维护完成，设备已恢复可借')
    await loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败，请稍后重试')
  } finally {
    actionId.value = null
  }
}

async function rejectRepair(row) {
  let note
  try {
    const result = await ElMessageBox.prompt(
      `驳回「${row.device_name}」的报修，请填写核查结论。`,
      '驳回报修',
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '例如：经检查设备运行正常',
        inputValue: ''
      }
    )
    note = result.value || ''
  } catch {
    return
  }

  actionId.value = row.id
  try {
    const res = await auditMaintenance(row.id, { action: 'reject', note })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success('已驳回该报修')
    await loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败，请稍后重试')
  } finally {
    actionId.value = null
  }
}

async function finishDevice(device) {
  try {
    await ElMessageBox.confirm(
      `确认「${device.name}」维护完成并恢复可借吗？`,
      '结束维护',
      { confirmButtonText: '恢复可借', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  actionId.value = `device-${device.id}`
  try {
    const res = await setDeviceMaintenance(device.id, { action: 'finish' })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success('设备已恢复可借')
    await loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败，请稍后重试')
  } finally {
    actionId.value = null
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-shell">
    <section class="m-stats">
      <div class="m-stat card tone-amber">
        <span class="m-stat-icon"><el-icon><Tools /></el-icon></span>
        <div>
          <span>待处理报修</span>
          <strong>{{ stats.pending }}</strong>
          <small>等待管理员核查</small>
        </div>
      </div>
      <div class="m-stat card tone-copper">
        <span class="m-stat-icon"><el-icon><Tools /></el-icon></span>
        <div>
          <span>维修中设备</span>
          <strong>{{ stats.repairing }}</strong>
          <small>借用申请已暂停</small>
        </div>
      </div>
      <div class="m-stat card tone-green">
        <span class="m-stat-icon"><el-icon><Tools /></el-icon></span>
        <div>
          <span>今日完成</span>
          <strong>{{ stats.doneToday }}</strong>
          <small>维护并恢复可借</small>
        </div>
      </div>
      <div class="m-stat card tone-gray">
        <span class="m-stat-icon"><el-icon><Tools /></el-icon></span>
        <div>
          <span>待维修记录</span>
          <strong>{{ stats.processing }}</strong>
          <small>维修进行中的工单</small>
        </div>
      </div>
    </section>

    <section v-if="repairingDevices.length" class="repairing-strip card">
      <div class="strip-head">
        <strong>当前维护中的设备</strong>
        <span>共 {{ repairingDevices.length }} 台，恢复前不可借用</span>
      </div>
      <div class="strip-list">
        <div v-for="device in repairingDevices" :key="device.id" class="strip-item">
          <span class="strip-dot"></span>
          <div class="strip-copy">
            <strong>{{ device.name }}</strong>
            <small>{{ device.maintenance_reason || '设备检修' }} · {{ device.location || '实验室' }}</small>
          </div>
          <el-button
            size="small"
            type="primary"
            plain
            :loading="actionId === `device-${device.id}`"
            @click="finishDevice(device)"
          >
            结束维护
          </el-button>
        </div>
      </div>
    </section>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索设备、报修人或故障类型"
        clearable
        :prefix-icon="Search"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <div class="chip-row">
        <button
          v-for="item in filters"
          :key="item.key"
          type="button"
          class="tab-chip"
          :class="{ active: status === item.key }"
          @click="switchFilter(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="filter-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <div class="card card-pad">
      <div class="card-head">
        <h3>
          {{ activeFilter?.label || '全部记录' }}
          <span class="sub">共 {{ list.length }} 条</span>
        </h3>
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="6" />

      <template v-else-if="list.length">
        <el-table :data="list">
          <el-table-column label="设备" min-width="190">
            <template #default="{ row }">
              <div class="device-cell">
                <span class="device-initial">{{ (row.category || '设').slice(0, 1) }}</span>
                <div>
                  <strong>{{ row.device_name }}</strong>
                  <span>{{ row.category }} · 编号 #{{ row.device_id }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="报修人" width="120">
            <template #default="{ row }">
              <span class="muted">{{ row.user_name || '-' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="故障类型" min-width="170">
            <template #default="{ row }">
              <div class="reason-cell">
                <strong>{{ row.reason }}</strong>
                <span v-if="row.detail">{{ row.detail }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="提交时间" width="150">
            <template #default="{ row }">
              <span class="muted time">{{ formatTime(row.created_at) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <StatusPill :status="row.status" :label="statusLabels[row.status]" size="sm" />
            </template>
          </el-table-column>

          <el-table-column label="处理记录" min-width="170">
            <template #default="{ row }">
              <span class="muted note">
                {{ row.note || '—' }}
                <template v-if="row.handler_name">（{{ row.handler_name }}）</template>
              </span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="180" align="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button
                  size="small"
                  type="primary"
                  :loading="actionId === row.id"
                  @click="startRepair(row)"
                >
                  开始维修
                </el-button>
                <el-button size="small" text @click="rejectRepair(row)">驳回</el-button>
              </template>
              <el-button
                v-else-if="row.status === 'processing'"
                size="small"
                type="success"
                :loading="actionId === row.id"
                @click="finishRepair(row)"
              >
                完成维修
              </el-button>
              <span v-else class="muted">已结束</span>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <EmptyState
        v-else
        title="暂无报修记录"
        description="学生提交设备报修后，会出现在这里等待处理"
        action-text="刷新列表"
        @action="loadData"
      />
    </div>
  </div>
</template>

<style scoped src="./maintenance.css"></style>
