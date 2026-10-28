<!-- 我的申请：状态筛选、借用时间线与归还流程 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate } from '@/utils/date'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { cancelBooking, confirmPickup, getMyBookings, returnBooking } from '@/api/student/bookings'
import { useNotificationStore } from '@/stores/Notification'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ApplyDetailDrawer from './components/ApplyDetailDrawer.vue'
import BookingExtendDialog from './components/BookingExtendDialog.vue'
import BookingReviewDialog from './components/BookingReviewDialog.vue'

const router = useRouter()
const notificationStore = useNotificationStore()

const loading = ref(true)
const records = ref([])
const keyword = ref('')
const activeTab = ref('all')
const page = ref(1)
const pageSize = 8

const detailVisible = ref(false)
const currentRecord = ref(null)
const returning = ref(false)
const pickupLoadingId = ref(null)

const extendVisible = ref(false)
const extendRecord = ref(null)

const reviewVisible = ref(false)
const reviewRecord = ref(null)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '在借' },
  { key: 'returning', label: '归还中' },
  { key: 'returned', label: '已归还' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'cancelled', label: '已取消' }
]

const today = (() => {
  const now = new Date()
  const pad = num => String(num).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
})()

const filtered = computed(() => {
  const kw = keyword.value.trim()

  return records.value.filter(item => {
    const matchTab = activeTab.value === 'all' || item.status === activeTab.value
    const matchKeyword =
      !kw ||
      (item.device_name || '').includes(kw) ||
      (item.category || '').includes(kw)
    return matchTab && matchKeyword
  })
})

const counts = computed(() => {
  const result = { all: records.value.length }
  tabs.forEach(tab => {
    if (tab.key !== 'all') {
      result[tab.key] = records.value.filter(item => item.status === tab.key).length
    }
  })
  return result
})

const summary = computed(() => [
  {
    key: 'all',
    label: '全部申请',
    value: counts.value.all || 0,
    tone: 'primary',
    hint: '累计提交记录'
  },
  {
    key: 'pending',
    label: '待审核',
    value: counts.value.pending || 0,
    tone: 'amber',
    hint: '等待管理员处理'
  },
  {
    key: 'approved',
    label: '在借设备',
    value: counts.value.approved || 0,
    tone: 'green',
    hint: '使用中，请按时归还'
  },
  {
    key: 'returned',
    label: '已完成',
    value: counts.value.returned || 0,
    tone: 'cyan',
    hint: '已归还并确认'
  }
])

const paged = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})

function switchTab(key) {
  activeTab.value = key
  page.value = 1
}

function handleSearch() {
  page.value = 1
}

function openDetail(row) {
  currentRecord.value = row
  detailVisible.value = true
}

function canCancel(row) {
  return row.status === 'pending'
}

function canReview(row) {
  return row.status === 'returned' && !Number(row.review_rating)
}

function isReviewed(row) {
  return Number(row.review_rating) > 0
}

function displayStatus(row) {
  return row.status === 'approved' && row.borrow_end < today ? 'overdue' : row.status
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm(
      `确定取消「${row.device_name}」的借用申请吗？取消后需要重新提交。`,
      '取消申请',
      { confirmButtonText: '确认取消', cancelButtonText: '再想想', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    const res = await cancelBooking(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '取消失败')
      return
    }
    ElMessage.success('申请已取消')
    detailVisible.value = false
    await loadRecords()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '取消失败')
  }
}

async function handlePickup(row) {
  try {
    await ElMessageBox.confirm(
      `请确认已凭取件码 ${row.pickup_code || '—'} 领取「${row.device_name}」。`,
      '确认取件',
      { confirmButtonText: '已取件', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return
  }

  pickupLoadingId.value = row.id
  try {
    const res = await confirmPickup(row.id, row.pickup_code)
    if (res.code !== 200) {
      ElMessage.error(res.message || '取件确认失败')
      return
    }
    ElMessage.success('取件成功，开始计算借用周期')
    await loadRecords()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '取件确认失败')
  } finally {
    pickupLoadingId.value = null
  }
}

function openExtend(row) {
  extendRecord.value = row
  extendVisible.value = true
}

function openReview(row) {
  reviewRecord.value = row
  reviewVisible.value = true
}

function handleDialogSuccess() {
  return loadRecords()
}

async function loadRecords() {
  loading.value = true
  try {
    const res = await getMyBookings({ page: 1, pageSize: 1000 })
    records.value = res.data?.list || []

    if (currentRecord.value) {
      const next = records.value.find(item => item.id === currentRecord.value.id)
      if (next) currentRecord.value = next
    }
  } catch {
    ElMessage.error('申请记录加载失败，请稍后重试')
    records.value = []
  } finally {
    loading.value = false
  }
}

async function handleReturn(row) {
  if (returning.value) return
  returning.value = true

  try {
    const res = await returnBooking(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '归还申请提交失败')
      return
    }

    ElMessage.success('归还申请已提交，等待管理员确认')
    notificationStore.push({
      type: 'warn',
      title: '归还申请已提交',
      content: `「${row.device_name}」的归还申请已提交，等待管理员确认后完成闭环。`
    })
    detailVisible.value = false
    await loadRecords()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '归还申请提交失败')
  } finally {
    returning.value = false
  }
}

