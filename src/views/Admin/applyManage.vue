<!-- 管理端申请管理：批量审批、导出与归还确认 -->
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, MagicStick, Search } from '@element-plus/icons-vue'
import { getReviewSuggestion } from '@/api/ai'
import { auditBooking, auditExtension, getCancelledBookings, getExtensionPendingBookings, getPendingBookings, getRejectedBookings, getReturnedBookings, getReturningBookings, getReturnRejectedBookings, getUnreturnedBookings, returnAuditBooking } from '@/api/Admin/admin'
import StatusPill from '@/components/common/StatusPill.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ApplyStatsGrid from './components/ApplyStatsGrid.vue'
import ApplyReviewDrawer from './components/ApplyReviewDrawer.vue'
import RejectBookingDialog from './components/RejectBookingDialog.vue'
import RejectReturnDialog from './components/RejectReturnDialog.vue'
import { downloadCsv } from '@/utils/csv'
import { useDebounce } from '@/composables/useDebounce'

const loading = ref(true)
const loadError = ref(false)
const activeTab = ref('pending')
const keyword = ref('')
const page = ref(1)
const pageSize = 10
let requestSeq = 0

const rows = ref([])
const total = ref(0)
const counts = reactive({
  pending: 0,
  'extension-pending': 0,
  unreturned: 0,
  returning: 0,
  returned: 0,
  rejected: 0,
  cancelled: 0,
  'return-rejected': 0
})

const FETCHERS = {
  pending: getPendingBookings,
  'extension-pending': getExtensionPendingBookings,
  unreturned: getUnreturnedBookings,
  returning: getReturningBookings,
  returned: getReturnedBookings,
  rejected: getRejectedBookings,
  cancelled: getCancelledBookings,
  'return-rejected': getReturnRejectedBookings
}

const tabs = [
  { key: 'pending', label: '待审核' },
  { key: 'extension-pending', label: '续借审核' },
  { key: 'unreturned', label: '在借未还' },
  { key: 'returning', label: '归还中' },
  { key: 'returned', label: '已归还' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'cancelled', label: '已取消' },
  { key: 'return-rejected', label: '归还被拒' }
]

const statusMap = {
  pending: { text: '待审核', tone: 'warning' },
  'extension-pending': { text: '续借待审', tone: 'violet' },
  unreturned: { text: '在借', tone: 'success' },
  returning: { text: '归还中', tone: 'primary' },
  returned: { text: '已归还', tone: 'info' },
  rejected: { text: '已拒绝', tone: 'danger' },
  cancelled: { text: '已取消', tone: 'info' },
  'return-rejected': { text: '归还被拒', tone: 'danger' }
}

const detailVisible = ref(false)
const currentRow = ref(null)
const handlingId = ref(null)
const selection = ref([])
const batchLoading = ref(false)
const exporting = ref(false)

const reviewLoading = ref(false)
const reviewResult = ref(null)
const reviewBookingId = ref(null)

const rejectVisible = ref(false)
const rejectRow = ref(null)

const returnRejectVisible = ref(false)
const returnRejectRow = ref(null)

const paged = computed(() => rows.value)

function tabCount(key) {
  return counts[key] || 0
}

function todayKey() {
  const now = new Date()
  const pad = num => String(num).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function rowStatus(row) {
  if (!row) return activeTab.value
  if (row.status === 'approved' && row.extension_status === 'pending') return 'extension-pending'
  if (row.status === 'approved' && row.borrow_end < todayKey()) return 'overdue'
  return row.status || activeTab.value
}

function switchTab(key) {
  if (key === activeTab.value) return
  activeTab.value = key
  page.value = 1
  keyword.value = ''
  selection.value = []
  loadList()
}

function openDetail(row) {
  currentRow.value = row
  detailVisible.value = true
  reviewResult.value = null
  reviewBookingId.value = null
}

async function generateReview(row = currentRow.value) {
  if (!row || reviewLoading.value) return

  reviewLoading.value = true
  reviewResult.value = null
  reviewBookingId.value = row.id

  try {
    const res = await getReviewSuggestion(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || 'AI 审批建议生成失败')
      return
    }
    reviewResult.value = res.data
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || 'AI 审批建议生成失败')
  } finally {
    reviewLoading.value = false
  }
}

