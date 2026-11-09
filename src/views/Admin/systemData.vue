<!-- 管理端系统数据：数据表规模与审计日志 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { getAuditLogs, getDatabaseStats } from '@/api/workspace'
import { useDebounce } from '@/composables/useDebounce'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const loading = ref(true)
const dbLoading = ref(true)
const dbError = ref('')
const logError = ref('')
const db = ref({ schemaVersion: 0, tables: [], total: 0 })
const logs = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
const keyword = ref('')
const action = ref('all')
let requestSeq = 0

const hasFilter = computed(() => Boolean(keyword.value.trim()) || action.value !== 'all')

const actions = [
  { key: 'all', label: '全部操作' },
  { key: 'booking.approve', label: '审批通过' },
  { key: 'booking.reject', label: '审批拒绝' },
  { key: 'return.approve', label: '归还核验' },
  { key: 'extension.approve', label: '续借通过' },
  { key: 'maintenance.start', label: '开始维修' },
  { key: 'maintenance.finish', label: '完成维修' },
  { key: 'device.create', label: '设备上架' },
  { key: 'device.offline', label: '设备下架' }
]

const actionLabels = {
  'booking.approve': '审批通过',
  'booking.reject': '审批拒绝',
  'return.approve': '归还核验',
  'return.reject': '归还拒绝',
  'extension.approve': '续借通过',
  'extension.reject': '续借拒绝',
  'maintenance.start': '开始维修',
  'maintenance.finish': '完成维修',
  'maintenance.reject': '驳回维修',
  'device.maintenance.start': '设备维护',
  'device.maintenance.finish': '结束维护',
  'device.create': '设备上架',
  'device.update': '设备编辑',
  'device.offline': '设备下架',
  'user.blacklist.add': '加入黑名单',
  'user.blacklist.remove': '解除黑名单'
}

const maxCount = computed(() =>
  Math.max(1, ...db.value.tables.map(item => Number(item.count) || 0))
)

function formatTime(input) {
  if (!input) return '-'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function actionLabel(value) {
  return actionLabels[value] || value
}

async function loadDb() {
  dbLoading.value = true
  dbError.value = ''
  try {
    const res = await getDatabaseStats()
    if (res.code === 200) {
      db.value = res.data
    } else {
      dbError.value = res.message || '数据表信息加载失败'
    }
  } catch (error) {
    dbError.value = error?.response?.data?.message || '数据表信息加载失败'
  } finally {
    dbLoading.value = false
  }
}

async function loadLogs() {
  const seq = ++requestSeq
  loading.value = true
  logError.value = ''
  try {
    const res = await getAuditLogs({
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      action: action.value
    })
    if (seq !== requestSeq) return

    logs.value = res.data?.list || []
    total.value = res.data?.total || 0

    // 删除/筛选后当前页可能越界，自动回到最后一页
    if (!logs.value.length && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize))
      loadLogs()
    }
  } catch (error) {
    if (seq !== requestSeq) return
    logs.value = []
    total.value = 0
    logError.value = error?.response?.data?.message || '审计日志加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function search() {
  page.value = 1
  loadLogs()
}

const debouncedSearch = useDebounce(search, 320)

function reset() {
  keyword.value = ''
  action.value = 'all'
  page.value = 1
  loadLogs()
}

function changePage(value) {
  page.value = value
  loadLogs()
}

onMounted(() => {
  loadDb()
  loadLogs()
})
</script>