onMounted(loadRecords)
</script>

<template>
  <div class="page-shell">
    <PageHeader
      eyebrow="MY APPLICATIONS"
      title="我的申请"
      description="查看借用进度、审核结果并提交归还申请"
    >
      <template #actions>
        <el-button type="primary" @click="router.push('/devices')">
          去借新设备
        </el-button>
      </template>
    </PageHeader>

    <section class="summary-grid stagger">
      <button
        v-for="item in summary"
        :key="item.key"
        type="button"
        class="summary-card card"
        :class="[`tone-${item.tone}`, { active: activeTab === item.key }]"
        @click="switchTab(item.key)"
      >
        <span class="summary-label">{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <span class="summary-hint">{{ item.hint }}</span>
        <i class="summary-bar"></i>
      </button>
    </section>

    <div class="card card-pad">
      <div class="toolbar">
        <div class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="tab-chip"
            :class="{ active: activeTab === tab.key }"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
            <span class="tab-count">{{ counts[tab.key] || 0 }}</span>
          </button>
        </div>

        <el-input
          v-model="keyword"
          class="search-input"
          placeholder="搜索设备或分类"
          clearable
          :prefix-icon="Search"
          @input="handleSearch"
        />
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="6" />

      <template v-else-if="paged.length">
        <el-table :data="paged" class="record-table" @row-click="openDetail">
          <el-table-column label="设备" min-width="180">
            <template #default="{ row }">
              <div class="device-cell">
                <span class="device-initial">{{ (row.category || '设').slice(0, 1) }}</span>
                <div>
                  <strong>{{ row.device_name }}</strong>
                  <span>{{ row.category }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="借用时间" min-width="210">
            <template #default="{ row }">
              <span class="time-text">{{ row.borrow_start }} → {{ row.borrow_end }}</span>
            </template>
          </el-table-column>

          <el-table-column label="申请时间" width="120">
            <template #default="{ row }">
              <span class="muted">{{ formatDate(row.created_at) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <StatusPill :status="displayStatus(row)" size="sm" />
            </template>
          </el-table-column>

          <el-table-column label="操作" width="130" align="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  v-if="canCancel(row)"
                  size="small"
                  type="danger"
                  plain
                  @click.stop="handleCancel(row)"
                >
                  取消
                </el-button>
                <el-button
                  v-else-if="row.status === 'approved'"
                  size="small"
                  type="primary"
                  plain
                  @click.stop="handleReturn(row)"
                >
                  归还
                </el-button>
                <el-button
                  v-else-if="canReview(row)"
                  size="small"
                  type="primary"
                  plain
                  @click.stop="openReview(row)"
                >
                  评价
                </el-button>
                <span v-else-if="isReviewed(row)" class="muted small">已评价</span>
                <span v-else class="muted small">—</span>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-if="filtered.length > pageSize"
          v-model:current-page="page"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="filtered.length"
        />
      </template>

      <EmptyState
        v-else
        :title="records.length ? '没有符合条件的申请' : '还没有借用记录'"
        :description="records.length ? '换个筛选条件，或去设备大厅申请一台设备' : '去设备大厅挑选一台设备，开启第一次实验'"
        action-text="去设备大厅"
        @action="router.push('/devices')"
      />
    </div>

    <ApplyDetailDrawer
      v-model="detailVisible"
      :record="currentRecord"
      :returning="returning"
      :pickup-loading-id="pickupLoadingId"
      @cancel="handleCancel"
      @pickup="handlePickup"
      @extend="openExtend"
      @return="handleReturn"
      @review="openReview"
    />

    <BookingExtendDialog
      v-model="extendVisible"
      :record="extendRecord"
      @success="handleDialogSuccess"
    />

    <BookingReviewDialog
      v-model="reviewVisible"
      :record="reviewRecord"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<style scoped src="./applyRecord.css"></style>