function openReview(row) {
  openDetail(row)
  generateReview(row)
}

/** 各状态计数：只取 total，避免把每个状态的全量数据都拉到前端 */
async function loadCounts() {
  const entries = Object.entries(FETCHERS)
  const results = await Promise.allSettled(
    entries.map(([, fetcher]) => fetcher({ page: 1, pageSize: 1 }))
  )
  results.forEach((item, index) => {
    const key = entries[index][0]
    if (item.status === 'fulfilled' && item.value.code === 200) {
      counts[key] = Number(item.value.data?.total || 0)
    }
  })
}

/** 当前状态列表：服务端分页 + 服务端关键词搜索 */
async function loadList() {
  const seq = ++requestSeq
  loading.value = true
  loadError.value = false
  try {
    const fetcher = FETCHERS[activeTab.value]
    const res = await fetcher({
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || undefined
    })
    if (seq !== requestSeq) return
    if (res.code !== 200) throw new Error(res.message || '加载失败')

    const list = res.data?.list || []
    const totalCount = Number(res.data?.total || 0)
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize))

    if (!list.length && totalCount > 0 && page.value > lastPage) {
      page.value = lastPage
      return loadList()
    }

    rows.value = list
    total.value = totalCount
  } catch {
    if (seq !== requestSeq) return
    loadError.value = true
    rows.value = []
    total.value = 0
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadAll() {
  loading.value = true
  await Promise.all([loadCounts(), loadList()])
}

async function approve(row) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${row.user_name}」对「${row.device_name}」的借用申请？`,
      '审批确认',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  handlingId.value = row.id
  try {
    const res = await auditBooking(row.id, { action: 'approve' })
    if (res.code !== 200) {
      ElMessage.error(res.message || '审批失败')
      return
    }
    ElMessage.success('已通过该申请')
    detailVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '审批失败')
  } finally {
    handlingId.value = null
  }
}

async function batchApprove() {
  if (!selection.value.length) return

  try {
    await ElMessageBox.confirm(
      `确认批量通过选中的 ${selection.value.length} 条申请吗？`,
      '批量审批',
      { confirmButtonText: '全部通过', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  batchLoading.value = true
  const pending = [...selection.value]
  try {
    // 逐条串行审批，单条失败不影响后续；结束统一刷新，避免重复提交同一批
    const results = []
    for (const row of pending) {
      try {
        const res = await auditBooking(row.id, { action: 'approve' })
        results.push(res.code === 200 ? null : res.message || `#${row.id} 审批失败`)
      } catch (error) {
        results.push(error?.response?.data?.message || `#${row.id} 审批失败`)
      }
    }

    const failed = results.filter(Boolean)
    const success = pending.length - failed.length
    selection.value = []
    await loadAll()

    if (failed.length) {
      ElMessage.warning(`已通过 ${success} 条，${failed.length} 条失败：${failed[0]}`)
    } else {
      ElMessage.success(`已通过 ${success} 条申请`)
    }
  } finally {
    batchLoading.value = false
  }
}

function openReject(row) {
  rejectRow.value = row
  rejectVisible.value = true
}