<template>
  <div class="page-shell">
    <section class="device-stats stagger">
      <div class="d-stat card">
        <span>数据表</span>
        <strong>{{ db.tables.length }}</strong>
        <small>业务数据集合</small>
      </div>
      <div class="d-stat card tone-green">
        <span>总记录数</span>
        <strong>{{ db.total }}</strong>
        <small>含历史演示数据</small>
      </div>
      <div class="d-stat card tone-amber">
        <span>数据结构版本</span>
        <strong>v{{ db.schemaVersion }}</strong>
        <small>自动迁移补齐</small>
      </div>
      <div class="d-stat card tone-gray">
        <span>审计日志</span>
        <strong>{{ total }}</strong>
        <small>管理员操作留痕</small>
      </div>
    </section>

    <div class="card card-pad db-card">
      <div class="card-head">
        <h3>数据表规模<span class="sub">按记录数排序</span></h3>
      </div>

      <AppSkeleton v-if="dbLoading" type="list" :rows="4" />

      <EmptyState
        v-else-if="dbError"
        tone="error"
        compact
        title="数据表信息加载失败"
        :description="dbError"
        action-text="重新加载"
        @action="loadDb"
      />

      <div v-else-if="db.tables.length" class="table-grid">
        <div v-for="table in db.tables" :key="table.key" class="table-item">
          <div class="table-copy">
            <strong>{{ table.label }}</strong>
            <small>{{ table.key }}</small>
          </div>
          <span class="table-count">{{ table.count }}</span>
          <div class="table-bar">
            <i :style="{ width: `${Math.max(3, (table.count / maxCount) * 100)}%` }"></i>
          </div>
        </div>
      </div>

      <EmptyState v-else compact title="暂无数据表信息" description="初始化数据库后会自动统计各集合规模" />
    </div>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索操作人、对象或详情"
        aria-label="搜索审计日志"
        clearable
        :prefix-icon="Search"
        @input="debouncedSearch"
        @keyup.enter="search"
        @clear="search"
      />
      <el-select
        v-model="action"
        placeholder="全部操作"
        aria-label="按操作类型筛选"
        class="select"
        @change="search"
      >
        <el-option v-for="item in actions" :key="item.key" :label="item.label" :value="item.key" />
      </el-select>
      <div class="filter-actions">
        <el-button @click="reset">重置</el-button>
      </div>
    </div>

    <div class="card card-pad">
      <div class="card-head">
        <h3>操作审计<span class="sub">共 {{ total }} 条</span></h3>
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="6" />

      <EmptyState
        v-else-if="logError"
        tone="error"
        title="审计日志加载失败"
        :description="logError"
        action-text="重新加载"
        @action="loadLogs"
      />

      <template v-else-if="logs.length">
        <el-table :data="logs">
          <el-table-column label="操作" width="130">
            <template #default="{ row }">
              <span class="action-tag">{{ actionLabel(row.action) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作人" width="120">
            <template #default="{ row }">
              <div class="actor-cell">
                <span class="actor-initial">{{ (row.actor_name || '?').slice(0, 1) }}</span>
                {{ row.actor_name }}
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="target_name" label="操作对象" min-width="190" show-overflow-tooltip />
          <el-table-column label="详情" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="muted">{{ row.detail || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="IP" width="130">
            <template #default="{ row }">
              <span class="muted mono">{{ row.ip || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              <span class="muted mono">{{ formatTime(row.created_at) }}</span>
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
          @current-change="changePage"
        />
      </template>

      <EmptyState
        v-else-if="hasFilter"
        title="没有匹配的审计记录"
        description="换个关键词，或清空筛选条件后再试"
        action-text="清空筛选"
        @action="reset"
      />

      <EmptyState
        v-else
        title="暂无审计记录"
        description="管理员审批、维护、设备上下架与黑名单操作会自动记录"
        action-text="刷新"
        @action="loadLogs"
      />
    </div>
  </div>
</template>

<style scoped>
.db-card {
  margin-bottom: 18px;
}

.device-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.d-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 18px;
}

.d-stat > span {
  font-size: 11.5px;
  color: var(--text-3);
}

.d-stat strong {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.d-stat small {
  font-size: 10.5px;
  color: var(--text-3);
}

.d-stat.tone-green strong {
  color: var(--green);
}

.d-stat.tone-amber strong {
  color: var(--amber);
}

.d-stat.tone-gray strong {
  color: var(--text-3);
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.table-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  padding: 11px 13px;
  border-radius: 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
}

.table-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
}

.table-copy strong {
  font-size: 12.5px;
  color: var(--text-1);
}

.table-copy small {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--font-mono);
}

.table-count {
  font-size: 15px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

.table-bar {
  grid-column: 1 / -1;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-3) 12%, transparent);
  overflow: hidden;
}

.table-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--primary), var(--lime));
}

.action-tag {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 7px;
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
}

.actor-cell {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-2);
}

.actor-initial {
  width: 24px;
  height: 24px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-soft);
}

.mono {
  font-family: var(--font-mono);
  font-size: 10.5px;
}

@media (max-width: 768px) {
  .table-grid {
    grid-template-columns: 1fr;
  }

  .device-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