async function approveExtension(row) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${row.user_name}」对「${row.device_name}」的续借申请？归还日期将延长至 ${row.requested_end}。`,
      '续借审核',
      { confirmButtonText: '通过续借', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  handlingId.value = row.id
  try {
    const res = await auditExtension(row.id, { action: 'approve' })
    if (res.code !== 200) {
      ElMessage.error(res.message || '续借审核失败')
      return
    }
    ElMessage.success('续借申请已通过')
    detailVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '续借审核失败')
  } finally {
    handlingId.value = null
  }
}

async function rejectExtension(row) {
  let reason
  try {
    const result = await ElMessageBox.prompt(
      `请填写拒绝「${row.user_name}」续借申请的原因`,
      '拒绝续借',
      {
        confirmButtonText: '确认拒绝',
        cancelButtonText: '取消',
        inputPlaceholder: '例如：后续时段已被预约',
        inputValidator: value => Boolean(String(value || '').trim()) || '请填写原因'
      }
    )
    reason = result.value
  } catch {
    return
  }

  handlingId.value = row.id
  try {
    const res = await auditExtension(row.id, { action: 'reject', reason })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success('已拒绝续借申请')
    detailVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败')
  } finally {
    handlingId.value = null
  }
}

async function confirmReturn(row) {
  let code
  try {
    const result = await ElMessageBox.prompt(
      `确认「${row.user_name}」已归还「${row.device_name}」？归还码：${row.return_code || '—'}（可留空，输入则进行核验）`,
      '归还审核',
      {
        confirmButtonText: '确认归还',
        cancelButtonText: '取消',
        inputPlaceholder: '输入归还码进行核验（可留空）'
      }
    )
    code = String(result.value || '').trim()
  } catch {
    return
  }

  handlingId.value = row.id
  try {
    const res = await returnAuditBooking(row.id, {
      action: 'approve',
      ...(code ? { code } : {})
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '归还审核失败')
      return
    }
    ElMessage.success('归还审核通过，库存已回补')
    detailVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '归还审核失败')
  } finally {
    handlingId.value = null
  }
}

function openReturnReject(row) {
  returnRejectRow.value = row
  returnRejectVisible.value = true
}

function handleReviewed() {
  detailVisible.value = false
  rejectVisible.value = false
  returnRejectVisible.value = false
  return loadAll()
}

function handleSelectionChange(rows) {
  selection.value = rows
}

function handleCellClick(row, column) {
  if (column.type === 'selection') return
  openDetail(row)
}

async function handleExport() {
  if (!total.value) {
    ElMessage.warning('当前分类下没有可导出的数据')
    return
  }

  exporting.value = true
  try {
    // 导出当前分类 + 当前关键词的全量数据，而不是仅导出当前页
    const res = await FETCHERS[activeTab.value]({
      page: 1,
      pageSize: 2000,
      keyword: keyword.value.trim() || undefined
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '导出失败')
      return
    }

    const list = res.data?.list || []
    const header = ['申请编号', '设备', '分类', '申请人', '借用开始', '借用结束', '申请时间', '状态', '取件码', '归还码', '用途']
    const exportRows = list.map(item => [
      item.id,
      item.device_name,
      item.category,
      item.user_name,
      item.borrow_start,
      item.borrow_end,
      item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '',
      statusMap[rowStatus(item)]?.text || rowStatus(item),
      item.pickup_code || '',
      item.return_code || '',
      item.purpose || ''
    ])

    downloadCsv(
      `申请记录_${activeTab.value}_${new Date().toISOString().slice(0, 10)}.csv`,
      header,
      exportRows
    )
    ElMessage.success(`已导出 ${exportRows.length} 条记录`)
  } catch {
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

const debouncedSearch = useDebounce(() => {
  page.value = 1
  loadList()
}, 300)

function handleSearchNow() {
  debouncedSearch.cancel()
  page.value = 1
  loadList()
}

const listCard = ref(null)

function handlePageChange(value) {
  page.value = value
  loadList()
  listCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(loadAll)
</script>

<template>
  <div class="page-shell">
    <ApplyStatsGrid :counts="counts" :active-tab="activeTab" @select="switchTab" />

    <div ref="listCard" class="card card-pad">
      <div class="toolbar">
        <div class="tabs" role="tablist" aria-label="申请状态">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="tab-chip"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :class="{ active: activeTab === tab.key }"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
            <span class="tab-count">{{ tabCount(tab.key) }}</span>
          </button>
        </div>

        <div class="toolbar-right">
          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索设备 / 申请人 / 分类"
            clearable
            :prefix-icon="Search"
            aria-label="搜索申请"
            @input="debouncedSearch"
            @keyup.enter="handleSearchNow"
            @clear="handleSearchNow"
          />
          <el-button :loading="exporting" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </div>

      <div v-if="activeTab === 'pending' && selection.length" class="batch-bar">
        <span>已选择 <b>{{ selection.length }}</b> 条申请</span>
        <el-button type="primary" size="small" :loading="batchLoading" @click="batchApprove">
          批量通过
        </el-button>
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="7" />

      <EmptyState
        v-else-if="loadError"
        tone="error"
        title="申请列表加载失败"
        description="网络或服务暂不可用，请检查后重试"
        action-text="重新加载"
        @action="loadAll"
      />

      <template v-else-if="paged.length">
        <el-table :data="paged" @cell-click="handleCellClick" @selection-change="handleSelectionChange">
          <el-table-column v-if="activeTab === 'pending'" type="selection" width="44" />

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

          <el-table-column label="申请人" width="130">
            <template #default="{ row }">
              <div class="user-cell">
                <span class="mini-avatar">{{ (row.user_name || '?').slice(0, 1) }}</span>
                {{ row.user_name }}
              </div>
            </template>
          </el-table-column>

          <el-table-column label="借用时间" min-width="210">
            <template #default="{ row }">
              <div class="time-cell">
                <span class="time-text">{{ row.borrow_start }} → {{ row.borrow_end }}</span>
                <small v-if="row.requested_end" class="ext-request">
                  续借至 {{ row.requested_end }}
                </small>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="申请时间" width="115">
            <template #default="{ row }">
              <span class="muted">{{ row.created_at ? new Date(row.created_at).toLocaleDateString('zh-CN') : '—' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <StatusPill :status="rowStatus(row)" size="sm" />
            </template>
          </el-table-column>

          <el-table-column label="操作" width="260" align="right">
            <template #default="{ row }">
              <template v-if="activeTab === 'extension-pending'">
                <el-button
                  type="success"
                  size="small"
                  :loading="handlingId === row.id"
                  @click.stop="approveExtension(row)"
                >
                  通过
                </el-button>
                <el-button type="danger" size="small" plain @click.stop="rejectExtension(row)">
                  拒绝
                </el-button>
              </template>

              <template v-else-if="activeTab === 'pending'">
                <el-button
                  type="warning"
                  size="small"
                  plain
                  @click.stop="openReview(row)"
                >
                  <el-icon><MagicStick /></el-icon>
                  AI
                </el-button>
                <el-button
                  type="primary"
                  size="small"
                  :loading="handlingId === row.id"
                  @click.stop="approve(row)"
                >
                  通过
                </el-button>
                <el-button type="danger" size="small" plain @click.stop="openReject(row)">
                  拒绝
                </el-button>
              </template>

              <template v-else-if="activeTab === 'returning'">
                <el-button
                  type="success"
                  size="small"
                  :loading="handlingId === row.id"
                  @click.stop="confirmReturn(row)"
                >
                  确认归还
                </el-button>
                <el-button type="danger" size="small" plain @click.stop="openReturnReject(row)">
                  拒绝
                </el-button>
              </template>

              <template v-else-if="activeTab === 'return-rejected'">
                <el-button size="small" plain @click.stop="openDetail(row)">查看原因</el-button>
              </template>

              <el-button v-else size="small" plain @click.stop="openDetail(row)">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-if="total > pageSize"
          v-model:current-page="page"
          background
          layout="prev, pager, next"
          :pager-count="5"
          :page-size="pageSize"
          :total="total"
          @current-change="handlePageChange"
        />
      </template>

      <EmptyState
        v-else
        :title="keyword.trim() ? '没有匹配的申请' : '当前分类暂无申请'"
        :description="keyword.trim() ? '换个关键词，或清空搜索查看全部记录' : '切换上方标签查看其他状态，或等待学生提交新的借用申请'"
        :action-text="keyword.trim() ? '清空搜索' : ''"
        @action="keyword = ''; handleSearchNow()"
      />
    </div>

    <ApplyReviewDrawer
      v-model="detailVisible"
      :row="currentRow"
      :status="activeTab"
      :review-loading="reviewLoading"
      :review-result="reviewResult"
      :review-booking-id="reviewBookingId"
      @approve="approve"
      @reject="openReject"
      @approve-extension="approveExtension"
      @reject-extension="rejectExtension"
      @confirm-return="confirmReturn"
      @return-reject="openReturnReject"
      @generate-review="generateReview"
    />

    <RejectBookingDialog v-model="rejectVisible" :row="rejectRow" @rejected="handleReviewed" />
    <RejectReturnDialog v-model="returnRejectVisible" :row="returnRejectRow" @rejected="handleReviewed" />
  </div>
</template>

<style scoped src="./applyManage.css"></style>
